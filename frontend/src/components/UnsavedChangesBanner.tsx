/**
 * UnsavedChangesBanner — Display unsaved changes and action buttons
 *
 * Shows a prominent banner when draft differs from server state.
 * Provides Save Draft, Review, and Discard actions.
 */

import React from 'react';
import './UnsavedChangesBanner.css';

export interface UnsavedChangesBannerProps {
  hasUnsavedChanges: boolean;
  changeCount: number;
  isSaving: boolean;
  error?: string | null;
  onSave: () => Promise<void>;
  onReview: () => void;
  onDiscard: () => Promise<void>;
}

export const UnsavedChangesBanner: React.FC<UnsavedChangesBannerProps> = ({
  hasUnsavedChanges,
  changeCount,
  isSaving,
  error,
  onSave,
  onReview,
  onDiscard,
}) => {
  const [savingError, setSavingError] = React.useState<string | null>(null);
  const [isDiscarding, setIsDiscarding] = React.useState(false);

  const handleSave = async () => {
    try {
      setSavingError(null);
      await onSave();
    } catch (err) {
      setSavingError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Discard all unsaved changes? This cannot be undone.')) {
      return;
    }
    try {
      setIsDiscarding(true);
      setSavingError(null);
      await onDiscard();
    } catch (err) {
      setSavingError(err instanceof Error ? err.message : 'Failed to discard changes');
    } finally {
      setIsDiscarding(false);
    }
  };

  if (!hasUnsavedChanges) {
    return null;
  }

  return (
    <div className="unsaved-changes-banner">
      <div className="banner-content">
        <div className="banner-icon">⚠️</div>
        <div className="banner-message">
          <span className="banner-text">
            {changeCount === 1
              ? '1 unsaved change'
              : `${changeCount} unsaved changes`}
          </span>
          {error && <span className="banner-error">{error}</span>}
          {savingError && <span className="banner-error">{savingError}</span>}
        </div>
      </div>

      <div className="banner-actions">
        <button
          className="banner-button banner-button-primary"
          onClick={handleSave}
          disabled={isSaving}
          title="Save changes to server"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          className="banner-button banner-button-secondary"
          onClick={onReview}
          disabled={isSaving}
          title="Review changes before saving"
        >
          Review
        </button>
        <button
          className="banner-button banner-button-tertiary"
          onClick={handleDiscard}
          disabled={isSaving || isDiscarding}
          title="Discard all unsaved changes"
        >
          {isDiscarding ? 'Discarding...' : 'Discard'}
        </button>
      </div>
    </div>
  );
};
