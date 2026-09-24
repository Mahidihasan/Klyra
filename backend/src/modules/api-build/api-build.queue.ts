import { addActivity, claimNextDeploy, completeDeploy, getProject, saveProject, addDeployment, listEndpoints } from './api-build.service';
import { probeProjectHealth } from './api-build.telemetry';
import { deployProjectDocker } from './api-build.docker';
import { buildGatewayUrl, resolveDeploymentKind, slugOfProject } from './api-build.deployment';

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

    // Two deployment pipelines, distinguished by the existing deployment.kind:
    //   - 'docker'  -> real container lifecycle (scaffold -> image -> container
    //                  -> /health) via deployProjectDocker()
    //   - 'external'-> the pre-existing URL-based flow: probe the already-hosted
    //                  upstream directly. No container is ever built for it.
    if (resolveDeploymentKind(project) === 'docker') {
      await processDockerDeploy(job, project);
      return;
    }

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
/**
 * Docker pipeline for one queued deploy of a Klyra-hosted API.
 * Never produces a healthy record on failure — errors are caught, recorded,
 * and surfaced as activity so the workspace shows exactly what broke.
 */
async function processDockerDeploy(
  job: { id: string; project_id: string },
  project: Record<string, unknown> & { id: string },
) {
  const startedAt = Date.now();
  const deployment = (project.deployment as Record<string, unknown>) || {};
  const version = String(project.version ?? 'v1.0.0');
  const slug = slugOfProject(project);

  const logLines: string[] = [
    'Queue worker claimed deployment (Klyra-hosted / Docker)',
    `Deployment kind resolved to 'docker' — container pipeline engaged`,
  ];

  const appendLog = (line: string) => {
    if (line) logLines.push(line);
  };

  try {
    const endpoints = await listEndpoints(String(job.project_id));
    const runtime = await deployProjectDocker({
      slug,
      version,
      image: typeof deployment.image === 'string' ? deployment.image : undefined,
      endpoints,
      log: appendLog,
    });

    const gatewayUrl = buildGatewayUrl(slug);
    logLines.push(`Deployment is live on the gateway: ${gatewayUrl}`);

    await addDeployment(String(job.project_id), {
      version,
      environment: String(deployment.environment ?? 'development'),
      source: 'Klyra Hosted',
      branch: typeof deployment.branch === 'string' ? deployment.branch : undefined,
      region: 'sg-edge',
      status: 'healthy',
      url: gatewayUrl,
      durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      author: 'gateway-queue',
      logs: logLines,
    });

    await saveProject({
      ...project,
      status: 'healthy',
      baseUrl: gatewayUrl,
      gatewayUrl,
      deployment: {
        ...deployment,
        kind: 'docker',
        status: 'healthy',
        providerUrl: gatewayUrl,
        runtime,
        lastHealthCheck: 'just now',
        log: [...((deployment.log as string[]) ?? []), ...logLines],
      },
      updatedAt: new Date().toISOString(),
    });

    await addActivity(String(job.project_id),
      `Container deployed for ${version} — healthy at ${gatewayUrl}`, 'ok');
    await completeDeploy(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logLines.push(`Docker deploy failed: ${message}`);

    await addDeployment(String(job.project_id), {
      version,
      environment: String(deployment.environment ?? 'development'),
      source: 'Klyra Hosted',
      region: 'sg-edge',
      status: 'failed',
      url: String(deployment.providerUrl ?? ''),
      durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      author: 'gateway-queue',
      logs: logLines,
    });

    await saveProject({
      ...project,
      status: 'failed',
      deployment: {
        ...deployment,
        kind: 'docker',
        status: 'failed',
        lastHealthCheck: 'just now',
        log: [...((deployment.log as string[]) ?? []), ...logLines],
      },
      updatedAt: new Date().toISOString(),
    });

    await addActivity(String(job.project_id),
      `Docker deployment failed for ${version}: ${message.slice(0, 160)}`, 'critical');
    await completeDeploy(job.id);
  }
}

export function startApiBuildQueue() {
  setInterval(() => { void processOne(); }, 1500).unref();
  void processOne();
}
