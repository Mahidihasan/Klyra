import { Router } from 'express';
import { requireAuth } from './auth.service';
import * as git from './git.service';
import { pool } from '../../services/database.service';
import { logActivity, handleError, loadRepoFor } from './repos.routes.core';
import { scanDiffForSecrets } from './detect.service';

const router = Router();

// ============================ PULL REQUESTS ============================
router.get('/repos/:id/pulls', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT p.*, a.username AS author_username, m.username AS merged_by_username
       FROM kr_pull_requests p
       JOIN kr_users a ON a.id = p.author_id
       LEFT JOIN kr_users m ON m.id = p.merged_by
       WHERE p.repo_id=$1 ORDER BY p.number DESC`, [ctx.repo.id]);
    res.json(rows.rows);
  } catch (err) { handleError(res, err, 'Failed to list pull requests'); }
});

router.post('/repos/:id/pulls', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const { title, body, source, target, reviewers } = req.body || {};
    if (!title || !source || !target) return res.status(400).json({ error: 'Title, source and target branches are required' });
    if (source === target) return res.status(400).json({ error: 'Source and target branches must differ' });
    if (!(await git.branchExists(ctx.repo.id, source)) || !(await git.branchExists(ctx.repo.id, target))) {
      return res.status(404).json({ error: 'Source or target branch not found' });
    }
    const num = (await pool.query('SELECT COALESCE(MAX(number),0)+1 AS n FROM kr_pull_requests WHERE repo_id=$1', [ctx.repo.id])).rows[0].n;
    const id = (
      await pool.query(
        `INSERT INTO kr_pull_requests (repo_id, number, title, body, source_branch, target_branch, author_id, reviewers)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [ctx.repo.id, num, title, body || '', source, target, ctx.user.id, JSON.stringify(reviewers || [])]
      )
    ).rows[0].id;
    await logActivity(ctx.repo.id, ctx.user.id, 'pr_created', { number: num, title, source, target });
    res.status(201).json({ id, number: num, title, source_branch: source, target_branch: target });
  } catch (err) { handleError(res, err, 'Failed to open pull request'); }
});

router.get('/repos/:id/pulls/:number', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const pr = (await pool.query(
      `SELECT p.*, a.username AS author_username, a.display_name AS author_name, m.username AS merged_by_username
       FROM kr_pull_requests p
       JOIN kr_users a ON a.id = p.author_id
       LEFT JOIN kr_users m ON m.id = p.merged_by
       WHERE p.repo_id=$1 AND p.number=$2`, [ctx.repo.id, req.params.number])).rows[0];
    if (!pr) return res.status(404).json({ error: 'Pull request not found' });
    const [reviews, comments, ab, diff] = await Promise.all([
      pool.query(`SELECT r.*, u.username AS reviewer_username, u.display_name AS reviewer_name, u.avatar_color
                  FROM kr_pr_reviews r JOIN kr_users u ON u.id=r.reviewer_id WHERE r.pr_id=$1 ORDER BY r.created_at`, [pr.id]),
      pool.query(`SELECT c.*, u.username AS author_username, u.display_name AS author_name, u.avatar_color
                  FROM kr_pr_comments c JOIN kr_users u ON u.id=c.author_id WHERE c.pr_id=$1 ORDER BY c.created_at`, [pr.id]),
      git.aheadBehind(ctx.repo.id, pr.source_branch, pr.target_branch),
      git.getDiff(ctx.repo.id, pr.target_branch, pr.source_branch).catch(() => ''),
    ]);
    res.json({
      ...pr,
      reviews: reviews.rows,
      comments: comments.rows,
      ahead: ab.ahead,
      behind: ab.behind,
      diff,
      secret_findings: scanDiffForSecrets(diff),
    });
  } catch (err) { handleError(res, err, 'Failed to load pull request'); }
});

// Submit a review: approve / request changes / comment
router.post('/repos/:id/pulls/:number/reviews', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read'); // reviewers only need read
    if (!ctx) return;
    const { state, body } = req.body || {};
    if (!['approved', 'changes_requested', 'commented'].includes(state)) {
      return res.status(400).json({ error: 'state must be approved, changes_requested or commented' });
    }
    const pr = (await pool.query('SELECT id, author_id FROM kr_pull_requests WHERE repo_id=$1 AND number=$2', [ctx.repo.id, req.params.number])).rows[0];
    if (!pr) return res.status(404).json({ error: 'Pull request not found' });
    if (pr.author_id === ctx.user.id && state === 'approved') {
      return res.status(400).json({ error: 'You cannot approve your own pull request' });
    }
    await pool.query('INSERT INTO kr_pr_reviews (pr_id, reviewer_id, state, body) VALUES ($1,$2,$3,$4)', [pr.id, ctx.user.id, state, body || '']);
    await logActivity(ctx.repo.id, ctx.user.id, `pr_review_${state}`, { pr_number: Number(req.params.number) });
    res.status(201).json({ ok: true });
  } catch (err) { handleError(res, err, 'Failed to submit review'); }
});

router.post('/repos/:id/pulls/:number/comments', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ error: 'Comment body is required' });
    const pr = (await pool.query('SELECT id FROM kr_pull_requests WHERE repo_id=$1 AND number=$2', [ctx.repo.id, req.params.number])).rows[0];
    if (!pr) return res.status(404).json({ error: 'Pull request not found' });
    await pool.query('INSERT INTO kr_pr_comments (pr_id, author_id, body) VALUES ($1,$2,$3)', [pr.id, ctx.user.id, body]);
    await logActivity(ctx.repo.id, ctx.user.id, 'pr_comment', { pr_number: Number(req.params.number) });
    res.status(201).json({ ok: true });
  } catch (err) { handleError(res, err, 'Failed to add comment'); }
});

// Merge a PR — merge permission + at least one approval + secret scan clean
router.post('/repos/:id/pulls/:number/merge', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'merge');
    if (!ctx) return;
    const pr = (await pool.query('SELECT * FROM kr_pull_requests WHERE repo_id=$1 AND number=$2', [ctx.repo.id, req.params.number])).rows[0];
    if (!pr) return res.status(404).json({ error: 'Pull request not found' });
    if (pr.status !== 'open') return res.status(400).json({ error: `Pull request is already ${pr.status}` });

    const approvals = await pool.query(`SELECT COUNT(*)::int AS n FROM kr_pr_reviews WHERE pr_id=$1 AND state='approved'`, [pr.id]);
    const changes = await pool.query(`SELECT COUNT(*)::int AS n FROM kr_pr_reviews WHERE pr_id=$1 AND state='changes_requested'`, [pr.id]);
    if (approvals.rows[0].n < 1) return res.status(400).json({ error: 'Merge requires at least one approval' });
    if (changes.rows[0].n > 0) return res.status(400).json({ error: 'Merge blocked: changes requested by a reviewer' });

    // Secret scanning before merge
    const diff = await git.getDiff(ctx.repo.id, pr.target_branch, pr.source_branch).catch(() => '');
    const secrets = scanDiffForSecrets(diff);
    if (secrets.length > 0) {
      return res.status(422).json({ error: 'Merge blocked by secret scanning', secrets });
    }

    const merge = await git.mergeBranches(
      ctx.repo.id, pr.source_branch, pr.target_branch,
      `Merge pull request #${pr.number} from ${pr.source_branch}\n\n${pr.title}`,
      { name: ctx.user.display_name || ctx.user.username, email: `${ctx.user.username}@users.klyra.local` }
    );
    if (!merge.ok) return res.status(409).json({ error: 'Merge conflict — resolve manually on the branch', log: merge.log });

    await pool.query(`UPDATE kr_pull_requests SET status='merged', merged_by=$1, merged_at=NOW() WHERE id=$2`, [ctx.user.id, pr.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'pr_merged', { number: pr.number, title: pr.title });
    res.json({ ok: true, merge_sha: merge.sha, log: merge.log });
  } catch (err) { handleError(res, err, 'Merge failed'); }
});

router.post('/repos/:id/pulls/:number/close', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const r = await pool.query(`UPDATE kr_pull_requests SET status='closed' WHERE repo_id=$1 AND number=$2 AND status='open' RETURNING number`, [ctx.repo.id, req.params.number]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Open pull request not found' });
    await logActivity(ctx.repo.id, ctx.user.id, 'pr_closed', { number: Number(req.params.number) });
    res.json({ ok: true });
  } catch (err) { handleError(res, err, 'Failed to close pull request'); }
});

export default router;
