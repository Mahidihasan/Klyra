/**
 * useDraftState — Manage draft & unsaved state for a project
 *
 * Handles:
 * - Separation of server state and working draft
 * - localStorage persistence across navigation/refresh
 * - Tracking unsaved changes
 * - Browser leave warning if unsaved
 * - Auto-save draft to server every 30 seconds
 */

import { useEffect, useState, useCallback } from 'react';
import { ProviderProject } from '../types/apibuild';
import { apiBuildService } from '../services/apiBuild';

export interface DraftState {
  server: ProviderProject | null;
  draft: ProviderProject | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  changes: Array<{
    id: string;
    type: 'add' | 'modify' | 'delete';
    category: string;
    resource: string;
    before: unknown;
    after: unknown;
  }>;
}

const DRAFT_STORAGE_KEY = (projectId: string) => `draft_${projectId}`;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export function useDraftState(projectId: string) {
  // Server state (from backend)
  const [server, setServer] = useState<ProviderProject | null>(null);

  // Draft state (working copy, may be unsaved)
  const [draft, setDraft] = useState<ProviderProject | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<DraftState['changes']>([]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = !deepEqual(server, draft);

  /**
   * Load initial state from server and localStorage
   */
  const loadState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch server state
      const serverProject = await apiBuildService.get(projectId);
      setServer(serverProject);

      // Try to load draft from localStorage
      const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY(projectId));
      if (storedDraft) {
        try {
          const parsed = JSON.parse(storedDraft) as ProviderProject;
          setDraft(parsed);
        } catch {
          console.warn('Failed to parse stored draft');
          setDraft(serverProject);
        }
      } else {
        setDraft(serverProject);
      }

      // Compute changes
      if (serverProject && storedDraft) {
        try {
          const computedChanges = await apiBuildService.computeDraftChanges(projectId, JSON.parse(storedDraft));
          setChanges(computedChanges || []);
        } catch {
          // Silently fail; changes computation is not critical
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project state');
      setServer(null);
      setDraft(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  /**
   * Update the working draft
   */
  const updateDraft = useCallback(async (patch: Partial<ProviderProject>) => {
    if (!draft) return;

    const updated = { ...draft, ...patch };
    setDraft(updated);

    // Persist to localStorage
    localStorage.setItem(DRAFT_STORAGE_KEY(projectId), JSON.stringify(updated));

    // Recompute changes
    if (server) {
      try {
        const computedChanges = await apiBuildService.computeDraftChanges(projectId, updated);
        setChanges(computedChanges || []);
      } catch {
        // Silently fail
      }
    }
  }, [draft, server, projectId]);

  /**
   * Save draft to server (promote draft to live)
   */
  const saveDraft = useCallback(async () => {
    if (!draft || !server) return;

    try {
      setIsSaving(true);
      setError(null);

      // Send to server with version for optimistic concurrency
      const result = await apiBuildService.saveDraftToLive(projectId, draft);

      // Update server state
      setServer(result);
      setDraft(result);

      // Clear draft from localStorage
      localStorage.removeItem(DRAFT_STORAGE_KEY(projectId));

      // Clear changes
      setChanges([]);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save draft';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [draft, server, projectId]);

  /**
   * Discard draft (revert to server state)
   */
  const discardDraft = useCallback(async () => {
    if (!server) return;

    try {
      setError(null);

      // Clear server-side draft
      await apiBuildService.discardDraft(projectId);

      // Revert to server state
      setDraft(server);

      // Clear localStorage
      localStorage.removeItem(DRAFT_STORAGE_KEY(projectId));

      // Clear changes
      setChanges([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discard draft';
      setError(message);
      throw err;
    }
  }, [server, projectId]);

  /**
   * Apply only the accepted changes to live; rejected changes are dropped.
   * Rebuilds the config from the server state plus each accepted change's
   * "after" value, persists it as the draft, then promotes it to live through
   * the existing optimistic-concurrency path.
   */
  const promoteSelected = useCallback(async (ids: string[]) => {
    if (!server || !draft) return undefined;

    try {
      setError(null);
      setIsSaving(true);

      const accepted = changes.filter((change) => ids.includes(change.id));
      const base = (server as unknown) as Record<string, unknown>;
      const merged = { ...base };
      for (const change of accepted) {
        if (change.type === 'delete' || change.after === undefined) {
          delete merged[change.resource];
        } else {
          merged[change.resource] = change.after;
        }
      }

      const persisted = merged as unknown as ProviderProject;
      setDraft(persisted);
      localStorage.setItem(DRAFT_STORAGE_KEY(projectId), JSON.stringify(persisted));

      // Persist the merged config as the server-side draft, then promote it.
      await apiBuildService.updateDraftConfig(projectId, persisted);
      const result = await apiBuildService.saveDraftToLive(projectId, persisted);

      setServer(result);
      setDraft(result);
      localStorage.removeItem(DRAFT_STORAGE_KEY(projectId));
      setChanges([]);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply selected changes';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [server, draft, changes, projectId]);

  /**
   * Validate draft before saving
   */
  const validateDraft = useCallback(async () => {
    if (!draft) return { ok: false };

    try {
      const validation = await apiBuildService.validateDraft(projectId, draft);
      return validation;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Validation failed',
      };
    }
  }, [draft, projectId]);

  /**
   * Refresh server state (discarding unsaved draft)
   */
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const serverProject = await apiBuildService.get(projectId);
      setServer(serverProject);
      setDraft(serverProject);
      localStorage.removeItem(DRAFT_STORAGE_KEY(projectId));
      setChanges([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh project');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load initial state on mount
  useEffect(() => {
    loadState();
  }, [loadState]);

  // Set up auto-save
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setInterval(async () => {
      if (draft && hasUnsavedChanges) {
        try {
          // Save draft to server (without promoting to live)
          await apiBuildService.updateDraftConfig(projectId, draft);
        } catch (err) {
          console.warn('Auto-save failed:', err);
        }
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [draft, hasUnsavedChanges, projectId]);

  // Warn before leaving if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    server,
    draft,
    hasUnsavedChanges,
    isLoading,
    isSaving,
    error,
    changes,
    updateDraft,
    saveDraft,
    discardDraft,
    promoteSelected,
    validateDraft,
    refresh,
    loadState,
  };
}

/**
 * Deep equality check (handles nested objects/arrays)
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
