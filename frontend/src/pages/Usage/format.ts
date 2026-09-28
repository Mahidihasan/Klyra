export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Renders an error rate that is ALREADY a percentage.
 *
 * The API returns errorRate as 0–100, not 0–1. This used to multiply by 100
 * again, so a 4.17% error rate was displayed as 417.0%.
 */
export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * A rate limit as the plan states it: "1,000 / hour".
 *
 * Deliberately not compared against request counts anywhere — a rate and a
 * period total are different units.
 */
export function formatRateLimit(
  limit: number | null,
  period: 'SECOND' | 'MINUTE' | 'HOUR' | 'DAY' | null,
): string {
  if (limit === null) return 'No limit';
  const unit = period ? period.toLowerCase() : 'period';
  return `${formatNumber(limit)} / ${unit}`;
}

export function methodColor(method: string): string {
  const m = method.toUpperCase();
  switch (m) {
    case 'GET': return '#10b981'; // emerald-500
    case 'POST': return '#3b82f6'; // blue-500
    case 'PUT': return '#f59e0b'; // amber-500
    case 'DELETE': return '#ef4444'; // red-500
    case 'PATCH': return '#8b5cf6'; // violet-500
    default: return '#6b7280'; // gray-500
  }
}

export function statusColor(code: number): string {
  if (code >= 200 && code < 300) return '#10b981'; // green
  if (code >= 300 && code < 400) return '#3b82f6'; // blue
  if (code >= 400 && code < 500) return '#f59e0b'; // amber
  if (code >= 500) return '#ef4444'; // red
  return '#6b7280'; // gray
}
