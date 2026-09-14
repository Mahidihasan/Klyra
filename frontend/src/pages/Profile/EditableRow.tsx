import { Check, Loader2, Lock, Pencil, X } from 'lucide-react';
import React from 'react';

/* ==========================================================================
 * EditableRow — one settings row with a pencil edit affordance. Idle state
 * shows the current value; the pencil (or a lock for read-only values) sits
 * on the right. When `editing` is true the value is replaced by `children`
 * (the editor inputs) plus Save/Cancel controls and an inline error line.
 * ========================================================================== */

export interface EditableRowProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: React.ReactNode;
  readOnly?: boolean;
  readOnlyNote?: string;
  editing: boolean;
  busy?: boolean;
  error?: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children?: React.ReactNode;
}

export const EditableRow: React.FC<EditableRowProps> = ({
  icon,
  label,
  hint,
  value,
  readOnly = false,
  readOnlyNote,
  editing,
  busy = false,
  error,
  onEdit,
  onCancel,
  onSave,
  children,
}) => (
  <div className={`profile-row${editing ? ' editing' : ''}`}>
    <div className="profile-row-head">
      <div className="profile-row-icon">{icon}</div>
      <div className="profile-row-main">
        <span className="profile-row-label">
          {label}
          {hint ? <em>{hint}</em> : null}
        </span>
        {!editing && <div className="profile-row-value">{value}</div>}
      </div>
      {!editing &&
        (readOnly ? (
          <span
            className="profile-row-locked"
            title={readOnlyNote ?? 'This field cannot be changed.'}
          >
            <Lock size={14} />
          </span>
        ) : (
          <button
            type="button"
            className="profile-row-edit"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            disabled={busy}
          >
            <Pencil size={13} />
            <span>Edit</span>
          </button>
        ))}
    </div>
    {editing && (
      <div className="profile-row-editor">
        {children}
        {error ? <p className="profile-row-error">{error}</p> : null}
        <div className="profile-row-editor-actions">
          <button
            type="button"
            className="profile-secondary-btn"
            onClick={onCancel}
            disabled={busy}
          >
            <X size={15} /> Cancel
          </button>
          <button type="button" className="profile-primary-btn" onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="profile-spinner" size={15} /> : <Check size={15} />}
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )}
  </div>
);
