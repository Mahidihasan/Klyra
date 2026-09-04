import { Router } from 'express';
import { requireAuth } from './auth.service';
import * as git from './git.service';
import { pool } from '../../services/database.service';
import { logActivity, handleError, loadRepoFor } from './repos.routes.core';

const router = Router();

// ============================ TAGS & RELEASES ============================
router.get('/repos/:id/releases', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT r.*, u.username AS created_by_username,
              (SELECT id FROM kr_marketplace_listings m WHERE m.release_id = r.id LIMIT 1) AS marketplace_listing_id
       FROM kr_releases r LEFT JOIN kr_users u ON u.id=r.created_by
       WHERE r.repo_id=$1 ORDER BY r.created_at DESC`, [ctx.repo.id]);
    const tags = await git.listTagRefs(ctx.repo.id);
    res.json({ releases: rows.rows, tags });
  } catch (err) { handleError(res, err, 'Failed to load releases'); }
});

// Create a draft release from an existing tag (semver tag required)
router.post('/repos/:id/releases', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const { tag_name, name, notes, prerelease } = req.body || {};
    if (!tag_name || !name) return res.status(400).json({ error: 'tag_name and name are required' });
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag_name)) {
      return res.status(400).json({ error: 'Tag must follow semantic versioning (e.g. 1.2.0 or 1.0.0-beta.1)' });
    }
    const tag = (await git.listTagRefs(ctx.repo.id)).find(t => t.name === tag_name);
    if (!tag) return res.status(404).json({ error: `Tag "${tag_name}" does not exist — create it first` });
    const dup = await pool.query('SELECT id FROM kr_releases WHERE repo_id=$1 AND tag_name=$2', [ctx.repo.id, tag_name]);
    if (dup.rows.length) return res.status(409).json({ error: 'A release for this tag already exists' });
    const id = (await pool.query(
      `INSERT INTO kr_releases (repo_id, tag_name, name, notes, prerelease, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6) RETURNING id`,
      [ctx.repo.id, tag_name, name, notes || '', !!prerelease, ctx.user.id])).rows[0].id;
    await logActivity(ctx.repo.id, ctx.user.id, 'release_drafted', { tag_name, name });
    res.status(201).json({ id, tag_name, status: 'draft' });
  } catch (err) { handleError(res, err, 'Failed to create release'); }
});

// Publish a release (owner only — owner retains publish authority)
router.post('/repos/:id/releases/:releaseId/publish', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'owner');
    if (!ctx) return;
    const release = (await pool.query('SELECT * FROM kr_releases WHERE id=$1 AND repo_id=$2', [req.params.releaseId, ctx.repo.id])).rows[0];
    if (!release) return res.status(404).json({ error: 'Release not found' });
    if (release.status === 'published') return res.status(400).json({ error: 'Release is already published' });
    const prev = (await pool.query(
      `SELECT tag_name FROM kr_releases WHERE repo_id=$1 AND status='published' ORDER BY created_at DESC LIMIT 1`, [ctx.repo.id])).rows[0];
    const commits = await git.listCommits(ctx.repo.id, release.tag_name, 100);
    await pool.query(`UPDATE kr_releases SET status='published', latest=TRUE WHERE id=$1`, [release.id]);
    await pool.query(`UPDATE kr_releases SET latest=FALSE WHERE repo_id=$1 AND id<>$2`, [ctx.repo.id, release.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'release_published', { tag_name: release.tag_name });
    res.json({ ok: true, commits, previous_tag: prev?.tag_name || null });
  } catch (err) { handleError(res, err, 'Failed to publish release'); }
});

// Compare two versions (tags): commits + diff + ahead/behind
router.get('/repos/:id/releases/compare', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) return res.status(400).json({ error: 'from and to tag names are required' });
    const ab = await git.aheadBehind(ctx.repo.id, from, to);
    const commits = await git.listCommits(ctx.repo.id, to, 100);
    const patch = await git.getDiff(ctx.repo.id, from, to);
    res.json({ from, to, ahead: ab.ahead, behind: ab.behind, commits, patch });
  } catch (err) { handleError(res, err, 'Failed to compare versions'); }
});

// ============================ DEPLOYMENTS ============================
router.get('/repos/:id/deployments', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT d.*, r.tag_name AS release_tag FROM kr_deployments d
       LEFT JOIN kr_releases r ON r.id = d.release_id
       WHERE d.repo_id=$1 ORDER BY d.created_at DESC LIMIT 30`, [ctx.repo.id]);
    res.json(rows.rows);
  } catch (err) { handleError(res, err, 'Failed to load deployments'); }
});

// Deploy a published release (owner only). Status is derived from real Git
// state: the release tag must actually resolve in the repository.
router.post('/repos/:id/deployments', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'owner');
    if (!ctx) return;
    const { release_id, environment } = req.body || {};
    const release = (await pool.query(`SELECT * FROM kr_releases WHERE id=$1 AND repo_id=$2 AND status='published'`, [release_id, ctx.repo.id])).rows[0];
    if (!release) return res.status(404).json({ error: 'Published release not found' });
    const id = (await pool.query(
      `INSERT INTO kr_deployments (repo_id, release_id, environment, status, log)
       VALUES ($1,$2,$3,'pending','Queued') RETURNING id`,
      [ctx.repo.id, release_id, environment || 'production'])).rows[0].id;
    const tagOk = (await git.listTagRefs(ctx.repo.id)).some(t => t.name === release.tag_name);
    const status = tagOk ? 'success' : 'failure';
    const log = tagOk
      ? `Release ${release.tag_name} verified against Git tags. Deployment registered for ${environment || 'production'}.`
      : `Tag ${release.tag_name} not found in Git — deployment failed.`;
    await pool.query(`UPDATE kr_deployments SET status=$1, log=$2, finished_at=NOW() WHERE id=$3`, [status, log, id]);
    await pool.query(`UPDATE kr_repositories SET deploy_status=$1, updated_at=NOW() WHERE id=$2`, [status === 'success' ? 'deployed' : 'failed', ctx.repo.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'deployment', { release: release.tag_name, status });
    res.status(202).json({ id, status, log });
  } catch (err) { handleError(res, err, 'Failed to deploy'); }
});

// ============================ MARKETPLACE ============================
router.get('/repos/:id/marketplace', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const rows = await pool.query(
      `SELECT m.*, r.tag_name AS release_tag, u.username AS created_by_username
       FROM kr_marketplace_listings m
       LEFT JOIN kr_releases r ON r.id = m.release_id
       LEFT JOIN kr_users u ON u.id = m.created_by
       WHERE m.repo_id=$1 ORDER BY m.created_at DESC`, [ctx.repo.id]);
    res.json(rows.rows);
  } catch (err) { handleError(res, err, 'Failed to load marketplace listings'); }
});

// Create a marketplace draft from a PUBLISHED release only
router.post('/repos/:id/marketplace', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const { release_id, name, tagline, description, category, pricing_type, price_cents, docs_url, requirements } = req.body || {};
    if (!release_id || !name) return res.status(400).json({ error: 'release_id and name are required' });
    const release = (await pool.query(`SELECT * FROM kr_releases WHERE id=$1 AND repo_id=$2 AND status='published'`, [release_id, ctx.repo.id])).rows[0];
    if (!release) return res.status(403).json({ error: 'Marketplace publishing requires a published (approved) release' });
    const detect = ctx.repo.detect_json as any;
    const id = (await pool.query(
      `INSERT INTO kr_marketplace_listings
        (repo_id, release_id, name, tagline, description, category, pricing_type, price_cents, docs_url, requirements, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11) RETURNING id`,
      [ctx.repo.id, release_id, name, tagline || '', description || '', category || 'other',
       pricing_type === 'paid' ? 'paid' : 'free', price_cents || 0, docs_url || '',
       requirements || JSON.stringify(detect?.envVariables || []), ctx.user.id])).rows[0].id;
    await logActivity(ctx.repo.id, ctx.user.id, 'marketplace_draft', { name, release: release.tag_name });
    res.status(201).json({ id, status: 'draft' });
  } catch (err) { handleError(res, err, 'Failed to create marketplace listing'); }
});

// Draft → in_review → published. Publishing requires OWNER (marketplace
// publishing permission is separate from collaborator write access).
router.post('/repos/:id/marketplace/:listingId/status', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'owner');
    if (!ctx) return;
    const { status } = req.body || {};
    if (!['in_review', 'published', 'draft'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const listing = (await pool.query('SELECT * FROM kr_marketplace_listings WHERE id=$1 AND repo_id=$2', [req.params.listingId, ctx.repo.id])).rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (status === 'published') {
      const release = (await pool.query(`SELECT status FROM kr_releases WHERE id=$1`, [listing.release_id])).rows[0];
      if (release?.status !== 'published') return res.status(403).json({ error: 'Only approved (published) releases can go to the marketplace' });
    }
    await pool.query(
      `UPDATE kr_marketplace_listings SET status=$1, published_at=${status === 'published' ? 'NOW()' : 'published_at'} WHERE id=$2`,
      [status, listing.id]);
    await logActivity(ctx.repo.id, ctx.user.id, 'marketplace_status', { listing: listing.name, status });
    res.json({ ok: true, status });
  } catch (err) { handleError(res, err, 'Failed to update listing'); }
});

export default router;
