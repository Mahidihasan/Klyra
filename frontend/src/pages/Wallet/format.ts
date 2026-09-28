/**
 * Shared formatting for the wallet screens.
 *
 * Locale is pinned to en-US for the same reason pages/Billing/format.ts pins
 * it: left to the browser, USD rendered as "US$49.50" for some teammates and
 * "$49.50" for others, so the same figure looked different per machine.
 */

import { WalletTransactionDirection } from '../../types/wallet';

const LOCALE = 'en-US';

/** U+2212. A hyphen is narrower and breaks column alignment in a money table. */
const MINUS = '−';

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    // Unknown or malformed currency code — show the number with the code.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * A ledger amount with its sign: `+$50.00` for a credit, `−$12.00` for a debit.
 *
 * The sign carries the meaning on purpose. Colour reinforces it but must never
 * be the only cue — see WALLET_DESIGN.md section 7.
 */
export function signedAmount(
  amount: number,
  direction: WalletTransactionDirection,
  currency: string,
): string {
  const formatted = formatAmount(Math.abs(amount), currency);
  return direction === 'CREDIT' ? `+${formatted}` : `${MINUS}${formatted}`;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Day and month only, for the narrow date column on the Overview list. */
export function formatShortDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "updated 2 minutes ago" under the balance.
 *
 * Falls back to an absolute date past a week, where "9 days ago" stops being
 * more useful than the date itself.
 */
export function formatRelativeTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  return formatDate(value);
}

/** 'YYYY-MM' to the short month label under a chart bar. */
export function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split('-');
  const date = new Date(Date.UTC(Number(year), Number(monthPart) - 1, 1));
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(LOCALE, { month: 'short', timeZone: 'UTC' });
}

/**
 * "expires in 24 minutes", for a top-up still waiting to be paid.
 *
 * The mirror of formatRelativeTime, looking forward instead of back. Something
 * already past reads as expired rather than as a negative duration.
 */
export function formatTimeUntil(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return 'expired';
  if (seconds < 60) return 'expires in under a minute';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `expires in ${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.round(minutes / 60);
  return `expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}
