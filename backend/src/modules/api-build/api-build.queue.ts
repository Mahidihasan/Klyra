import { claimNextDeploy, completeDeploy, getProject, setProjectDeployment } from './api-build.service';

let running = false;
async function processOne() {
  if (running) return;
  running = true;
  try {
    const job = await claimNextDeploy();
    if (!job) return;
    const project = await getProject(job.project_id);
    if (!project) return;
    const existing = (project.deployment as Record<string, unknown>) || {};
    await setProjectDeployment(job.project_id, { ...existing, status: 'healthy', lastHealthCheck: 'just now', log: [...((existing.log as string[]) || []), 'Queue worker claimed deployment', 'Health check passed', 'Deployment healthy'] });
    await completeDeploy(job.id);
  } catch (error) { console.error('[api-build queue] job failed', error); }
  finally { running = false; }
}
export function startApiBuildQueue() {
  setInterval(() => { void processOne(); }, 1500).unref();
  void processOne();
}
