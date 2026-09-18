/**
 * API Build — deployment model shared by the gateway, the deploy pipeline,
 * telemetry and the routes layer.
 *
 * This module is the single source of truth for:
 *
 *   1. the canonical gateway URL of a project      -> buildGatewayUrl()
 *   2. the deployment kinds Klyra supports         -> 'external' | 'docker'
 *   3. which upstream the gateway must target      -> resolveDeploymentUpstream()
 *   4. which fields may never reach the browser    -> sanitizeDeploymentForClient()
 *
 * Docker internals (container DNS names, internal ports) live only here, in the
 * deploy pipeline (api-build.deploy.ts / api-build.docker.ts) and inside the
 * backend's own database. They are stripped from every project/deployment
 * payload before it is returned to the frontend, so the Playground and every
 * other screen only ever see the gateway URL.
 */

export type DeploymentKind = 'external' | 'docker';

/**
 * 'klyra' is the legacy kind the setup wizard used before the real Docker
 * hosting model existed. Those records describe Klyra-hosted APIs, so they are
 * treated as 'docker' everywhere (backward compatibility, no data migration
 * required).
 */
const LEGACY_DOCKER_KINDS = new Set(['klyra', 'docker']);

/** Path the gateway router is mounted at (app.ts). The URL builder and the
 *  router must never disagree again — this constant is used by both. */
export const GATEWAY_ROUTE_PREFIX = '/api/gateway';

/** Internal container port for generated Klyra-hosted APIs. */
export const DEFAULT_INTERNAL_PORT = Number(process.env.KLYRA_API_INTERNAL_PORT || 8080);

/** Public origin the gateway answers on (browser-facing). In development this
 *  is the backend itself; in production it comes from GATEWAY_URL. */
export function backendOrigin(): string {
  return (process.env.GATEWAY_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
}

/** Canonical, routable gateway URL for a project slug. */
export function buildGatewayUrl(slug: string): string {
  return `${backendOrigin()}${GATEWAY_ROUTE_PREFIX}/${slug}`;
}

/** Project ids are `proj-{slug}-{rand}`; older ids may carry no suffix. */
export function slugFromProjectId(id: string): string {
  const m = /^proj-(.+)-[a-z0-9]{4,8}$/i.exec(id);
  return m ? m[1] : id;
}

/** Stable slug for a project record (slug field, falling back to the id). */
export function slugOfProject(project: Record<string, unknown> | null | undefined): string {
  return String(project?.slug || '') || slugFromProjectId(String(project?.id || ''));
}

/**
 * Read-time normalization ("heal on read", the established Klyra pattern).
 *
 * Whatever stale form a stored gatewayUrl has — the fictional
 * `https://api.klyra.com/{slug}` seeded by early records, the missing `/api`
 * prefix produced before the route mount was fixed, or any other origin — it is
 * rewritten to the canonical URL derived from the slug. Idempotent, so it is
 * safe to run on every read; this is the migration strategy for existing data.
 */
export function normalizeProjectGatewayUrl<T extends Record<string, unknown>>(record: T): T {
  const slug = slugOfProject(record);
  if (!slug) return record;
  const canonical = buildGatewayUrl(slug);
  if (record.gatewayUrl === canonical) return record;
  return { ...record, gatewayUrl: canonical };
}

/** Runtime facts of a deployment. internalUrl/hostUrl/upstream are backend-only
 *  (never serialized to the client). */
export interface DeploymentRuntime {
  kind: DeploymentKind;
  /** What the gateway forwards to. For docker this is the container URL. */
  upstream?: string;
  containerName?: string;
  image?: string;
  internalPort?: number;
  /** Published loopback host port — only set when the backend runs on the host. */
  hostPort?: number;
  /** Docker DNS URL — resolvable only from inside the Docker network. */
  internalUrl?: string;
  /** Loopback URL — used only when KLYRA_DOCKER_RUNTIME=host (native backend). */
  hostUrl?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

/**
 * Reads the runtime descriptor of the project's active deployment. Returns null
 * when the project has no meaningful runtime yet (never-deployed docker record,
 * plain external connection, ...) so callers can fall back to project.baseUrl.
 */
export function activeDeploymentRuntime(project: Record<string, unknown> | null | undefined): DeploymentRuntime | null {
  const dep = asRecord(project?.deployment);
  if (!dep) return null;
  const kindRaw = String(dep.kind || '').toLowerCase();
  if (!kindRaw) return null;
  const kind: DeploymentKind = LEGACY_DOCKER_KINDS.has(kindRaw) ? 'docker' : 'external';
  const runtime = asRecord(dep.runtime) || dep;
  const upstream = String(runtime.upstream || runtime.providerUrl || '').trim();
  const containerName = String(runtime.containerName || '').trim();
  if (kind === 'docker' && !upstream && !containerName) return null;
  if (kind === 'external' && !upstream) return null;
  return {
    kind,
    upstream: upstream || undefined,
    containerName: containerName || undefined,
    image: String(runtime.image || '').trim() || undefined,
    internalPort: Number(runtime.internalPort) || undefined,
    hostPort: Number(runtime.hostPort) || undefined,
    internalUrl: String(runtime.internalUrl || '').trim() || undefined,
    hostUrl: String(runtime.hostUrl || '').trim() || undefined,
  };
}

const deploymentIsLive = (project: Record<string, unknown> | null | undefined): boolean => {
  const status = String(asRecord(project?.deployment)?.status || '').toLowerCase();
  return status === 'healthy' || status === 'healthy-external';
};

/**
 * The one function that makes the gateway deployment-agnostic.
 *
 * Resolution order:
 *   1. live docker deployment -> container URL (Docker DNS by default; the
 *      published loopback port when the backend itself runs on the host —
 *      KLYRA_DOCKER_RUNTIME=host, the development layout)
 *   2. live external deployment -> the recorded external upstream
 *   3. fallback -> project.baseUrl (identical to the pre-docker behavior, so
 *      existing externally-connected projects are untouched)
 */
export function resolveDeploymentUpstream(project: Record<string, unknown> | null | undefined): string {
  const runtime = activeDeploymentRuntime(project);
  if (runtime && deploymentIsLive(project)) {
    if (runtime.kind === 'docker') {
      const preferHost = String(process.env.KLYRA_DOCKER_RUNTIME || 'docker').toLowerCase() === 'host';
      const target = preferHost ? (runtime.hostUrl || runtime.internalUrl) : (runtime.internalUrl || runtime.upstream);
      if (target) return target;
    }
    if (runtime.upstream) return runtime.upstream;
  }
  return String(project?.baseUrl || '').trim();
}

/** Decides which pipeline a deploy request takes. */
export function resolveDeploymentKind(
  project: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> = {},
): DeploymentKind {
  const requested = String(payload.kind || payload.deploymentKind || '').toLowerCase();
  if (requested === 'docker' || requested === 'klyra') return 'docker';
  if (requested === 'external') return 'external';
  const kindRaw = String(asRecord(project?.deployment)?.kind || '').toLowerCase();
  if (LEGACY_DOCKER_KINDS.has(kindRaw)) return 'docker';
  if (kindRaw === 'external') return 'external';
  // No explicit signal: keep today's behavior for connected upstreams and
  // default APIs built inside Klyra to Klyra-hosted containers.
  const hasUpstream = Boolean(String(project?.baseUrl || '').trim());
  return String(project?.sourceKind || '') === 'existing' && hasUpstream ? 'external' : 'docker';
}

/** Fields that must never leave the backend. */
const INTERNAL_RUNTIME_FIELDS = new Set(['upstream', 'internalUrl', 'hostUrl', 'internalPort', 'hostPort']);

/** Strips Docker-internal fields from a deployment object for API responses. */
export function sanitizeDeploymentForClient(deployment: unknown): Record<string, unknown> {
  const dep = asRecord(deployment);
  if (!dep) return {};
  const clone: Record<string, unknown> = { ...dep };
  for (const key of Object.keys(clone)) {
    if (INTERNAL_RUNTIME_FIELDS.has(key)) delete clone[key];
  }
  const runtime = asRecord(clone.runtime);
  if (runtime) {
    const safeRuntime: Record<string, unknown> = { ...runtime };
    for (const key of Object.keys(safeRuntime)) {
      if (INTERNAL_RUNTIME_FIELDS.has(key)) delete safeRuntime[key];
    }
    clone.runtime = safeRuntime;
  }
  const kindRaw = String(clone.kind || '').toLowerCase();
  if (LEGACY_DOCKER_KINDS.has(kindRaw)) clone.kind = 'docker';
  else if (kindRaw) clone.kind = 'external';
  return clone;
}

/** Normalizes gatewayUrl + strips Docker internals from a full project record. */
export function sanitizeProjectForClient<T extends Record<string, unknown>>(project: T): T {
  const safe = normalizeProjectGatewayUrl(project);
  if (safe.deployment === undefined || safe.deployment === null) return safe;
  return { ...safe, deployment: sanitizeDeploymentForClient(safe.deployment) } as T;
}

/** Docker-safe naming (container/image rules: [a-z0-9][a-z0-9_.-]*). */
export function sanitizeContainerToken(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]$/, '');
  return token || 'api';
}

export const containerNameFor = (slug: string, version: string): string =>
  `klyra-api-${sanitizeContainerToken(slug)}-${sanitizeContainerToken(version)}`;

export const imageNameFor = (slug: string, version: string): string =>
  `klyra-api-${sanitizeContainerToken(slug)}:${sanitizeContainerToken(version) || 'latest'}`;
