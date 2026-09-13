/**
 * Operation System — shared types.
 *
 * Mirrors backend/src/modules/api-build/api-build.operations.ts so frontend and
 * backend stay in sync on one vocabulary (release §19: no conflicting names).
 *
 * State machine:
 *   queued → validating → running → succeeded
 *                              ↘ failed
 *   queued|validating|running → cancelled
 *   failed|cancelled → (retry) → queued
 */

export type OperationType =
  | 'deploy' | 'rollback' | 'publish' | 'import' | 'sync' | 'migrate'
  | 'rotate_key' | 'bulk_policy_update' | 'health_probe' | 'delete';

export type OperationState =
  | 'queued' | 'validating' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface OperationRecord {
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

/** RGB tuple per state — semantic, plus textual labels (never color-only). */
export const OPERATION_META: Record<OperationState, { label: string; color: string; dot: string }> = {
  queued:    { label: 'Queued',    color: '#64748b', dot: '#64748b' },
  validating:{ label: 'Validating',color: '#f59e0b', dot: '#f59e0b' },
  running:   { label: 'Running',   color: '#38bdf8', dot: '#38bdf8' },
  succeeded: { label: 'Succeeded', color: '#22c55e', dot: '#22c55e' },
  failed:    { label: 'Failed',    color: '#ef4444', dot: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', dot: '#94a3b8' },
};

export function isOperationTerminal(state: OperationState): boolean {
  return state === 'succeeded' || state === 'failed' || state === 'cancelled';
}

export function isOperationCancellable(state: OperationState): boolean {
  return state === 'queued' || state === 'validating' || state === 'running';
}

export function isOperationRetryable(state: OperationState): boolean {
  return state === 'failed' || state === 'cancelled';
}

/** Resource history entry — mirrors backend api-build.history.ts. */
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