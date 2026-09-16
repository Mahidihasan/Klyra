/**
 * DraftContext — Provides draft state to all ApiBuild workspace tabs
 *
 * Wraps the useDraftState hook in React Context so tabs can access
 * the shared draft state without prop drilling.
 */

import React, { createContext, useContext } from 'react';
import { useDraftState } from '../../hooks/useDraftState';
import { ProviderProject } from '../../types/apibuild';

export interface DraftContextType {
  server: ProviderProject | null;
  draft: ProviderProject | null;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  changes: Array<{
    id: string;
    type: 'add' | 'modify' | 'delete';
    category: string;
    resource: string;
    before: unknown;
    after: unknown;
  }>;
  updateDraft: (patch: Partial<ProviderProject>) => Promise<void>;
  saveDraft: () => Promise<ProviderProject | undefined>;
  discardDraft: () => Promise<void>;
  validateDraft: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>;
  /** Apply only the accepted changes to live; rejected changes are dropped from the draft. */
  promoteSelected: (ids: string[]) => Promise<ProviderProject | undefined>;
  refresh: () => Promise<void>;
}

const DraftContext = createContext<DraftContextType | null>(null);

export interface DraftProviderProps {
  projectId: string;
  children: React.ReactNode;
}

/**
 * DraftProvider — Wrap this around the workspace to provide draft state
 */
export const DraftProvider: React.FC<DraftProviderProps> = ({ projectId, children }) => {
  const draft = useDraftState(projectId);

  return (
    <DraftContext.Provider value={draft}>
      {children}
    </DraftContext.Provider>
  );
};

/**
 * useDraft — Hook to access draft state from context
 * Call this from any tab component
 */
export function useDraft(): DraftContextType {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('useDraft must be used inside DraftProvider');
  }
  return context;
}
