import React from 'react';
import { Check, Copy, KeyRound, AlertTriangle, X } from 'lucide-react';

interface RevealSecretModalProps {
  secret: { keyName: string; secret: string } | null;
  onClose: () => void;
}

/** Shown exactly once after creation — the secret is never retrievable again. */
export const RevealSecretModal: React.FC<RevealSecretModalProps> = ({ secret, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!secret) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(secret.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the value stays selectable in the box.
    }
  };

  return (
    <div className="apikeys-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="apikeys-modal" role="dialog" aria-modal="true" style={{ maxWidth: 540 }}>
        <div className="apikeys-modal-head">
          <div className="apikeys-modal-title">
            <KeyRound size={17} />
            API key created
          </div>
          <button type="button" className="apikeys-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="apikeys-modal-body">
          <div className="apikeys-secret-box">
            <div className="apikeys-secret-label">{secret.keyName}</div>
            <div className="apikeys-secret-value">
              <span>{secret.secret}</span>
              <button type="button" className="apikeys-secret-copy" onClick={() => { void handleCopy(); }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="apikeys-secret-warning">
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                This is the only time the full key is shown. Klyra stores a SHA-256 hash — copy it into a
                safe place now. Send it as <code>Authorization: Bearer</code> or the <code>x-api-key</code> header.
              </span>
            </div>
          </div>
        </div>
        <div className="apikeys-modal-foot">
          <button type="button" className="apikeys-btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
