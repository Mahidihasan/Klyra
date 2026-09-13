import React from 'react';
import {
  Activity,
  Boxes,
  LucideIcon,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { MetricId, PlatformMetric } from '../../types/admin';

import { formatDelta, formatMetricValue } from './format';

/**
 * One icon per metric, keyed by id rather than array position so a backend
 * reorder can't silently mislabel the cards.
 */
const METRIC_ICON: Record<MetricId, LucideIcon> = {
  'total-users': Users,
  'active-apis': Boxes,
  mrr: Wallet,
  'api-calls-24h': Activity,
};

const DIRECTION_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

interface KpiCardProps {
  metric: PlatformMetric;
}

export const KpiCard: React.FC<KpiCardProps> = ({ metric }) => {
  const Icon = METRIC_ICON[metric.id] ?? Activity;
  const DeltaIcon = DIRECTION_ICON[metric.delta.direction];

  // Colour tracks whether the movement is good news, not its sign: falling
  // error rates and rising revenue are both green, and the backend already
  // decided which is which.
  const tone =
    metric.delta.direction === 'flat' ? 'flat' : metric.delta.isPositive ? 'positive' : 'negative';

  return (
    <article className="kpi-card card-base">
      <header className="kpi-head">
        <span className="kpi-label">{metric.label}</span>
        <Icon size={16} className="kpi-icon" aria-hidden="true" />
      </header>

      <p className="kpi-value">{formatMetricValue(metric)}</p>

      <div className="kpi-foot">
        <span className="kpi-delta" data-tone={tone}>
          <DeltaIcon size={12} aria-hidden="true" />
          {formatDelta(metric.delta.percent)}
        </span>
        <span className="kpi-compared">{metric.delta.comparedTo}</span>
      </div>

      <p className="kpi-caption">{metric.caption}</p>

      <style>{`
        .kpi-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .kpi-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .kpi-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .kpi-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .kpi-value {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.1;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .kpi-foot {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .kpi-delta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 999px;
          background-color: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .kpi-delta[data-tone='positive'] {
          color: var(--status-active);
          border-color: rgba(34, 197, 94, 0.25);
          background-color: rgba(34, 197, 94, 0.08);
        }

        .kpi-delta[data-tone='negative'] {
          color: var(--status-maintenance);
          border-color: rgba(239, 68, 68, 0.25);
          background-color: rgba(239, 68, 68, 0.08);
        }

        .kpi-delta[data-tone='flat'] {
          color: var(--text-muted);
        }

        .kpi-compared {
          font-size: 11px;
          color: var(--text-muted);
        }

        .kpi-caption {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.5;
        }
      `}</style>
    </article>
  );
};

/** Placeholder shown while the first request is in flight. */
export const KpiCardSkeleton: React.FC = () => (
  <div className="kpi-skeleton card-base" aria-hidden="true">
    <span className="kpi-skeleton-bar short" />
    <span className="kpi-skeleton-bar tall" />
    <span className="kpi-skeleton-bar" />

    <style>{`
      .kpi-skeleton {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .kpi-skeleton-bar {
        height: 12px;
        border-radius: 4px;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.02) 25%,
          rgba(255, 255, 255, 0.05) 50%,
          rgba(255, 255, 255, 0.02) 75%
        );
        background-size: 400px 100%;
        animation: kpi-skeleton-shimmer 1.3s ease-in-out infinite;
      }

      .kpi-skeleton-bar.short { width: 45%; }
      .kpi-skeleton-bar.tall { height: 28px; width: 65%; }

      @keyframes kpi-skeleton-shimmer {
        0% { background-position: -200px 0; }
        100% { background-position: 400px 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .kpi-skeleton-bar { animation: none; }
      }
    `}</style>
  </div>
);
