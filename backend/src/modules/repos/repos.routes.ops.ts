import { Router } from 'express';
import { requireAuth } from './auth.service';
import * as git from './git.service';
import { pool } from '../../services/database.service';
import { logActivity, handleError, loadRepoFor, getRepo } from './repos.routes.core';
import { detectRepo, DetectionResult } from './detect.service';
import { runCi, latestRuns } from './ci.service';
import { subscribeRepoEvents } from './realtime.service';

const router = Router();

// In-flight detection guard shared by the module
const detecting = new Set<string>();

// ============================ REALTIME (SSE) ============================
// Opens a Server-Sent Events stream for one repository. Any table change routed
// to this repo (CI finishes, deployments, activity, repo metadata) is pushed to
// this stream by the repo realtime hub. Read access is enforced on subscribe.
router.get('/repos/:id/events', requireAuth, (req, res) => {
  void (async () => {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    subscribeRepoEvents(ctx.repo.id, res);
  })();
});

// ============================ API DETECTION ============================
// Re-scans the default branch: framework, endpoints, OpenAPI, env vars,
// dependencies and secrets. Result is stored on the repository (detected
// metadata) — distinct from manually configured repo settings.
router.post('/repos/:id/detect', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    if (detecting.has(ctx.repo.id)) return res.status(409).json({ error: 'Detection already running for this repository' });
    detecting.add(ctx.repo.id);
    try {
      const branches = await git.listBranches(ctx.repo.id);
      if (branches.length === 0) return res.status(400).json({ error: 'Repository is empty — push code first' });
      const result = await detectRepo(ctx.repo.id, ctx.repo.default_branch);
      await pool.query(`UPDATE kr_repositories SET detect_json=$1, updated_at=NOW() WHERE id=$2`, [JSON.stringify(result), ctx.repo.id]);
      if (result.framework && !ctx.repo.framework) {
        await pool.query(`UPDATE kr_repositories SET framework=$1 WHERE id=$2 AND (framework IS NULL OR framework='')`, [result.framework, ctx.repo.id]);
      }
      await logActivity(ctx.repo.id, ctx.user.id, 'detection_run', {
        endpoints: result.endpoints.length, secrets: result.secrets.length, framework: result.framework,
      });
      res.json(result);
    } finally {
      detecting.delete(ctx.repo.id);
    }
  } catch (err) { handleError(res, err, 'Detection failed'); }
});

router.get('/repos/:id/api', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const detect = ctx.repo.detect_json as DetectionResult | null;
    res.json({
      detected: detect,
      manual: { framework: ctx.repo.framework, language: ctx.repo.language },
    });
  } catch (err) { handleError(res, err, 'Failed to load API metadata'); }
});

// ============================ CI ============================
router.get('/repos/:id/ci/runs', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    res.json(await latestRuns(ctx.repo.id));
  } catch (err) { handleError(res, err, 'Failed to load CI runs'); }
});

// Trigger a REAL build or test run against the default branch
router.post('/repos/:id/ci/:type', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const type = req.params.type;
    if (!['build', 'test'].includes(type)) return res.status(400).json({ error: 'type must be build or test' });
    const branches = await git.listBranches(ctx.repo.id);
    if (branches.length === 0) return res.status(400).json({ error: 'Repository is empty — push code first' });
    const sha = (await git.latestCommit(ctx.repo.id, ctx.repo.default_branch))?.sha || null;
    await logActivity(ctx.repo.id, ctx.user.id, `ci_${type}_triggered`, { ref: ctx.repo.default_branch });
    res.status(202).json(await runCi(ctx.repo.id, ctx.repo.default_branch, type as 'build' | 'test', sha));
  } catch (err) { handleError(res, err, 'Failed to trigger CI'); }
});

router.get('/repos/:id/ci/runs/:runId', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const run = (await pool.query('SELECT * FROM kr_ci_runs WHERE id=$1 AND repo_id=$2', [req.params.runId, ctx.repo.id])).rows[0];
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) { handleError(res, err, 'Failed to load run'); }
});

export default router;
