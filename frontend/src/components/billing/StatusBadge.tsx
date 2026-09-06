import React from 'react';

import { InvoiceStatus, PaymentStatus } from '../../types/billing';

type AnyStatus = InvoiceStatus | PaymentStatus;

interface StatusBadgeProps {
  status: AnyStatus;
}

const TONE: Record<AnyStatus, { label: string; color: string }> = {
  // Invoice statuses
  PAID: { label: 'Paid', color: 'var(--status-active)' },
  SENT: { label: 'Due', color: 'var(--status-beta)' },
  PARTIALLY_PAID: { label: 'Partially paid', color: 'var(--status-beta)' },
  OVERDUE: { label: 'Overdue', color: 'var(--status-maintenance)' },
  DRAFT: { label: 'Draft', color: 'var(--text-muted)' },
  VOID: { label: 'Void', color: 'var(--text-muted)' },
  // Payment statuses
  SUCCEEDED: { label: 'Succeeded', color: 'var(--status-active)' },
  PENDING: { label: 'Pending', color: 'var(--status-beta)' },
  FAILED: { label: 'Failed', color: 'var(--status-maintenance)' },
  REFUNDED: { label: 'Refunded', color: 'var(--text-accent)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--text-muted)' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const tone = TONE[status] ?? { label: status, color: 'var(--text-muted)' };

  return (
    <span className="status-badge" style={{ color: tone.color }}>
      <span className="status-badge-dot" style={{ backgroundColor: tone.color }} />
      {tone.label}

      <style>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px;
          border-radius: 999px;
          background-color: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .status-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
      `}</style>
    </span>
  );
};
