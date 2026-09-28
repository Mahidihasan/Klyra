import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface UsageFiltersProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function UsageFilters<T extends string>({ options, value, onChange }: UsageFiltersProps<T>) {
  return (
    <div className="usage-filters">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`usage-filter-btn ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface UsageEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const UsageEmptyState: React.FC<UsageEmptyStateProps> = ({ icon, title, description }) => {
  return (
    <div className="usage-empty-state">
      <div className="usage-empty-icon">{icon}</div>
      <h3 className="usage-empty-title">{title}</h3>
      <p className="usage-empty-desc">{description}</p>
    </div>
  );
};

export const UsageTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="usage-table-container">
      <table className="usage-table">
        <thead>
          <tr>
            <th colSpan={6}><div className="usage-skeleton-text" style={{ width: '100px' }}></div></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><div className="usage-skeleton-text" style={{ width: '150px' }}></div></td>
              <td><div className="usage-skeleton-text" style={{ width: '80px' }}></div></td>
              <td><div className="usage-skeleton-text" style={{ width: '60px' }}></div></td>
              <td><div className="usage-skeleton-text" style={{ width: '100px' }}></div></td>
              <td><div className="usage-skeleton-text" style={{ width: '50px' }}></div></td>
              <td><div className="usage-skeleton-text" style={{ width: '120px' }}></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface UsagePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const UsagePagination: React.FC<UsagePaginationProps> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="usage-pagination">
      <button 
        className="usage-pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} />
        <span>Previous</span>
      </button>
      <span className="usage-pagination-text">
        Page {page} of {totalPages}
      </span>
      <button 
        className="usage-pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <span>Next</span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
