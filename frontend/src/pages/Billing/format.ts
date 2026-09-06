/**
 * Shared formatting for the billing screens.
 *
 * Locale is pinned to en-US on purpose: leaving it to the browser meant USD
 * rendered as "US$49.50" on non-US locales and "$49.50" on US ones, so the
 * same invoice looked different per teammate.
 */
const LOCALE = 'en-US';

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
 * Reads brand/last4 out of payment_method_details without assuming the JSONB
 * blob is populated — Stripe isn't wired up yet, so it's often null.
 */
export function describeCard(
  details: Record<string, unknown> | null,
  method: string | null,
): string {
  if (details) {
    const brand = typeof details.brand === 'string' ? details.brand : null;
    const last4 = typeof details.last4 === 'string' ? details.last4 : null;
    if (brand && last4) return `${brand} ···· ${last4}`;
    if (last4) return `Card ···· ${last4}`;
  }
  return method || 'Unknown method';
}
