/**
 * Formatting for the admin overview screens.
 *
 * Locale is pinned to en-US for the same reason as pages/Billing/format.ts:
 * leaving it to the browser made the same figure render differently per
 * teammate, which is a bad property for numbers people compare in a standup.
 */
import { MetricFormat, PlatformMetric } from '../../types/admin';

const LOCALE = 'en-US';

/** 12_400 -> "12.4K". Used where the exact digit doesn't matter. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(Math.round(value));
}

export function formatCurrency(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      // Whole dollars: MRR in the tens of thousands doesn't need cents, and
      // the extra digits crowd the card.
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

/** Render a metric according to the `format` the backend chose for it. */
export function formatMetricValue(metric: PlatformMetric): string {
  const byFormat: Record<MetricFormat, () => string> = {
    integer: () => formatInteger(metric.value),
    currency: () => formatCurrency(metric.value, metric.currency ?? 'USD'),
    compact: () => formatCompact(metric.value),
  };

  return (byFormat[metric.format] ?? byFormat.integer)();
}

/** "+4.2%" / "-1.8%" / "0%" — sign always shown so the badge reads at a glance. */
export function formatDelta(percent: number): string {
  if (percent === 0) return '0%';
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent}%`;
}

/**
 * Axis and tooltip labels for a bucket start.
 *
 * `bucketMinutes` decides the grain: hourly buckets want a clock time, daily
 * buckets want a date. Showing "14:00" on a 30-day chart implies a precision
 * the bucket doesn't have.
 */
export function formatBucketLabel(timestamp: string, bucketMinutes: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';

  if (bucketMinutes >= 1440) {
    return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  }

  if (bucketMinutes >= 360) {
    return date.toLocaleString(LOCALE, { weekday: 'short', hour: 'numeric', hour12: true });
  }

  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Full timestamp for tooltips, where the extra context is worth the width. */
export function formatBucketTooltip(timestamp: string, bucketMinutes: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';

  if (bucketMinutes >= 1440) {
    return date.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return date.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "4m ago", "2h ago" — alerts are only interesting relative to now. */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

/** Clock time for the "updated at" line in the header. */
export function formatClockTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}
