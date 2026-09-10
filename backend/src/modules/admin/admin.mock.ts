/**
 * Deterministic mock data for the admin overview.
 *
 * Used when Postgres isn't reachable (or the analytics tables are empty), so
 * the dashboard can be developed and demoed without a seeded database.
 *
 * The generator is seeded rather than random: a given bucket timestamp always
 * produces the same numbers. Without that, the 30s background refresh would
 * make the chart jitter on every poll and the KPI deltas dance, which reads as
 * a bug. Values still evolve over time because the seed is derived from the
 * bucket's epoch time.
 */

import {
  AdminOverviewStats,
  ComponentStatus,
  PlatformAlert,
  PlatformMetric,
  SystemHealth,
  TrafficPoint,
  TrafficRange,
  TrafficSeries,
} from './admin.types';

/** Bucket width and count per range. */
const RANGE_SHAPE: Record<TrafficRange, { bucketMinutes: number; buckets: number }> = {
  '24h': { bucketMinutes: 60, buckets: 24 },
  '7d': { bucketMinutes: 60 * 6, buckets: 28 },
  '30d': { bucketMinutes: 60 * 24, buckets: 30 },
};

/**
 * Small integer hash -> [0, 1). Deterministic for a given seed.
 * (xorshift-style mix; good enough for plausible-looking demo data.)
 */
export function seededUnit(seed: number): number {
  let x = Math.trunc(seed) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 100000) / 100000;
}

/**
 * Traffic has a daily rhythm — quiet overnight, peaking early afternoon UTC.
 * Returns a multiplier in roughly [0.35, 1.0].
 */
function diurnalFactor(date: Date): number {
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  // Cosine trough at 04:00 UTC, peak at 16:00 UTC.
  const phase = ((hour - 16 + 24) % 24) / 24;
  return 0.675 + 0.325 * Math.cos(phase * 2 * Math.PI);
}

export function buildMockTraffic(range: TrafficRange, now: Date = new Date()): TrafficSeries {
  const { bucketMinutes, buckets } = RANGE_SHAPE[range];
  const bucketMs = bucketMinutes * 60_000;

  // Align the newest bucket to its own boundary so labels land on round times.
  const newestStart = Math.floor(now.getTime() / bucketMs) * bucketMs;

  const points: TrafficPoint[] = [];

  for (let i = buckets - 1; i >= 0; i -= 1) {
    const startMs = newestStart - i * bucketMs;
    const start = new Date(startMs);

    // Seed from the bucket start so the same bucket is stable across polls.
    const seed = Math.floor(startMs / bucketMs);
    const noise = 0.85 + seededUnit(seed) * 0.3;

    // Scale the baseline with bucket width so wider buckets hold more calls.
    const baseline = 5200 * (bucketMinutes / 60);
    const total = Math.round(baseline * diurnalFactor(start) * noise);

    // Client errors sit ~3-6%; server errors are rarer at ~0.2-1.1%.
    const clientRate = 0.03 + seededUnit(seed * 7 + 11) * 0.03;
    const serverRate = 0.002 + seededUnit(seed * 13 + 29) * 0.009;

    const clientError = Math.round(total * clientRate);
    const serverError = Math.round(total * serverRate);

    points.push({
      timestamp: start.toISOString(),
      success: Math.max(total - clientError - serverError, 0),
      clientError,
      serverError,
    });
  }

  return { range, bucketMinutes, points, totals: summariseTraffic(points) };
}

/** Shared by the mock and live paths so totals are computed exactly once. */
export function summariseTraffic(points: TrafficPoint[]): TrafficSeries['totals'] {
  const success = points.reduce((sum, p) => sum + p.success, 0);
  const clientError = points.reduce((sum, p) => sum + p.clientError, 0);
  const serverError = points.reduce((sum, p) => sum + p.serverError, 0);
  const total = success + clientError + serverError;

  return {
    success,
    clientError,
    serverError,
    total,
    errorRatePercent:
      total === 0 ? 0 : Math.round(((clientError + serverError) / total) * 10000) / 100,
  };
}

export function buildMockMetrics(traffic: TrafficSeries): PlatformMetric[] {
  // Derive the 24h call count from the series when possible so the KPI card and
  // the chart never disagree on screen.
  const calls24h =
    traffic.range === '24h'
      ? traffic.totals.total
      : Math.round(traffic.totals.total / (traffic.points.length / 24 || 1));

  return [
    {
      id: 'total-users',
      label: 'Total Users',
      value: 48213,
      format: 'integer',
      caption: '1,204 active in the last 7 days',
      delta: { percent: 8.2, direction: 'up', isPositive: true, comparedTo: 'vs last week' },
    },
    {
      id: 'active-apis',
      label: 'Total Active APIs',
      value: 1342,
      format: 'integer',
      caption: 'Published and accepting traffic',
      delta: { percent: 3.1, direction: 'up', isPositive: true, comparedTo: 'vs last week' },
    },
    {
      id: 'mrr',
      label: 'Monthly Recurring Revenue',
      value: 184920,
      format: 'currency',
      currency: 'USD',
      caption: 'Normalised from active subscriptions',
      delta: { percent: 5.7, direction: 'up', isPositive: true, comparedTo: 'vs last week' },
    },
    {
      id: 'api-calls-24h',
      label: 'Total API Calls (24h)',
      value: calls24h,
      format: 'compact',
      caption: `${traffic.totals.errorRatePercent}% error rate`,
      // A drop in traffic is not good news, so isPositive tracks the direction.
      delta: { percent: -2.4, direction: 'down', isPositive: false, comparedTo: 'vs last week' },
    },
  ];
}

export function buildMockHealth(now: Date = new Date()): SystemHealth {
  const lastCheckedAt = now.toISOString();

  const components: SystemHealth['components'] = [
    {
      id: 'database',
      label: 'PostgreSQL',
      status: 'operational',
      uptimePercent: 99.98,
      latencyMs: 12,
      message: 'Primary healthy, replica lag under 1s',
      probed: false,
      lastCheckedAt,
    },
    {
      id: 'redis',
      label: 'Redis Cache',
      status: 'degraded',
      uptimePercent: 99.42,
      latencyMs: 87,
      message: 'Elevated latency on the eviction queue',
      probed: false,
      lastCheckedAt,
    },
    {
      id: 'api-gateway',
      label: 'API Gateway',
      status: 'operational',
      uptimePercent: 99.95,
      latencyMs: 34,
      message: 'All 6 edge regions responding',
      probed: false,
      lastCheckedAt,
    },
  ];

  return { overall: worstStatus(components.map((c) => c.status)), components };
}

/** 'down' beats 'degraded' beats 'operational'. */
export function worstStatus(statuses: ComponentStatus[]): ComponentStatus {
  if (statuses.includes('down')) return 'down';
  if (statuses.includes('degraded')) return 'degraded';
  return 'operational';
}

export function buildMockAlerts(now: Date = new Date()): PlatformAlert[] {
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  return [
    {
      id: 'alert-redis-latency',
      severity: 'warning',
      title: 'Redis latency above threshold',
      description: 'p99 cache latency held over 80ms for 12 minutes.',
      source: 'redis',
      createdAt: minutesAgo(14),
      acknowledged: false,
    },
    {
      id: 'alert-5xx-spike',
      severity: 'critical',
      title: '5xx spike on payments-api',
      description: '212 server errors in 5 minutes, mostly POST /v1/charges.',
      source: 'api-gateway',
      createdAt: minutesAgo(48),
      acknowledged: false,
    },
    {
      id: 'alert-key-rotation',
      severity: 'info',
      title: 'Scheduled key rotation completed',
      description: '38 gateway signing keys rotated without downtime.',
      source: 'platform',
      createdAt: minutesAgo(190),
      acknowledged: true,
    },
    {
      id: 'alert-quota',
      severity: 'warning',
      title: 'Three tenants near request quota',
      description: 'Acme, Northwind and Globex are each above 90% of plan quota.',
      source: 'billing',
      createdAt: minutesAgo(320),
      acknowledged: true,
    },
  ];
}

export function buildMockOverview(
  range: TrafficRange,
  degradedReason: string,
  now: Date = new Date(),
): AdminOverviewStats {
  const traffic = buildMockTraffic(range, now);

  return {
    generatedAt: now.toISOString(),
    source: 'mock',
    degradedReason,
    metrics: buildMockMetrics(traffic),
    traffic,
    health: buildMockHealth(now),
    alerts: buildMockAlerts(now),
  };
}
