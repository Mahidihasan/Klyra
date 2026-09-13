/**
 * ChangeReviewModal — Review and confirm changes before saving
 *
 * Displays computed changes between draft and server state,
 * shows impact analysis, and provides Save/Discard actions.
 */

import React from 'react';
import './ChangeReviewModal.css';

export interface Change {
  id: string;
  type: 'add' | 'modify' | 'delete';
  category: string;
  resource: string;
  before: unknown;
  after: unknown;
  impact?: {
    affectedConsumers?: string[];
    isBreaking?: boolean;
    requiresApproval?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
  };
}

export interface ChangeReviewModalProps {
  changes: Change[];
  isOpen: boolean;
  isSaving: boolean;
  error?: string | null;
  onSave: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onClose: () => void;
  /** Change Center: save only the changes whose ids are provided. Falls back to onSave. */
  onSaveSelected?: (ids: string[]) => Promise<void>;
}

export const ChangeReviewModal: React.FC<ChangeReviewModalProps> = ({
  changes,
  isOpen,
  isSaving,
  error,
  onSave,
  onDiscard,
  onClose,
  onSaveSelected,
}) => {
  const [saving, setSaving] = React.useState(false);
  const [discarding, setDiscarding] = React.useState(false);
  // Selection state — starts fully selected so plain "Save" keeps old behaviour.
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(changes.map((c) => c.id)));

  // Reset selection when the change list changes underneath the modal.
  React.useEffect(() => {
    setSelected(new Set(changes.map((c) => c.id)));
  }, [changes]);

  if (!isOpen) return null;

  const toggleChange = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (onSaveSelected) {
        await onSaveSelected([...selected]);
      } else {
        await onSave();
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Discard all changes? This cannot be undone.')) {
      return;
    }
    try {
      setDiscarding(true);
      await onDiscard();
      onClose();
    } finally {
      setDiscarding(false);
    }
  };

  const breakingChanges = changes.filter((c) => c.impact?.isBreaking);
  const affectedConsumers = new Set(
    changes.flatMap((c) => c.impact?.affectedConsumers || [])
  );
  const selectedChanges = changes.filter((c) => selected.has(c.id));
  const selectedConsumers = new Set(
    selectedChanges.flatMap((c) => c.impact?.affectedConsumers || [])
  );
  const allSelected = selected.size === changes.length && changes.length > 0;

  const toggleAll = () => {
    setSelected(allSelected ? new Set<string>() : new Set(changes.map((c) => c.id)));
  };

  return (
    <>
      {/* Overlay */}
      <div className="change-review-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="change-review-modal">
        <div className="modal-header">
          <h2>Review Changes</h2>
          <button
            className="modal-close"
            onClick={onClose}
            title="Close without saving"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}

          {/* Summary + Selection controls */}
          <div className="changes-summary">
            <div className="summary-stat">
              <span className="stat-label">Total Changes</span>
              <span className="stat-value">{changes.length}</span>
            </div>

            <div className="summary-stat">
              <span className="stat-label">Selected</span>
              <span className="stat-value">{selected.size}</span>
            </div>

            {breakingChanges.length > 0 && (
              <div className="summary-stat warning">
                <span className="stat-label">⚠️ Breaking</span>
                <span className="stat-value">{breakingChanges.length}</span>
              </div>
            )}

            {selectedConsumers.size > 0 && (
              <div className="summary-stat">
                <span className="stat-label">Blast Radius · Consumers</span>
                <span className="stat-value">{selectedConsumers.size}</span>
              </div>
            )}

            {selectedChanges.some((c) => c.category === 'contract') && (
              <div className="summary-stat">
                <span className="stat-label">Blast Radius · Endpoints</span>
                <span className="stat-value">{selectedChanges.filter((c) => c.category === 'contract').length}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
            <button className="btn btn-tertiary" onClick={toggleAll} style={{ fontSize: 12, padding: '2px 8px' }}>
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
            <span style={{ color: 'var(--kly-text-dim)', fontSize: 11 }}>
              Tick the changes you want to accept — unticked changes stay as a draft.
            </span>
          </div>

          {/* Changes List */}
          <div className="changes-list">
            {changes.length === 0 ? (
              <div className="empty-state">No changes</div>
            ) : (
              changes.map((change) => (
                <ChangeItem
                  key={change.id}
                  change={change}
                  selected={selected.has(change.id)}
                  onToggle={() => toggleChange(change.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSaving || discarding}
          >
            Cancel
          </button>

          <button
            className="btn btn-tertiary"
            onClick={handleDiscard}
            disabled={isSaving || discarding}
          >
            {discarding ? 'Discarding...' : 'Discard All'}
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || selected.size === 0}
          >
            {saving ? 'Saving...' : `Save Selected (${selected.size})`}
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * ChangeItem — Display a single change with an accept/reject checkbox
 */
function ChangeItem({
  change,
  selected,
  onToggle,
}: {
  change: Change;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const typeIcon = {
    add: '➕',
    modify: '🔄',
    delete: '➖',
  }[change.type];

  const riskColor = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#ef4444',
  }[change.impact?.riskLevel || 'low'];

  return (
    <div className="change-item">
      <div
        className="change-header"
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Apply change to ${change.resource}`}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#6366f1' }}
        />
        <div className="change-icon">{typeIcon}</div>

        <div className="change-info">
          <div className="change-resource">
            <span className="category-badge">{change.category}</span>
            <span className="resource-name">{change.resource}</span>
          </div>

          {change.impact && (
            <div className="change-meta">
              {change.impact.isBreaking && (
                <span className="badge breaking">⚠️ Breaking Change</span>
              )}
              {change.impact.affectedConsumers && change.impact.affectedConsumers.length > 0 && (
                <span className="badge impacts">
                  Affects {change.impact.affectedConsumers.length} consumer(s)
                </span>
              )}
            </div>
          )}
        </div>

        {change.impact && (
          <div
            className="change-risk"
            style={{ borderLeftColor: riskColor }}
          >
            {change.impact.riskLevel?.toUpperCase()}
          </div>
        )}

        <div className="expand-icon">
          {expanded ? '▼' : '▶'}
        </div>
      </div>

      {expanded && (
        <div className="change-details">
          <div className="diff-view">
            <div className="diff-section">
              <div className="diff-label">Before</div>
              <div className="diff-value before">
                {formatValue(change.before)}
              </div>
            </div>

            <div className="diff-arrow">→</div>

            <div className="diff-section">
              <div className="diff-label">After</div>
              <div className="diff-value after">
                {formatValue(change.after)}
              </div>
            </div>
          </div>

          {change.impact?.affectedConsumers && change.impact.affectedConsumers.length > 0 && (
            <div className="impact-section">
              <div className="impact-label">Affected Consumers</div>
              <div className="impact-list">
                {change.impact.affectedConsumers.slice(0, 3).map((consumer) => (
                  <span key={consumer} className="consumer-badge">{consumer}</span>
                ))}
                {change.impact.affectedConsumers.length > 3 && (
                  <span className="consumer-badge">+{change.impact.affectedConsumers.length - 3} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
