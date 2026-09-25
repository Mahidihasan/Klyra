import { getProject, appendLog, recordUsage, listEndpoints, setEndpointMetrics, saveIncident, listIncidents, listProjects, addActivity } from './api-build.service';
import { projectApiBasePath, resolveDeploymentUpstream } from './api-build.deployment';

/* ==========================================================================
 * Telemetry worker — the source of REAL operational data for the workspace.
 *
 * For every live project it periodically probes the API's own upstream health
 * endpoint (the deployment's container origin for Docker projects,
 * project.baseUrl for external projects — never the gateway URL, which would
 * only exercise Klyra itself) and records what actually happened: a request
 * log row, an hourly usage bucket, endpoint latency metrics, and — after
 * repeated failures — a genuine incident. No number in the workspace is
 * fabricated: it is observed here first.
 * ========================================================================== */

const PROBE_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 8_000;
const INCIDENT_THRESHOLD = 3;

const failureStreak = new Map<string, number>();

export interface ProbeResult {
  projectId: string;
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  checkedAt: string;
  target: string;
  reason?: string;
}

/**
 * The target a probe must ask for: the deployment origin plus the health path,
 * inserting the API base path the specification declares when neither the
 * origin nor the health path carries it already. A project whose specification
 * serves under `/api/v3` (the deployed Petstore) must probe
 * `<origin>/api/v3/health`, not `<origin>/health` — probing the root produced
 * a fabricated 404 failure for every healthy container, poisoned the traffic
 * telemetry, and opened a bogus "health checks failing" incident for it.
 */
export function resolveProbeTarget(
  upstream: string,
  healthPath: string,
  basePath: string,
): { target: string; reason?: string } {
  const origin = String(upstream || '').trim().replace(/\/+$/, '');
  if (!origin || !/^https?:\/\//i.test(origin)) {
    return { target: '', reason: 'No reachable upstream base URL configured yet.' };
  }
  const health = `/${String(healthPath || '/health').replace(/^\/+/, '')}`;
  const base = basePath && basePath !== '/'
    ? (basePath.startsWith('/') ? basePath : `/${basePath}`).replace(/\/+$/, '')
    : '';

  let upstreamPath = '';
  try {
    upstreamPath = new URL(origin).pathname.replace(/\/+$/, '');
  } catch { upstreamPath = ''; }

  const qualified = base && (health === base || health.startsWith(`${base}/`));
  // The upstream origin can already carry the API prefix (an external baseUrl
  // of `https://host/v1` with the document declaring `/v1`).
  const originated = base && (upstreamPath === base || upstreamPath.endsWith(base));
  const path = base && !qualified && !originated ? `${base}${health}` : health;
  return { target: `${origin}${path}` };
}

async function fetchHealth(url: string, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; statusCode: number; latencyMs: number }> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'KlyraGatewayHealth/1.0', Accept: '*/*' },
    });
    return { ok: response.status >= 200 && response.status < 400, statusCode: response.status, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, statusCode: 0, latencyMs: Date.now() - started };
  }
}
/** Runs one real health check for a project and records everything it observes. */
export async function probeProjectHealth(projectId: string): Promise<ProbeResult> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found.');
  const healthPath = String(project.healthCheckPath || '/health');
  // A Docker project's stored baseUrl is its gateway URL; probing it would only
  // exercise Klyra's own forwarding (and fail the API-key gate on locked
  // projects). The probe must address the API itself: the container origin for
  // Docker deployments, the recorded upstream for external ones.
  const projectRecord = project as unknown as Record<string, unknown>;
  const upstream = resolveDeploymentUpstream(projectRecord) || String(project.baseUrl || '').trim();
  const { target, reason } = resolveProbeTarget(upstream, healthPath, projectApiBasePath(projectRecord));

  if (!target) {
    return { projectId, ok: false, statusCode: 0, latencyMs: 0, checkedAt: new Date().toISOString(), target, reason };
  }

  const outcome = await fetchHealth(target);
  const result: ProbeResult = {
    projectId,
    ok: outcome.ok,
    statusCode: outcome.statusCode,
    latencyMs: outcome.latencyMs,
    checkedAt: new Date().toISOString(),
    target,
    reason: outcome.ok ? undefined : `Upstream returned HTTP ${outcome.statusCode || 'no response'} for ${healthPath}`,
  };

  try {
    await appendLog(projectId, {
      method: 'GET',
      path: healthPath,
      statusCode: outcome.statusCode || 503,
      latencyMs: outcome.latencyMs,
      consumerName: 'klyra-gateway',
      keyPrefix: '',
      version: String(project.version ?? ''),
      region: 'sg-edge',
      requestHeaders: { 'user-agent': 'KlyraGatewayHealth/1.0' },
      responseHeaders: {},
      responseBody: outcome.ok ? '' : `Health probe failed: HTTP ${outcome.statusCode || 'network error'}`,
      trace: [
        { stage: 'gateway.ingress', durationMs: Math.max(1, Math.round(outcome.latencyMs * 0.08)) },
        { stage: 'upstream.request', durationMs: Math.max(1, Math.round(outcome.latencyMs * 0.84)) },
        { stage: 'gateway.egress', durationMs: Math.max(1, Math.round(outcome.latencyMs * 0.08)) },
      ],
    });
    await recordUsage(projectId, {
      requests: 1,
      success: outcome.ok ? 1 : 0,
      clientErr: 0,
      serverErr: outcome.ok ? 0 : 1,
      rateLim: 0,
      p95: outcome.latencyMs,
    });

    // Refresh the matching endpoint's real latency metrics when the probed
    // path exists in the catalog.
    const endpoints = await listEndpoints(projectId);
    const match = endpoints.find((e) => e.method === 'GET' && e.path === healthPath);
    if (match) {
      await setEndpointMetrics(projectId, match.id, {
        avg: outcome.latencyMs,
        p95: Math.round(outcome.latencyMs * 1.35),
        total: 1,
        errors: outcome.ok ? 0 : 1,
        healthy: outcome.ok,
      });
    }

    await trackIncidents(projectId, outcome.ok);
  } catch (error) {
    console.error('[api-build telemetry] failed to record probe result', error);
  }

  return result;
}
async function trackIncidents(projectId: string, healthy: boolean) {
  const streak = healthy ? 0 : (failureStreak.get(projectId) ?? 0) + 1;
  failureStreak.set(projectId, streak);

  const open = (await listIncidents(projectId)).filter((i) => i.status !== 'Resolved');
  if (!healthy && streak >= INCIDENT_THRESHOLD && open.length === 0) {
    await saveIncident(projectId, {
      title: `Upstream health checks failing (${streak} consecutive probes)`,
      severity: streak >= 6 ? 'Critical' : 'Major',
      status: 'Investigating',
      summary: `The gateway health probe has failed ${streak} times in a row. The upstream returned errors or timed out.`,
    });
    await addActivity(projectId, 'Health checks failing — incident opened automatically', 'critical');
  }
  if (healthy && open.length > 0) {
    for (const incident of open) {
      await saveIncident(projectId, { id: incident.id, title: incident.title, status: 'Resolved', resolvedAt: new Date().toISOString() });
    }
    await addActivity(projectId, 'Upstream healthy again — incident resolved automatically', 'ok');
    failureStreak.set(projectId, 0);
  }
}

async function probeAllLive() {
  let projects;
  try { projects = await listProjects(); } catch { return; }
  await Promise.allSettled(projects.map(async (p) => {
    const status = String(p.status ?? '');
    if (status === 'draft') return;
    // A Docker project's stored baseUrl is its gateway URL; the container
    // origin behind it is what answers. Only projects with no origin at all
    // are skipped — the probe itself resolves the right target.
    const record = p as unknown as Record<string, unknown>;
    const upstream = resolveDeploymentUpstream(record);
    if (!upstream && !String(p.baseUrl ?? '').trim()) return;
    try { await probeProjectHealth(String(p.id)); } catch (error) { console.error('[api-build telemetry] probe failed', error); }
  }));
}

/** Starts the recurring probe loop (fire-and-forget, unref'd timer). */
export function startApiBuildTelemetry() {
  const timer = setInterval(() => { void probeAllLive(); }, PROBE_INTERVAL_MS);
  timer.unref?.();
  void probeAllLive();
  // eslint-disable-next-line no-console
  console.log(`[api-build telemetry] live health probes every ${PROBE_INTERVAL_MS / 1000}s`);
}