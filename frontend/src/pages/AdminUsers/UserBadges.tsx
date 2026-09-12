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
      className="bg-gradient-to-tr from-cyan-500 to-violet-600 text-white font-semibold flex items-center justify-center rounded-full"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initialsFor(user)}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: UserRoleValue }> = ({ role }) => {
  const isViolet = role === 'ADMIN';
  const isCyan = role === 'PROVIDER';
  return (
  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isViolet ? 'bg-violet-900/50 text-violet-400 border border-violet-700/50' : isCyan ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-700/50' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
    {ROLE_LABELS[role]}
  </span>
)};

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
}> = ({ status, isPendingVerification }) => {
  const isActive = status === 'ACTIVE';
  return (
  <div className="flex items-center gap-2">
    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isActive ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
      {isActive && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>}
      {STATUS_LABELS[status]}
    </span>
    {isPendingVerification && (
      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-900/50 text-amber-400 border border-amber-700/50" title="This account has not verified its email">
        Unverified
      </span>
    )}
  </div>
)};

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
