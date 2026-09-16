/**
 * API Build — Draft System Service
 *
 * Manages draft configuration storage, change tracking, and validation.
 * Enables non-destructive change staging and collaborative editing.
 *
 * Key concepts:
 * - Draft is a separate copy of project config, not live until saved
 * - Changes are computed from diff between draft and live
 * - Version field enables optimistic concurrency (prevents overwrites)
 * - Audit log records all mutations for immutable history
 */

import { pool } from '../../services/database.service';
import { randomUUID } from 'node:crypto';

export interface DraftChange {
  id: string;
  type: 'add' | 'modify' | 'delete';
  category: 'contract' | 'gateway' | 'security' | 'environment' | 'policy';
  resource: string;
  before: unknown;
  after: unknown;
  impact: {
    affectedConsumers: string[];
    isBreaking: boolean;
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  isSelected: boolean;
}

export interface DraftState {
  config: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  changes: DraftChange[];
  hasUnsavedChanges: boolean;
}

export interface AuditEvent {
  id: string;
  projectId: string;
  actorId: string;
  actorEmail?: string;
  timestamp: string;
  resourceType: string;
  resourceId?: string;
  operation: string;
  before?: unknown;
  after?: unknown;
  changeSummary?: string;
  requestId?: string;
  context?: unknown;
}

// ============================================================================
// Draft Configuration Management
// ============================================================================

/**
 * Get both server and draft configuration for a project.
 * If no draft exists, returns null for draft.
 */
export async function getDraftState(
  projectId: string
): Promise<{ server: Record<string, unknown> | null; draft: Record<string, unknown> | null }> {
  const result = await pool.query(
    'SELECT project, draft_config FROM api_build_projects WHERE id = $1',
    [projectId]
  );

  if (result.rows.length === 0) return { server: null, draft: null };

  const row = result.rows[0];
  return {
    server: row.project as Record<string, unknown>,
    draft: row.draft_config as Record<string, unknown> | null,
  };
}

/**
 * Save a draft configuration (does not affect live config).
 * Updates draft_updated_at and draft_by timestamp.
 */
export async function saveDraftConfig(
  projectId: string,
  draftConfig: Record<string, unknown>,
  actorId: string
): Promise<{
  draft: Record<string, unknown>;
  hasChanges: boolean;
}> {
  const now = new Date().toISOString();

  const result = await pool.query(
    `UPDATE api_build_projects 
     SET draft_config = $1, draft_updated_at = $2, draft_by = $3
     WHERE id = $4
     RETURNING draft_config, project`,
    [JSON.stringify(draftConfig), now, actorId, projectId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Project ${projectId} not found`);
  }

  const row = result.rows[0];
  const hasChanges = !deepEqual(row.project, draftConfig);

  // Record audit event for draft save
  await recordAuditEvent({
    projectId,
    actorId,
    resourceType: 'draft',
    resourceId: projectId,
    operation: 'update',
    before: row.project,
    after: draftConfig,
    changeSummary: 'Draft configuration updated',
  });

  return {
    draft: row.draft_config,
    hasChanges,
  };
}

/**
 * Promote draft to live (save draft as the new server state).
 * Increments version field for optimistic concurrency.
 * Returns error if version mismatch (concurrent edit detected).
 */
export async function promoteDraftToLive(
  projectId: string,
  clientVersion: number,
  actorId: string
): Promise<{
  success: boolean;
  error?: { code: string; message: string };
  project?: Record<string, unknown>;
  newVersion?: number;
}> {
  const current = await pool.query(
    'SELECT project, draft_config, version FROM api_build_projects WHERE id = $1',
    [projectId]
  );

  if (current.rows.length === 0) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    };
  }

  const row = current.rows[0];

  // Optimistic concurrency: check version match
  if (row.version !== clientVersion) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message: `Version conflict: client has ${clientVersion}, server has ${row.version}`,
      },
      project: row.project,
      newVersion: row.version,
    };
  }

  // Validate draft before promotion
  const validation = await validateDraft(projectId, row.draft_config || row.project);
  if (!validation.ok) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: validation.error || 'Draft validation failed',
      },
    };
  }

  const now = new Date().toISOString();
  const newVersion = row.version + 1;
  const draftConfig = row.draft_config || row.project;

  // Promote draft to live
  const result = await pool.query(
    `UPDATE api_build_projects 
     SET project = $1, 
         version = $2, 
         draft_config = NULL, 
         draft_updated_at = NULL, 
         draft_by = NULL,
         saved_by = $3,
         updated_at = $4
     WHERE id = $5
     RETURNING project`,
    [JSON.stringify(draftConfig), newVersion, actorId, now, projectId]
  );

  if (result.rows.length === 0) {
    return {
      success: false,
      error: { code: 'SAVE_FAILED', message: 'Failed to save draft' },
    };
  }

  // Record audit event
  await recordAuditEvent({
    projectId,
    actorId,
    resourceType: 'project',
    resourceId: projectId,
    operation: 'save_draft',
    before: row.project,
    after: draftConfig,
    changeSummary: 'Draft promoted to live configuration',
  });

  return {
    success: true,
    project: result.rows[0].project,
    newVersion,
  };
}

/**
 * Discard draft (revert to server state).
 */
export async function discardDraft(projectId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE api_build_projects 
     SET draft_config = NULL, draft_updated_at = NULL, draft_by = NULL
     WHERE id = $1`,
    [projectId]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Change Computation & Analysis
// ============================================================================

/**
 * Compute changes between draft and live configuration.
 * Returns structured Change objects for the Change Center UI.
 */
export async function computeChanges(
  projectId: string,
  draftConfig: Record<string, unknown>,
  liveConfig: Record<string, unknown>
): Promise<DraftChange[]> {
  const changes: DraftChange[] = [];

  // Compute configuration-level changes
  const configChanges = computeConfigDiff(
    liveConfig as Record<string, unknown>,
    draftConfig as Record<string, unknown>
  );

  for (const change of configChanges) {
    const impact = await analyzeChangeImpact(projectId, change);
    changes.push({
      ...change,
      impact,
    });
  }

  return changes;
}

/**
 * Analyze impact of a change (affected consumers, breaking, risk level).
 */
async function analyzeChangeImpact(
  projectId: string,
  change: Omit<DraftChange, 'impact'>
): Promise<DraftChange['impact']> {
  // Find affected consumers
  const consumers = await pool.query(
    'SELECT id FROM api_build_consumers WHERE project_id = $1',
    [projectId]
  );

  const affectedConsumers = consumers.rows.map((row) => row.id);

  // Detect breaking changes
  const isBreaking = detectBreakingChange(change);
  const requiresApproval = isBreaking || affectedConsumers.length > 5;

  return {
    affectedConsumers,
    isBreaking,
    requiresApproval,
    riskLevel: isBreaking ? 'high' : affectedConsumers.length > 0 ? 'medium' : 'low',
  };
}

/**
 * Simple diff computation between two configurations.
 */
function computeConfigDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Omit<DraftChange, 'impact'>[] {
  const changes: Omit<DraftChange, 'impact'>[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    if (deepEqual(beforeValue, afterValue)) continue;

    if (!(key in before)) {
      changes.push({
        id: randomUUID(),
        type: 'add',
        category: 'gateway',
        resource: key,
        before: undefined,
        after: afterValue,
        isSelected: true,
      });
    } else if (!(key in after)) {
      changes.push({
        id: randomUUID(),
        type: 'delete',
        category: 'gateway',
        resource: key,
        before: beforeValue,
        after: undefined,
        isSelected: true,
      });
    } else {
      changes.push({
        id: randomUUID(),
        type: 'modify',
        category: 'gateway',
        resource: key,
        before: beforeValue,
        after: afterValue,
        isSelected: true,
      });
    }
  }

  return changes;
}

/**
 * Detect if a change is breaking (would require consumer migration).
 */
function detectBreakingChange(change: Omit<DraftChange, 'impact'>): boolean {
  // Examples of breaking changes:
  // - Removing an endpoint
  // - Changing authentication type
  // - Modifying required endpoint parameters
  // - Removing a response field

  if (change.type === 'delete') {
    // Removing anything is potentially breaking
    return true;
  }

  // Check for specific breaking patterns
  if (change.resource === 'authKind' || change.resource === 'authentication') {
    return true; // Auth changes are breaking
  }

  if (change.type === 'modify' && typeof change.after === 'object' && typeof change.before === 'object') {
    // Field removals in objects are breaking
    const before = change.before as Record<string, unknown>;
    const after = change.after as Record<string, unknown>;

    for (const key of Object.keys(before)) {
      if (!(key in after)) {
        return true; // Field was removed
      }
    }
  }

  return false;
}

// ============================================================================
// Draft Validation
// ============================================================================

/**
 * Validate draft configuration before promoting to live.
 */
export async function validateDraft(
  projectId: string,
  draftConfig: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const warnings: string[] = [];

  // Required fields validation
  if (!draftConfig.name || typeof draftConfig.name !== 'string') {
    return { ok: false, error: 'Project name is required' };
  }

  if (!draftConfig.baseUrl || typeof draftConfig.baseUrl !== 'string') {
    return { ok: false, error: 'Base URL is required' };
  }

  // URL format validation
  try {
    new URL(draftConfig.baseUrl as string);
  } catch {
    return { ok: false, error: 'Invalid base URL format' };
  }

  // Warn about potentially problematic configurations
  if (!draftConfig.authKind) {
    warnings.push('No authentication configured; consider adding authorization');
  }

  if (!draftConfig.rateLimitPerMin) {
    warnings.push('No rate limit configured; consider setting one for production');
  }

  return { ok: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// ============================================================================
// Audit Log
// ============================================================================

/**
 * Record an audit event (immutable change history).
 */
export async function recordAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'>
): Promise<AuditEvent> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  await pool.query(
    `INSERT INTO api_build_audit_log 
     (id, project_id, actor_id, actor_email, timestamp, resource_type, resource_id, 
      operation, before, after, change_summary, request_id, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      event.projectId,
      event.actorId,
      event.actorEmail,
      timestamp,
      event.resourceType,
      event.resourceId,
      event.operation,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
      event.changeSummary,
      event.requestId,
      event.context ? JSON.stringify(event.context) : null,
    ]
  );

  return {
    id,
    timestamp,
    ...event,
  };
}

/**
 * Retrieve audit log for a project.
 */
export async function getAuditLog(
  projectId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<AuditEvent[]> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const result = await pool.query(
    `SELECT id, project_id, actor_id, actor_email, timestamp, resource_type, resource_id,
            operation, before, after, change_summary, request_id, context
     FROM api_build_audit_log
     WHERE project_id = $1
     ORDER BY timestamp DESC
     LIMIT $2 OFFSET $3`,
    [projectId, limit, offset]
  );

  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    timestamp: row.timestamp,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    operation: row.operation,
    before: row.before,
    after: row.after,
    changeSummary: row.change_summary,
    requestId: row.request_id,
    context: row.context,
  }));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Deep equality check (handles nested objects/arrays).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => deepEqual(val, (b as unknown[])[i]));
    }

    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);

    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }

  return false;
}
