/**
 * WorkspaceRedesignWithDraft — Wraps WorkspaceRedesign with Draft System
 *
 * This component provides draft state management to all tabs via DraftContext.
 * It displays the UnsavedChangesBanner when draft differs from server state.
 */

import React, { useState } from 'react';
import { ProviderProject, ProjectTab } from '../../types/apibuild';
import { DetailedEndpoint } from './types';
import { DraftProvider, useDraft } from './DraftContext';
import { UnsavedChangesBanner } from '../../components/UnsavedChangesBanner';
import { ChangeReviewModal } from '../../components/ChangeReviewModal';
import { WorkspaceRedesign } from './WorkspaceRedesign';

interface WorkspaceRedesignWithDraftProps {
  project: ProviderProject;
  projectsList: ProviderProject[];
  tab: ProjectTab;
  setTab: (t: ProjectTab) => void;
  onBackToDashboard: () => void;
  /** Optional endpoint lets "Test in Playground" preselect a specific route. */
  onOpenPlayground: (ep?: DetailedEndpoint) => void;
  onPauseToggle: () => void;
  onDeleteProject: () => void;
  onSelectProject: (p: ProviderProject) => void;
  onUpdateProject: (patch: Partial<ProviderProject>) => void;
}

/**
 * Outer wrapper — Just provides the DraftProvider
 */
export const WorkspaceRedesignWithDraft: React.FC<WorkspaceRedesignWithDraftProps> = (
  props
) => {
  return (
    <DraftProvider projectId={props.project.id}>
      <WorkspaceRedesignContent {...props} />
    </DraftProvider>
  );
};

/**
 * Inner content — Uses draft state via context
 */
function WorkspaceRedesignContent({
  project,
  projectsList,
  tab,
  setTab,
  onBackToDashboard,
  onOpenPlayground,
  onPauseToggle,
  onDeleteProject,
  onSelectProject,
  onUpdateProject,
}: WorkspaceRedesignWithDraftProps) {
  const draft = useDraft();
  const [showChangeReview, setShowChangeReview] = useState(false);

  // Use draft if available, fall back to server
  const displayProject = draft.draft || draft.server || project;

  const handleSaveDraft = async () => {
    try {
      const saved = await draft.saveDraft();
      if (saved) {
        onUpdateProject(saved);
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  const handleDiscardDraft = async () => {
    try {
      await draft.discardDraft();
      // Project state will revert automatically
    } catch (err) {
      console.error('Failed to discard draft:', err);
    }
  };

  return (
    <div className="workspace-with-draft">
      {/* Unsaved Changes Banner */}
      <UnsavedChangesBanner
        hasUnsavedChanges={draft.hasUnsavedChanges}
        changeCount={draft.changes.length}
        isSaving={draft.isSaving}
        error={draft.error}
        onSave={handleSaveDraft}
        onReview={() => setShowChangeReview(true)}
        onDiscard={handleDiscardDraft}
      />

      {/* Workspace */}
      <WorkspaceRedesign
        project={displayProject}
        projectsList={projectsList}
        tab={tab}
        setTab={setTab}
        onBackToDashboard={onBackToDashboard}
        onOpenPlayground={onOpenPlayground}
        onPauseToggle={onPauseToggle}
        onDeleteProject={onDeleteProject}
        onSelectProject={onSelectProject}
        onUpdateProject={onUpdateProject}
      />

      {/* Change Review Modal — Change Center with selective accept/reject */}
      <ChangeReviewModal
        isOpen={showChangeReview}
        changes={draft.changes}
        isSaving={draft.isSaving}
        error={draft.error}
        onSave={handleSaveDraft}
        onSaveSelected={async (ids) => {
          const saved = await draft.promoteSelected(ids);
          if (saved) onUpdateProject(saved);
        }}
        onDiscard={handleDiscardDraft}
        onClose={() => setShowChangeReview(false)}
      />
    </div>
  );
}
