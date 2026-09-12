/**
 * Role and status filter drawer.
 *
 * A drawer rather than an always-visible filter bar because the table is the
 * point of this screen and eight filter pills across the top would push it
 * below the fold. Active filters stay summarised as removable chips in the
 * toolbar, so nothing is ever filtered invisibly.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import {
  ROLE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  SUBSCRIPTION_TIER_FILTER_OPTIONS,
  UserRoleValue,
  UserStatusFilter,
  UserSubscriptionTier,
} from '../../types/adminUsers';

interface Props {
  isOpen: boolean;
  role: UserRoleValue | null;
  status: UserStatusFilter | null;
  subscriptionTier: UserSubscriptionTier | null;
  onRoleChange: (role: UserRoleValue | null) => void;
  onStatusChange: (status: UserStatusFilter | null) => void;
  onSubscriptionTierChange: (tier: UserSubscriptionTier | null) => void;
  onClear: () => void;
  onClose: () => void;
}

export const FilterDrawer: React.FC<Props> = ({
  isOpen,
  role,
  status,
  subscriptionTier,
  onRoleChange,
  onStatusChange,
  onSubscriptionTierChange,
  onClear,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    // Move focus into the panel so keyboard users aren't left behind on the
    // trigger button while a modal surface is covering the page.
    panelRef.current?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasFilters = role !== null || status !== null || subscriptionTier !== null;

  return (
    <div className="au-drawer-overlay" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="au-drawer au-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Filter users"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="au-drawer-head">
          <h2>Filters</h2>
          <button
            type="button"
            className="au-icon-btn"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="au-drawer-body">
          <fieldset className="au-filter-group">
            <legend>Role</legend>
            <div className="au-filter-pills">
              <button
                type="button"
                className={role === null ? 'au-filter-pill active' : 'au-filter-pill'}
                onClick={() => onRoleChange(null)}
              >
                Any role
              </button>
              {ROLE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={role === option.id ? 'au-filter-pill active' : 'au-filter-pill'}
                  onClick={() => onRoleChange(role === option.id ? null : option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="au-filter-group">
            <legend>Status</legend>
            <div className="au-filter-pills">
              <button
                type="button"
                className={status === null ? 'au-filter-pill active' : 'au-filter-pill'}
                onClick={() => onStatusChange(null)}
              >
                Any status
              </button>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={status === option.id ? 'au-filter-pill active' : 'au-filter-pill'}
                  onClick={() => onStatusChange(status === option.id ? null : option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="au-filter-note">
              Pending verification isn&apos;t a stored status — it means the account never confirmed
              its email address, so it can be filtered but not set.
            </p>
          </fieldset>

          <fieldset className="au-filter-group">
            <legend>Subscription Plan</legend>
            <div className="au-filter-pills">
              <button
                type="button"
                className={subscriptionTier === null ? 'au-filter-pill active' : 'au-filter-pill'}
                onClick={() => onSubscriptionTierChange(null)}
              >
                Any plan
              </button>
              {SUBSCRIPTION_TIER_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={subscriptionTier === option.id ? 'au-filter-pill active' : 'au-filter-pill'}
                  onClick={() => onSubscriptionTierChange(subscriptionTier === option.id ? null : option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="au-drawer-foot">
          <button type="button" className="au-ghost-btn" onClick={onClear} disabled={!hasFilters}>
            Clear all
          </button>
          <button type="button" className="au-primary-btn" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};
