import { addActivity, claimNextDeploy, completeDeploy, getProject, saveProject, addDeployment } from './api-build.service';
import { probeProjectHealth } from './api-build.telemetry';

let running = false;

/**
 * Processes one queued deploy job for real:
 *   1. claims the next queued job (SKIP LOCKED — safe with multiple workers),
 *   2. probes the upstream health endpoint (live, not simulated),
 *   3. records a durable deployment row + audit entry,
 *   4. marks the job completed.
 */
async function processOne() {
  if (running) return;
  running = true;
  try {
    const job = await claimNextDeploy();
    if (!job) return;
    const project = await getProject(job.project_id);
    if (!project) { await completeDeploy(job.id); return; }

    const startedAt = Date.now();
    const deployment = (project.deployment as Record<string, unknown>) || {};
    const probe = await probeProjectHealth(String(job.project_id));
    const healthy = probe.ok;
    const log = [
      'Queue worker claimed deployment',
      `Probed ${probe.target || 'upstream'} -> HTTP ${probe.statusCode || 'no response'} in ${probe.latencyMs}ms`,
      healthy ? 'Health check passed' : 'Health check failed — upstream unreachable',
    ];

    await addDeployment(String(job.project_id), {
      version: String(project.version ?? 'v1.0.0'),
      environment: String(deployment.environment ?? 'development'),
      source: String(deployment.source ?? 'Klyra Hosted'),
      branch: typeof deployment.branch === 'string' ? deployment.branch : undefined,
      region: 'sg-edge',
      status: healthy ? 'healthy' : 'failed',
      url: String(deployment.providerUrl ?? ''),
      durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      author: 'gateway-queue',
      logs: log,
    });

    await saveProject({
      ...project,
      status: healthy ? 'healthy' : 'failed',
      deployment: {
        ...deployment,
        status: healthy ? 'healthy' : 'failed',
        lastHealthCheck: 'just now',
        log: [...((deployment.log as string[]) ?? []), ...log],
      },
      updatedAt: new Date().toISOString(),
    });
    await addActivity(String(job.project_id), healthy
      ? `Deployment completed for ${String(project.version ?? 'v1.0.0')} — upstream healthy`
      : 'Deployment finished with a failed health check', healthy ? 'ok' : 'critical');
    await completeDeploy(job.id);
  } catch (error) { console.error('[api-build queue] job failed', error); }
  finally { running = false; }
}
export function startApiBuildQueue() {
  setInterval(() => { void processOne(); }, 1500).unref();
  void processOne();
}
