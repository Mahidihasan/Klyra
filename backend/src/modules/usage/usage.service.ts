// Usage analytics — read-only queries over api_analytics.
//
// Every query is scoped by the user id the route took from the JWT. There is
// no ownership parameter anywhere: a caller cannot ask for someone else's
// traffic, because there is nowhere to say whose traffic they want.

import { pool as db } from '../../services/database.service';
import {
  UsageOverview,
  DailyUsagePoint,
  ApiUsageRow,
  EndpointUsageRow,
  RequestLogResult,
  UsagePeriod,
} from './usage.types';

/** Days per period, used both for the SQL interval and for filling the chart. */
const PERIOD_DAYS: Record<UsagePeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const PERIOD_LABEL: Record<UsagePeriod, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
};

/** Upper bound on a page of the request log, so `?limit=500000` cannot run. */
export const MAX_HISTORY_LIMIT = 100;

class UsageService {
  private days(period: UsagePeriod): number {
    return PERIOD_DAYS[period] ?? PERIOD_DAYS['30d'];
  }

  private label(period: UsagePeriod): string {
    return PERIOD_LABEL[period] ?? PERIOD_LABEL['30d'];
  }

  /**
   * The one window definition every endpoint uses.
   *
   * Whole UTC days: the last N days including today, from midnight to the
   * midnight after today. Both ends are explicit and both are shared.
   *
   * It used to be `created_at >= NOW() - N days` — a rolling N x 24 hours with
   * no upper bound — while the daily chart filled whole calendar days. The two
   * disagreed at both edges: the rolling window included a partial day at the
   * far end and anything dated in the future, neither of which the chart could
   * show. The totals differed by seven requests on a 462-request account, which
   * is exactly the kind of number nobody notices and nobody can explain later.
   */
  private window(period: UsagePeriod): { start: Date; startIso: string; endIso: string; days: number } {
    const days = this.days(period);
    const now = new Date();

    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
    );
    // Exclusive: midnight after today, so "today" is whole and tomorrow is out.
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );

    return { start, startIso: start.toISOString(), endIso: end.toISOString(), days };
  }

  async getOverview(userId: string, period: UsagePeriod): Promise<UsageOverview> {
    const { startIso, endIso } = this.window(period);

    const result = await db.query(
      `SELECT
         COUNT(*)                                        AS total_requests,
         COALESCE(SUM(CASE WHEN is_error THEN 1 ELSE 0 END), 0) AS total_errors,
         AVG(latency_ms)                                 AS avg_latency_ms,
         COUNT(DISTINCT api_id)                          AS active_apis
       FROM api_analytics
       WHERE user_id = $1
         AND created_at >= $2::timestamptz
         AND created_at <  $3::timestamptz`,
      [userId, startIso, endIso],
    );

    const row = result.rows[0];
    const totalRequests = parseInt(row?.total_requests ?? '0', 10);
    const totalErrors = parseInt(row?.total_errors ?? '0', 10);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      totalRequests,
      totalErrors,
      // A percentage, 0–100. The frontend formatter must not multiply again.
      errorRate: Number(errorRate.toFixed(2)),
      avgLatencyMs: Math.round(parseFloat(row?.avg_latency_ms ?? '0')),
      activeApis: parseInt(row?.active_apis ?? '0', 10),
      periodLabel: this.label(period),
    };
  }

  /**
   * One point per day for the whole period, including days with no traffic.
   *
   * Postgres only returns days that have rows, so a 30-day chart with twelve
   * busy days would otherwise draw twelve evenly spaced bars and read as though
   * every day had activity. Days are UTC, matching how they are stored.
   */
  async getDailyUsage(userId: string, period: UsagePeriod): Promise<DailyUsagePoint[]> {
    const { start, startIso, endIso, days } = this.window(period);

    const result = await db.query(
      `SELECT
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
         COUNT(*) AS requests,
         COALESCE(SUM(CASE WHEN is_error THEN 1 ELSE 0 END), 0) AS errors,
         AVG(latency_ms) AS avg_latency_ms
       FROM api_analytics
       WHERE user_id = $1
         AND created_at >= $2::timestamptz
         AND created_at <  $3::timestamptz
       GROUP BY 1
       ORDER BY 1 ASC`,
      [userId, startIso, endIso],
    );

    const byDate = new Map<string, DailyUsagePoint>();
    for (const row of result.rows) {
      byDate.set(row.date, {
        date: row.date,
        requests: parseInt(row.requests, 10) || 0,
        errors: parseInt(row.errors, 10) || 0,
        avgLatencyMs: Math.round(parseFloat(row.avg_latency_ms ?? '0')),
      });
    }

    // Walks the same window the query used, so the points always sum to the
    // figure the other endpoints report.
    const points: DailyUsagePoint[] = [];
    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + offset),
      );
      const key = day.toISOString().slice(0, 10);
      points.push(byDate.get(key) ?? { date: key, requests: 0, errors: 0, avgLatencyMs: 0 });
    }

    return points;
  }

  /**
   * Per-API totals, with the active plan's rate limit alongside them.
   *
   * user_subscriptions is UNIQUE (user_id, api_id), so the LEFT JOIN cannot
   * duplicate analytics rows and inflate the counts.
   */
  async getByApi(userId: string, period: UsagePeriod): Promise<ApiUsageRow[]> {
    const { startIso, endIso } = this.window(period);

    const result = await db.query(
      `SELECT
         a.id   AS api_id,
         a.name AS api_name,
         COUNT(aa.id) AS requests,
         COALESCE(SUM(CASE WHEN aa.is_error THEN 1 ELSE 0 END), 0) AS errors,
         AVG(aa.latency_ms) AS avg_latency_ms,
         sp.rate_limit        AS rate_limit,
         sp.rate_limit_period AS rate_limit_period,
         COALESCE(SUM(
           CASE WHEN us.period_start IS NOT NULL
                 AND aa.created_at >= us.period_start
                 AND (us.period_end IS NULL OR aa.created_at <= us.period_end)
                THEN 1 ELSE 0 END
         ), 0) AS requests_this_period
       FROM api_analytics aa
       JOIN apis a ON aa.api_id = a.id
       LEFT JOIN user_subscriptions us
              ON us.user_id = aa.user_id AND us.api_id = a.id AND us.status = 'ACTIVE'
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE aa.user_id = $1
         AND aa.created_at >= $2::timestamptz
         AND aa.created_at <  $3::timestamptz
       GROUP BY a.id, a.name, sp.rate_limit, sp.rate_limit_period
       ORDER BY requests DESC`,
      [userId, startIso, endIso],
    );

    return result.rows.map((row) => {
      const requests = parseInt(row.requests, 10) || 0;
      const errors = parseInt(row.errors, 10) || 0;

      return {
        apiId: row.api_id,
        apiName: row.api_name,
        requests,
        errors,
        errorRate: Number((requests > 0 ? (errors / requests) * 100 : 0).toFixed(2)),
        avgLatencyMs: Math.round(parseFloat(row.avg_latency_ms ?? '0')),
        rateLimit: row.rate_limit === null ? null : parseInt(row.rate_limit, 10),
        rateLimitPeriod: row.rate_limit_period ?? null,
        requestsThisPeriod: parseInt(row.requests_this_period, 10) || 0,
      };
    });
  }

  async getTopEndpoints(userId: string, period: UsagePeriod): Promise<EndpointUsageRow[]> {
    const { startIso, endIso } = this.window(period);

    const result = await db.query(
      `SELECT
         aa.request_method AS method,
         aa.endpoint,
         a.name AS api_name,
         COUNT(*) AS hits,
         AVG(aa.latency_ms) AS avg_latency_ms,
         COALESCE(SUM(CASE WHEN aa.is_error THEN 1 ELSE 0 END), 0) AS error_count
       FROM api_analytics aa
       JOIN apis a ON aa.api_id = a.id
       WHERE aa.user_id = $1
         AND aa.created_at >= $2::timestamptz
         AND aa.created_at <  $3::timestamptz
       GROUP BY aa.request_method, aa.endpoint, a.name
       ORDER BY hits DESC
       LIMIT 20`,
      [userId, startIso, endIso],
    );

    return result.rows.map((row) => ({
      method: row.method,
      endpoint: row.endpoint,
      apiName: row.api_name,
      hits: parseInt(row.hits, 10) || 0,
      avgLatencyMs: Math.round(parseFloat(row.avg_latency_ms ?? '0')),
      errorCount: parseInt(row.error_count, 10) || 0,
    }));
  }

  /**
   * A page of the raw request log, scoped to the same period as every other
   * endpoint. It used to ignore the period and always read all of history,
   * which made the page's period selector look broken on this tab.
   */
  async getRequestLog(
    userId: string,
    period: UsagePeriod,
    page: number,
    limit: number,
  ): Promise<RequestLogResult> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), MAX_HISTORY_LIMIT);
    const safePage = Math.max(Math.trunc(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    const { startIso, endIso } = this.window(period);

    const countResult = await db.query(
      `SELECT COUNT(*) AS total
         FROM api_analytics
        WHERE user_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <  $3::timestamptz`,
      [userId, startIso, endIso],
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const result = await db.query(
      `SELECT
         aa.id,
         a.name AS api_name,
         aa.request_method AS method,
         aa.endpoint,
         aa.status_code,
         aa.latency_ms,
         aa.is_error,
         aa.created_at
       FROM api_analytics aa
       LEFT JOIN apis a ON aa.api_id = a.id
       WHERE aa.user_id = $1
         AND aa.created_at >= $2::timestamptz
         AND aa.created_at <  $3::timestamptz
       ORDER BY aa.created_at DESC, aa.id DESC
       LIMIT $4 OFFSET $5`,
      [userId, startIso, endIso, safeLimit, offset],
    );

    return {
      entries: result.rows.map((row) => ({
        id: row.id,
        apiName: row.api_name,
        method: row.method,
        endpoint: row.endpoint,
        statusCode: row.status_code,
        latencyMs: row.latency_ms,
        isError: row.is_error,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString(),
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }
}

export const usageService = new UsageService();
