import {
  addActivity,
  claimNextDeploy,
  completeDeploy,
  failDeploy,
  getProject,
  saveProject,
  addDeployment,
} from './api-build.service';
import { probeProjectHealth } from './api-build.telemetry';
import { resolveDeploymentKind, normalizeDeploymentSource } from './api-build.deployment';
import { deployProject } from './api-build.deploy';

let running = false;

/**
 * Processes one queued deploy job for real:
 *   1. claims the next queued job (SKIP LOCKED — safe with multiple workers),
 *   2. checks deployment kind:
 *      - external: probes upstream health endpoint
 *      - docker: executes full container lifecycle via api-build.deploy.ts
 *   3. records durable deployment row + audit entry,
 *   4. marks the job completed.
 */
async function processOne() {
  if (running) return;
  running = true;
  try {
    const job = await claimNextDeploy();
    if (!job) return;
    const project = await getProject(job.project_id);
    if (!project) {
      await completeDeploy(job.id);
      return;
    }

    const payload = (job.payload as Record<string, unknown> | undefined) || {};
    const kind = resolveDeploymentKind(project, payload);

    /** Truthful job terminal state: a failed deployment must not be 'completed'. */
    let deploymentError = '';

    if (kind === 'docker') {
      try {
        const result = await deployProject(String(job.project_id), {
          actor: 'gateway-queue',
          version: typeof payload.version === 'string' ? payload.version : undefined,
          environment: typeof payload.environment === 'string' ? payload.environment : undefined,
        });
        if (!result.ok) {
          deploymentError = result.error || 'Docker deployment failed.';
        }
      } catch (dockerErr) {
        console.error(`[api-build queue] Docker deployment failed for project ${job.project_id}:`, dockerErr);
        deploymentError = dockerErr instanceof Error ? dockerErr.message : String(dockerErr);
      }
    } else {
      // External deployment: probe external upstream
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
        source: normalizeDeploymentSource(deployment.source, 'External API'),
        branch: typeof deployment.branch === 'string' ? deployment.branch : undefined,
        region: 'sg-edge',
        status: healthy ? 'healthy' : 'failed',
        url: String(project.gatewayUrl || deployment.providerUrl || ''),
        durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        author: 'gateway-queue',
        logs: log,
      });

      await saveProject({
        ...project,
        status: healthy ? 'healthy' : 'failed',
        deployment: {
          ...deployment,
          kind: 'external',
          status: healthy ? 'healthy' : 'failed',
          lastHealthCheck: 'just now',
          log: [...((deployment.log as string[]) ?? []), ...log],
        },
        updatedAt: new Date().toISOString(),
      });
      await addActivity(
        String(job.project_id),
        healthy
          ? `Deployment completed for ${String(project.version ?? 'v1.0.0')} — upstream healthy`
          : 'Deployment finished with a failed health check',
        healthy ? 'ok' : 'critical',
      );
    }

    if (deploymentError) {
      await failDeploy(job.id, deploymentError);
    } else {
      await completeDeploy(job.id);
    }
  } catch (error) {
    console.error('[api-build queue] job failed', error);
    throw error;
  } finally {
    running = false;
  }
}

export function startApiBuildQueue() {
  let delay = 1500;
  const MAX_DELAY = 30000;
  const INITIAL_DELAY = 1500;

  const loop = async () => {
    try {
      await processOne();
      delay = INITIAL_DELAY; // Reset on success
    } catch (err) {
      delay = Math.min(MAX_DELAY, delay * 1.5);
    }
    setTimeout(loop, delay).unref();
  };

  void loop();
}

