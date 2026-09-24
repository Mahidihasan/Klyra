import express, { Router } from 'express';
import {
  addActivity,
  addDeployment,
  appendLog,
  completeDeploy,
  composeProject,
  computeAnalytics,
  computeInsights,
  createApiKey,
  createProject,
  deleteAlertRule,
  deleteApiKey,
  deleteConsumer,
  deletePlan,
  deleteVersion,
  enqueueDeploy,
  getEndpoint,
  getJob,
  getProject,
  importEndpoints,
  listActivity,
  listAlertRules,
  listApiKeys,
  listConsumers,
  listDeployments,
  listEndpoints,
  listIncidents,
  listLogs,
  listPlans,
  listProjects,
  listUsage,
  listVersions,
  recordUsage,
  removeProject,
  saveAlertRule,
  saveIncident,
  savePlan,
  saveConsumer,
  saveVersion,
  touchApiKey,
  updateApiKey,
  updateDeploymentStatus,
  updateEndpoint,
  updateProject,
} from './api-build.service';
import { addCategory, listCategories, removeCategory } from './api-build.categories';
import { detectUpstream, extractOperations, extractOperationsFromSpec } from './api-build.detect';
import { probeProjectHealth } from './api-build.telemetry';
import {
  getDraftState,
  saveDraftConfig,
  promoteDraftToLive,
  discardDraft,
  computeChanges,
  validateDraft,
  recordAuditEvent,
  getAuditLog,
} from './api-build.draft';
import {
  createOperation,
  getOperation,
  listOperations,
  cancelOperation,
  retryOperation,
  type OperationType,
  type OperationState,
} from './api-build.operations';
import {
  listResourceHistory,
  getRestoreSnapshot,
  recordResourceHistory,
} from './api-build.history';
import {
  buildGatewayUrl,
  normalizeDeploymentSource,
  sanitizeProjectForClient,
  slugFromProjectId,
} from './api-build.deployment';
import multer from 'multer';
import { processProjectZip, inspectUploadedProject, prepareGitHubSource } from './api-build.upload';

const projectUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

const router = Router();

const ok = (res: express.Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });
const fail = (res: express.Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, error: { code, message } });
const validId = (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 160;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const numField = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Canonical gateway URL construction lives in ./api-build.deployment.ts — the
 * single source of truth shared by project creation, read-time healing and the
 * deploy pipeline. The gateway router is mounted at `/api/gateway` (app.ts) and
 * every advertised URL is built from the same GATEWAY_ROUTE_PREFIX, so the
 * advertised URL and the actual Express route can never diverge again.
 */

const newProjectRecord = (body: Record<string, unknown>) => {
  const name = str(body.name).trim() || 'Untitled API';
  const slug =
    str(body.slug) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') ||
    `api-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id: `proj-${slug}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    slug,
    description: str(body.description, 'A new Klyra API project.'),
    category: str(body.category, 'AI / Developer Tools'),
    status: 'draft' as const,
    environment: 'development' as const,
    version: 'v1.0.0',
    sourceKind: str(body.sourceKind, 'existing'),
    dockerSourceMode: str(body.dockerSourceMode, 'image') as 'image' | 'folder',
    dockerImage: str(body.dockerImage, ''),
    dockerUploadId: str(body.dockerUploadId, ''),
    dockerfilePath: str(body.dockerfilePath, 'Dockerfile'),
    buildContext: str(body.buildContext, '.'),
    dockerPort: numField(body.dockerPort, 8080),
    readinessMode: str(body.readinessMode, 'auto'),
    readinessPath: str(body.readinessPath, ''),
    baseUrl: '',
    openApiUrl: '',
    gatewayUrl: buildGatewayUrl(slug),
    authKind: 'apiKey' as const,
    rateLimitPerMin: 100,
    healthCheckPath: '/health',
    requests: 0,
    requestsLabel: '0 requests',
    successRate: 100,
    latencyMs: 0,
    consumers: 0,
    revenue: 0,
    endpointCount: 0,
    schemaCount: 0,
    visibility: 'private' as const,
    published: false,
    createdAt: now,
    updatedAt: now,
    deployment: {
      kind: 'external' as const,
      status: 'queued' as const,
      providerUrl: '',
      environment: 'development' as const,
      version: 'v1.0.0',
      lastHealthCheck: 'not yet checked',
      log: ['Project created — choose an API source to continue.'],
    },
    detection: null,
    plans: [],
    consumersList: [],
    apiKeys: [],
    versions: [],
    activity: [],
    corsOrigins: '*',
    cacheTtlSeconds: 0,
    retryStrategy: 'none',
    connectTimeoutMs: 5000,
    requestTimeoutMs: 30000,
    stripBasePath: false,
    authHeaderName: 'Authorization',
    ipAllowlist: '',
    tags: str(body.category),
  };
};

/* Projects — full lifecycle. POST creates the record AND its defaults. */
router.get('/projects', async (_req, res) => {
  try {
    ok(
      res,
      (await listProjects()).map((project) =>
        sanitizeProjectForClient(project as Record<string, unknown>),
      ),
    );
  } catch {
    fail(res, 503, 'DATABASE_UNAVAILABLE', 'Project storage is unavailable.');
  }
});

router.post('/projects', async (req, res) => {
  try {
    ok(
      res,
      sanitizeProjectForClient(
        (await createProject(newProjectRecord(req.body || {}))) as Record<string, unknown>,
      ),
    );
  } catch (error) {
    fail(
      res,
      400,
      'INVALID_PROJECT',
      error instanceof Error ? error.message : 'Could not create the project.',
    );
  }
});

router.get('/projects/:id', async (req, res) => {
  const project = await composeProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
  ok(res, sanitizeProjectForClient(project as Record<string, unknown>));
});

router.put('/projects/:id', async (req, res) => {
  if (!validId(req.params.id) || !req.body || typeof req.body !== 'object')
    return fail(res, 400, 'INVALID_PROJECT', 'A valid project payload is required.');

  // Governance: capture the previous record for audit + resource history.
  const actor = str(req.headers['x-actor-id'], 'system');
  const reason = str(req.headers['x-change-reason'], '') || undefined;
  const before = await getProject(req.params.id);
  if (!before) return fail(res, 404, 'NOT_FOUND', 'Project not found.');

  const project = await updateProject(req.params.id, req.body);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');

  const changedKeys = Object.keys(req.body).filter(
    (k) =>
      JSON.stringify((before as Record<string, unknown>)[k]) !==
      JSON.stringify((project as Record<string, unknown>)[k]),
  );
  if (changedKeys.length > 0) {
    const beforeSubset = Object.fromEntries(
      changedKeys.map((k) => [k, (before as Record<string, unknown>)[k]]),
    );
    const afterSubset = Object.fromEntries(
      changedKeys.map((k) => [k, (project as Record<string, unknown>)[k]]),
    );
    void recordResourceHistory({
      projectId: req.params.id,
      resourceType: 'project',
      resourceId: req.params.id,
      actor,
      reason,
      before: beforeSubset,
      after: afterSubset,
      summary: `Updated ${changedKeys.slice(0, 6).join(', ')}${
        changedKeys.length > 6 ? ` +${changedKeys.length - 6} more` : ''
      }`,
    }).catch(() => undefined);
    void recordAuditEvent({
      projectId: req.params.id,
      actorId: actor,
      resourceType: 'project',
      resourceId: req.params.id,
      operation: 'update',
      before: beforeSubset,
      after: afterSubset,
      changeSummary: `Updated ${changedKeys.slice(0, 6).join(', ')}`,
    }).catch(() => undefined);
  }

  ok(res, sanitizeProjectForClient(project as Record<string, unknown>));
});

router.delete('/projects/:id', async (req, res) => {
  ok(res, { deleted: await removeProject(req.params.id) });
});
/* Endpoints — catalog backed by the relational table; imported from specs. */
router.get('/projects/:id/endpoints', async (req, res) => {
  ok(res, await listEndpoints(req.params.id));
});
router.get('/projects/:id/endpoints/:eid', async (req, res) => {
  const endpoint = await getEndpoint(req.params.id, req.params.eid);
  if (!endpoint) return fail(res, 404, 'NOT_FOUND', 'Endpoint not found.');
  ok(res, endpoint);
});
router.put('/projects/:id/endpoints/:eid', async (req, res) => {
  const endpoint = await updateEndpoint(req.params.id, req.params.eid, req.body || {});
  if (!endpoint) return fail(res, 404, 'NOT_FOUND', 'Endpoint not found.');
  ok(res, endpoint);
});
router.post('/projects/:id/endpoints/import', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
  const payload = (req.body || {}) as { endpoints?: unknown[]; baseUrl?: string; openApiUrl?: string };
  const endpoints = (
    Array.isArray(payload.endpoints) ? payload.endpoints : []
  ) as Parameters<typeof importEndpoints>[1];
  await importEndpoints(req.params.id, endpoints);
  let discovered = 0;
  // A project whose specification can be re-read gets its discovered rows
  // refreshed from the document itself (see extractOperationsFromSpec — a
  // `$ref` request body resolves to the schema it points at). Stored rows that
  // still carry the old placeholder bodies (`"example"`) are exactly what this
  // updates.
  if (payload.baseUrl || payload.openApiUrl) {
    try {
      const detection = await detectUpstream(str(payload.baseUrl), str(payload.openApiUrl));
      const rehydrated = detection.foundAt
        ? await extractOperationsFromSpec(String(detection.foundAt), detection.endpoints)
        : [];
      const rows = rehydrated.length ? rehydrated : extractOperations(detection.foundAt || '', detection.endpoints);
      await importEndpoints(
        req.params.id,
        rows as Parameters<typeof importEndpoints>[1],
      );
      discovered = rows.length;
    } catch {
      // Discovery on a stale/dead upstream must never fail an import call.
    }
  }
  ok(res, { imported: endpoints.length, endpoints: endpoints.length, discovered });
});
router.delete('/projects/:id/endpoints/:eid', async (req, res) => {
  const { pool } = await import('../../services/database.service');
  await pool.query('DELETE FROM api_build_endpoints WHERE project_id = $1 AND id = $2', [
    req.params.id,
    req.params.eid,
  ]);
  ok(res, { deleted: true });
});
/* Versions */
router.get('/projects/:id/versions', async (req, res) => {
  ok(res, await listVersions(req.params.id));
});
router.post('/projects/:id/versions', async (req, res) => {
  const v = req.body || {};
  const version = await saveVersion(req.params.id, {
    id: str(v.id) || `v-${Date.now().toString(36)}`,
    semver: str(v.semver, `v1.${Date.now() % 50}.0`),
    status: str(v.status, 'draft'),
    notes: str(v.notes, ''),
    endpointsCount: numField(v.endpointsCount),
    isDefault: v.isDefault === true,
    releasedAt: str(v.releasedAt) || new Date().toISOString(),
    changelog:
      v.changelog && typeof v.changelog === 'object'
        ? v.changelog
        : { added: [], modified: [], deprecated: [], breaking: [] },
    createdAt: new Date().toISOString(),
  });
  await addActivity(req.params.id, `Version ${version.semver} created (${version.status})`, 'info');
  ok(res, version, 201);
});
router.put('/projects/:id/versions/:vid', async (req, res) => {
  const existing = (await listVersions(req.params.id)).find((v) => v.id === req.params.vid);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Version not found.');
  ok(
    res,
    await saveVersion(req.params.id, { ...existing, ...(req.body || {}), id: req.params.vid }),
  );
});
router.delete('/projects/:id/versions/:vid', async (req, res) => {
  ok(res, { deleted: await deleteVersion(req.params.id, req.params.vid) });
});

/* Plans */
router.get('/projects/:id/plans', async (req, res) => {
  ok(res, await listPlans(req.params.id));
});
router.post('/projects/:id/plans', async (req, res) => {
  const p = req.body || {};
  const plan = await savePlan(req.params.id, {
    id: str(p.id) || `plan-${Date.now().toString(36)}`,
    name: str(p.name, 'New plan'),
    requestsPerMonth: numField(p.requestsPerMonth),
    priceMonthly: numField(p.priceMonthly),
    rateLimitPerMin: numField(p.rateLimitPerMin),
    overagePer1k: numField(p.overagePer1k),
    trialDays: numField(p.trialDays),
    subscribers: numField(p.subscribers),
    createdAt: new Date().toISOString(),
  });
  await addActivity(req.params.id, `Plan "${plan.name}" created ($${plan.priceMonthly}/mo)`, 'ok');
  ok(res, plan, 201);
});
router.put('/projects/:id/plans/:pid', async (req, res) => {
  const existing = (await listPlans(req.params.id)).find((p) => p.id === req.params.pid);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Plan not found.');
  ok(res, await savePlan(req.params.id, { ...existing, ...(req.body || {}), id: req.params.pid }));
});
router.delete('/projects/:id/plans/:pid', async (req, res) => {
  ok(res, { deleted: await deletePlan(req.params.id, req.params.pid) });
});

/* Consumers */
router.get('/projects/:id/consumers', async (req, res) => {
  ok(res, await listConsumers(req.params.id));
});
router.post('/projects/:id/consumers', async (req, res) => {
  const c = req.body || {};
  const consumer = await saveConsumer(req.params.id, {
    id: str(c.id) || '',
    name: str(c.name, 'New consumer'),
    email: str(c.email),
    plan: str(c.plan, 'Free'),
    status: str(c.status, 'active'),
    requests: numField(c.requests),
    joinedAt: new Date().toISOString(),
  });
  await addActivity(req.params.id, `New consumer: ${consumer.name} (${consumer.plan} plan)`, 'ok');
  ok(res, consumer, 201);
});
router.put('/projects/:id/consumers/:cid', async (req, res) => {
  const existing = (await listConsumers(req.params.id)).find((c) => c.id === req.params.cid);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Consumer not found.');
  ok(
    res,
    await saveConsumer(req.params.id, { ...existing, ...(req.body || {}), id: req.params.cid }),
  );
});
router.delete('/projects/:id/consumers/:cid', async (req, res) => {
  ok(res, { deleted: await deleteConsumer(req.params.id, req.params.cid) });
});
/* API keys — plaintext returned once at creation; hash-only storage. */
router.get('/projects/:id/keys', async (req, res) => {
  ok(res, await listApiKeys(req.params.id));
});
router.post('/projects/:id/keys', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
  const k = req.body || {};
  const label = str(k.label).trim();
  if (!label) return fail(res, 400, 'INVALID_KEY', 'A key label is required.');
  const created = await createApiKey(req.params.id, {
    label,
    consumer: str(k.consumer),
    plan: str(k.plan, 'Free'),
    environment: str(k.environment, 'live'),
  });
  await addActivity(
    req.params.id,
    `API key "${label}" created for ${created.consumer || 'the project'}`,
    'ok',
  );
  ok(res, created, 201);
});
router.put('/projects/:id/keys/:kid', async (req, res) => {
  const updated = await updateApiKey(req.params.id, req.params.kid, req.body || {});
  if (!updated) return fail(res, 404, 'NOT_FOUND', 'Key not found.');
  if (req.body?.revoked === true)
    await addActivity(req.params.id, `API key "${updated.label}" revoked`, 'warning');
  ok(res, updated);
});
router.delete('/projects/:id/keys/:kid', async (req, res) => {
  ok(res, { deleted: await deleteApiKey(req.params.id, req.params.kid) });
});

/* Activity — audit feed (append + list). */
router.get('/projects/:id/activity', async (req, res) => {
  ok(res, await listActivity(req.params.id));
});
router.post('/projects/:id/activity', async (req, res) => {
  const label = str(req.body?.label).trim();
  if (!label) return fail(res, 400, 'INVALID_ACTIVITY', 'An activity label is required.');
  await addActivity(req.params.id, label, str(req.body?.kind, 'info'));
  ok(res, await listActivity(req.params.id), 201);
});

/* Deployments — queue + real records. Row URLs are normalized on read too:
 * deployments deployed before the canonical `/api/gateway` URL existed carry
 * the old `/gateway/{slug}` (or fictional klyra.com) form in their url field. */
router.get('/projects/:id/deployments', async (req, res) => {
  const rows = await listDeployments(req.params.id);
  const canonicalUrl = buildGatewayUrl(slugFromProjectId(req.params.id));
  ok(
    res,
    rows.map((row) => {
      const stale =
        !row.url || /klyra\.(com|dev)\//i.test(row.url) || /\/(api\/)?gateway\//.test(row.url);
      return stale ? { ...row, url: canonicalUrl } : row;
    }),
  );
});
router.post('/projects/:id/deployments', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
  const body = req.body || {};
  if (body.enqueue === true || (!body.version && !body.status)) {
    const job = await enqueueDeploy(req.params.id, body);
    return ok(res, { jobId: job.id, status: job.status }, 202);
  }
  const record = await addDeployment(req.params.id, {
    version: str(body.version, str(project.version, 'v1.0.0')),
    environment: str(body.environment, str(project.environment, 'development')),
    source: normalizeDeploymentSource(body.source, 'Klyra Hosted'),
    branch: str(body.branch) || null,
    commitHash: str(body.commitHash) || null,
    commitMessage: str(body.commitMessage) || null,
    region: str(body.region, 'sg-edge'),
    status: str(body.status, 'building'),
    url: str(
      body.url,
      str((project.deployment as Record<string, unknown> | undefined)?.providerUrl, ''),
    ),
    durationSec: numField(body.durationSec),
    author: str(body.author, 'workspace'),
    logs: Array.isArray(body.logs) ? body.logs : ['Deployment requested'],
    envVars: Array.isArray(body.envVars) ? body.envVars : [],
  });
  ok(res, record, 201);
});
router.put('/projects/:id/deployments/:did', async (req, res) => {
  await updateDeploymentStatus(req.params.did, str(req.body?.status, 'healthy'), {
    log: Array.isArray(req.body?.logs) ? req.body.logs : undefined,
    durationSec: numField(req.body?.durationSec, 0) || undefined,
  });
  ok(res, { updated: true });
});

/* Logs — filterable request log feed. */
router.get('/projects/:id/logs', async (req, res) => {
  ok(
    res,
    await listLogs(req.params.id, {
      limit: Number(req.query.limit) || 200,
      method: str(req.query.method, 'ALL'),
      path: str(req.query.path),
      status: Number(req.query.status) || undefined,
    }),
  );
});
router.post('/projects/:id/logs', async (req, res) => {
  const l = req.body || {};
  if (!str(l.method) || !str(l.path))
    return fail(res, 400, 'INVALID_LOG', 'method and path are required.');
  if (str(l.keyPrefix)) void touchApiKey(req.params.id, str(l.keyPrefix));
  ok(
    res,
    await appendLog(req.params.id, {
      method: str(l.method, 'GET'),
      path: str(l.path, '/'),
      statusCode: numField(l.statusCode, 200),
      latencyMs: numField(l.latencyMs),
      consumerName: str(l.consumerName, 'anonymous'),
      keyPrefix: str(l.keyPrefix),
      version: str(l.version),
      region: str(l.region, 'sg-edge'),
      ipAddress: str(l.ipAddress),
      requestHeaders: l.requestHeaders,
      queryParams: l.queryParams,
      requestBody: str(l.requestBody),
      responseHeaders: l.responseHeaders,
      responseBody: str(l.responseBody),
      trace: Array.isArray(l.trace) ? l.trace : [],
    }),
    201,
  );
});
/* Monitoring — incidents + alert rules. */
router.get('/projects/:id/incidents', async (req, res) => {
  ok(res, await listIncidents(req.params.id));
});
router.post('/projects/:id/incidents', async (req, res) => {
  const i = req.body || {};
  const title = str(i.title).trim();
  if (!title) return fail(res, 400, 'INVALID_INCIDENT', 'An incident title is required.');
  ok(
    res,
    await saveIncident(req.params.id, {
      title,
      severity: str(i.severity, 'Major') as 'Critical' | 'Major' | 'Minor',
      status: str(i.status, 'Investigating'),
      affectedEndpoints: Array.isArray(i.affectedEndpoints) ? i.affectedEndpoints : [],
      summary: str(i.summary),
    }),
    201,
  );
});
router.put('/projects/:id/incidents/:iid', async (req, res) => {
  const existing = (await listIncidents(req.params.id)).find((i) => i.id === req.params.iid);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Incident not found.');
  const merged = { ...existing, ...(req.body || {}) };
  if (merged.status === 'Resolved' && !merged.resolvedAt)
    merged.resolvedAt = new Date().toISOString();
  ok(res, await saveIncident(req.params.id, merged));
});

router.get('/projects/:id/alerts', async (req, res) => {
  ok(res, await listAlertRules(req.params.id));
});
router.post('/projects/:id/alerts', async (req, res) => {
  const a = req.body || {};
  const metric = str(a.metric);
  if (!['p95_latency', 'error_rate', 'uptime', 'rate_limit'].includes(metric)) {
    return fail(
      res,
      400,
      'INVALID_ALERT',
      'metric must be p95_latency, error_rate, uptime or rate_limit.',
    );
  }
  ok(
    res,
    await saveAlertRule(req.params.id, {
      name: str(a.name, 'New alert rule'),
      metric: metric as 'p95_latency' | 'error_rate' | 'uptime' | 'rate_limit',
      condition: str(a.condition, '>') as '>' | '<',
      threshold: numField(a.threshold, 1),
      unit: str(a.unit),
      durationSec: numField(a.durationSec, 300),
      channels: Array.isArray(a.channels) ? a.channels : ['email'],
      enabled: a.enabled !== false,
    }),
    201,
  );
});
router.delete('/projects/:id/alerts/:aid', async (req, res) => {
  ok(res, { deleted: await deleteAlertRule(req.params.id, req.params.aid) });
});

/* Usage + analytics + insights — all derived from observed data. */
router.get('/projects/:id/usage', async (req, res) => {
  ok(res, await listUsage(req.params.id, str(req.query.range, '24h')));
});
router.post('/projects/:id/usage', async (req, res) => {
  const u = req.body || {};
  await appendLog(req.params.id, {
    method: str(u.method, 'GET'),
    path: str(u.path, '/'),
    statusCode: numField(u.statusCode, 200),
    latencyMs: numField(u.latencyMs),
    consumerName: str(u.consumerName, 'anonymous'),
    keyPrefix: str(u.keyPrefix),
    version: str(u.version),
  });
  await recordUsage(req.params.id, {
    requests: 1,
    success: numField(u.statusCode, 200) >= 200 && numField(u.statusCode) < 400 ? 1 : 0,
    clientErr:
      numField(u.statusCode) >= 400 &&
      numField(u.statusCode) < 500 &&
      numField(u.statusCode) !== 429
        ? 1
        : 0,
    serverErr: numField(u.statusCode) >= 500 ? 1 : 0,
    rateLim: numField(u.statusCode) === 429 ? 1 : 0,
    p95: numField(u.latencyMs),
  });
  ok(res, { recorded: true }, 201);
});
router.get('/projects/:id/analytics', async (req, res) => {
  ok(res, await computeAnalytics(req.params.id));
});
router.get('/projects/:id/insights', async (req, res) => {
  ok(res, await computeInsights(req.params.id));
});

/* Health probe — real upstream check, refreshes endpoint metrics. */
router.post('/projects/:id/health', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
  ok(res, await probeProjectHealth(req.params.id));
});

/* Marketplace categories (user-defined from the "New project" wizard). */
router.get('/categories', async (_req, res) => {
  try {
    ok(res, await listCategories());
  } catch {
    fail(res, 503, 'DATABASE_UNAVAILABLE', 'Category storage is unavailable.');
  }
});
router.post('/categories', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return fail(res, 400, 'INVALID_CATEGORY', 'A category name is required.');
    ok(res, await addCategory(name));
  } catch (error) {
    fail(res, 400, 'INVALID_CATEGORY', error instanceof Error ? error.message : String(error));
  }
});
router.delete('/categories/:name', async (req, res) => {
  ok(res, { deleted: await removeCategory(req.params.name) });
});

/* Live upstream detection (server-side fetch; no CORS limitations). */
router.post('/detect', async (req, res) => {
  const baseUrl = String(req.body?.baseUrl || '').trim();
  const openApiUrl = String(req.body?.openApiUrl || '').trim();
  const repository = String(req.body?.repository || '').trim();
  const dockerImage = String(req.body?.dockerImage || '').trim();
  if (!baseUrl && !openApiUrl) {
    // Container sources have no reachable upstream until the container runs.
    // This is NOT an error: the deploy pipeline discovers the specification
    // automatically after the container reports healthy (api-build.deploy.ts).
    if (repository || dockerImage) {
      return ok(res, {
        found: false,
        reachable: false,
        baseUrl: '',
        openApiVersion: null,
        endpointCount: 0,
        schemaCount: 0,
        authKind: null,
        endpoints: [],
        servers: [],
        securitySchemes: [],
        title: null,
        description: null,
        foundAt: null,
        latencyMs: null,
        reason: repository
          ? `Repository source: Klyra clones ${repository} and discovers the OpenAPI specification automatically once the container is running.`
          : 'Container image source: Klyra discovers the OpenAPI specification automatically once the container is running.',
      });
    }
    return fail(res, 400, 'MISSING_URL', 'Provide a base URL or an OpenAPI URL.');
  }
  ok(res, await detectUpstream(baseUrl, openApiUrl));
});

/* Project Folder / ZIP Upload for Docker container build */
router.post('/upload-project', projectUpload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return fail(res, 400, 'NO_FILE', 'No project file uploaded. Provide a ZIP archive in the "file" field.');
    const descriptor = await processProjectZip(file.buffer, file.originalname);
    ok(res, descriptor, 201);
  } catch (error) {
    fail(res, 400, 'UPLOAD_FAILED', error instanceof Error ? error.message : String(error));
  }
});

router.post('/projects/:id/upload', projectUpload.single('file'), async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
    const file = req.file;
    if (!file) return fail(res, 400, 'NO_FILE', 'No project file uploaded. Provide a ZIP archive in the "file" field.');
    const descriptor = await processProjectZip(file.buffer, file.originalname);
    await updateProject(req.params.id, {
      dockerSourceMode: 'folder',
      dockerUploadId: descriptor.uploadId,
      dockerfilePath: descriptor.dockerfilePath,
      buildContext: descriptor.buildContext,
      dockerPort: descriptor.detectedPort,
    });
    ok(res, descriptor, 201);
  } catch (error) {
    fail(res, 400, 'UPLOAD_FAILED', error instanceof Error ? error.message : String(error));
  }
});

/* Inspect a previously extracted project upload (build context facts only —
   never absolute filesystem paths). Used by the wizard after a page reload. */
router.get('/uploads/:uploadId', async (req, res) => {
  try {
    ok(res, await inspectUploadedProject(String(req.params.uploadId || '')));
  } catch (error) {
    fail(res, 404, 'UPLOAD_NOT_FOUND', error instanceof Error ? error.message : String(error));
  }
});

/* Obtain a GitHub repository as a buildable container source: shallow clone,
   Dockerfile/build-context/EXPOSE detection, and persistence of both the
   repository reference and the discovered build facts on the project. */
router.post('/projects/:id/source/github', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');
  try {
    const repository = str(req.body?.repository).trim();
    const requestedBranch = str(req.body?.branch).trim() || 'main';
    const descriptor = await prepareGitHubSource(repository, requestedBranch);
    await updateProject(req.params.id, {
      sourceKind: 'github',
      repository,
      branch: descriptor.branch || requestedBranch,
      dockerSourceMode: 'folder',
      dockerUploadId: descriptor.uploadId,
      dockerfilePath: descriptor.dockerfilePath,
      buildContext: descriptor.buildContext,
      dockerPort: descriptor.detectedPort,
    });
    ok(res, descriptor, 201);
  } catch (error) {
    fail(
      res,
      400,
      'GITHUB_SOURCE_FAILED',
      error instanceof Error ? error.message : String(error),
    );
  }
});

/* Deployment job status polling. */
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return fail(res, 404, 'NOT_FOUND', 'Deployment job not found.');
    ok(res, job);
  } catch {
    fail(res, 503, 'DATABASE_UNAVAILABLE', 'Deployment queue is unavailable.');
  }
});
router.post('/jobs/:id/complete', async (req, res) => {
  await completeDeploy(req.params.id);
  ok(res, { completed: true });
});

/* ============================================================================
 * Draft & Change Management
 * ============================================================================ */

/** Get current draft and server state for a project. */
router.get('/projects/:id/draft', async (req, res) => {
  try {
    const state = await getDraftState(req.params.id);
    ok(res, state);
  } catch (error) {
    fail(
      res,
      500,
      'DRAFT_FETCH_FAILED',
      error instanceof Error ? error.message : 'Failed to fetch draft state',
    );
  }
});

/** Update draft configuration (does not affect live config). */
router.patch('/projects/:id/draft', async (req, res) => {
  if (!validId(req.params.id) || !req.body || typeof req.body !== 'object') {
    return fail(res, 400, 'INVALID_DRAFT', 'A valid draft configuration is required.');
  }

  try {
    const actorId = (req.headers['x-actor-id'] as string) || 'system';
    const result = await saveDraftConfig(
      req.params.id,
      req.body as Record<string, unknown>,
      actorId,
    );
    ok(res, result);
  } catch (error) {
    fail(
      res,
      500,
      'DRAFT_SAVE_FAILED',
      error instanceof Error ? error.message : 'Failed to save draft',
    );
  }
});

/** Compute changes between draft and live. */
router.post('/projects/:id/draft/changes', async (req, res) => {
  try {
    const state = await getDraftState(req.params.id);
    if (!state.server || !state.draft) {
      return ok(res, []);
    }

    const changes = await computeChanges(req.params.id, state.draft, state.server);
    ok(res, changes);
  } catch (error) {
    fail(
      res,
      500,
      'CHANGES_COMPUTE_FAILED',
      error instanceof Error ? error.message : 'Failed to compute changes',
    );
  }
});

/** Validate draft before promoting to live. */
router.post('/projects/:id/draft/validate', async (req, res) => {
  try {
    const state = await getDraftState(req.params.id);
    const config = state.draft || state.server;
    if (!config) {
      return fail(res, 404, 'NOT_FOUND', 'Project configuration not found');
    }

    const validation = await validateDraft(req.params.id, config);
    ok(res, validation);
  } catch (error) {
    fail(
      res,
      500,
      'VALIDATION_FAILED',
      error instanceof Error ? error.message : 'Validation failed',
    );
  }
});

/** Promote draft to live (save and clear draft). */
router.post('/projects/:id/draft/save', async (req, res) => {
  if (!validId(req.params.id)) {
    return fail(res, 400, 'INVALID_PROJECT_ID', 'Invalid project ID');
  }

  try {
    const clientVersion = numField(req.body?.version, 0);
    const actorId = (req.headers['x-actor-id'] as string) || 'system';

    const result = await promoteDraftToLive(req.params.id, clientVersion, actorId);

    if (!result.success) {
      const statusCode = result.error?.code === 'CONFLICT' ? 409 : 400;
      return fail(
        res,
        statusCode,
        result.error?.code || 'UNKNOWN',
        result.error?.message || 'Failed to save draft',
      );
    }

    ok(res, {
      project: sanitizeProjectForClient((result.project || {}) as Record<string, unknown>),
      version: result.newVersion,
    });
  } catch (error) {
    fail(res, 500, 'SAVE_FAILED', error instanceof Error ? error.message : 'Failed to save draft');
  }
});

/** Discard draft (revert to server state). */
router.delete('/projects/:id/draft', async (req, res) => {
  try {
    const result = await discardDraft(req.params.id);
    ok(res, { discarded: result });
  } catch (error) {
    fail(
      res,
      500,
      'DISCARD_FAILED',
      error instanceof Error ? error.message : 'Failed to discard draft',
    );
  }
});

/** Get audit log for a project. */
router.get('/projects/:id/audit', async (req, res) => {
  try {
    const limit = numField(req.query.limit as string, 50);
    const offset = numField(req.query.offset as string, 0);
    const events = await getAuditLog(req.params.id, { limit, offset });
    ok(res, events);
  } catch (error) {
    fail(
      res,
      500,
      'AUDIT_FETCH_FAILED',
      error instanceof Error ? error.message : 'Failed to fetch audit log',
    );
  }
});

/* ============================================================================
 * Operations — the universal async execution surface.
 * POST /projects/:id/operations            create (deploy | rollback | publish | …)
 * GET  /projects/:id/operations            list (filterable)
 * GET  /projects/:id/operations/:opId      detail (progress, logs, errors)
 * POST /projects/:id/operations/:opId/cancel
 * POST /projects/:id/operations/:opId/retry
 * ========================================================================== */

const OPERATION_TYPES: ReadonlySet<string> = new Set([
  'deploy',
  'rollback',
  'publish',
  'import',
  'sync',
  'migrate',
  'rotate_key',
  'bulk_policy_update',
  'health_probe',
  'delete',
]);

router.post('/projects/:id/operations', async (req, res) => {
  if (!validId(req.params.id)) return fail(res, 400, 'INVALID_PROJECT_ID', 'Invalid project ID.');
  const body = (req.body || {}) as Record<string, unknown>;
  const type = str(body.type);
  if (!OPERATION_TYPES.has(type)) {
    return fail(
      res,
      400,
      'INVALID_OPERATION_TYPE',
      `type must be one of: ${Array.from(OPERATION_TYPES).join(', ')}.`,
    );
  }
  const project = await getProject(req.params.id);
  if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');

  try {
    const operation = await createOperation({
      projectId: req.params.id,
      type: type as OperationType,
      actor: str(req.headers['x-actor-id'], 'system'),
      resource: str(body.resource, '') || undefined,
      environment: str(body.environment, '') || undefined,
      payload: (body.payload && typeof body.payload === 'object' ? body.payload : {}) as Record<
        string,
        unknown
      >,
      requestId: str(req.headers['x-request-id'], '') || undefined,
      reason: str(body.reason, '') || undefined,
    });
    ok(res, operation, 202);
  } catch (error) {
    fail(
      res,
      500,
      'OPERATION_CREATE_FAILED',
      error instanceof Error ? error.message : 'Failed to create operation.',
    );
  }
});

router.get('/projects/:id/operations', async (req, res) => {
  try {
    const state = str(req.query.state, '') as OperationState;
    const type = str(req.query.type, '') as OperationType;
    ok(
      res,
      await listOperations(req.params.id, {
        limit: numField(req.query.limit as string, 50),
        state: state || undefined,
        type: type || undefined,
      }),
    );
  } catch (error) {
    fail(
      res,
      500,
      'OPERATIONS_FETCH_FAILED',
      error instanceof Error ? error.message : 'Failed to list operations.',
    );
  }
});

router.get('/projects/:id/operations/:opId', async (req, res) => {
  try {
    const operation = await getOperation(req.params.id, req.params.opId);
    if (!operation) return fail(res, 404, 'NOT_FOUND', 'Operation not found.');
    ok(res, operation);
  } catch (error) {
    fail(
      res,
      500,
      'OPERATION_FETCH_FAILED',
      error instanceof Error ? error.message : 'Failed to fetch operation.',
    );
  }
});

router.post('/projects/:id/operations/:opId/cancel', async (req, res) => {
  try {
    const row = await cancelOperation(
      req.params.id,
      req.params.opId,
      str(req.headers['x-actor-id'], 'system'),
    );
    if (!row)
      return fail(
        res,
        409,
        'OPERATION_NOT_CANCELLABLE',
        'Operation is not in a cancellable state.',
      );
    ok(res, row);
  } catch (error) {
    fail(
      res,
      500,
      'OPERATION_CANCEL_FAILED',
      error instanceof Error ? error.message : 'Failed to cancel operation.',
    );
  }
});

router.post('/projects/:id/operations/:opId/retry', async (req, res) => {
  try {
    const row = await retryOperation(
      req.params.id,
      req.params.opId,
      str(req.headers['x-actor-id'], 'system'),
    );
    if (!row)
      return fail(
        res,
        409,
        'OPERATION_NOT_RETRYABLE',
        'Only failed or cancelled operations can be retried.',
      );
    ok(res, row, 202);
  } catch (error) {
    fail(
      res,
      500,
      'OPERATION_RETRY_FAILED',
      error instanceof Error ? error.message : 'Failed to retry operation.',
    );
  }
});

/* ============================================================================
 * Resource history — immutable versioned snapshots with restore support.
 * ========================================================================== */

router.get('/projects/:id/history', async (req, res) => {
  try {
    ok(
      res,
      await listResourceHistory(req.params.id, {
        resourceType: str(req.query.resourceType, '') || undefined,
        resourceId: req.query.resourceId !== undefined ? String(req.query.resourceId) : undefined,
        limit: numField(req.query.limit as string, 50),
        offset: numField(req.query.offset as string, 0),
      }),
    );
  } catch (error) {
    fail(
      res,
      500,
      'HISTORY_FETCH_FAILED',
      error instanceof Error ? error.message : 'Failed to fetch resource history.',
    );
  }
});

/** Restore a historical project snapshot through the normal update path. */
router.post('/projects/:id/history/restore', async (req, res) => {
  if (!validId(req.params.id)) return fail(res, 400, 'INVALID_PROJECT_ID', 'Invalid project ID.');
  const body = (req.body || {}) as Record<string, unknown>;
  const resourceType = str(body.resourceType, 'project');
  const versionNo = numField(body.versionNo, 0);
  if (!versionNo) return fail(res, 400, 'INVALID_RESTORE', 'A versionNo is required.');

  try {
    const snapshot = await getRestoreSnapshot(req.params.id, resourceType, versionNo);
    if (!snapshot || !snapshot.after) {
      return fail(res, 404, 'NOT_FOUND', 'History version not found.');
    }
    const project = await updateProject(req.params.id, snapshot.after);
    if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found.');

    const actor = str(req.headers['x-actor-id'], 'system');
    await recordAuditEvent({
      projectId: req.params.id,
      actorId: actor,
      resourceType,
      resourceId: req.params.id,
      operation: 'restore',
      before: snapshot.after,
      after: snapshot.after,
      changeSummary: `Restored ${resourceType} to version ${versionNo}`,
      context: { restoredFromVersion: versionNo },
    });
    await recordResourceHistory({
      projectId: req.params.id,
      resourceType,
      resourceId: req.params.id,
      actor,
      reason: `Restored from version ${versionNo}`,
      before: snapshot.after,
      after: snapshot.after,
      summary: `Restore of version ${versionNo}`,
    });
    ok(res, sanitizeProjectForClient(project as Record<string, unknown>));
  } catch (error) {
    fail(
      res,
      500,
      'RESTORE_FAILED',
      error instanceof Error ? error.message : 'Failed to restore version.',
    );
  }
});

export default router;
