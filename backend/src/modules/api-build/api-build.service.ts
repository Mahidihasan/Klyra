import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../../services/database.service';

export type ApiBuildProject = Record<string, unknown> & { id: string };

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const nowIso = () => new Date().toISOString();

export async function listProjects(): Promise<ApiBuildProject[]> {
  const result = await pool.query('SELECT project FROM api_build_projects ORDER BY updated_at DESC');
  return result.rows.map((row) => row.project as ApiBuildProject);
}
export async function getProject(id: string): Promise<ApiBuildProject | null> {
  const result = await pool.query('SELECT project FROM api_build_projects WHERE id = $1', [id]);
  return (result.rows[0]?.project as ApiBuildProject | undefined) ?? null;
}
export async function saveProject(project: ApiBuildProject): Promise<ApiBuildProject> {
  await pool.query(`INSERT INTO api_build_projects (id, project) VALUES ($1, $2::jsonb)
    ON CONFLICT (id) DO UPDATE SET project = EXCLUDED.project, updated_at = NOW()`, [project.id, JSON.stringify(project)]);
  return project;
}
export async function removeProject(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_projects WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function createProject(project: ApiBuildProject): Promise<ApiBuildProject> {
  await pool.query(
    'INSERT INTO api_build_projects (id, project) VALUES ($1, $2::jsonb)',
    [project.id, JSON.stringify(project)],
  );
  await ensureProjectDefaults(project.id);
  return project;
}

export async function updateProject(id: string, patch: Record<string, unknown>): Promise<ApiBuildProject | null> {
  const record = await getProject(id);
  if (!record) return null;
  const saved = await saveProject({ ...record, ...patch, updatedAt: nowIso() });
  return composeProject(saved.id);
}
export async function enqueueDeploy(projectId: string) {
  const result = await pool.query(`INSERT INTO api_build_jobs (project_id, type, payload)
    VALUES ($1, 'deploy', jsonb_build_object('requestedAt', NOW())) RETURNING id, status, created_at`, [projectId]);
  return result.rows[0];
}
export async function claimNextDeploy() {
  const result = await pool.query(`WITH next_job AS (
    SELECT id FROM api_build_jobs WHERE status = 'queued' AND type = 'deploy' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE api_build_jobs j SET status = 'running', started_at = NOW() FROM next_job WHERE j.id = next_job.id RETURNING j.*`);
  return result.rows[0] ?? null;
}
export async function completeDeploy(id: string) {
  await pool.query("UPDATE api_build_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1", [id]);
}
export async function getJob(id: string) {
  const result = await pool.query('SELECT id, project_id, type, status, error, created_at, started_at, completed_at FROM api_build_jobs WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}
export async function setProjectDeployment(projectId: string, deployment: Record<string, unknown>) {
  const current = await getProject(projectId);
  if (!current) return null;
  const saved = await saveProject({ ...current, status: 'healthy', deployment, updatedAt: nowIso() });
  return composeProject(saved.id);
}

/* ==========================================================================
 * Composition — rehydrates the ProviderProject record from its relational
 * children so the single-record API stays compatible with the UI.
 * ======================================================================== */

export async function composeProject(id: string): Promise<ApiBuildProject | null> {
  const record = await getProject(id);
  if (!record) return null;
  const endpoints = await listEndpoints(id);
  const plans = await listPlans(id);
  const consumers = await listConsumers(id);
  const keys = await listApiKeys(id);
  const versions = await listVersions(id);
  const activity = await listActivity(id);
  const totalRequests = endpoints.reduce((t, e) => t + e.totalRequests, 0);
  const latencyMs = totalRequests > 0
    ? Math.round(endpoints.reduce((t, e) => t + e.avgLatencyMs * e.totalRequests, 0) / totalRequests)
    : Math.round(num(record.latencyMs));
  const healthyCount = endpoints.filter((e) => e.isHealthy).length;
  const unhealthyCount = Math.max(endpoints.length - healthyCount, 0);
  const usage = await listUsage(id, '24h');
  const usageReqs = usage.reduce((t, b) => t + b.total, 0);
  const usageSuccess = usage.reduce((t, b) => t + b.success, 0);
  const reqs = Math.max(totalRequests, usageReqs);
  const revenue = plans.reduce((t, p) => t + p.subscribers * p.priceMonthly, 0);
  return {
    ...record,
    endpointCount: endpoints.length,
    schemaCount: Math.max(num(record.schemaCount), endpoints.length),
    plans,
    consumersList: consumers,
    apiKeys: keys,
    versions,
    activity,
    requests: reqs,
    requestsLabel: `${reqs >= 1000000 ? `${(reqs / 1000000).toFixed(1).replace(/\.0$/, '')}M` : reqs >= 1000 ? `${(reqs / 1000).toFixed(0)}K` : String(reqs)} requests`,
    latencyMs,
    successRate: reqs > 0 ? Math.round((usageSuccess / reqs) * 1000) / 10 : 100,
    consumers: consumers.length,
    revenue: Math.round(revenue),
    unhealthyCount,
    updatedAt: record.updatedAt,
  };
}

/* ==========================================================================
 * Defaults — a brand-new project gets a first version, a sane pricing ladder
 * and an audit entry. No fabricated runtime metrics, just real scaffolding.
 * ======================================================================== */

export async function ensureProjectDefaults(projectId: string) {
  await pool.query(
    `INSERT INTO api_build_versions (project_id, id, semver, status, notes, endpoints_count, is_default)
     VALUES ($1, 'v1.0.0', 'v1.0.0', 'draft', 'Initial draft', 0, TRUE)
     ON CONFLICT (project_id, semver) DO NOTHING`, [projectId]);
  const plans: { id: string; name: string; rpm: number; price: number; rl: number; over: number; trial: number }[] = [
    { id: 'plan-free', name: 'Free', rpm: 1000, price: 0, rl: 60, over: 0, trial: 0 },
    { id: 'plan-pro', name: 'Pro', rpm: 50000, price: 19, rl: 300, over: 0.4, trial: 14 },
    { id: 'plan-biz', name: 'Business', rpm: 500000, price: 79, rl: 2000, over: 0.25, trial: 14 },
  ];
  for (const p of plans) {
    await pool.query(
      `INSERT INTO api_build_plans (project_id, id, name, requests_per_month, price_monthly, rate_limit_per_min, overage_per_1k, trial_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, name) DO NOTHING`,
      [projectId, p.id, p.name, p.rpm, p.price, p.rl, p.over, p.trial]);
  }
  await addActivity(projectId, 'Project created', 'info');
}
/* ==========================================================================
 * Endpoints — detailed OpenAPI-backed endpoint catalog.
 * ======================================================================== */

export interface DetailedEndpointRow {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  category: string;
  authRequired: boolean;
  rateLimitPerMin: number;
  status: 'active' | 'beta' | 'deprecated';
  parameters: unknown[];
  requestBody: unknown | null;
  responses: unknown[];
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
  errorRate: number;
  isHealthy: boolean;
  updatedAt: string;
}

const mapEndpoint = (r: Record<string, unknown>): DetailedEndpointRow => ({
  id: String(r.id),
  method: String(r.method),
  path: String(r.path),
  summary: String(r.summary ?? ''),
  description: String(r.description ?? ''),
  category: String(r.category ?? 'General'),
  authRequired: r.auth_required === true,
  rateLimitPerMin: Math.round(num(r.rate_limit_per_min)),
  status: String(r.status || 'active') as DetailedEndpointRow['status'],
  parameters: Array.isArray(r.parameters) ? r.parameters : [],
  requestBody: r.request_body ?? null,
  responses: Array.isArray(r.responses) ? r.responses : [],
  avgLatencyMs: Math.round(num(r.avg_latency_ms)),
  p95LatencyMs: Math.round(num(r.p95_latency_ms)),
  totalRequests: Math.round(num(r.total_requests)),
  errorRate: Math.round(num(r.error_rate) * 1000) / 1000,
  isHealthy: r.is_healthy === true,
  updatedAt: String(r.updated_at ?? ''),
});

export async function listEndpoints(projectId: string): Promise<DetailedEndpointRow[]> {
  const result = await pool.query(
    `SELECT id, method, path, summary, description, category, auth_required, rate_limit_per_min, status,
            parameters, request_body, responses, avg_latency_ms, p95_latency_ms, total_requests, error_rate, is_healthy, updated_at
       FROM api_build_endpoints WHERE project_id = $1 ORDER BY path ASC`, [projectId]);
  return result.rows.map(mapEndpoint);
}

export async function getEndpoint(projectId: string, id: string): Promise<DetailedEndpointRow | null> {
  const result = await pool.query(
    `SELECT id, method, path, summary, description, category, auth_required, rate_limit_per_min, status,
            parameters, request_body, responses, avg_latency_ms, p95_latency_ms, total_requests, error_rate, is_healthy, updated_at
       FROM api_build_endpoints WHERE project_id = $1 AND id = $2`, [projectId, id]);
  return result.rows[0] ? mapEndpoint(result.rows[0]) : null;
}

/** Bulk imports endpoints discovered from an upstream OpenAPI document. */
export async function importEndpoints(projectId: string, endpoints: DetailedEndpointRow[]) {
  if (!endpoints.length) return;
  for (const ep of endpoints) {
    await pool.query(
      `INSERT INTO api_build_endpoints
         (project_id, id, method, path, summary, description, category, auth_required, rate_limit_per_min, status,
          parameters, request_body, responses, avg_latency_ms, p95_latency_ms, total_requests, error_rate, is_healthy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, 0, 0, 0, 0, TRUE)
       ON CONFLICT (project_id, method, path)
         DO UPDATE SET summary = EXCLUDED.summary, description = EXCLUDED.description,
                       auth_required = EXCLUDED.auth_required, parameters = EXCLUDED.parameters,
                       request_body = EXCLUDED.request_body, responses = EXCLUDED.responses, updated_at = NOW()`,
      [projectId, ep.id, ep.method, ep.path, ep.summary, ep.description, ep.category, ep.authRequired,
       ep.rateLimitPerMin, ep.status,
       JSON.stringify(ep.parameters), ep.requestBody ? JSON.stringify(ep.requestBody) : null, JSON.stringify(ep.responses)]);
  }
  await pool.query('UPDATE api_build_projects SET updated_at = NOW() WHERE id = $1', [projectId]);
  await addActivity(projectId, `Imported ${endpoints.length} endpoint${endpoints.length === 1 ? '' : 's'} from the OpenAPI specification`, 'ok');
}

export async function updateEndpoint(projectId: string, id: string, patch: Record<string, unknown>): Promise<DetailedEndpointRow | null> {
  const existing = await getEndpoint(projectId, id);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await pool.query(
    `UPDATE api_build_endpoints SET summary = $3, description = $4, category = $5, auth_required = $6, rate_limit_per_min = $7, status = $8, updated_at = NOW()
      WHERE project_id = $1 AND id = $2`,
    [projectId, id, String(next.summary), String(next.description), String(next.category),
     next.authRequired === true, Math.max(0, Math.round(num(next.rateLimitPerMin))), next.status]);
  return getEndpoint(projectId, id);
}

/** Telemetry updates metric columns directly and untouched by the update above. */
export async function setEndpointMetrics(projectId: string, id: string, metrics: { avg?: number; p95?: number; total?: number; errors?: number; healthy?: boolean }) {
  await pool.query(
    `UPDATE api_build_endpoints SET
       avg_latency_ms = CASE WHEN avg_latency_ms = 0 THEN $3 ELSE (avg_latency_ms * 0.9 + $3 * 0.1) END,
       p95_latency_ms = CASE WHEN p95_latency_ms = 0 THEN $4 ELSE (p95_latency_ms * 0.9 + $4 * 0.1) END,
       total_requests = total_requests + $5,
       error_rate = $6,
       is_healthy = $7,
       updated_at = NOW()
     WHERE project_id = $1 AND id = $2`,
    [projectId, id, Math.round(metrics.avg ?? 0), Math.round(metrics.p95 ?? 0),
     Math.round(metrics.total ?? 0), metrics.errors ?? 0, metrics.healthy !== false]);
}
/* ==========================================================================
 * Versions
 * ======================================================================== */

export interface VersionRow {
  id: string;
  semver: string;
  status: string;
  notes: string;
  endpointsCount: number;
  isDefault: boolean;
  releasedAt: string | null;
  changelog: Record<string, string[]>;
  createdAt: string;
}

const mapVersion = (r: Record<string, unknown>): VersionRow => ({
  id: String(r.id), semver: String(r.semver), status: String(r.status),
  notes: String(r.notes ?? ''), endpointsCount: Math.round(num(r.endpoints_count)),
  isDefault: r.is_default === true, releasedAt: r.released_at ? String(r.released_at) : null,
  changelog: r.changelog && typeof r.changelog === 'object' ? r.changelog as Record<string, string[]> : { added: [], modified: [], deprecated: [], breaking: [] },
  createdAt: String(r.created_at ?? ''),
});

export async function listVersions(projectId: string): Promise<VersionRow[]> {
  const result = await pool.query(
    `SELECT id, semver, status, notes, endpoints_count, is_default, released_at, changelog, created_at
       FROM api_build_versions WHERE project_id = $1 ORDER BY released_at DESC NULLS LAST, created_at DESC`, [projectId]);
  return result.rows.map(mapVersion);
}

export async function saveVersion(projectId: string, version: VersionRow): Promise<VersionRow> {
  const nextDefault = version.isDefault || version.status === 'published';
  if (nextDefault) {
    await pool.query('UPDATE api_build_versions SET is_default = FALSE WHERE project_id = $1', [projectId]);
  }
  await pool.query(
    `INSERT INTO api_build_versions (project_id, id, semver, status, notes, endpoints_count, is_default, released_at, changelog)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (project_id, id) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes,
       endpoints_count = EXCLUDED.endpoints_count, is_default = EXCLUDED.is_default, released_at = EXCLUDED.released_at,
       changelog = EXCLUDED.changelog`,
    [projectId, version.id, version.semver, version.status, version.notes, version.endpointsCount,
     nextDefault, version.releasedAt ? version.releasedAt : null, JSON.stringify(version.changelog)]);
  if (nextDefault) {
    await pool.query(
      `UPDATE api_build_projects SET project = jsonb_set(project, '{version}', to_jsonb($2::text)) WHERE id = $1`,
      [projectId, version.semver]);
  }
  return version;
}

export async function deleteVersion(projectId: string, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_versions WHERE project_id = $1 AND id = $2', [projectId, id]);
  return (result.rowCount ?? 0) > 0;
}

/* ==========================================================================
 * Plans
 * ======================================================================== */

export interface PlanRow {
  id: string;
  name: string;
  requestsPerMonth: number;
  priceMonthly: number;
  rateLimitPerMin: number;
  overagePer1k: number;
  trialDays: number;
  subscribers: number;
  createdAt: string;
}

const mapPlan = (r: Record<string, unknown>): PlanRow => ({
  id: String(r.id), name: String(r.name), requestsPerMonth: Math.round(num(r.requests_per_month)),
  priceMonthly: Math.round(num(r.price_monthly) * 100) / 100, rateLimitPerMin: Math.round(num(r.rate_limit_per_min)),
  overagePer1k: Math.round(num(r.overage_per_1k) * 100) / 100, trialDays: Math.round(num(r.trial_days)),
  subscribers: Math.round(num(r.subscribers)), createdAt: String(r.created_at ?? ''),
});

export async function listPlans(projectId: string): Promise<PlanRow[]> {
  const result = await pool.query(
    'SELECT id, name, requests_per_month, price_monthly, rate_limit_per_min, overage_per_1k, trial_days, subscribers, created_at FROM api_build_plans WHERE project_id = $1 ORDER BY price_monthly ASC',
    [projectId]);
  return result.rows.map(mapPlan);
}

export async function savePlan(projectId: string, plan: PlanRow): Promise<PlanRow> {
  await pool.query(
    `INSERT INTO api_build_plans (project_id, id, name, requests_per_month, price_monthly, rate_limit_per_min, overage_per_1k, trial_days, subscribers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (project_id, name) DO UPDATE SET requests_per_month = EXCLUDED.requests_per_month,
       price_monthly = EXCLUDED.price_monthly, rate_limit_per_min = EXCLUDED.rate_limit_per_min,
       overage_per_1k = EXCLUDED.overage_per_1k, trial_days = EXCLUDED.trial_days`,
    [projectId, plan.id, plan.name, plan.requestsPerMonth, plan.priceMonthly, plan.rateLimitPerMin,
     plan.overagePer1k, plan.trialDays, plan.subscribers]);
  return plan;
}

export async function deletePlan(projectId: string, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_plans WHERE project_id = $1 AND id = $2', [projectId, id]);
  return (result.rowCount ?? 0) > 0;
}
/* ==========================================================================
 * Consumers
 * ======================================================================== */

export interface ConsumerRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  requests: number;
  joinedAt: string;
}

const mapConsumer = (r: Record<string, unknown>): ConsumerRow => ({
  id: String(r.id), name: String(r.name), email: String(r.email ?? ''),
  plan: String(r.plan ?? 'Free'), status: String(r.status ?? 'active'),
  requests: Math.round(num(r.requests)), joinedAt: String(r.joined_at ?? ''),
});

export async function listConsumers(projectId: string): Promise<ConsumerRow[]> {
  const result = await pool.query(
    'SELECT id, name, email, plan, status, requests, joined_at FROM api_build_consumers WHERE project_id = $1 ORDER BY joined_at DESC',
    [projectId]);
  return result.rows.map(mapConsumer);
}

export async function saveConsumer(projectId: string, consumer: ConsumerRow): Promise<ConsumerRow> {
  const id = consumer.id || randomUUID();
  await pool.query(
    `INSERT INTO api_build_consumers (id, project_id, name, email, plan, status, requests, joined_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, plan = EXCLUDED.plan,
       status = EXCLUDED.status, requests = EXCLUDED.requests`,
    [id, projectId, consumer.name, consumer.email, consumer.plan, consumer.status, consumer.requests,
     consumer.joinedAt ? consumer.joinedAt : nowIso()]);
  return { ...consumer, id };
}

export async function deleteConsumer(projectId: string, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_consumers WHERE project_id = $1 AND id = $2', [projectId, id]);
  return (result.rowCount ?? 0) > 0;
}

/* ==========================================================================
 * API keys — plaintext secret returned exactly once; only the SHA-256 hash is
 * persisted.
 * ======================================================================== */

export interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  consumer: string;
  plan: string;
  createdAt: string;
  lastUsed: string | null;
  revoked: boolean;
}

const mapKey = (r: Record<string, unknown>): ApiKeyRow => ({
  id: String(r.id), label: String(r.label), prefix: String(r.prefix),
  consumer: String(r.consumer ?? ''), plan: String(r.plan ?? 'Free'),
  createdAt: String(r.created_at ?? ''), lastUsed: r.last_used ? String(r.last_used) : null,
  revoked: r.revoked === true,
});

export async function listApiKeys(projectId: string): Promise<ApiKeyRow[]> {
  const result = await pool.query(
    `SELECT id, label, prefix, consumer, plan, created_at, last_used, revoked
       FROM api_build_api_keys WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]);
  return result.rows.map(mapKey);
}

/** Creates a credential; returns the row plus the one-time plaintext secret. */
export async function createApiKey(projectId: string, input: { label: string; consumer?: string; plan?: string; environment?: string }) {
  const id = `key-${randomUUID().slice(0, 8)}`;
  const env = input.environment === 'test' ? 'test' : 'live';
  const secret = `kly_${env}_${randomHex(24)}`;
  const prefix = `kly_${env}_${secret.slice(7, 11)}`;
  const hash = hashSecret(secret);
  await pool.query(
    `INSERT INTO api_build_api_keys (id, project_id, label, prefix, secret_hash, consumer, plan)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, projectId, input.label, prefix, hash, input.consumer ?? '', input.plan ?? 'Free']);
  return { id, label: input.label, prefix, consumer: input.consumer ?? '', plan: input.plan ?? 'Free', createdAt: nowIso(), lastUsed: null, revoked: false, secret };
}

export async function updateApiKey(projectId: string, id: string, patch: { label?: string; plan?: string; revoked?: boolean; consumer?: string }) {
  const current = await pool.query('SELECT id, plan, label, revoked FROM api_build_api_keys WHERE project_id = $1 AND id = $2', [projectId, id]);
  if (!current.rows[0]) return null;
  await pool.query(
    `UPDATE api_build_api_keys SET
       label = COALESCE($3, label), plan = COALESCE($4, plan), consumer = COALESCE($5, consumer),
       revoked = COALESCE($6, revoked)
     WHERE project_id = $1 AND id = $2`,
    [projectId, id, patch.label, patch.plan, patch.consumer, patch.revoked === undefined ? null : patch.revoked]);
  const row = await pool.query(
    `SELECT id, label, prefix, consumer, plan, created_at, last_used, revoked
       FROM api_build_api_keys WHERE project_id = $1 AND id = $2`, [projectId, id]);
  return mapKey(row.rows[0]);
}

export async function deleteApiKey(projectId: string, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_api_keys WHERE project_id = $1 AND id = $2', [projectId, id]);
  return (result.rowCount ?? 0) > 0;
}

export async function touchApiKey(projectId: string, prefix: string) {
  await pool.query(
    `UPDATE api_build_api_keys SET last_used = NOW() WHERE project_id = $1 AND prefix = $2`, [projectId, prefix]);
}

const randomHex = (bytes: number) => {
  const buf = Buffer.allocUnsafe(bytes);
  for (let i = 0; i < bytes; i += 1) buf[i] = Math.floor(Math.random() * 256);
  return Buffer.from(buf).toString('hex');
};

export const hashSecret = (secret: string) => {
  const digest = createHash('sha256');
  digest.update(secret);
  return digest.digest('hex');
};
/* ==========================================================================
 * Activity — immutable audit feed.
 * ======================================================================== */

export interface ActivityRow { id: string; label: string; at: string; kind: string; }

const mapActivity = (r: Record<string, unknown>): ActivityRow => ({
  id: String(r.id), label: String(r.label), at: String(r.created_at ?? ''), kind: String(r.kind ?? 'info'),
});

export async function listActivity(projectId: string): Promise<ActivityRow[]> {
  const result = await pool.query(
    'SELECT id, label, kind, created_at FROM api_build_activity WHERE project_id = $1 ORDER BY created_at DESC LIMIT 60',
    [projectId]);
  return result.rows.map(mapActivity);
}

export async function addActivity(projectId: string, label: string, kind = 'info'): Promise<void> {
  await pool.query(
    `INSERT INTO api_build_activity (project_id, label, kind) VALUES ($1, $2, $3)`,
    [projectId, label.slice(0, 400), ['info', 'ok', 'warning', 'critical'].includes(kind) ? kind : 'info']);
}

/* ==========================================================================
 * Deployments — real deployment records.
 * ======================================================================== */

export interface DeploymentRow {
  id: string;
  version: string;
  environment: string;
  source: string;
  branch: string | null;
  commitHash: string | null;
  commitMessage: string | null;
  region: string;
  status: string;
  url: string;
  deployedAt: string;
  durationSec: number;
  author: string;
  logs: string[];
  envVars: unknown[];
}

const mapDeployment = (r: Record<string, unknown>): DeploymentRow => ({
  id: String(r.id), version: String(r.version), environment: String(r.environment),
  source: String(r.source), branch: r.branch ? String(r.branch) : null,
  commitHash: r.commit_hash ? String(r.commit_hash) : null,
  commitMessage: r.commit_message ? String(r.commit_message) : null,
  region: String(r.region ?? 'auto'), status: String(r.status),
  url: String(r.url ?? ''), deployedAt: String(r.deployed_at ?? ''),
  durationSec: Math.round(num(r.duration_sec)), author: String(r.author ?? 'system'),
  logs: Array.isArray(r.logs) ? r.logs : [], envVars: Array.isArray(r.env_vars) ? r.env_vars : [],
});

export async function listDeployments(projectId: string): Promise<DeploymentRow[]> {
  const result = await pool.query(
    `SELECT id, version, environment, source, branch, commit_hash, commit_message, region, status, url, deployed_at, duration_sec, author, logs, env_vars
       FROM api_build_deployments WHERE project_id = $1 ORDER BY deployed_at DESC`, [projectId]);
  return result.rows.map(mapDeployment);
}

export async function addDeployment(projectId: string, deployment: Partial<DeploymentRow>): Promise<DeploymentRow> {
  const result = await pool.query(
    `INSERT INTO api_build_deployments
       (project_id, version, environment, source, branch, commit_hash, commit_message, region, status, url, duration_sec, author, logs, env_vars)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
     RETURNING id`,
    [projectId, deployment.version ?? 'v1.0.0', deployment.environment ?? 'development',
     deployment.source ?? 'Klyra Hosted', deployment.branch ?? null, deployment.commitHash ?? null,
     deployment.commitMessage ?? null, deployment.region ?? 'auto', deployment.status ?? 'building',
     deployment.url ?? '', deployment.durationSec ?? 0, deployment.author ?? 'system',
     JSON.stringify(deployment.logs ?? ['Deployment requested']),
     JSON.stringify(deployment.envVars ?? [])]);
  await addActivity(projectId, `Deployment ${deployment.version ?? ''} ${deployment.status ?? 'building'} to ${deployment.environment ?? 'development'}`, deployment.status === 'failed' ? 'warning' : 'ok');
  return mapDeployment((await pool.query(
    `SELECT id, version, environment, source, branch, commit_hash, commit_message, region, status, url, deployed_at, duration_sec, author, logs, env_vars
       FROM api_build_deployments WHERE id = $1`, [result.rows[0].id])).rows[0]);
}

export async function updateDeploymentStatus(id: string, status: string, patch: { log?: string[]; durationSec?: number } = {}) {
  await pool.query(
    `UPDATE api_build_deployments SET status = $2, duration_sec = COALESCE($3, duration_sec),
       logs = CASE WHEN $4::jsonb IS NULL THEN logs ELSE $4::jsonb END
     WHERE id = $1`,
    [id, status, patch.durationSec ?? null, patch.log ? JSON.stringify(patch.log) : null]);
}
/* ==========================================================================
 * Logs — one row per observed request; written by telemetry and workspace.
 * ======================================================================== */

export interface LogRow {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  consumerName: string;
  keyPrefix: string;
  version: string;
  region: string;
  ipAddress: string;
  requestHeaders: Record<string, string>;
  queryParams: Record<string, string>;
  requestBody: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  trace: { stage: string; durationMs: number }[];
}

const mapLog = (r: Record<string, unknown>): LogRow => ({
  id: String(r.id), timestamp: String(r.created_at ?? ''), method: String(r.method),
  path: String(r.path), statusCode: Math.round(num(r.status_code)),
  latencyMs: Math.round(num(r.latency_ms)), consumerName: String(r.consumer_name ?? 'anonymous'),
  keyPrefix: String(r.key_prefix ?? ''), version: String(r.version ?? ''), region: String(r.region ?? ''),
  ipAddress: String(r.ip_address ?? ''),
  requestHeaders: r.request_headers && typeof r.request_headers === 'object' ? r.request_headers as Record<string, string> : {},
  queryParams: r.query_params && typeof r.query_params === 'object' ? r.query_params as Record<string, string> : {},
  requestBody: String(r.request_body ?? ''),
  responseHeaders: r.response_headers && typeof r.response_headers === 'object' ? r.response_headers as Record<string, string> : {},
  responseBody: String(r.response_body ?? ''),
  trace: Array.isArray(r.trace) ? r.trace : [],
});

export async function listLogs(projectId: string, options: { limit?: number; method?: string; path?: string; status?: number } = {}) {
  const clauses = ['project_id = $1'];
  const params: unknown[] = [projectId];
  if (options.method && options.method !== 'ALL') { params.push(options.method); clauses.push(`method = $${params.length}`); }
  if (options.path) { params.push(`%${options.path}%`); clauses.push(`path ILIKE $${params.length}`); }
  if (options.status) { params.push(Math.round(num(options.status))); clauses.push(`status_code = $${params.length}`); }
  params.push(Math.min(Math.max(options.limit ?? 200, 1), 500));
  const result = await pool.query(
    `SELECT id, method, path, status_code, latency_ms, consumer_name, key_prefix, version, region,
            ip_address, request_headers, query_params, request_body, response_headers, response_body, trace, created_at
       FROM api_build_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params);
  return result.rows.map(mapLog);
}

export async function appendLog(projectId: string, log: {
  method: string; path: string; statusCode: number; latencyMs?: number; consumerName?: string;
  keyPrefix?: string; version?: string; region?: string; ipAddress?: string;
  requestHeaders?: Record<string, string>; queryParams?: Record<string, string>;
  requestBody?: string; responseHeaders?: Record<string, string>; responseBody?: string;
  trace?: { stage: string; durationMs: number }[];
}): Promise<LogRow> {
  const result = await pool.query(
    `INSERT INTO api_build_logs
       (project_id, method, path, status_code, latency_ms, consumer_name, key_prefix, version, region,
        ip_address, request_headers, query_params, request_body, response_headers, response_body, trace)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15, $16::jsonb)
     RETURNING id`,
    [projectId, log.method, log.path, Math.round(num(log.statusCode)), Math.round(num(log.latencyMs)),
     log.consumerName || 'anonymous', log.keyPrefix ?? '', log.version ?? '', log.region ?? 'sg-edge',
     log.ipAddress ?? '', JSON.stringify(log.requestHeaders ?? {}), JSON.stringify(log.queryParams ?? {}),
     (log.requestBody ?? '').slice(0, 20000), JSON.stringify(log.responseHeaders ?? {}),
     (log.responseBody ?? '').slice(0, 20000), JSON.stringify(log.trace ?? [])]);
  const row = await pool.query(
    `SELECT id, method, path, status_code, latency_ms, consumer_name, key_prefix, version, region,
            ip_address, request_headers, query_params, request_body, response_headers, response_body, trace, created_at
       FROM api_build_logs WHERE id = $1`, [result.rows[0].id]);
  return mapLog(row.rows[0]);
}
/* ==========================================================================
 * Monitoring — incidents and alert rules.
 * ======================================================================== */

export interface IncidentRow {
  id: string;
  title: string;
  severity: 'Critical' | 'Major' | 'Minor';
  status: string;
  startedAt: string;
  resolvedAt: string | null;
  affectedEndpoints: string[];
  summary: string;
  postmortem: string | null;
}

const mapIncident = (r: Record<string, unknown>): IncidentRow => ({
  id: String(r.id), title: String(r.title),
  severity: String(r.severity) as IncidentRow['severity'], status: String(r.status),
  startedAt: String(r.started_at ?? ''), resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
  affectedEndpoints: Array.isArray(r.affected_endpoints) ? r.affected_endpoints : [],
  summary: String(r.summary ?? ''), postmortem: r.postmortem ? String(r.postmortem) : null,
});

export async function listIncidents(projectId: string): Promise<IncidentRow[]> {
  const result = await pool.query(
    'SELECT id, title, severity, status, started_at, resolved_at, affected_endpoints, summary, postmortem FROM api_build_incidents WHERE project_id = $1 ORDER BY started_at DESC',
    [projectId]);
  return result.rows.map(mapIncident);
}

export async function saveIncident(projectId: string, incident: Partial<IncidentRow> & { title: string }): Promise<IncidentRow> {
  const id = incident.id || `inc-${randomUUID().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO api_build_incidents (id, project_id, title, severity, status, started_at, resolved_at, affected_endpoints, summary, postmortem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     ON CONFLICT (project_id, id) DO UPDATE SET title = EXCLUDED.title, severity = EXCLUDED.severity,
       status = EXCLUDED.status, resolved_at = EXCLUDED.resolved_at, affected_endpoints = EXCLUDED.affected_endpoints,
       summary = EXCLUDED.summary, postmortem = EXCLUDED.postmortem`,
    [id, projectId, incident.title, incident.severity ?? 'Major', incident.status ?? 'Investigating',
     incident.startedAt ?? nowIso(), incident.resolvedAt ?? null, JSON.stringify(incident.affectedEndpoints ?? []),
     incident.summary ?? '', incident.postmortem ?? null]);
  const row = await pool.query(
    'SELECT id, title, severity, status, started_at, resolved_at, affected_endpoints, summary, postmortem FROM api_build_incidents WHERE project_id = $1 AND id = $2',
    [projectId, id]);
  return mapIncident(row.rows[0]);
}

export interface AlertRuleRow {
  id: string;
  name: string;
  metric: 'p95_latency' | 'error_rate' | 'uptime' | 'rate_limit';
  condition: '>' | '<';
  threshold: number;
  unit: string;
  durationSec: number;
  channels: string[];
  enabled: boolean;
  lastTriggered: string | null;
}

const mapAlertRule = (r: Record<string, unknown>): AlertRuleRow => ({
  id: String(r.id), name: String(r.name),
  metric: String(r.metric) as AlertRuleRow['metric'], condition: String(r.condition) as AlertRuleRow['condition'],
  threshold: num(r.threshold), unit: String(r.unit ?? ''), durationSec: Math.round(num(r.duration_sec)),
  channels: Array.isArray(r.channels) ? r.channels : [], enabled: r.enabled === true,
  lastTriggered: r.last_triggered ? String(r.last_triggered) : null,
});

export async function listAlertRules(projectId: string): Promise<AlertRuleRow[]> {
  const result = await pool.query(
    'SELECT id, name, metric, condition, threshold, unit, duration_sec, channels, enabled, last_triggered FROM api_build_alert_rules WHERE project_id = $1 ORDER BY created_at ASC',
    [projectId]);
  return result.rows.map(mapAlertRule);
}

export async function saveAlertRule(projectId: string, rule: Partial<AlertRuleRow> & { name: string; metric: AlertRuleRow['metric']; threshold: number }): Promise<AlertRuleRow> {
  const id = rule.id || `alert-${randomUUID().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO api_build_alert_rules (id, project_id, name, metric, condition, threshold, unit, duration_sec, channels, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT (project_id, id) DO UPDATE SET name = EXCLUDED.name, metric = EXCLUDED.metric,
       condition = EXCLUDED.condition, threshold = EXCLUDED.threshold, unit = EXCLUDED.unit,
       duration_sec = EXCLUDED.duration_sec, channels = EXCLUDED.channels, enabled = EXCLUDED.enabled`,
    [id, projectId, rule.name, rule.metric, rule.condition ?? '>', rule.threshold, rule.unit ?? '',
     rule.durationSec ?? 300, JSON.stringify(rule.channels ?? ['email']), rule.enabled !== false]);
  const row = await pool.query(
    'SELECT id, name, metric, condition, threshold, unit, duration_sec, channels, enabled, last_triggered FROM api_build_alert_rules WHERE project_id = $1 AND id = $2',
    [projectId, id]);
  return mapAlertRule(row.rows[0]);
}

export async function deleteAlertRule(projectId: string, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_alert_rules WHERE project_id = $1 AND id = $2', [projectId, id]);
  return (result.rowCount ?? 0) > 0;
}
/* ==========================================================================
 * Usage — time-series buckets. Every value comes from observed requests.
 * ======================================================================== */

export interface UsageBucket {
  label: string;
  total: number;
  success: number;
  clientErr: number;
  serverErr: number;
  rateLim: number;
  p95: number;
}

const RANGE_MINUTES: Record<string, number> = { '24h': 24 * 60, '7d': 7 * 24 * 60, '30d': 30 * 24 * 60 };

export async function listUsage(projectId: string, range = '24h'): Promise<UsageBucket[]> {
  const minutes = RANGE_MINUTES[range] ?? RANGE_MINUTES['24h'];
  const bucketCount = range === '24h' ? 24 : range === '7d' ? 14 : 30;
  const widthMinutes = minutes / bucketCount;
  const result = await pool.query(
    `SELECT bucket, requests, success, client_error, server_error, rate_limited, p95_ms
       FROM api_build_usage
      WHERE project_id = $1 AND bucket >= NOW() - ($2 || ' minutes')::interval
      ORDER BY bucket ASC`,
    [projectId, String(minutes)]);
  const byBucket = new Map<string, UsageBucket>();
  for (const r of result.rows) {
    const label = range === '24h'
      ? `${new Date(String(r.bucket)).getUTCHours()}:00`
      : new Date(String(r.bucket)).toISOString().slice(5, 10);
    byBucket.set(label, {
      label,
      total: Math.round(num(r.requests)),
      success: Math.round(num(r.success)),
      clientErr: Math.round(num(r.client_error)),
      serverErr: Math.round(num(r.server_error)),
      rateLim: Math.round(num(r.rate_limited)),
      p95: Math.round(num(r.p95_ms)),
    });
  }
  // Merge into the fixed-width bucket grid so charts have stable axes.
  const merged: UsageBucket[] = [];
  const now = Date.now();
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const bucketTime = new Date(now - i * widthMinutes * 60 * 1000);
    const label = range === '24h'
      ? `${bucketTime.getUTCHours()}:00`
      : bucketTime.toISOString().slice(5, 10);
    const existing = byBucket.get(label);
    merged.push(existing ?? { label, total: 0, success: 0, clientErr: 0, serverErr: 0, rateLim: 0, p95: 0 });
  }
  return merged;
}

export async function recordUsage(projectId: string, bucket: { requests: number; success: number; clientErr: number; serverErr: number; rateLim: number; p95: number }) {
  const bucketTime = new Date();
  bucketTime.setUTCMinutes(0, 0, 0);
  await pool.query(
    `INSERT INTO api_build_usage (project_id, bucket, requests, success, client_error, server_error, rate_limited, p95_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (project_id, bucket) DO UPDATE SET
       requests = api_build_usage.requests + EXCLUDED.requests,
       success = api_build_usage.success + EXCLUDED.success,
       client_error = api_build_usage.client_error + EXCLUDED.client_error,
       server_error = api_build_usage.server_error + EXCLUDED.server_error,
       rate_limited = api_build_usage.rate_limited + EXCLUDED.rate_limited,
       p95_ms = GREATEST(api_build_usage.p95_ms, EXCLUDED.p95_ms)`,
    [projectId, bucketTime.toISOString(), Math.round(num(bucket.requests)), Math.round(num(bucket.success)),
     Math.round(num(bucket.clientErr)), Math.round(num(bucket.serverErr)), Math.round(num(bucket.rateLim)),
     Math.round(num(bucket.p95))]);
}
/* ==========================================================================
 * Analytics — aggregated from endpoints, logs and usage. Never fabricated.
 * ======================================================================== */

export async function computeAnalytics(projectId: string) {
  const endpoints = await listEndpoints(projectId);
  const usage = await listUsage(projectId, '7d');
  const logs = await listLogs(projectId, { limit: 200 });
  const total = usage.reduce((t, b) => t + b.total, 0);
  const success = usage.reduce((t, b) => t + b.success, 0);
  const errors = usage.reduce((t, b) => t + b.clientErr + b.serverErr, 0);
  const rateLimited = usage.reduce((t, b) => t + b.rateLim, 0);
  const weighted = endpoints.reduce((t, e) => t + e.totalRequests, 0);
  const avgLatency = weighted > 0
    ? Math.round(endpoints.reduce((t, e) => t + e.avgLatencyMs * e.totalRequests, 0) / weighted)
    : 0;
  const p95 = total > 0 ? Math.max(...usage.map((b) => b.p95), 0) : 0;
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 100;
  const errorRate = total > 0 ? Math.round((errors / total) * 10000) / 100 : 0;
  return {
    timeRange: '7d' as const,
    traffic: usage,
    totals: { total, success, errors, rateLimited, avgLatency, p95, successRate, errorRate },
    endpoints: {
      total: endpoints.length,
      healthy: endpoints.filter((e) => e.isHealthy).length,
      top: [...endpoints].sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 10),
    },
    recentStatusCounts: logs.reduce<Record<string, number>>((acc, l) => {
      const key = `${Math.floor(l.statusCode / 100)}xx`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

/* ==========================================================================
 * Insights — derived from real project state (endpoints, plans, incidents).
 * ======================================================================== */

export interface InsightRow {
  id: string;
  category: 'Performance' | 'Usage' | 'Business' | 'Version' | 'Security' | 'Revenue';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  description: string;
  actionText: string;
  actionType: 'navigate_tab' | 'open_drawer' | 'open_modal';
  targetTab?: string;
}

export async function computeInsights(projectId: string): Promise<InsightRow[]> {
  const project = await getProject(projectId);
  if (!project) return [];
  const endpoints = await listEndpoints(projectId);
  const plans = await listPlans(projectId);
  const incidents = await listIncidents(projectId);
  const usage = await listUsage(projectId, '24h');
  const insights: InsightRow[] = [];

  const total = usage.reduce((t, b) => t + b.total, 0);
  const errors = usage.reduce((t, b) => t + b.clientErr + b.serverErr, 0);
  const errorRate = total > 0 ? (errors / total) * 100 : 0;
  const p95 = Math.max(...usage.map((b) => b.p95), 0);

  if (endpoints.length === 0) {
    insights.push({
      id: 'no-endpoints', category: 'Usage', severity: 'warning',
      title: 'No endpoints imported yet',
      description: 'Connect an upstream OpenAPI specification to populate the endpoint catalog and unlock traffic analytics.',
      actionText: 'Import spec', actionType: 'navigate_tab', targetTab: 'api',
    });
  }
  if (errorRate > 2) {
    insights.push({
      id: 'error-rate', category: 'Performance', severity: errorRate > 5 ? 'critical' : 'warning',
      title: `Error rate at ${errorRate.toFixed(1)}%`,
      description: `${errors} of the last ${total} requests failed. Review endpoint health and recent deployments.`,
      actionText: 'View monitoring', actionType: 'navigate_tab', targetTab: 'monitoring',
    });
  }
  if (p95 > 500) {
    insights.push({
      id: 'latency', category: 'Performance', severity: 'warning',
      title: `p95 latency reached ${Math.round(p95)}ms`,
      description: 'Latency exceeded the 500ms comfort threshold in the last 24h window. Consider tuning timeouts or caching.',
      actionText: 'View analytics', actionType: 'navigate_tab', targetTab: 'analytics',
    });
  }
  if (plans.length > 0 && plans.every((p) => p.subscribers === 0)) {
    insights.push({
      id: 'no-subscribers', category: 'Business', severity: 'info',
      title: 'Pricing plans have no subscribers yet',
      description: 'Publish the API to the marketplace so consumers can discover it and subscribe to a plan.',
      actionText: 'Review pricing', actionType: 'navigate_tab', targetTab: 'plans',
    });
  }
  const open = incidents.filter((i) => i.status !== 'Resolved');
  if (open.length > 0) {
    insights.push({
      id: 'open-incidents', category: 'Security', severity: open.some((i) => i.severity === 'Critical') ? 'critical' : 'warning',
      title: `${open.length} open incident${open.length === 1 ? '' : 's'}`,
      description: open.map((i) => i.title).join('; '),
      actionText: 'Open monitoring', actionType: 'navigate_tab', targetTab: 'monitoring',
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: 'all-healthy', category: 'Usage', severity: 'success',
      title: 'All systems nominal',
      description: 'Endpoints healthy, error rate nominal and no open incidents. Keep shipping.',
      actionText: 'View analytics', actionType: 'navigate_tab', targetTab: 'analytics',
    });
  }
  return insights;
}
