/**
 * Search, filter and summary bar above the users table.
 *
 * The search box is debounced here rather than in the page so the page only
 * ever sees committed search terms — it can treat every query change as worth
 * a network request without having to know which keystroke triggered it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';

import {
  ROLE_LABELS,
  STATUS_LABELS,
  SUBSCRIPTION_TIER_LABELS,
  UserRoleValue,
  UserStatusFilter,
  UserSubscriptionTier,
} from '../../types/adminUsers';

/**
 * 350ms: long enough that a normal typing burst produces one request, short
 * enough that the table doesn't feel detached from the keyboard.
 */
const DEBOUNCE_MS = 350;

interface Props {
  search: string;
  role: UserRoleValue | null;
  status: UserStatusFilter | null;
  subscriptionTier: UserSubscriptionTier | null;
  total: number;
  isBusy: boolean;
  onSearchChange: (search: string) => void;
  onRoleChange: (role: UserRoleValue | null) => void;
  onStatusChange: (status: UserStatusFilter | null) => void;
  onSubscriptionTierChange: (tier: UserSubscriptionTier | null) => void;
  onOpenFilters: () => void;
  onRefresh: () => void;
}

export const UsersToolbar: React.FC<Props> = ({
  search,
  role,
  status,
  subscriptionTier,
  total,
  isBusy,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onSubscriptionTierChange,
  onOpenFilters,
  onRefresh,
}) => {
  const [draft, setDraft] = useState(search);

  // The last value this component handed upward. Comparing against it is what
  // keeps the two effects below from bouncing edits back and forth.
  const emittedRef = useRef(search);

  const commit = useCallback(
    (next: string) => {
      emittedRef.current = next;
      onSearchChange(next);
    },
    [onSearchChange],
  );

  useEffect(() => {
    if (draft === emittedRef.current) return undefined;
    const timer = window.setTimeout(() => commit(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, commit]);

  // Adopt a reset that came from elsewhere — "Clear all" in the filter drawer,
  // or a chip being dismissed — without clobbering in-progress typing.
  useEffect(() => {
    if (search === emittedRef.current) return;
    emittedRef.current = search;
    setDraft(search);
  }, [search]);

  const activeFilterCount = (role !== null ? 1 : 0) + (status !== null ? 1 : 0) + (subscriptionTier !== null ? 1 : 0);

  return (
    <div className="au-toolbar">
      <div className="au-toolbar-row">
        <div className="au-search">
          <Search size={15} className="au-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="au-search-input"
            value={draft}
            placeholder="Search by name, email or user ID"
            aria-label="Search users"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter skips the debounce; someone who pressed it is done typing.
              if (event.key === 'Enter') commit(draft);
              if (event.key === 'Escape' && draft) {
                setDraft('');
                commit('');
              }
            }}
          />
          {draft && (
            <button
              type="button"
              className="au-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setDraft('');
                commit('');
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          className={activeFilterCount > 0 ? 'au-filter-btn active' : 'au-filter-btn'}
          onClick={onOpenFilters}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 && <span className="au-filter-count">{activeFilterCount}</span>}
        </button>

        <button type="button" className="au-refresh-btn" onClick={onRefresh} disabled={isBusy}>
          <RefreshCw size={14} className={isBusy ? 'au-spin' : undefined} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="au-toolbar-row au-toolbar-meta">
        <p className="au-result-count" aria-live="polite">
          {total === 1 ? '1 user' : `${total.toLocaleString('en-US')} users`}
          {activeFilterCount > 0 || search ? ' matching' : ' total'}
        </p>

        <div className="au-chips">
          {search && <FilterChip label={`Search: ${search}`} onRemove={() => commit('')} />}
          {role !== null && (
            <FilterChip label={`Role: ${ROLE_LABELS[role]}`} onRemove={() => onRoleChange(null)} />
          )}
          {status !== null && (
            <FilterChip
              label={`Status: ${STATUS_LABELS[status]}`}
              onRemove={() => onStatusChange(null)}
            />
          )}
          {subscriptionTier !== null && (
            <FilterChip
              label={`Plan: ${SUBSCRIPTION_TIER_LABELS[subscriptionTier]}`}
              onRemove={() => onSubscriptionTierChange(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="au-chip">
    <span className="au-chip-label">{label}</span>
    <button type="button" onClick={onRemove} aria-label={`Remove filter: ${label}`}>
      <X size={12} aria-hidden="true" />
    </button>
  </span>
);
