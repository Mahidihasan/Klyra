import React from 'react';
import { Search, X, RefreshCw, Filter } from 'lucide-react';
import { ApiStatusValue } from '../../types/adminApis';

interface Props {
  search: string;
  status: ApiStatusValue | null;
  categoryId: string | null;
  total: number;
  isBusy: boolean;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: ApiStatusValue | null) => void;
  onOpenFilters: () => void;
  onRefresh: () => void;
}

export const ApisToolbar: React.FC<Props> = ({
  search,
  status,
  categoryId,
  total,
  isBusy,
  onSearchChange,
  onStatusChange,
  onOpenFilters,
  onRefresh,
}) => {
  const filterCount = (status ? 1 : 0) + (categoryId ? 1 : 0);

  return (
    <div className="au-toolbar">
      <div className="au-toolbar-row">
        <div className="au-search">
          <Search size={16} className="au-search-icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by API name or ID..."
            className="au-search-input"
            aria-label="Search APIs"
          />
          {search && (
            <button
              type="button"
              className="au-search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          className={filterCount > 0 ? 'au-filter-btn active' : 'au-filter-btn'}
          onClick={onOpenFilters}
          aria-expanded="false"
        >
          <Filter size={15} />
          <span>Filters</span>
          {filterCount > 0 && <span className="au-filter-count">{filterCount}</span>}
        </button>

        <button
          type="button"
          className="au-refresh-btn"
          onClick={onRefresh}
          disabled={isBusy}
          aria-label="Refresh list"
        >
          <RefreshCw size={15} className={isBusy ? 'au-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="au-toolbar-row au-toolbar-meta">
        <div className="au-chips">
          {status && (
            <div className="au-chip">
              <span className="au-chip-label">
                Status: <strong>{status}</strong>
              </span>
              <button
                type="button"
                onClick={() => onStatusChange(null)}
                aria-label={`Remove status filter ${status}`}
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>
        <div className="au-result-count" aria-live="polite">
          {total === 1 ? '1 API' : `${total.toLocaleString()} APIs`}
        </div>
      </div>
    </div>
  );
};
