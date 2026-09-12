import { Router } from 'express';
import { enqueueDeploy, getJob, getProject, listProjects, removeProject, saveProject } from './api-build.service';
import { addCategory, listCategories } from './api-build.categories';
import { detectUpstream } from './api-build.detect';
const router = Router();
const validId = (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 160;
router.get('/projects', async (_req, res) => { try { res.json({ success: true, data: await listProjects() }); } catch { res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Project storage is unavailable.' } }); } });
router.get('/projects/:id', async (req, res) => { const project = await getProject(req.params.id); if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found.' } }); res.json({ success: true, data: project }); });
router.put('/projects/:id', async (req, res) => { if (!validId(req.params.id) || !req.body || typeof req.body !== 'object') return res.status(400).json({ success: false, error: { code: 'INVALID_PROJECT', message: 'A valid project payload is required.' } }); const project = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() }; await saveProject(project); res.json({ success: true, data: project }); });
router.delete('/projects/:id', async (req, res) => { res.json({ success: true, data: { deleted: await removeProject(req.params.id) } }); });
router.post('/projects/:id/deployments', async (req, res) => { const project = await getProject(req.params.id); if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found.' } }); const job = await enqueueDeploy(req.params.id); res.status(202).json({ success: true, data: { jobId: job.id, status: job.status } }); });
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deployment job not found.' } });
    res.json({ success: true, data: job });
  } catch { res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Deployment queue is unavailable.' } }); }
});

// ---- Marketplace categories (user-defined from the "New project" wizard) -----
router.get('/categories', async (_req, res) => {
  try { res.json({ success: true, data: await listCategories() }); }
  catch { res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Category storage is unavailable.' } }); }
});
router.post('/categories', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'A category name is required.' } });
    res.json({ success: true, data: await addCategory(name) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message } });
  }
});

// ---- Live upstream detection (server-side fetch; no CORS limitations) -------
router.post('/detect', async (req, res) => {
  const baseUrl = String(req.body?.baseUrl || '').trim();
  const openApiUrl = String(req.body?.openApiUrl || '').trim();
  if (!baseUrl && !openApiUrl) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_URL', message: 'Provide a base URL or an OpenAPI URL.' } });
  }
  res.json({ success: true, data: await detectUpstream(baseUrl, openApiUrl) });
});
export default router;
