/**
 * Formatting helpers for the admin Users screen.
 *
 * Locale is pinned to en-US for the same reason as pages/AdminOverview/format.ts
 * and pages/Billing/format.ts: leaving it to the browser made the same date
 * render differently per teammate.
 */

import { AdminUserRow } from '../../types/adminUsers';

const LOCALE = 'en-US';

/** "12 Mar 2026" — joined dates are scanned in a column, so keep them short. */
export function formatJoinedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Full timestamp for the drawer, where the extra precision earns its width. */
export function formatFullTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "3d ago" / "Never" — relative time is what matters for a last-seen value. */
export function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Never';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Two-letter monogram for the avatar fallback.
 *
 * Falls back through name, then email, then a neutral dash — an empty circle
 * next to a row of filled ones reads as a rendering bug.
 */
export function initialsFor(user: Pick<AdminUserRow, 'name' | 'email'>): string {
  const source = user.name?.trim() || user.email?.trim() || '';
  if (!source) return '—';

  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Stable hue per user so the avatar colour doesn't change between renders or
 * between pages. Derived from the id rather than the row index for that reason.
 */
export function avatarHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return hash;
}

/** Audit action codes are SCREAMING_CASE on the wire; soften them for display. */
export function humaniseAuditAction(action: string): string {
  const word = action.replace(/_/g, ' ').toLowerCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}
