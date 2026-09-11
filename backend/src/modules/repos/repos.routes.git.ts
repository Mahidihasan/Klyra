import { Router } from 'express';
import { requireAuth } from './auth.service';
import * as git from './git.service';
import { pool } from '../../services/database.service';
import { logActivity, handleError, loadRepoFor } from './repos.routes.core';

const router = Router();

// ============================ BRANCHES ============================
router.get('/repos/:id/branches', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const branchRows = await pool.query('SELECT name, protected, created_at FROM kr_branches WHERE repo_id=$1', [ctx.repo.id]);
    const protMap = new Map(branchRows.rows.map((r: any) => [r.name, r]));
    const refs = await git.listBranches(ctx.repo.id);
    const defaultBranch = ctx.repo.default_branch;
    const out = await Promise.all(refs.map(async r => {
      const meta = protMap.get(r.name);
      const ab = r.name === defaultBranch ? { ahead: 0, behind: 0 } : await git.aheadBehind(ctx.repo.id, r.name, defaultBranch);
      const latest = await git.latestCommit(ctx.repo.id, r.name);
      return { name: r.name, sha: r.sha, protected: meta?.protected ?? false, ahead: ab.ahead, behind: ab.behind, latest_commit: latest };
    }));
    res.json(out);
  } catch (err) { handleError(res, err, 'Failed to list branches'); }
});

router.post('/repos/:id/branches', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const { name, from } = req.body || {};
    if (!name || !/^[a-zA-Z0-9._/-]+$/.test(name)) return res.status(400).json({ error: 'A valid branch name is required' });
    if (name === ctx.repo.default_branch) return res.status(400).json({ error: 'Cannot recreate the default branch' });
    const source = from || ctx.repo.default_branch;
    if (!(await git.branchExists(ctx.repo.id, source))) return res.status(404).json({ error: `Source branch "${source}" not found` });
    if (await git.branchExists(ctx.repo.id, name)) return res.status(409).json({ error: 'Branch already exists' });
    await git.createBranchFrom(ctx.repo.id, name, source);
    await pool.query('INSERT INTO kr_branches (repo_id, name, protected, created_by) VALUES ($1,$2,FALSE,$3) ON CONFLICT DO NOTHING',
      [ctx.repo.id, name, ctx.user.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'branch_created', { name, from: source });
    res.status(201).json({ name, from: source });
  } catch (err) { handleError(res, err, 'Failed to create branch'); }
});

router.delete('/repos/:id/branches/:name', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const name = req.params.name;
    if (name === ctx.repo.default_branch) return res.status(400).json({ error: 'The default branch cannot be deleted' });
    const prot = await pool.query('SELECT protected FROM kr_branches WHERE repo_id=$1 AND name=$2', [ctx.repo.id, name]);
    if (prot.rows[0]?.protected) return res.status(403).json({ error: 'Protected branches cannot be deleted' });
    await git.deleteBranch(ctx.repo.id, name);
    await pool.query('DELETE FROM kr_branches WHERE repo_id=$1 AND name=$2', [ctx.repo.id, name]);
    await logActivity(ctx.repo.id, ctx.user.id, 'branch_deleted', { name });
    res.status(204).send();
  } catch (err) { handleError(res, err, 'Failed to delete branch'); }
});

// Toggle branch protection (owner only; default branch is always protected)
router.post('/repos/:id/branches/:name/protection', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'owner');
    if (!ctx) return;
    const name = req.params.name;
    if (name === ctx.repo.default_branch) return res.status(400).json({ error: 'The default branch is always protected' });
    const cur = await pool.query('SELECT protected FROM kr_branches WHERE repo_id=$1 AND name=$2', [ctx.repo.id, name]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Branch not found' });
    const next = !cur.rows[0].protected;
    await pool.query('UPDATE kr_branches SET protected=$1 WHERE repo_id=$2 AND name=$3', [next, ctx.repo.id, name]);
    res.json({ name, protected: next });
  } catch (err) { handleError(res, err, 'Failed to update protection'); }
});

// ============================ COMMITS / TREE / FILE / DIFF ============================
router.get('/repos/:id/commits', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const ref = await git.resolveRef(ctx.repo.id, String(req.query.ref || ctx.repo.default_branch));
    const limit = Math.min(parseInt(String(req.query.limit) || '30', 10) || 30, 100);
    const page = Math.max(parseInt(String(req.query.page) || '0', 10) || 0, 0);
    const pathFilter = req.query.path ? String(req.query.path) : undefined;
    const commits = pathFilter
      ? await git.fileCommitHistory(ctx.repo.id, ref, pathFilter)
      : await git.listCommits(ctx.repo.id, ref, limit, page * limit);
    res.json({ ref, commits, total: await git.commitCount(ctx.repo.id, ref) });
  } catch (err) { handleError(res, err, 'Failed to list commits (empty repository?)'); }
});

router.get('/repos/:id/commits/:sha', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const diff = await git.getCommitDiff(ctx.repo.id, req.params.sha);
    const lines = diff.split('\n');
    const meta = lines.slice(0, 4);
    res.json({ sha: meta[0], message: meta[1], author: meta[2], date: meta[3], patch: lines.slice(4).join('\n') });
  } catch (err) { handleError(res, err, 'Commit not found'); }
});

router.get('/repos/:id/tree', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const ref = await git.resolveRef(ctx.repo.id, String(req.query.ref || ctx.repo.default_branch));
    const dir = String(req.query.path || '');
    const recursive = req.query.recursive === '1';
    const entries = await git.listTree(ctx.repo.id, ref, dir, recursive);
    const latest = await git.latestCommit(ctx.repo.id, ref);
    res.json({ ref, path: dir, latest_commit: latest, entries });
  } catch (err) { handleError(res, err, 'Failed to list directory (empty repository?)'); }
});

router.get('/repos/:id/file', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const ref = await git.resolveRef(ctx.repo.id, String(req.query.ref || ctx.repo.default_branch));
    const filePath = String(req.query.path || '');
    if (!filePath || filePath.includes('..')) return res.status(400).json({ error: 'Invalid file path' });
    const content = await git.readFileAt(ctx.repo.id, ref, filePath);
    const history = await git.fileCommitHistory(ctx.repo.id, ref, filePath);
    res.json({ path: filePath, ref, content, history: history.slice(0, 20), latest_commit: history[0] || null });
  } catch (err) { handleError(res, err, 'File not found'); }
});

router.get('/repos/:id/diff', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) return res.status(400).json({ error: 'Both "from" and "to" refs are required' });
    const filePath = req.query.path ? String(req.query.path) : undefined;
    const patch = await git.getDiff(ctx.repo.id, from, to, filePath);
    const ab = await git.aheadBehind(ctx.repo.id, from, to);
    res.json({ from, to, ahead: ab.ahead, behind: ab.behind, patch });
  } catch (err) { handleError(res, err, 'Failed to compute diff'); }
});

router.get('/repos/:id/ahead-behind', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) return res.status(400).json({ error: 'Both "from" and "to" refs are required' });
    res.json(await git.aheadBehind(ctx.repo.id, from, to));
  } catch (err) { handleError(res, err, 'Failed to compute ahead/behind'); }
});

// ============================ TAGS ============================
router.get('/repos/:id/tags', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    res.json(await git.listTagRefs(ctx.repo.id));
  } catch (err) { handleError(res, err, 'Failed to list tags'); }
});

router.post('/repos/:id/tags', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const { name, ref, message } = req.body || {};
    if (!name || !ref) return res.status(400).json({ error: 'Tag name and ref are required' });
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) return res.status(400).json({ error: 'Invalid tag name' });
    if (!(await git.branchExists(ctx.repo.id, ref))) return res.status(404).json({ error: `Ref "${ref}" not found` });
    if ((await git.listTagRefs(ctx.repo.id)).some(t => t.name === name)) return res.status(409).json({ error: 'Tag already exists' });
    await git.createTag(ctx.repo.id, name, ref, message);
    const sha = (await git.listTagRefs(ctx.repo.id)).find(t => t.name === name)?.sha || null;
    await pool.query('INSERT INTO kr_tags (repo_id, name, commit_sha, message, created_by) VALUES ($1,$2,$3,$4,$5)',
      [ctx.repo.id, name, sha, message || '', ctx.user.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'tag_created', { name, ref });
    res.status(201).json({ name, ref, sha });
  } catch (err) { handleError(res, err, 'Failed to create tag'); }
});

export default router;
