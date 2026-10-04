import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface CancelSubscriptionModalProps {
  title: string;
  itemTitle: string;
  itemSubtitle?: string;
  warningText?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  title,
  itemTitle,
  itemSubtitle,
  warningText = 'Are you sure you want to cancel this subscription? You will lose access to dedicated rate limits and premium endpoints at the end of the billing period.',
  confirmLabel = 'Yes, Cancel Subscription',
  onClose,
  onConfirm,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onConfirm();
      setIsProcessing(false);
      onClose();
    }, 400);
  };

  return (
    <div className="subs-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="subs-modal-box compact" onClick={(e) => e.stopPropagation()}>
        <div className="subs-modal-head">
          <h2 style={{ color: '#f87171' }}>
            <AlertTriangle size={18} color="#ef4444" />
            <span>{title}</span>
          </h2>
          <button className="subs-modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="subs-modal-body">
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{itemTitle}</strong>
            {itemSubtitle && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{itemSubtitle}</span>
            )}
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {warningText}
          </p>
        </div>

        <div className="subs-modal-foot">
          <button type="button" className="btn-outline-subtle" onClick={onClose} disabled={isProcessing}>
            Keep Subscription
          </button>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: 'var(--radius-sm)',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: isProcessing ? 0.7 : 1
            }}
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Cancelling…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
