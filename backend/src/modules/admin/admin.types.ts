/**
 * Types for the Admin "Platform Overview" screen.
 *
 * These are the wire contract between `admin.routes.ts` and the frontend's
 * `frontend/src/types/admin.ts` — the two files are mirrors and must be kept
 * in sync. Enum-ish unions here intentionally match the Postgres enums in
 * infrastructure/database/schema.sql where they overlap.
 */

/** Where a payload came from, so the UI can be honest about what it shows. */
export type AdminDataSource = 'live' | 'mock';

// ============================================================================
// KPI metrics
// ============================================================================

export type MetricId = 'total-users' | 'active-apis' | 'mrr' | 'api-calls-24h';

/** How the client should render `value`. Keeps formatting out of the payload. */
export type MetricFormat = 'integer' | 'currency' | 'compact';

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface MetricDelta {
  /** Signed percentage change, e.g. -4.2 for a 4.2% drop. Rounded to 1dp. */
  percent: number;
  /**
   * Direction is computed server-side rather than derived from the sign of
   * `percent`, because "up" is not always "good" — the UI colours on
   * `isPositive`, not on direction.
   */
  direction: DeltaDirection;
  /** True when this movement is good news for the platform. */
  isPositive: boolean;
  /** Human label for the comparison window, e.g. "vs last week". */
  comparedTo: string;
}

export interface PlatformMetric {
  id: MetricId;
  label: string;
  value: number;
  format: MetricFormat;
  /** ISO-4217 code, present only when `format` is 'currency'. */
  currency?: string;
  /** Short supporting line under the value, e.g. "1,204 active this week". */
  caption: string;
  delta: MetricDelta;
}

// ============================================================================
// Traffic & error-rate series
// ============================================================================

export type TrafficRange = '24h' | '7d' | '30d';

/** One bucket of the traffic series, split by response class. */
export interface TrafficPoint {
  /** ISO-8601 timestamp for the START of the bucket. */
  timestamp: string;
  /** 2xx responses. */
  success: number;
  /** 4xx responses. */
  clientError: number;
  /** 5xx responses. */
  serverError: number;
}

export interface TrafficTotals {
  success: number;
  clientError: number;
  serverError: number;
  total: number;
  /** (4xx + 5xx) / total, as a percentage rounded to 2dp. 0 when total is 0. */
  errorRatePercent: number;
}

export interface TrafficSeries {
  range: TrafficRange;
  /** Width of each bucket in minutes — the client uses this to label the axis. */
  bucketMinutes: number;
  points: TrafficPoint[];
  totals: TrafficTotals;
}

// ============================================================================
// System health
// ============================================================================

export type ComponentId = 'database' | 'redis' | 'api-gateway';

export type ComponentStatus = 'operational' | 'degraded' | 'down';

export interface SystemComponentHealth {
  id: ComponentId;
  label: string;
  status: ComponentStatus;
  /** Rolling 30-day uptime as a percentage, e.g. 99.98. */
  uptimePercent: number;
  /** Measured round-trip for the probe, or null when it could not be measured. */
  latencyMs: number | null;
  /** Short human explanation, shown under the badge. */
  message: string;
  /**
   * False when this component has no real health check behind it and the
   * numbers are simulated. Klyra has no Redis client installed, so Redis is
   * reported unprobed rather than being quietly faked as green.
   */
  probed: boolean;
  lastCheckedAt: string;
}

export interface SystemHealth {
  /** Worst status across components — 'down' beats 'degraded' beats 'operational'. */
  overall: ComponentStatus;
  components: SystemComponentHealth[];
}

// ============================================================================
// Alerts
// ============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface PlatformAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  /** Emitting subsystem, e.g. "api-gateway" or "billing". */
  source: string;
  createdAt: string;
  acknowledged: boolean;
}

// ============================================================================
// Response envelope
// ============================================================================

export interface AdminOverviewStats {
  generatedAt: string;
  source: AdminDataSource;
  /**
   * Set when `source` is 'mock' — explains why live data was unavailable so
   * the UI can show a precise banner instead of a generic "demo data" note.
   */
  degradedReason?: string;
  metrics: PlatformMetric[];
  traffic: TrafficSeries;
  health: SystemHealth;
  alerts: PlatformAlert[];
}

/** Query parameters accepted by GET /api/v1/admin/overview/stats. */
export interface AdminOverviewQuery {
  range: TrafficRange;
}

export const TRAFFIC_RANGES: readonly TrafficRange[] = ['24h', '7d', '30d'] as const;

export function isTrafficRange(value: unknown): value is TrafficRange {
  return typeof value === 'string' && (TRAFFIC_RANGES as readonly string[]).includes(value);
}
