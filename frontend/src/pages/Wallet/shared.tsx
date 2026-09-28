/**
 * Small pieces shared by the wallet tabs, mirroring pages/Billing/shared.tsx.
 *
 * All styling comes from the single <style> block in index.tsx, so nothing
 * here carries its own CSS.
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  PaginationMeta,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../types/wallet';

interface WalletFiltersProps<T extends string> {
  filters: { id: T; label: string }[];
  active: T;
  onChange: (next: T) => void;
}

export function WalletFilters<T extends string>({
  filters,
  active,
  onChange,
}: WalletFiltersProps<T>) {
  return (
    <div className="wallet-filters">
      {filters.map((item) => (
        <button
          key={item.id}
          className={`wallet-filter ${active === item.id ? 'active' : ''}`}
          aria-pressed={active === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface WalletStateProps {
  title: string;
  body: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const WalletState: React.FC<WalletStateProps> = ({
  title,
  body,
  icon,
  actionLabel,
  onAction,
}) => (
  <div className="wallet-state">
    {icon}
    <h3>{title}</h3>
    <p>{body}</p>
    {actionLabel && onAction && (
      <button className="wallet-retry-btn" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="wallet-skeleton" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="wallet-skeleton-row" />
    ))}
  </div>
);

interface WalletPaginationProps {
  meta: PaginationMeta | null;
  isLoading: boolean;
  noun: string;
  onPageChange: (updater: (prev: number) => number) => void;
}

export const WalletPagination: React.FC<WalletPaginationProps> = ({
  meta,
  isLoading,
  noun,
  onPageChange,
}) => {
  if (!meta || meta.totalPages <= 1) return null;

  return (
    <div className="wallet-pagination">
      <span className="wallet-pagination-info">
        Page {meta.page} of {meta.totalPages} · {meta.total} {noun}
      </span>
      <div className="wallet-pagination-controls">
        <button
          className="wallet-pagination-btn"
          disabled={meta.page <= 1 || isLoading}
          onClick={() => onPageChange((prev) => Math.max(1, prev - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="wallet-pagination-btn"
          disabled={meta.page >= meta.totalPages || isLoading}
          onClick={() => onPageChange((prev) => prev + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/**
 * Type pill, in the same visual language as components/billing/StatusBadge.
 *
 * Status wins over type: a PENDING or FAILED row is worth flagging whatever
 * kind of movement it was.
 */
const TYPE_TONE: Record<WalletTransactionType, { label: string; color: string }> = {
  TOPUP: { label: 'Top-up', color: 'var(--status-active)' },
  BONUS: { label: 'Bonus', color: 'var(--status-active)' },
  SPEND: { label: 'Spend', color: 'var(--text-secondary)' },
  REFUND: { label: 'Refund', color: 'var(--text-accent)' },
  ADJUSTMENT: { label: 'Adjustment', color: 'var(--text-muted)' },
};

interface TransactionBadgeProps {
  type: WalletTransactionType;
  status: WalletTransactionStatus;
}

export const TransactionBadge: React.FC<TransactionBadgeProps> = ({ type, status }) => {
  const tone = TYPE_TONE[type] ?? { label: type, color: 'var(--text-muted)' };

  const color =
    status === 'PENDING'
      ? 'var(--status-beta)'
      : status === 'FAILED'
        ? 'var(--status-maintenance)'
        : tone.color;

  const label =
    status === 'PENDING'
      ? `${tone.label} · pending`
      : status === 'FAILED'
        ? `${tone.label} · failed`
        : tone.label;

  return (
    <span className="wallet-badge" style={{ color }}>
      <span className="wallet-badge-dot" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
};
