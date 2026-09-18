import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

export interface ConfirmAction {
  kind: 'revoke' | 'suspend' | 'activate' | 'delete';
  keyId: string;
  keyName: string;
}

interface ConfirmActionModalProps {
  action: ConfirmAction | null;
  busy: boolean;
  onConfirm: (action: ConfirmAction) => void;
  onClose: () => void;
}

const COPY: Record<ConfirmAction['kind'], { title: string; body: (name: string) => string; button: string; tone: 'danger' | 'warn' }> = {
  revoke: {
    title: 'Revoke this API key?',
    body: (name) => `Requests signed with "${name}" will be rejected immediately. Revocation is permanent — the key cannot be reactivated.`,
    button: 'Revoke key',
    tone: 'danger',
  },
  suspend: {
    title: 'Suspend this API key?',
    body: (name) => `"${name}" will stop working while suspended, but you can reactivate it at any time without changing its value.`,
    button: 'Suspend key',
    tone: 'warn',
  },
  activate: {
    title: 'Reactivate this API key?',
    body: (name) => `"${name}" will resume authenticating requests with its existing prefix and limits.`,
    button: 'Reactivate',
    tone: 'warn',
  },
  delete: {
    title: 'Delete this API key?',
    body: (name) => `The record for "${name}" will be permanently removed from your account. This cannot be undone.`,
    button: 'Delete forever',
    tone: 'danger',
  },
};

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({ action, busy, onConfirm, onClose }) => {
  if (!action) return null;
  const copy = COPY[action.kind];
  const Icon = action.kind === 'suspend' || action.kind === 'activate' ? ShieldAlert : AlertTriangle;

  return (
    <div className="apikeys-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="apikeys-modal" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
        <div className="apikeys-modal-head">
          <div className="apikeys-modal-title">
            <span className={`apikeys-confirm-icon ${copy.tone}`}>
              <Icon size={20} />
            </span>
            {copy.title}
          </div>
          <button type="button" className="apikeys-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="apikeys-modal-body">
          <p className="apikeys-confirm-text" style={{ marginTop: 0 }}>{copy.body(action.keyName)}</p>
        </div>
        <div className="apikeys-modal-foot">
          <button type="button" className="apikeys-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`apikeys-btn ${copy.tone === 'danger' ? 'danger' : 'primary'}`}
            onClick={() => onConfirm(action)}
            disabled={busy}
          >
            {copy.button}
          </button>
        </div>
      </div>
    </div>
  );
};
