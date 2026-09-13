/**
 * useOperations — live operation monitor.
 *
 * Polls the durable backend operation list while any operation is still
 * non-terminal, so the UI reflects real executor progress. This is the
 * frontend surface for the operation system (§25–26); the authoritative state
 * always lives in the backend row, never in local component state.
 */

import { useState, useEffect, useCallback } from 'react';
import { OperationRecord, isOperationTerminal } from '../../../types/operations';
import { apiBuildService } from '../../../services/apiBuild';

const POLL_INTERVAL_MS = 1500;

export interface UseOperationsResult {
  operations: OperationRecord[];
  /** True while any operation is non-terminal (polling is active). */
  isPolling: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Create a new operation and refresh. Returns the created row. */
  start: (input: { type: string; environment?: string; payload?: Record<string, unknown>; reason?: string }) => Promise<OperationRecord | null>;
  cancel: (operationId: string) => Promise<OperationRecord | null>;
  retry: (operationId: string) => Promise<OperationRecord | null>;
}

export function useOperations(projectId: string, options: { limit?: number } = {}): UseOperationsResult {
  const limit = options.limit || 12;
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    try {
      setError(null);
      const list = await apiBuildService.listOperations<OperationRecord>(projectId, { limit });
      setOperations(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operations');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while anything is non-terminal. Stops automatically once done.
  useEffect(() => {
    if (!projectId) return;
    const active = operations.some((op) => !isOperationTerminal(op.state));
    if (!active) return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [operations, projectId, refresh]);

  const start = useCallback(async (input: { type: string; environment?: string; payload?: Record<string, unknown>; reason?: string }) => {
    try {
      const created = await apiBuildService.createOperation<OperationRecord>(projectId, input);
      setOperations((prev) => [created, ...prev.filter((op) => op.id !== created.id)]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start operation');
      return null;
    }
  }, [projectId]);

  const cancel = useCallback(async (operationId: string) => {
    try {
      const row = await apiBuildService.cancelOperation<OperationRecord>(projectId, operationId);
      setOperations((prev) => prev.map((op) => op.id === operationId ? row : op));
      return row;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel operation');
      return null;
    }
  }, [projectId]);

  const retry = useCallback(async (operationId: string) => {
    try {
      const row = await apiBuildService.retryOperation<OperationRecord>(projectId, operationId);
      setOperations((prev) => prev.map((op) => op.id === operationId ? row : op));
      return row;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry operation');
      return null;
    }
  }, [projectId]);

  const isPolling = operations.some((op) => !isOperationTerminal(op.state));

  return { operations, isPolling, isLoading, error, refresh, start, cancel, retry };
}