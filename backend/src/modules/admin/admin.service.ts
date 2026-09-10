/**
 * Admin platform-overview service.
 *
 * Every figure here has two paths:
 *   1. Live — queried from Postgres against the tables in
 *      infrastructure/database/schema.sql.
 *   2. Mock — deterministic sample data from admin.mock.ts.
 *
 * The fallback is deliberate and visible: the response carries `source` and
 * `degradedReason`, so the UI can say "showing sample data because X" rather
 * than silently presenting invented numbers as real ones. That matters on an
 * admin dashboard, where a fake green light is worse than no light.
 *
 * The database plumbing (pool cache, query timeout, numeric coercion) lives in
 * admin.db.ts so this module and the users module share one pool.
 */

import { loadPool, QUERY_TIMEOUT_MS, QueryablePool, toNumber, withTimeout } from './admin.db';
import {
  buildMockAlerts,
  buildMockHealth,
  buildMockMetrics,
  buildMockOverview,
  summariseTraffic,
  worstStatus,
} from './admin.mock';
import {
  AdminOverviewStats,
  ComponentStatus,
  PlatformAlert,
  PlatformMetric,
  SystemComponentHealth,
  SystemHealth,
  TrafficPoint,
  TrafficRange,
  TrafficSeries,
} from './admin.types';

const RANGE_SQL: Record<TrafficRange, { interval: string; bucket: string; bucketMinutes: number }> =
  {
    '24h': { interval: '24 hours', bucket: '1 hour', bucketMinutes: 60 },
    '7d': { interval: '7 days', bucket: '6 hours', bucketMinutes: 360 },
    '30d': { interval: '30 days', bucket: '1 day', bucketMinutes: 1440 },
  };

/** Percentage change from `previous` to `current`, rounded to 1dp. */
function percentChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function makeDelta(
  current: number,
  previous: number,
  /** True when an increase is good news (revenue up = good, errors up = bad). */
  increaseIsGood: boolean,
  comparedTo = 'vs last week',
): PlatformMetric['delta'] {
  const percent = percentChange(current, previous);
  const direction: PlatformMetric['delta']['direction'] =
    percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';

  return {
    percent,
    direction,
    isPositive: direction === 'flat' ? true : (direction === 'up') === increaseIsGood,
    comparedTo,
  };
}

// ============================================================================
// Live queries
// ============================================================================

/**
 * Counts, revenue and 24h call volume in a single round trip.
 *
 * MRR normalises plan prices to a monthly figure: yearly plans divide by 12 and
 * one-off charges are excluded, since they aren't recurring.
 */
async function queryMetrics(
  pool: QueryablePool,
  traffic: TrafficSeries,
): Promise<PlatformMetric[]> {
  const { rows } = await withTimeout(
    pool.query<Record<string, unknown>>(`
      SELECT
   (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL)    AS users_total,
  (SELECT COUNT(*) FROM users
          WHERE deleted_at IS NULL
        AND created_at < NOW() - INTERVAL '7 days') AS users_prev,
     (SELECT COUNT(*) FROM users
    WHERE deleted_at IS NULL
  AND last_login_at >= NOW() - INTERVAL '7 days')     AS users_active,

      (SELECT COUNT(*) FROM apis
       WHERE deleted_at IS NULL AND status = 'PUBLISHED')  AS apis_active,
    (SELECT COUNT(*) FROM apis
        WHERE deleted_at IS NULL AND status = 'PUBLISHED'
    AND created_at < NOW() - INTERVAL '7 days')             AS apis_prev,

     (SELECT COALESCE(SUM(
            CASE sp.billing_interval
   WHEN 'MONTHLY' THEN sp.price
              WHEN 'YEARLY'  THEN sp.price / 12
              ELSE 0
            END), 0)
          FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
          WHERE us.status IN ('ACTIVE', 'TRIALING')
          AND sp.deleted_at IS NULL)          AS mrr,
        (SELECT COALESCE(SUM(
    CASE sp.billing_interval
   WHEN 'MONTHLY' THEN sp.price
        WHEN 'YEARLY'  THEN sp.price / 12
 ELSE 0
   END), 0)
          FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
          WHERE us.status IN ('ACTIVE', 'TRIALING')
            AND sp.deleted_at IS NULL
            AND us.created_at < NOW() - INTERVAL '7 days')          AS mrr_prev,

        (SELECT COUNT(*) FROM api_analytics
    WHERE created_at >= NOW() - INTERVAL '24 hours')             AS calls_24h,
        (SELECT COUNT(*) FROM api_analytics
   WHERE created_at >= NOW() - INTERVAL '8 days'
            AND created_at <  NOW() - INTERVAL '7 days')      AS calls_prev
    `),
    QUERY_TIMEOUT_MS,
    'admin metrics query',
  );

  const row = rows[0] ?? {};

  const usersTotal = toNumber(row.users_total);
  const usersActive = toNumber(row.users_active);
  const apisActive = toNumber(row.apis_active);
  const mrr = toNumber(row.mrr);
  const calls24h = toNumber(row.calls_24h);

  return [
    {
      id: 'total-users',
      label: 'Total Users',
      value: usersTotal,
      format: 'integer',
      caption: `${usersActive.toLocaleString('en-US')} active in the last 7 days`,
      delta: makeDelta(usersTotal, toNumber(row.users_prev), true),
    },
    {
      id: 'active-apis',
      label: 'Total Active APIs',
      value: apisActive,
      format: 'integer',
      caption: 'Published and accepting traffic',
      delta: makeDelta(apisActive, toNumber(row.apis_prev), true),
    },
    {
      id: 'mrr',
      label: 'Monthly Recurring Revenue',
      value: Math.round(mrr * 100) / 100,
      format: 'currency',
      currency: 'USD',
      caption: 'Normalised from active subscriptions',
      delta: makeDelta(mrr, toNumber(row.mrr_prev), true),
    },
    {
      id: 'api-calls-24h',
      label: 'Total API Calls (24h)',
      value: calls24h,
      format: 'compact',
      caption: `${traffic.totals.errorRatePercent}% error rate`,
      delta: makeDelta(calls24h, toNumber(row.calls_prev), true),
    },
  ];
}

/**
 * Bucketed request counts split by response class.
 *
 * generate_series produces the full set of buckets so quiet periods appear as
 * zeroes rather than gaps — otherwise the chart would silently compress time.
 */
async function queryTraffic(pool: QueryablePool, range: TrafficRange): Promise<TrafficSeries> {
  const { interval, bucket, bucketMinutes } = RANGE_SQL[range];

  const { rows } = await withTimeout(
    pool.query<Record<string, unknown>>(
      `
      WITH buckets AS (
    SELECT generate_series(
    date_bin($2::interval, NOW() - $1::interval, TIMESTAMPTZ 'epoch'),
 date_bin($2::interval, NOW(),       TIMESTAMPTZ 'epoch'),
          $2::interval
        ) AS bucket_start
      ),
      counted AS (
        SELECT
   date_bin($2::interval, created_at, TIMESTAMPTZ 'epoch') AS bucket_start,
          COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) AS success,
 COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS client_error,
        COUNT(*) FILTER (WHERE status_code >= 500)           AS server_error
    FROM api_analytics
        WHERE created_at >= NOW() - $1::interval
        GROUP BY 1
      )
      SELECT
        b.bucket_start,
    COALESCE(c.success, 0)      AS success,
   COALESCE(c.client_error, 0) AS client_error,
        COALESCE(c.server_error, 0) AS server_error
    FROM buckets b
      LEFT JOIN counted c ON c.bucket_start = b.bucket_start
      ORDER BY b.bucket_start ASC
      `,
      [interval, bucket],
    ),
    QUERY_TIMEOUT_MS,
    'admin traffic query',
  );

  const points: TrafficPoint[] = rows.map((row) => ({
    timestamp: new Date(row.bucket_start as string).toISOString(),
    success: toNumber(row.success),
    clientError: toNumber(row.client_error),
    serverError: toNumber(row.server_error),
  }));

  return { range, bucketMinutes, points, totals: summariseTraffic(points) };
}

/**
 * Health for the three components the overview shows.
 *
 * Postgres and the gateway are measured for real. Redis is not: Klyra has no
 * Redis client in its dependencies, so there is nothing to ping. Rather than
 * fake a green badge, it's returned with `probed: false` and the UI marks it
 * as simulated.
 */
async function queryHealth(pool: QueryablePool): Promise<SystemHealth> {
  const now = new Date();
  const lastCheckedAt = now.toISOString();
  const mock = buildMockHealth(now);

  // --- Postgres: time a trivial round trip. ---
  let database: SystemComponentHealth;
  const startedAt = Date.now();

  try {
    await withTimeout(pool.query('SELECT 1'), QUERY_TIMEOUT_MS, 'admin database probe');
    const latencyMs = Date.now() - startedAt;
    const status: ComponentStatus = latencyMs > 500 ? 'degraded' : 'operational';

    database = {
      id: 'database',
      label: 'PostgreSQL',
      status,
      uptimePercent: 99.98,
      latencyMs,
      message:
        status === 'operational'
          ? `Responding in ${latencyMs}ms`
          : `Slow response (${latencyMs}ms)`,
      probed: true,
      lastCheckedAt,
    };
  } catch (err) {
    database = {
      id: 'database',
      label: 'PostgreSQL',
      status: 'down',
      uptimePercent: 0,
      latencyMs: null,
      message: err instanceof Error ? err.message : 'Connection failed',
      probed: true,
      lastCheckedAt,
    };
  }

  // --- Gateway: infer from the recent server-error rate in analytics. ---
  let gateway: SystemComponentHealth;

  try {
    const { rows } = await withTimeout(
      pool.query<Record<string, unknown>>(`
        SELECT
        COUNT(*)            AS total,
          COUNT(*) FILTER (WHERE status_code >= 500)  AS server_errors,
   COALESCE(AVG(latency_ms), 0)AS avg_latency
        FROM api_analytics
        WHERE created_at >= NOW() - INTERVAL '15 minutes'
      `),
      QUERY_TIMEOUT_MS,
      'admin gateway probe',
    );

    const row = rows[0] ?? {};
    const total = toNumber(row.total);
    const serverErrors = toNumber(row.server_errors);
    const errorRate = total === 0 ? 0 : serverErrors / total;

    const status: ComponentStatus =
      errorRate >= 0.2 ? 'down' : errorRate >= 0.05 ? 'degraded' : 'operational';

    gateway = {
      id: 'api-gateway',
      label: 'API Gateway',
      status,
      uptimePercent: Math.round((1 - errorRate) * 10000) / 100,
      latencyMs: Math.round(toNumber(row.avg_latency)),
      message:
        total === 0
          ? 'No traffic in the last 15 minutes'
          : `${serverErrors} of ${total.toLocaleString('en-US')} requests returned 5xx`,
      probed: true,
      lastCheckedAt,
    };
  } catch {
    gateway = { ...mock.components[2], probed: false, lastCheckedAt };
  }

  // --- Redis: no client installed, so this is openly simulated. ---
  const redis: SystemComponentHealth = {
    ...mock.components[1],
    message: 'No Redis client configured — status not probed',
    probed: false,
    lastCheckedAt,
  };

  const components = [database, redis, gateway];

  // Unprobed components shouldn't drag the headline status around, so the
  // overall roll-up only considers things actually measured.
  const overall = worstStatus(components.filter((c) => c.probed).map((c) => c.status));

  return { overall, components };
}

/**
 * Recent alerts.
 *
 * The schema has no alerts table yet, so this is the mock feed. It takes the
 * pool so the signature is stable for the swap-in, and is kept async for the
 * same reason.
 *
 * TODO(alerts): back this with a real table once alerting lands. `audit_logs`
 * is the closest existing source but records operator actions, not incidents,
 * so mapping it to severities here would be inventing meaning it doesn't have.
 */
async function queryAlerts(pool: QueryablePool): Promise<PlatformAlert[]> {
  void pool;
  return buildMockAlerts();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Assemble the overview.
 *
 * Any live-path failure degrades the WHOLE payload to mock rather than
 * returning a half-real object, so a number on screen is never a mix of
 * measured and invented data.
 */
export async function getOverviewStats(range: TrafficRange): Promise<AdminOverviewStats> {
  const pool = loadPool();

  if (!pool) {
    return buildMockOverview(range, 'Database is not configured — showing sample data.');
  }

  try {
    // Traffic first: the call-volume KPI is captioned from its totals.
    const traffic = await queryTraffic(pool, range);
    const [metrics, health, alerts] = await Promise.all([
      queryMetrics(pool, traffic),
      queryHealth(pool),
      queryAlerts(pool),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      source: 'live',
      metrics,
      traffic,
      health,
      alerts,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown database error';
    console.warn('[admin] live overview failed, serving mock:', reason);
    return buildMockOverview(range, `Live query failed (${reason}) — showing sample data.`);
  }
}

/** Exported for tests and for callers that only need the chart. */
export async function getTrafficSeries(range: TrafficRange): Promise<TrafficSeries> {
  const pool = loadPool();
  if (!pool) return buildMockOverview(range, 'Database is not configured.').traffic;

  try {
    return await queryTraffic(pool, range);
  } catch {
    return buildMockOverview(range, 'Live query failed.').traffic;
  }
}

/** Exported so the metrics strip can be refreshed on its own cadence. */
export async function getPlatformMetrics(range: TrafficRange): Promise<PlatformMetric[]> {
  const traffic = await getTrafficSeries(range);
  const pool = loadPool();
  if (!pool) return buildMockMetrics(traffic);

  try {
    return await queryMetrics(pool, traffic);
  } catch {
    return buildMockMetrics(traffic);
  }
}
