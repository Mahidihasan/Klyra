import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationMeta } from '../../types/billing';

interface BillingFiltersProps<T extends string> {
  filters: { id: T; label: string }[];
  active: T;
  onChange: (next: T) => void;
}

export function BillingFilters<T extends string>({
  filters,
  active,
  onChange,
}: BillingFiltersProps<T>) {
  return (
    <div className="billing-filters">
      {filters.map((item) => (
        <button
          key={item.id}
          className={`billing-filter ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface BillingStateProps {
  title: string;
  body: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const BillingState: React.FC<BillingStateProps> = ({
  title,
  body,
  icon,
  actionLabel,
  onAction,
}) => (
  <div className="billing-state">
    {icon}
    <h3>{title}</h3>
    <p>{body}</p>
    {actionLabel && onAction && (
      <button className="billing-retry-btn" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="billing-skeleton">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="skeleton-row" />
    ))}
  </div>
);

interface BillingPaginationProps {
  meta: PaginationMeta | null;
  isLoading: boolean;
  noun: string;
  onPageChange: (updater: (prev: number) => number) => void;
}

export const BillingPagination: React.FC<BillingPaginationProps> = ({
  meta,
  isLoading,
  noun,
  onPageChange,
}) => {
  if (!meta || meta.totalPages <= 1) return null;

  return (
    <div className="billing-pagination">
      <span className="pagination-info">
        Page {meta.page} of {meta.totalPages} · {meta.total} {noun}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          disabled={meta.page <= 1 || isLoading}
          onClick={() => onPageChange((prev) => Math.max(1, prev - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="pagination-btn"
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
