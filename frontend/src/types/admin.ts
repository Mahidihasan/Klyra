/**
 * Admin "Platform Overview" types.
 *
 * Mirrors backend/src/modules/admin/admin.types.ts — the two files are the
 * same wire contract from opposite ends. Change one, change the other.
 */

/** Where a payload came from, so the UI can be honest about what it shows. */
export type AdminDataSource = 'live' | 'mock';

// ============================================================================
// KPI metrics
// ============================================================================

export type MetricId = 'total-users' | 'active-apis' | 'mrr' | 'api-calls-24h';

/** How the client should render `value`. */
export type MetricFormat = 'integer' | 'currency' | 'compact';

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface MetricDelta {
  /** Signed percentage change, e.g. -4.2 for a 4.2% drop. */
  percent: number;
  direction: DeltaDirection;
  /** True when this movement is good news — drives the badge colour. */
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
  caption: string;
  delta: MetricDelta;
}

// ============================================================================
// Traffic & error-rate series
// ============================================================================

export type TrafficRange = '24h' | '7d' | '30d';

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
  /** (4xx + 5xx) / total as a percentage. */
  errorRatePercent: number;
}

export interface TrafficSeries {
  range: TrafficRange;
  /** Width of each bucket in minutes — drives axis labelling. */
  bucketMinutes: number;
  points: TrafficPoint[];
  totals: TrafficTotals;
}

/** The three stacked series the chart can show, in render order. */
export type TrafficSeriesKey = 'success' | 'clientError' | 'serverError';

// ============================================================================
// System health
// ============================================================================

export type ComponentId = 'database' | 'redis' | 'api-gateway';

export type ComponentStatus = 'operational' | 'degraded' | 'down';

export interface SystemComponentHealth {
  id: ComponentId;
  label: string;
  status: ComponentStatus;
  /** Rolling uptime percentage, e.g. 99.98. */
  uptimePercent: number;
  latencyMs: number | null;
  message: string;
  /** False when the numbers are simulated rather than measured. */
  probed: boolean;
  lastCheckedAt: string;
}

export interface SystemHealth {
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
  /** Set when `source` is 'mock' — why live data was unavailable. */
  degradedReason?: string;
  metrics: PlatformMetric[];
  traffic: TrafficSeries;
  health: SystemHealth;
  alerts: PlatformAlert[];
}

/** Ranges offered by the chart's range switcher. */
export const TRAFFIC_RANGE_OPTIONS: { id: TrafficRange; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];
