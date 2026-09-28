// Usage shapes, mirrored from backend/src/modules/usage/usage.types.ts — the
// two files are identical below this header and must stay that way, because
// the workspaces compile separately and nothing would catch a drift.

/** Mirrors the rate_limit_period enum in infrastructure/database/schema.sql. */
export type RateLimitPeriod = 'SECOND' | 'MINUTE' | 'HOUR' | 'DAY';

export interface UsageOverview {
  totalRequests: number;
  totalErrors: number;
  /**
   * A percentage in the range 0–100, already multiplied out. Not a fraction.
   * Formatters must not multiply it again — that bug showed 4.17% as 417%.
   */
  errorRate: number;
  avgLatencyMs: number;
  activeApis: number;
  periodLabel: string;
}

export interface DailyUsagePoint {
  /** 'YYYY-MM-DD', in UTC. */
  date: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
}

export interface ApiUsageRow {
  apiId: string;
  apiName: string;
  requests: number;
  errors: number;
  /** A percentage, 0–100. See UsageOverview.errorRate. */
  errorRate: number;
  avgLatencyMs: number;
  /**
   * Calls the active plan allows per `rateLimitPeriod`. Null when the user has
   * no active subscription to this API, or the plan sets no limit.
   *
   * This is a RATE, not an allowance for the billing period. It is deliberately
   * not comparable with `requestsThisPeriod` below: "1,000 per hour" and
   * "5,000 requests this month" are different units, and an earlier version
   * drew them as one progress bar.
   */
  rateLimit: number | null;
  rateLimitPeriod: RateLimitPeriod | null;
  /** Requests since the subscription's period_start. 0 without a subscription. */
  requestsThisPeriod: number;
}

export interface EndpointUsageRow {
  method: string;
  endpoint: string;
  apiName: string;
  hits: number;
  avgLatencyMs: number;
  errorCount: number;
}

export interface RequestLogEntry {
  id: string;
  apiName: string | null;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  isError: boolean;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RequestLogResult {
  entries: RequestLogEntry[];
  meta: PaginationMeta;
}

export type UsagePeriod = '7d' | '30d' | '90d';

/** Error codes the usage endpoints return in { success: false, error }. */
export type UsageErrorCode = 'UNAUTHORIZED' | 'INVALID_QUERY' | 'INTERNAL_ERROR';
