/**
 * API Build — Resource History Service
 *
 * Immutable per-resource version history built on top of api_build_resource_history.
 * Every governed save (project config, gateway settings, contract metadata) is
 * recorded with before/after values, an actor, an optional reason and a
 * monotonically increasing version number per (project, resourceType, resourceId).
 *
 * The UI uses this for:
 *  - "History" panels on any resource (Audit tab / contextual inspector),
 *  - diff views (before vs after),
 *  - restore-to-version (re-applying a historical snapshot through the normal
 *    update path, which itself records a new history entry — never destructively
 *    rewriting the log).
 *
 * Related but distinct: api_build_audit_log (activity-grade event stream, also
 * immutable) and api_build_activity (lightweight human-readable feed).
 */

import { pool } from '../../services/database.service';

export interface ResourceHistoryEntry {
  id: number;
  projectId: string;
  resourceType: string;
  resourceId: string;
  versionNo: number;
  actor: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  summary: string | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): ResourceHistoryEntry {
  return {
    id: Number(r.id),
    projectId: String(r.project_id),
    resourceType: String(r.resource_type),
    resourceId: String(r.resource_id ?? ''),
    versionNo: Number(r.version_no ?? 1),
    actor: String(r.actor ?? 'system'),
    reason: r.reason ? String(r.reason) : null,
    before: (r.before as Record<string, unknown>) ?? null,
    after: (r.after as Record<string, unknown>) ?? null,
    summary: r.summary ? String(r.summary) : null,
    createdAt: String(r.created_at ?? ''),
  };
}

/**
 * Record a new history entry for a resource. Computes the next version number
 * inside the same statement sequence (read + write; single-writer per project
 * save path, and a gap is harmless — uniqueness is not required, only order).
 */
export async function recordResourceHistory(input: {
  projectId: string;
  resourceType: string;
  resourceId?: string;
  actor?: string;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  summary?: string;
}): Promise<ResourceHistoryEntry> {
  const existing = await pool.query(
    `SELECT COALESCE(MAX(version_no), 0) AS max_version
       FROM api_build_resource_history
      WHERE project_id = $1 AND resource_type = $2 AND resource_id = $3`,
    [input.projectId, input.resourceType, input.resourceId || '']);
  const versionNo = Number(existing.rows[0]?.max_version ?? 0) + 1;

  const result = await pool.query(
    `INSERT INTO api_build_resource_history
       (project_id, resource_type, resource_id, version_no, actor, reason, before, after, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
     RETURNING id, project_id, resource_type, resource_id, version_no, actor, reason,
               before, after, summary, created_at`,
    [input.projectId, input.resourceType, input.resourceId || '', versionNo,
     input.actor || 'system', input.reason || null,
     input.before ? JSON.stringify(input.before) : null,
     input.after ? JSON.stringify(input.after) : null,
     input.summary || null],
  );
  return mapRow(result.rows[0]);
}

export async function listResourceHistory(
  projectId: string,
  options: { resourceType?: string; resourceId?: string; limit?: number; offset?: number } = {},
): Promise<ResourceHistoryEntry[]> {
  const limit = Math.min(Number(options.limit) || 50, 200);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const clauses = ['project_id = $1'];
  const params: unknown[] = [projectId];
  if (options.resourceType) { params.push(options.resourceType); clauses.push(`resource_type = $${params.length}`); }
  if (options.resourceId !== undefined && options.resourceId !== '') {
    params.push(options.resourceId);
    clauses.push(`resource_id = $${params.length}`);
  }
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT id, project_id, resource_type, resource_id, version_no, actor, reason,
            before, after, summary, created_at
       FROM api_build_resource_history
      WHERE ${clauses.join(' AND ')}
      ORDER BY version_no DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params);
  return result.rows.map(mapRow);
}

/**
 * Restore a historical snapshot: returns the "after" payload of the requested
 * version so the caller can push it through the normal update path (which
 * records its own history + audit entries). Restoring is additive in the log —
 * we never rewrite history.
 */
export async function getRestoreSnapshot(
  projectId: string, resourceType: string, versionNo: number,
): Promise<ResourceHistoryEntry | null> {
  const result = await pool.query(
    `SELECT id, project_id, resource_type, resource_id, version_no, actor, reason,
            before, after, summary, created_at
       FROM api_build_resource_history
      WHERE project_id = $1 AND resource_type = $2 AND version_no = $3`,
    [projectId, resourceType, versionNo]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
