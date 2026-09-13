import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

import { adminApi, AdminApiError } from '../../services/api/admin';
import { AdminOverviewStats, TrafficRange } from '../../types/admin';

import { AlertsFeed } from './AlertsFeed';
import { KpiCard, KpiCardSkeleton } from './KpiCard';
import { SystemHealthWidget } from './SystemHealthWidget';
import { TrafficChart } from './TrafficChart';
import { formatClockTime } from './format';

/**
 * Admin → Platform Overview.
 *
 * One request feeds the whole screen (GET /api/v1/admin/overview/stats), so the
 * KPI strip, chart, health widget and alert feed always describe the same
 * moment. Splitting them into separate polls would let the cards disagree with
 * the chart, which reads as a bug even when every number is correct.
 */

/** Background refresh cadence, matching BILLING_LIVE_FALLBACK_MS. */
const REFRESH_INTERVAL_MS = 60_000;

type LoadReason = 'initial' | 'range' | 'refresh';

export const AdminOverviewPage: React.FC = () => {
  const [range, setRange] = useState<TrafficRange>('24h');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [error, setError] = useState<AdminApiError | Error | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Tracks the in-flight request so a superseded one can be aborted — clicking
  // through the range pills quickly would otherwise let a slow early response
  // land last and overwrite the newest data.
  const requestRef = useRef<AbortController | null>(null);

  // Read through a ref rather than the closure: `load` is captured by the
  // polling interval, and a `stats` dependency there would either rebuild the
  // timer on every fetch or leave it holding a stale value.
  const statsRef = useRef<AdminOverviewStats | null>(null);
  statsRef.current = stats;

  const load = useCallback(async (nextRange: TrafficRange, reason: LoadReason) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setIsBusy(true);
    if (reason !== 'refresh') setError(null);

    try {
      const data = await adminApi.getOverviewStats(nextRange, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setStats(data);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted || (err as Error).name === 'AbortError') return;

      // A failed background refresh shouldn't wipe a good screen; keep what's
      // on display and let the timestamp go stale instead.
      if (reason === 'refresh' && statsRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load platform overview'));
    } finally {
      if (!controller.signal.aborted) setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(range, statsRef.current === null ? 'initial' : 'range');
  }, [range, load]);

  useEffect(() => () => requestRef.current?.abort(), []);

  // Poll in the background, but only while the tab is actually being looked at.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void load(range, 'refresh');
    };

    const timer = window.setInterval(tick, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [range, load]);

  const header = (
    <div className="ao-header">
      <div>
        <h1 className="ao-title">Platform overview</h1>
        <p className="ao-subtitle">
          Users, revenue, traffic and service health across the whole marketplace.
        </p>
      </div>

      <div className="ao-header-actions">
        {stats && (
          <span className="ao-source" data-source={stats.source}>
            <span className="ao-source-dot" />
            {stats.source === 'live' ? 'Live data' : 'Sample data'}
          </span>
        )}
        <button
          type="button"
          className="ao-refresh"
          onClick={() => void load(range, 'refresh')}
          disabled={isBusy}
        >
          <RefreshCw size={14} className={isBusy ? 'ao-spin' : ''} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );

  // ---- Error states -------------------------------------------------------
  if (error && !stats) {
    const adminError = error instanceof AdminApiError ? error : null;

    if (adminError?.isForbidden || adminError?.isUnauthorized) {
      return (
        <div className="ao-page">
          {header}
          <div className="ao-notice card-base">
            <ShieldAlert size={20} aria-hidden="true" />
            <h3>
              {adminError.isForbidden ? 'Your account is not an admin' : 'Sign in to continue'}
            </h3>
            <p>
              {adminError.isForbidden
                ? 'This screen is limited to accounts with the ADMIN or MODERATOR role. Ask an ' +
                  'existing admin to update your role.'
                : 'Platform data is only served to a signed-in admin. Sign in with an admin ' +
                  'account and reopen this screen.'}
            </p>
            <code>localStorage.setItem(&apos;klyra-dev-role&apos;, &apos;ADMIN&apos;)</code>
            <p className="ao-notice-hint">
              In local development you can set the line above and reload to preview the screen.
            </p>
          </div>
          <AdminOverviewStyles />
        </div>
      );
    }

    return (
      <div className="ao-page">
        {header}
        <div className="ao-notice card-base">
          <AlertTriangle size={20} aria-hidden="true" />
          <h3>Couldn&apos;t load the overview</h3>
          <p>{error.message}</p>
          <button type="button" className="ao-retry" onClick={() => void load(range, 'initial')}>
            Try again
          </button>
        </div>
        <AdminOverviewStyles />
      </div>
    );
  }

  // ---- First load ---------------------------------------------------------
  if (!stats) {
    return (
      <div className="ao-page">
        {header}
        <div className="ao-kpi-grid">
          {[0, 1, 2, 3].map((key) => (
            <KpiCardSkeleton key={key} />
          ))}
        </div>
        <div className="ao-chart-skeleton card-base" aria-hidden="true" />
        <AdminOverviewStyles />
      </div>
    );
  }

  return (
    <div className="ao-page">
      {header}

      {stats.source === 'mock' && (
        <div className="ao-degraded">
          <AlertTriangle size={15} aria-hidden="true" />
          <p>
            {stats.degradedReason ?? 'Live data is unavailable, so these figures are sample data.'}
          </p>
        </div>
      )}

      <div className="ao-kpi-grid">
        {stats.metrics.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </div>

      <TrafficChart
        traffic={stats.traffic}
        range={range}
        onRangeChange={setRange}
        isBusy={isBusy}
      />

      <div className="ao-split">
        <SystemHealthWidget health={stats.health} />
        <AlertsFeed alerts={stats.alerts} />
      </div>

      <p className="ao-footnote">Updated at {formatClockTime(stats.generatedAt)}</p>

      <AdminOverviewStyles />
    </div>
  );
};

const AdminOverviewStyles: React.FC = () => (
  <style>{`
    .ao-page {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .ao-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .ao-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .ao-subtitle {
      margin-top: 4px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .ao-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ao-source {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      background-color: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.25);
      color: var(--status-active);
    }

    .ao-source[data-source='mock'] {
      background-color: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.3);
      color: var(--status-beta);
    }

    .ao-source-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
    }

    .ao-refresh {
      display: flex;
      align-items: center;
      gap: 7px;
      height: 34px;
      padding: 0 14px;
      border-radius: var(--radius-md);
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .ao-refresh:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-primary);
    }

    .ao-refresh:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .ao-spin {
      animation: ao-spin 0.9s linear infinite;
    }

    @keyframes ao-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ao-spin { animation: none; }
    }

    .ao-degraded {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 11px 14px;
      border-radius: var(--radius-md);
      background-color: rgba(245, 158, 11, 0.07);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: var(--status-beta);
    }

    .ao-degraded p {
      font-size: 12px;
      line-height: 1.5;
    }

    .ao-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .ao-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }

    @media (max-width: 1100px) {
      .ao-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ao-split { grid-template-columns: minmax(0, 1fr); }
    }

    @media (max-width: 560px) {
      .ao-kpi-grid { grid-template-columns: minmax(0, 1fr); }
    }

    .ao-chart-skeleton {
      height: 340px;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.02) 25%,
        rgba(255, 255, 255, 0.045) 50%,
        rgba(255, 255, 255, 0.02) 75%
      );
      background-size: 600px 100%;
      animation: ao-shimmer 1.4s ease-in-out infinite;
    }

    @keyframes ao-shimmer {
      0% { background-position: -300px 0; }
      100% { background-position: 600px 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ao-chart-skeleton { animation: none; }
    }

    .ao-notice {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      padding: 28px 24px;
      color: var(--text-muted);
    }

    .ao-notice h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .ao-notice p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 62ch;
    }

    .ao-notice-hint {
      font-size: 12px;
    }

    .ao-notice code {
      font-family: var(--font-mono);
      font-size: 12px;
      background-color: var(--bg-input, var(--bg-pill));
      border: 1px solid var(--border-card);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      color: var(--text-accent);
    }

    .ao-retry {
      margin-top: 4px;
      height: 34px;
      padding: 0 18px;
      border: none;
      border-radius: var(--radius-md);
      background: var(--accent-gradient);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .ao-footnote {
      font-size: 11px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
  `}</style>
);

export default AdminOverviewPage;
