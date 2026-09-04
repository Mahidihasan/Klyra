import { Router } from 'express';
import { requireAuth } from './auth.service';
import { pool } from '../../services/database.service';
import { logActivity, handleError, loadRepoFor } from './repos.routes.core';

const router = Router();

// ============================ ISSUES ============================
router.get('/repos/:id/issues', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT i.*, u.username AS author_username,
              (SELECT COUNT(*)::int FROM kr_issue_comments c WHERE c.issue_id = i.id) AS comment_count
       FROM kr_issues i JOIN kr_users u ON u.id=i.author_id
       WHERE i.repo_id=$1
       ORDER BY i.status='closed', i.created_at DESC, i.number DESC`, [ctx.repo.id]);
    res.json(rows.rows);
  } catch (err) { handleError(res, err, 'Failed to list issues'); }
});

router.post('/repos/:id/issues', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read'); // any member can file issues
    if (!ctx) return;
    const { title, body } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const num = (await pool.query('SELECT COALESCE(MAX(number),0)+1 AS n FROM kr_issues WHERE repo_id=$1', [ctx.repo.id])).rows[0].n;
    const id = (await pool.query(
      `INSERT INTO kr_issues (repo_id, number, title, body, author_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [ctx.repo.id, num, title, body || '', ctx.user.id])).rows[0].id;
    await logActivity(ctx.repo.id, ctx.user.id, 'issue_created', { number: num, title });
    res.status(201).json({ id, number: num, title });
  } catch (err) { handleError(res, err, 'Failed to create issue'); }
});

router.get('/repos/:id/issues/:number', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const issue = (await pool.query(
      `SELECT i.*, u.username AS author_username FROM kr_issues i JOIN kr_users u ON u.id=i.author_id
       WHERE i.repo_id=$1 AND i.number=$2`, [ctx.repo.id, req.params.number])).rows[0];
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    const comments = await pool.query(
      `SELECT c.*, u.username AS author_username, u.avatar_color FROM kr_issue_comments c JOIN kr_users u ON u.id=c.author_id
       WHERE c.issue_id=$1 ORDER BY c.created_at`, [issue.id]);
    res.json({ ...issue, comments: comments.rows });
  } catch (err) { handleError(res, err, 'Failed to load issue'); }
});

router.post('/repos/:id/issues/:number/comments', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const { body } = req.body || {};
    const issue = (await pool.query('SELECT id FROM kr_issues WHERE repo_id=$1 AND number=$2', [ctx.repo.id, req.params.number])).rows[0];
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (!body) return res.status(400).json({ error: 'Comment body is required' });
    await pool.query('INSERT INTO kr_issue_comments (issue_id, author_id, body) VALUES ($1,$2,$3)', [issue.id, ctx.user.id, body]);
    await logActivity(ctx.repo.id, ctx.user.id, 'issue_comment', { issue_number: Number(req.params.number) });
    res.status(201).json({ ok: true });
  } catch (err) { handleError(res, err, 'Failed to add comment'); }
});

router.post('/repos/:id/issues/:number/status', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const { status } = req.body || {};
    if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open or closed' });
    const r = await pool.query(
      `UPDATE kr_issues SET status=$1, closed_at=${status === 'closed' ? 'NOW()' : 'NULL'}
       WHERE repo_id=$2 AND number=$3 RETURNING number`, [status, ctx.repo.id, req.params.number]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Issue not found' });
    await logActivity(ctx.repo.id, ctx.user.id, status === 'closed' ? 'issue_closed' : 'issue_reopened', { number: Number(req.params.number) });
    res.json({ ok: true });
  } catch (err) { handleError(res, err, 'Failed to update issue'); }
});

// ============================ COLLABORATORS ============================
router.get('/repos/:id/collaborators', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT c.user_id, c.role, c.created_at, u.username, u.display_name, u.avatar_color
       FROM kr_collaborators c JOIN kr_users u ON u.id = c.user_id
       WHERE c.repo_id=$1 ORDER BY CASE c.role WHEN 'owner' THEN 0 WHEN 'maintainer' THEN 1 WHEN 'developer' THEN 2 ELSE 3 END`,
      [ctx.repo.id]);
    res.json(rows.rows);
  } catch (err) { handleError(res, err, 'Failed to list collaborators'); }
});

// Add collaborator by username (owner or maintainer; owner role not assignable)
router.post('/repos/:id/collaborators', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'merge');
    if (!ctx) return;
    const { username, role } = req.body || {};
    if (!['maintainer', 'developer', 'reviewer'].includes(role)) {
      return res.status(400).json({ error: 'role must be maintainer, developer or reviewer' });
    }
    const user = (await pool.query('SELECT id FROM kr_users WHERE username=$1', [username])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = await pool.query('SELECT role FROM kr_collaborators WHERE repo_id=$1 AND user_id=$2', [ctx.repo.id, user.id]);
    if (existing.rows[0]?.role === 'owner') return res.status(400).json({ error: 'Cannot change the repository owner' });
    await pool.query(
      `INSERT INTO kr_collaborators (repo_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (repo_id, user_id) DO UPDATE SET role=$3`, [ctx.repo.id, user.id, role]);
    await logActivity(ctx.repo.id, ctx.user.id, 'collaborator_added', { username, role });
    res.status(201).json({ username, role });
  } catch (err) { handleError(res, err, 'Failed to add collaborator'); }
});

router.delete('/repos/:id/collaborators/:username', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'merge');
    if (!ctx) return;
    const user = (await pool.query('SELECT id FROM kr_users WHERE username=$1', [req.params.username])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = await pool.query('SELECT role FROM kr_collaborators WHERE repo_id=$1 AND user_id=$2', [ctx.repo.id, user.id]);
    if (existing.rows[0]?.role === 'owner') return res.status(400).json({ error: 'The repository owner cannot be removed' });
    await pool.query('DELETE FROM kr_collaborators WHERE repo_id=$1 AND user_id=$2', [ctx.repo.id, user.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'collaborator_removed', { username: req.params.username });
    res.status(204).send();
  } catch (err) { handleError(res, err, 'Failed to remove collaborator'); }
});

// ============================ ACTIVITY ============================
router.get('/repos/:id/activity', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT a.*, u.username AS actor_username, u.avatar_color AS actor_color
       FROM kr_activity a LEFT JOIN kr_users u ON u.id=a.actor_id
       WHERE a.repo_id=$1 ORDER BY a.created_at DESC LIMIT 100`, [ctx.repo.id]);
    res.json(rows.rows);
  } catch (err) { handleError(res, err, 'Failed to load activity'); }
});

export default router;
