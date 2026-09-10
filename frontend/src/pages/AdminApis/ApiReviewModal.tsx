import React, { useState } from 'react';
import { AlertTriangle, Loader2, CheckCircle, XCircle, Slash } from 'lucide-react';
import { AdminApiRow, ModerateAction } from '../../types/adminApis';

interface Props {
  api: AdminApiRow;
  isSaving: boolean;
  error: string | null;
  onConfirm: (action: ModerateAction, reason: string) => void;
  onClose: () => void;
}

export const ApiReviewModal: React.FC<Props> = ({
  api,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [selectedAction, setSelectedAction] = useState<ModerateAction | null>(null);

  const canSubmit = selectedAction !== null && !isSaving;

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Review API"
        onClick={(event) => event.stopPropagation()}
        style={{ width: '500px', maxWidth: '90vw' }}
      >
        <h2 className="au-modal-title">Review API</h2>

        <div className="au-modal-subject">
          {api.logoUrl ? (
            <img src={api.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div className="au-avatar-fallback" style={{ width: 36, height: 36, fontSize: 16 }}>
              {api.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="au-modal-subject-name">{api.name}</p>
            <p className="au-modal-subject-email">v{api.currentVersion} • Owned by {api.ownerName}</p>
          </div>
          <span className="au-badge" data-status={api.status === 'PUBLISHED' ? 'active' : api.status === 'PENDING' ? 'beta' : 'offline'}>
            {api.status}
          </span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card-base" style={{ padding: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Security Scan:</span>
              <span style={{ color: 'var(--status-active)', fontWeight: 600 }}>Passed</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Endpoints:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{api.endpointsCount} discovered</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rate Limits:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Standard</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
           <label className="au-field-label" style={{ marginBottom: '8px', display: 'block' }}>Action</label>
           <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={\`au-ghost-btn \${selectedAction === 'APPROVED' ? 'active-approve' : ''}\`}
                onClick={() => setSelectedAction('APPROVED')}
                style={{ flex: 1, borderColor: selectedAction === 'APPROVED' ? 'var(--status-active)' : undefined, color: selectedAction === 'APPROVED' ? 'var(--status-active)' : undefined, background: selectedAction === 'APPROVED' ? 'rgba(34, 197, 94, 0.1)' : undefined }}
              >
                <CheckCircle size={16} style={{ marginRight: 6 }} />
                Approve
              </button>
              <button
                className={\`au-ghost-btn \${selectedAction === 'REJECTED' ? 'active-reject' : ''}\`}
                onClick={() => setSelectedAction('REJECTED')}
                style={{ flex: 1, borderColor: selectedAction === 'REJECTED' ? 'var(--status-error)' : undefined, color: selectedAction === 'REJECTED' ? 'var(--status-error)' : undefined, background: selectedAction === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : undefined }}
              >
                <XCircle size={16} style={{ marginRight: 6 }} />
                Reject
              </button>
              <button
                className={\`au-ghost-btn \${selectedAction === 'DEPRECATED' ? 'active-deprecate' : ''}\`}
                onClick={() => setSelectedAction('DEPRECATED')}
                style={{ flex: 1, borderColor: selectedAction === 'DEPRECATED' ? 'var(--status-beta)' : undefined, color: selectedAction === 'DEPRECATED' ? 'var(--status-beta)' : undefined, background: selectedAction === 'DEPRECATED' ? 'rgba(245, 158, 11, 0.1)' : undefined }}
              >
                <Slash size={16} style={{ marginRight: 6 }} />
                Deprecate
              </button>
           </div>
        </div>

        <label className="au-field" style={{ marginTop: '20px' }}>
          <span className="au-field-label">
            Reason <span className="au-field-optional">(required for rejection)</span>
          </span>
          <textarea
            className="au-textarea"
            rows={3}
            value={reason}
            maxLength={500}
            disabled={isSaving}
            placeholder="Feedback for the API provider..."
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        {error && (
          <div className="au-inline-error">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <footer className="au-modal-foot">
          <button type="button" className="au-ghost-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="au-primary-btn"
            disabled={!canSubmit || (selectedAction === 'REJECTED' && !reason.trim())}
            onClick={() => {
              if (selectedAction) onConfirm(selectedAction, reason.trim());
            }}
          >
            {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
            Confirm
          </button>
        </footer>
      </div>
    </div>
  );
};
