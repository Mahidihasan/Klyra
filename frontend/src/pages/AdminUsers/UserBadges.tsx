/**
 * Small presentational pieces shared by the users table and its drawers.
 *
 * Kept separate so the table file stays about layout and the drawers can reuse
 * the exact same badge and avatar rendering — a role badge that looks different
 * in the drawer than in the row it opened from undermines trust in both.
 */

import React from 'react';

import {
  AdminUserRow,
  ROLE_LABELS,
  STATUS_LABELS,
  SUBSCRIPTION_TIER_LABELS,
  UserRoleValue,
  UserStatusValue,
  UserSubscriptionTier,
} from '../../types/adminUsers';

import { avatarHue, initialsFor } from './format';

export const UserAvatar: React.FC<{
  user: Pick<AdminUserRow, 'id' | 'name' | 'email' | 'avatarUrl'>;
  size?: number;
}> = ({ user, size = 32 }) => {
  const hue = avatarHue(user.id);

  if (user.avatarUrl) {
    return (
      <img
        className="au-avatar"
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className="au-avatar au-avatar-fallback"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        backgroundColor: `hsl(${hue} 58% 22%)`,
        color: `hsl(${hue} 80% 78%)`,
      }}
    >
      {initialsFor(user)}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: UserRoleValue }> = ({ role }) => (
  <span className="au-badge au-role-badge" data-role={role}>
    {ROLE_LABELS[role]}
  </span>
);

export const SubscriptionTierBadge: React.FC<{ tier: UserSubscriptionTier }> = ({ tier }) => (
  <span className="au-badge au-tier-badge" data-tier={tier}>
    {SUBSCRIPTION_TIER_LABELS[tier]}
  </span>
);

/**
 * Status badge.
 *
 * `isPendingVerification` is shown as a separate chip rather than replacing the
 * status, because the two are independent: an account can be ACTIVE *and*
 * unverified, and collapsing them would hide one of the two facts.
 */
export const StatusBadge: React.FC<{
  status: UserStatusValue;
  isPendingVerification?: boolean;
}> = ({ status, isPendingVerification }) => (
  <span className="au-status-cell">
    <span className="au-badge au-status-badge" data-status={status}>
      <span className="au-status-dot" />
      {STATUS_LABELS[status]}
    </span>
    {isPendingVerification && (
      <span className="au-badge au-pending-badge" title="This account has not verified its email">
        Unverified
      </span>
    )}
  </span>
);

/** Owned / subscribed counts, rendered so zero reads as "none" not "missing". */
export const CountPair: React.FC<{ owned: number; subscribed: number }> = ({
  owned,
  subscribed,
}) => (
  <span className="au-counts" title={`${owned} owned · ${subscribed} subscribed`}>
    <span className={owned > 0 ? 'au-count' : 'au-count au-count-zero'}>{owned}</span>
    <span className="au-count-sep">/</span>
    <span className={subscribed > 0 ? 'au-count' : 'au-count au-count-zero'}>{subscribed}</span>
  </span>
);
