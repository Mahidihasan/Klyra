/**
 * useProjectDraft — Helper hook for tabs to work with draft system
 *
 * Provides convenient methods for tabs to update project configuration
 * while integrating with the draft system.
 */

import { ProviderProject } from '../../../types/apibuild';
import { useDraft } from '../DraftContext';

export interface UseProjectDraftResult {
  project: ProviderProject | null;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateProject: (patch: Partial<ProviderProject>) => Promise<void>;
  validateBeforeSave: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>;
}

/**
 * Hook to use draft system from within a tab component
 */
export function useProjectDraft(): UseProjectDraftResult {
  const draft = useDraft();

  const updateProject = async (patch: Partial<ProviderProject>) => {
    await draft.updateDraft(patch);
  };

  const validateBeforeSave = async () => {
    return draft.validateDraft();
  };

  return {
    project: draft.draft || draft.server,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isLoading: draft.isLoading,
    isSaving: draft.isSaving,
    error: draft.error,
    updateProject,
    validateBeforeSave,
  };
}
