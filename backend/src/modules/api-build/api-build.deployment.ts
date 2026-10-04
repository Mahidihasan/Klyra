import { existsSync, readFileSync } from 'node:fs';

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

/** True when the backend process runs on the Docker host rather than in a container. */
export function usesHostDockerRuntime(): boolean {
  const configured = String(process.env.KLYRA_DOCKER_RUNTIME || '').trim().toLowerCase();
  if (configured === 'host') return true;
  if (configured === 'docker') return false;
  if (process.platform === 'win32') return true;
  if (existsSync('/.dockerenv') || existsSync('/run/.containerenv')) return false;
  try {
    const cgroups = readFileSync('/proc/1/cgroup', 'utf8');
    if (/(docker|containerd|kubepods|libpod)/i.test(cgroups)) return false;
  } catch {
    // A missing cgroup file is expected on non-Linux hosts.
  }
  return true;
}

/** Stable, isolated bridge network for one deployment container. */
export function sandboxNetworkName(containerName: string): string {
  const safeName = containerName.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^[^a-z0-9]+/, '');
  return `klyra-sandbox-${safeName || 'api'}`;
}

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

/**
 * True when a URL addresses Klyra's own gateway route (`/api/gateway/{slug}`).
 *
 * Project records can end up storing the gateway URL as their upstream origin —
 * the Configure step used to prefill "Upstream base URL" from the deployment
 * record, whose `providerUrl` *is* the gateway URL. The gateway would then
 * forward requests to itself and every Playground call hung until the 30s
 * timeout. Such a URL is never a valid forwarding target, so it is ignored.
 */
export function isKlyraGatewayUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  const path = (() => {
    try { return new URL(value).pathname; } catch { return value; }
  })();
  return new RegExp(`^${GATEWAY_ROUTE_PREFIX}/[^/]+`).test(path);
}

/**
 * The project slug a Klyra gateway URL addresses (`.../api/gateway/{slug}`), or
 * '' when the value is not a gateway URL. A gateway URL is not an upstream
 * origin, so callers that need to probe an API must resolve the project behind
 * the slug and use its real deployment origin (resolveDeploymentUpstream).
 */
export function gatewaySlugFromUrl(url: string): string {
  const value = String(url || '').trim();
  if (!value) return '';
  let path = value;
  try {
    path = new URL(value).pathname;
  } catch {
    // A bare path (`/api/gateway/petstore`) is accepted as-is.
  }
  const match = new RegExp(`^${GATEWAY_ROUTE_PREFIX}/([^/]+)`).exec(path);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Base path an API serves its operations under (`servers[0].url` — `/api/v3`
 * for the Swagger Petstore image, `/v3` for the OpenAPI Petstore), normalized
 * into a safe mount prefix: a single leading slash, no trailing slash, and no
 * scheme, host, query, fragment, whitespace or traversal segment (the value is
 * concatenated onto a forwarded URL). Returns '' for the origin root and for
 * anything that cannot be used as a prefix.
 */
export function normalizeApiBasePath(value: unknown): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || /[\s?#]/.test(trimmed)) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return '';
  const normalized = `/${trimmed.replace(/^\/+/, '')}`.replace(/\/+$/, '');
  if (normalized === '/') return '';
  if (normalized.split('/').some((segment) => segment === '.' || segment === '..')) return '';
  return normalized;
}

/** The base path detection recorded on a project ('' when unknown). */
export function projectApiBasePath(project: Record<string, unknown> | null | undefined): string {
  const detection =
    project?.detection && typeof project.detection === 'object'
      ? (project.detection as Record<string, unknown>)
      : null;
  return normalizeApiBasePath(detection?.basePath ?? project?.basePath);
}

/**
 * `rest` — the path after `/api/gateway/{slug}` — with the API's base path in
 * front, or null when there is nothing to add: no base path, the landing path,
 * or a request that already carries the prefix. The prefix check is
 * segment-aware, so `/api/v30/...` is never mistaken for `/api/v3`.
 */
export function apiSubPathWithBasePath(rest: string, basePath: string): string | null {
  const base = normalizeApiBasePath(basePath);
  if (!base) return null;
  const path = `/${String(rest || '').replace(/^\/+/, '')}`;
  if (path === '/') return null;
  if (path === base || path.startsWith(`${base}/`)) return null;
  return `${base}${path}`;
}

/** Stable slug for a project record (slug field, falling back to the id). */
export function slugOfProject(project: Record<string, unknown> | null | undefined): string {
  return String(project?.slug || '') || slugFromProjectId(String(project?.id || ''));
}

/** Pathname of a URL without a trailing slash ('https://host/v1/' -> '/v1'). */
function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * Resolves the path the gateway must ask the upstream for, given the sub-path
 * the caller asked the gateway for. This is what makes a gateway URL behave
 * exactly like the API's own base URL:
 *
 *   /api/gateway/{slug}/pet/1        -> /api/v3/pet/1   (base path inserted)
 *   /api/gateway/{slug}/api/v3/pet/1 -> /api/v3/pet/1   (already qualified)
 *   /api/gateway/{slug}              -> /api/v3          (the API root)
 *
 * Rules:
 *   - `stripBasePath` projects serve their operations at the origin root, so a
 *     present base path is removed instead of ensured;
 *   - an upstream whose own URL already ends with the base path (baseUrl
 *     `https://host/v1` with the document declaring `/v1`) is never prefixed
 *     twice.
 */
export function resolveGatewayForwardPath(opts: {
  /** Sub-path after /gateway/{slug}, without a leading slash ('' for the root). */
  requestedPath: string;
  /** Resolved upstream origin the request is forwarded to. */
  upstream: string;
  /** API base path the project declares (see projectApiBasePath). */
  basePath: string;
  /** Project flag: strip a present base path instead of ensuring it. */
  stripBasePath?: boolean;
}): string {
  const requested = `/${String(opts.requestedPath || '').replace(/^\/+/, '')}`;
  const rest = requested === '/' ? '' : requested.replace(/\/+$/, '');
  const basePath = normalizeApiBasePath(opts.basePath);
  if (!basePath) return rest;

  const alreadyQualified = rest === basePath || rest.startsWith(`${basePath}/`);

  if (opts.stripBasePath) {
    if (!alreadyQualified) return rest;
    const stripped = rest.slice(basePath.length);
    return stripped === '' || stripped.startsWith('/') ? stripped : `/${stripped}`;
  }

  if (alreadyQualified) return rest;
  if (pathnameOf(opts.upstream).endsWith(basePath)) return rest;
  return `${basePath}${rest}`;
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
      const preferHost = usesHostDockerRuntime();
      const target = preferHost
  ? (runtime.hostUrl || runtime.internalUrl || runtime.upstream)
  : (runtime.internalUrl || runtime.hostUrl || runtime.upstream);
      if (target) return target;
    }
    if (runtime.upstream) return runtime.upstream;
  }
  return projectBaseUpstream(project);
}

/**
 * The project's configured upstream origin, ignoring a self-referencing
 * gateway URL (see isKlyraGatewayUrl). Callers that need "the origin behind
 * project.baseUrl" must use this instead of reading baseUrl directly.
 */
export function projectBaseUpstream(project: Record<string, unknown> | null | undefined): string {
  const base = String(project?.baseUrl || '').trim();
  return isKlyraGatewayUrl(base) ? '' : base;
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
  // default APIs built inside Klyra to Klyra-hosted containers. A gateway URL
  // stored as baseUrl is not an upstream (see isKlyraGatewayUrl).
  const hasUpstream = Boolean(projectBaseUpstream(project));
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
/**
 * The deployment `source` column is constrained by the database
 * (api_build_deployments_source_check): only these exact values are legal.
 * Everything that writes a deployment row must pass its value through
 * normalizeDeploymentSource, or Postgres rejects the row with
 *   new row for relation "api_build_deployments" violates check constraint
 *   "api_build_deployments_source_check"
 */
export const DEPLOYMENT_SOURCES = ['External API', 'GitHub', 'Docker', 'Klyra Hosted'] as const;

export type DeploymentSource = (typeof DEPLOYMENT_SOURCES)[number];

/** Maps any value onto the constraint's allowed set, falling back when unknown. */
export function normalizeDeploymentSource(
  value: unknown,
  fallback: DeploymentSource = 'Klyra Hosted',
): DeploymentSource {
  const candidate = String(value ?? '').trim();
  return (DEPLOYMENT_SOURCES as readonly string[]).includes(candidate)
    ? (candidate as DeploymentSource)
    : fallback;
}

export function sanitizeContainerToken(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]$/, '');
  return token || 'api';
}

export const containerNameFor = (slug: string, version: string): string =>
  `klyra-api-${sanitizeContainerToken(slug)}-${sanitizeContainerToken(version)}`;

export const imageNameFor = (slug: string, version: string): string =>
  `klyra-api-${sanitizeContainerToken(slug)}:${sanitizeContainerToken(version) || 'latest'}`;
