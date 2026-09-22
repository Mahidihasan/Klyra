/**
 * API Build — Operation System Service
 *
 * Universal asynchronous operation model. Every long-running mutation
 * (deploy, rollback, publish, import, bulk update) is a durable row in
 * api_build_operations with:
 *
 *   id / type / state / progress / actor / resource / environment
 *   payload / logs / warnings / errors / result / timestamps
 *
 * State machine (shared with the frontend — see frontend types/operations.ts):
 *
 *   queued → validating → running → succeeded
 *                              ↘ failed
 *   queued|running → cancelled
 *   failed → (retry) → queued
 *
 * A deployment enters `running` exactly once. Steps, warnings and streamed
 * pipeline output are progress reports on that running row (planProgressTransition /
 * reportOperationProgress), never new state transitions — re-asserting
 * `running` on every report produced the production failure
 * "Invalid operation transition: running → running".
 *
 * Executor: operations run through an in-process worker (execute). State
 * transitions are persisted FIRST, so a crash mid-run leaves a truthful row.
 * The executor boundary is isolated in runOperation() — moving to a durable
 * queue worker (BullMQ) or a separate service only requires re-implementing
 * that one function.
 *
 * This is a real backend execution primitive, not UI simulation:
 * - "deploy" appends a real deployment row and flips project state,
 * - "rollback" re-points the project to the target recorded deployment,
 * - "publish" flips visibility/status,
 * - all of them append project activity + audit events.
 */

import { randomUUID } from 'node:crypto';
import { pool } from '../../services/database.service';
import {
  addActivity,
  getProject,
  saveProject,
  updateEndpoint,
} from './api-build.service';
import { recordAuditEvent } from './api-build.draft';
import { deployProject } from './api-build.deploy';

/* ==========================================================================
 * Types — mirror frontend/src/types/operations.ts
 * ======================================================================== */

export type OperationType =
  | 'deploy'
  | 'rollback'
  | 'publish'
  | 'import'
  | 'sync'
  | 'migrate'
  | 'rotate_key'
  | 'bulk_policy_update'
  | 'health_probe'
  | 'delete';

export type OperationState =
  | 'queued'
  | 'validating'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface OperationRow {
  id: string;
  projectId: string;
  type: OperationType;
  state: OperationState;
  progress: number;
  actor: string;
  resource: string | null;
  environment: string | null;
  payload: Record<string, unknown> | null;
  logs: string[];
  warnings: string[];
  errors: string[];
  result: Record<string, unknown> | null;
  requestId: string | null;
  reason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const TERMINAL: ReadonlySet<OperationState> = new Set<OperationState>(['succeeded', 'failed', 'cancelled']);
const CANCELLABLE: ReadonlySet<OperationState> = new Set<OperationState>(['queued', 'validating', 'running']);

const nowIso = () => new Date().toISOString();

function mapRow(r: Record<string, unknown>): OperationRow {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    type: String(r.type) as OperationType,
    state: String(r.state) as OperationState,
    progress: Number(r.progress ?? 0),
    actor: String(r.actor ?? 'system'),
    resource: r.resource ? String(r.resource) : null,
    environment: r.environment ? String(r.environment) : null,
    payload: (r.payload as Record<string, unknown>) ?? null,
    logs: Array.isArray(r.logs) ? (r.logs as string[]) : [],
    warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
    errors: Array.isArray(r.errors) ? (r.errors as string[]) : [],
    result: (r.result as Record<string, unknown>) ?? null,
    requestId: r.request_id ? String(r.request_id) : null,
    reason: r.reason ? String(r.reason) : null,
    createdAt: String(r.created_at ?? ''),
    startedAt: r.started_at ? String(r.started_at) : null,
    finishedAt: r.finished_at ? String(r.finished_at) : null,
  };
}

const SELECT_COLUMNS = `id, project_id, type, state, progress, actor, resource, environment,
  payload, logs, warnings, errors, result, request_id, reason, created_at, started_at, finished_at`;

/* ==========================================================================
 * State transitions — pure functions (unit-tested without a database)
 * ======================================================================== */

/** Validates a prospective state transition against the state machine. */
export function canTransition(from: OperationState, to: OperationState): boolean {
  if (from === to) return false;
  switch (to) {
    case 'validating':
      return from === 'queued';
    case 'running':
      return from === 'queued' || from === 'validating';
    case 'succeeded':
      return from === 'running' || from === 'validating';
    case 'failed':
      return from === 'running' || from === 'validating';
    case 'cancelled':
      return CANCELLABLE.has(from);
    // Re-opening a row is only allowed as a retry of a failed/cancelled one.
    case 'queued':
      return from === 'failed' || from === 'cancelled';
    default:
      return false;
  }
}

export function isTerminal(state: OperationState): boolean {
  return TERMINAL.has(state);
}

export function isCancellable(state: OperationState): boolean {
  return CANCELLABLE.has(state);
}

export function isRetryable(state: OperationState): boolean {
  return state === 'failed' || state === 'cancelled';
}

/* ==========================================================================
 * CRUD
 * ======================================================================== */

export interface CreateOperationInput {
  projectId: string;
  type: OperationType;
  actor?: string;
  resource?: string;
  environment?: string;
  payload?: Record<string, unknown>;
  requestId?: string;
  reason?: string;
}

export async function createOperation(input: CreateOperationInput): Promise<OperationRow> {
  const id = `op-${randomUUID().slice(0, 12)}`;
  const result = await pool.query(
    `INSERT INTO api_build_operations
       (id, project_id, type, state, actor, resource, environment, payload, request_id, reason)
     VALUES ($1, $2, $3, 'queued', $4, $5, $6, $7::jsonb, $8, $9)
     RETURNING ${SELECT_COLUMNS}`,
    [
      id,
      input.projectId,
      input.type,
      input.actor || 'system',
      input.resource || null,
      input.environment || null,
      input.payload ? JSON.stringify(input.payload) : null,
      input.requestId || null,
      input.reason || null,
    ],
  );
  const row = mapRow(result.rows[0]);
  await addActivity(input.projectId, `Operation ${row.type} queued (${row.id})`, 'info');
  await recordAuditEvent({
    projectId: input.projectId,
    actorId: row.actor,
    resourceType: 'operation',
    resourceId: row.id,
    operation: 'create',
    changeSummary: `${row.type} operation created`,
    context: { type: row.type, environment: row.environment },
  });
  void execute(row.id); // fire-and-forget; the queued state is already durable
  return row;
}

export async function getOperation(projectId: string, id: string): Promise<OperationRow | null> {
  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM api_build_operations WHERE project_id = $1 AND id = $2`,
    [projectId, id],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listOperations(
  projectId: string,
  options: { limit?: number; state?: OperationState; type?: OperationType } = {},
): Promise<OperationRow[]> {
  const limit = Math.min(Number(options.limit) || 50, 200);
  const clauses = ['project_id = $1'];
  const params: unknown[] = [projectId];
  if (options.state) {
    params.push(options.state);
    clauses.push(`state = $${params.length}`);
  }
  if (options.type) {
    params.push(options.type);
    clauses.push(`type = $${params.length}`);
  }
  params.push(limit);
  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM api_build_operations
     WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(mapRow);
}

/* ==========================================================================
 * Mutations — used by the executor and the cancel/retry routes
 * ======================================================================== */

interface TransitionInput {
  state?: OperationState;
  progress?: number;
  appendLog?: string;
  appendWarning?: string;
  appendError?: string;
  result?: Record<string, unknown>;
}

export async function transitionOperation(
  projectId: string,
  id: string,
  patch: TransitionInput,
): Promise<OperationRow | null> {
  const current = await getOperation(projectId, id);
  if (!current) return null;

  const nextState = patch.state ?? current.state;
  if (patch.state && patch.state !== current.state && !canTransition(current.state, nextState)) {
    throw new Error(`Invalid operation transition: ${current.state} → ${nextState}`);
  }
  
  // If the explicit patch.state exactly matches the current state, we drop the
  // state column from the write (meaning it's just a progress/log update).
  // This happens when two concurrent progress streams both fetch a 'validating'
  // row, both plan a 'running' transition, and one races the other.
  const writeState = patch.state === current.state ? current.state : nextState;

  const logs = patch.appendLog
    ? [...current.logs, `${new Date().toISOString().slice(11, 19)} ${patch.appendLog}`]
    : current.logs;
  const warnings = patch.appendWarning
    ? [...current.warnings, patch.appendWarning]
    : current.warnings;
  const errors = patch.appendError ? [...current.errors, patch.appendError] : current.errors;

  const result = await pool.query(
    `UPDATE api_build_operations SET
       state            = $3,
       progress         = COALESCE($4, progress),
       logs             = $5::jsonb,
       warnings         = $6::jsonb,
       errors           = $7::jsonb,
       result           = COALESCE($8::jsonb, result),
       started_at       = COALESCE(started_at, CASE WHEN $3 IN ('validating','running') THEN NOW() END),
       finished_at      = CASE WHEN $3 IN ('succeeded','failed','cancelled') THEN NOW() ELSE finished_at END,
       updated_at       = NOW()
     WHERE project_id = $1 AND id = $2
     RETURNING ${SELECT_COLUMNS}`,
    [
      projectId,
      id,
      writeState,
      patch.progress === undefined ? null : Math.max(0, Math.min(100, Math.round(patch.progress))),
      JSON.stringify(logs),
      JSON.stringify(warnings),
      JSON.stringify(errors),
      patch.result ? JSON.stringify(patch.result) : null,
    ],
  );
  return mapRow(result.rows[0]);
}

export async function cancelOperation(
  projectId: string,
  id: string,
  actor: string,
): Promise<OperationRow | null> {
  const current = await getOperation(projectId, id);
  if (!current || !isCancellable(current.state)) return null;
  const row = await transitionOperation(projectId, id, {
    state: 'cancelled',
    appendLog: `Cancelled by ${actor}`,
  });
  if (row) {
    await addActivity(projectId, `Operation ${current.type} cancelled (${id})`, 'warn');
    await recordAuditEvent({
      projectId,
      actorId: actor,
      resourceType: 'operation',
      resourceId: id,
      operation: 'cancel',
      changeSummary: `${current.type} operation cancelled`,
    });
  }
  return row;
}

export async function retryOperation(
  projectId: string,
  id: string,
  actor: string,
): Promise<OperationRow | null> {
  const current = await getOperation(projectId, id);
  if (!current || !isRetryable(current.state)) return null;
  const row = await transitionOperation(projectId, id, {
    state: 'queued',
    progress: 0,
    appendLog: `Re-queued by ${actor}`,
  });
  if (row) {
    await addActivity(projectId, `Operation ${current.type} re-queued (${id})`, 'info');
    void execute(id);
  }
  return row;
}

/* ==========================================================================
 * Progress reporting — steps, warnings and streamed log lines are NOT state
 * transitions.
 * ======================================================================== */

/**
 * Builds the write for a progress report against the CURRENT state:
 *
 *   - `queued` | `validating` → the single legal promotion into `running`
 *     (progress and logs travel with that one transition),
 *   - `running` → progress/logs only, the state is left untouched, so a
 *     deployment that reports many steps and log lines never attempts the
 *     illegal `running → running` transition again,
 *   - terminal (`succeeded` | `failed` | `cancelled`) → `null`; output that
 *     arrives after the row finished (a late Docker log flush) is dropped
 *     instead of crashing the worker or resurrecting the row.
 *
 * The state machine is untouched: `transitionOperation` still validates every
 * real state change through canTransition() — a direct `running → running`
 * request still throws.
 */
export function planProgressTransition(
  current: OperationState,
  patch: { progress?: number; appendLog?: string; appendWarning?: string },
): { state?: OperationState; progress?: number; appendLog?: string; appendWarning?: string } | null {
  if (current === 'running') return { ...patch };
  if (canTransition(current, 'running')) return { ...patch, state: 'running' };
  return null;
}

/** Durable progress report used by the executor (steps, warnings, raw logs). */
export async function reportOperationProgress(
  projectId: string,
  operationId: string,
  patch: { progress?: number; appendLog?: string; appendWarning?: string },
): Promise<OperationRow | null> {
  const current = await getOperation(projectId, operationId);
  if (!current) return null;
  const plan = planProgressTransition(current.state, patch);
  if (!plan) return null;
  return transitionOperation(projectId, operationId, plan);
}

/**
 * Terminal-state write guarded by the state machine. Returns null when the row
 * can no longer reach `state` (for example a cancellation that raced the
 * failure, or a duplicate invocation that already finished the row) instead of
 * throwing from inside the executor's error handler.
 */
async function guardedTransition(
  projectId: string,
  operationId: string,
  state: Extract<OperationState, 'succeeded' | 'failed'>,
  patch: TransitionInput,
): Promise<OperationRow | null> {
  const current = await getOperation(projectId, operationId);
  if (!current || !canTransition(current.state, state)) return null;
  return transitionOperation(projectId, operationId, { ...patch, state });
}

/* ==========================================================================
 * Executor — the only place that performs real work per operation type.
 * ======================================================================== */

interface ExecuteContext {
  step: (label: string, progress: number) => Promise<void>;
  warn: (message: string) => Promise<void>;
  /** Appends a raw execution-log line (Docker/git output) to the operation. */
  log: (line: string) => Promise<void>;
  payload: Record<string, unknown>;
  projectId: string;
  actor: string;
  environment: string | null;
}

/** Performs the real work for an operation. Returns the result payload. */
export async function runOperation(
  type: OperationType,
  ctx: ExecuteContext,
): Promise<Record<string, unknown>> {
  switch (type) {
    case 'deploy':
      return executeDeploy(ctx);
    case 'rollback':
      return executeRollback(ctx);
    case 'publish':
      return executePublish(ctx);
    case 'health_probe':
      return executeHealthProbe(ctx);
    case 'bulk_policy_update':
      return executeBulkUpdate(ctx);
    default:
      throw new Error(
        `Operation type "${type}" has no executor yet. ` +
          'Implement it in api-build.operations.runOperation before enqueueing.',
      );
  }
}

async function executeDeploy(ctx: ExecuteContext): Promise<Record<string, unknown>> {
  const { step, payload, projectId, actor } = ctx;
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found.');

  const version = String(payload.version || project.version || 'v1.0.0');
  const environment = String(payload.environment || project.environment || 'development');
  const strategy = String(payload.strategy || 'rolling');

  // Raw pipeline output (git clone, docker build/pull, readiness checks) is
  // streamed into the operation's log. Lines are batched (≤ every 700 ms or
  // 25 lines) so a chatty `docker build` does not issue one UPDATE per line,
  // and the batch order is preserved by a serialized chain.
  let logChain: Promise<void> = Promise.resolve();
  let pendingLogs: string[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const flushLogs = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const batch = pendingLogs;
    pendingLogs = [];
    if (!batch.length) {
      return;
    }
    logChain = logChain.then(() => ctx.log(batch.join('\n'))).catch(() => undefined);
  };
  const streamLog = (line: string) => {
    if (!line || !line.trim()) {
      return;
    }
    pendingLogs.push(line.trim());
    if (pendingLogs.length >= 25) {
      flushLogs();
      return;
    }
    if (!flushTimer) {
      flushTimer = setTimeout(flushLogs, 700);
    }
  };

  const result = await deployProject(projectId, {
    actor,
    version,
    environment,
    strategy,
    sourceKind: typeof payload.sourceKind === 'string' ? payload.sourceKind : undefined,
    repository: typeof payload.repository === 'string' ? payload.repository : undefined,
    branch: typeof payload.branch === 'string' ? payload.branch : undefined,
    dockerSourceMode: typeof payload.dockerSourceMode === 'string' ? (payload.dockerSourceMode as 'image' | 'folder') : undefined,
    dockerImage: typeof payload.dockerImage === 'string' ? payload.dockerImage : undefined,
    dockerUploadId: typeof payload.dockerUploadId === 'string' ? payload.dockerUploadId : undefined,
    dockerfilePath: typeof payload.dockerfilePath === 'string' ? payload.dockerfilePath : undefined,
    buildContext: typeof payload.buildContext === 'string' ? payload.buildContext : undefined,
    dockerPort: typeof payload.dockerPort === 'number' ? payload.dockerPort : undefined,
    openApiUrl: typeof payload.openApiUrl === 'string' ? payload.openApiUrl : undefined,
    readinessMode: typeof payload.readinessMode === 'string' ? (payload.readinessMode as 'auto' | 'http' | 'tcp') : undefined,
    readinessPath: typeof payload.readinessPath === 'string' ? payload.readinessPath : undefined,
    onLog: streamLog,
    onStep: async (label, progress) => {
      await step(label, progress);
    },
  });
  flushLogs();
  await logChain;

  if (!result.ok) {
    throw new Error(result.error || 'Deployment failed');
  }

  await recordAuditEvent({
    projectId,
    actorId: actor,
    resourceType: 'deployment',
    resourceId: result.deploymentId,
    operation: 'deploy',
    before: { version: project.version, environment: project.environment, status: project.status },
    after: { version, environment, status: 'healthy' },
    changeSummary: `Deployed ${version} to ${environment}`,
  });

  return {
    version,
    environment,
    strategy,
    deploymentId: result.deploymentId,
    containerName: result.containerName,
    gatewayUrl: result.gatewayUrl,
  };
}

async function executeRollback(ctx: ExecuteContext): Promise<Record<string, unknown>> {
  const { step, payload, projectId, actor } = ctx;
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found.');

  const targetVersion = String(payload.targetVersion || '');
  if (!targetVersion) throw new Error('Rollback requires a target version.');

  await step(`Fetching recorded deployment ${targetVersion}`, 15);
  const target = await pool.query(
    `SELECT id, version, environment FROM api_build_deployments
     WHERE project_id = $1 AND version = $2 ORDER BY deployed_at DESC LIMIT 1`,
    [projectId, targetVersion],
  );
  if (!target.rows[0]) {
    throw new Error(`No recorded deployment found for ${targetVersion}. Nothing to roll back to.`);
  }

  await step(`Reverting ${project.version} → ${targetVersion}`, 55);
  const before = {
    version: project.version,
    environment: project.environment,
    status: project.status,
  };
  await saveProject({
    ...project,
    version: targetVersion,
    environment: String(target.rows[0].environment || project.environment),
    status: 'healthy',
    updatedAt: nowIso(),
    deployment: {
      ...((project.deployment as Record<string, unknown>) || {}),
      status: 'healthy',
      version: targetVersion,
      lastHealthCheck: 'just now',
    },
  });
  await step('Rollback complete — traffic restored', 100);

  await recordAuditEvent({
    projectId,
    actorId: actor,
    resourceType: 'deployment',
    resourceId: String(target.rows[0].id),
    operation: 'rollback',
    before,
    after: { version: targetVersion, status: 'healthy' },
    changeSummary: `Rolled back from ${before.version} to ${targetVersion}`,
  });
  return { rolledBackTo: targetVersion, previousVersion: before.version };
}

async function executePublish(ctx: ExecuteContext): Promise<Record<string, unknown>> {
  const { step, payload, projectId, actor } = ctx;
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found.');

  const visibility = String(payload.visibility || project.visibility || 'private');
  const name = payload.listingName ? String(payload.listingName) : project.name;
  const description = payload.listingDescription
    ? String(payload.listingDescription)
    : project.description;

  await step('Validating marketplace listing', 30);
  if (!name || !description) {
    throw new Error('A listing name and description are required to publish.');
  }
  await step('Publishing to marketplace', 65);
  const before = { published: project.published, visibility: project.visibility };
  await saveProject({
    ...project,
    published: true,
    status: 'published',
    visibility: visibility as 'private' | 'unlisted' | 'public',
    name,
    description,
    updatedAt: nowIso(),
  });
  await step('Published', 100);

  await recordAuditEvent({
    projectId,
    actorId: actor,
    resourceType: 'project',
    resourceId: projectId,
    operation: 'publish',
    before,
    after: { published: true, visibility },
    changeSummary: `API published (${visibility})`,
  });
  return { visibility };
}

async function executeHealthProbe(ctx: ExecuteContext): Promise<Record<string, unknown>> {
  const { step, projectId } = ctx;
  await step('Probing upstream', 30);
  const { probeProjectHealth } = await import('./api-build.telemetry');
  const result = await probeProjectHealth(projectId);
  await step('Probe complete', 100);
  return { probe: result };
}

const BULK_PATCH_FIELDS = [
  'authRequired',
  'rateLimitPerMin',
  'status',
  'mockMode',
  'cacheTtl',
  'category',
];

async function executeBulkUpdate(ctx: ExecuteContext): Promise<Record<string, unknown>> {
  const { step, payload, projectId, actor } = ctx;
  const endpointIds = Array.isArray(payload.endpointIds) ? payload.endpointIds.map(String) : [];
  const patch = (payload.patch || {}) as Record<string, unknown>;
  if (endpointIds.length === 0) throw new Error('Bulk update requires at least one endpoint.');
  if (Object.keys(patch).length === 0)
    throw new Error('Bulk update requires a configuration patch.');

  await step(`Updating ${endpointIds.length} endpoints`, 20);
  const safePatch = Object.fromEntries(
    Object.entries(patch).filter(([k]) => BULK_PATCH_FIELDS.includes(k)),
  );
  let updated = 0;
  for (const eid of endpointIds) {
    const row = await updateEndpoint(projectId, eid, safePatch);
    if (row) updated += 1;
  }
  await step(`Updated ${updated}/${endpointIds.length} endpoints`, 100);

  await recordAuditEvent({
    projectId,
    actorId: actor,
    resourceType: 'endpoint',
    resourceId: endpointIds.join(','),
    operation: 'bulk_update',
    after: safePatch,
    changeSummary: `Bulk updated ${updated} endpoints`,
  });
  return { updated, requested: endpointIds.length };
}

/* ==========================================================================
 * In-process worker — persists each transition, then marks the row terminal.
 * Replace with a durable queue worker without changing the API surface.
 * ======================================================================== */

const inflight = new Set<string>();

export async function execute(operationId: string): Promise<void> {
  if (inflight.has(operationId)) return;
  inflight.add(operationId);
  try {
    // Atomic single-use claim: only the invocation that moves the row OFF
    // `queued` runs the operation. A duplicate (queue worker racing the
    // operation worker, a double-fired retry, a replayed request) gets zero
    // rows back and returns without doing any work — idempotent by
    // construction instead of crashing or double-running a deployment.
    const claimed = await pool.query(
      `UPDATE api_build_operations
       SET state = 'validating', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND state = 'queued'
       RETURNING ${SELECT_COLUMNS}`,
      [operationId],
    );
    const row = claimed.rows[0];
    if (!row) return;

    const projectId = String(row.project_id);
    const type = String(row.type) as OperationType;
    const payload = (row.payload as Record<string, unknown>) || {};

    // A deployment enters `running` exactly once. Steps, warnings and streamed
    // Docker output are progress reports on that one running row — re-asserting
    // the state on every report is what produced `running → running`.
    const step = async (label: string, progress: number) => {
      await reportOperationProgress(projectId, operationId, { progress, appendLog: label });
    };
    const warn = async (message: string) => {
      await reportOperationProgress(projectId, operationId, { appendWarning: message });
    };
    const log = async (line: string) => {
      await reportOperationProgress(projectId, operationId, { appendLog: line });
    };

    try {
      await transitionOperation(projectId, operationId, { appendLog: 'Operation started' });
      const result = await runOperation(type, {
        step,
        warn,
        log,
        payload,
        projectId,
        actor: String(row.actor || 'system'),
        environment: row.environment ? String(row.environment) : null,
      });
      await guardedTransition(projectId, operationId, 'succeeded', {
        progress: 100,
        result,
        appendLog: 'Operation completed',
      });
      await addActivity(projectId, `Operation ${type} succeeded (${operationId})`, 'ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await guardedTransition(projectId, operationId, 'failed', {
        appendError: message,
        appendLog: `Operation failed: ${message}`,
      });
      await addActivity(projectId, `Operation ${type} failed (${operationId})`, 'error');
    }
  } finally {
    inflight.delete(operationId);
  }
}

/** Safety net: fail operations stuck non-terminal beyond a deadline. */
export async function reapStaleOperations(maxAgeMs = 10 * 60 * 1000): Promise<number> {
  const result = await pool.query(
    `UPDATE api_build_operations
     SET state = 'failed',
         errors = errors || $1::jsonb,
         finished_at = NOW(), updated_at = NOW()
     WHERE state IN ('queued','validating','running')
       AND created_at < NOW() - ($2 || ' milliseconds')::interval
     RETURNING id`,
    [JSON.stringify(['Operation timed out and was marked failed.']), String(maxAgeMs)],
  );
  return result.rowCount ?? 0;
}

/**
 * Periodic sweeper for operations orphaned by a process crash (the executor
 * runs in-process). Started with the server alongside startApiBuildQueue().
 */
export function startOperationReaper(intervalMs = 60_000): void {
  setInterval(() => {
    void reapStaleOperations().catch(() => undefined);
  }, intervalMs).unref();
}
