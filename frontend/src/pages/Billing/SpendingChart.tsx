import React, { useMemo } from 'react';
import { SpendingPoint } from '../../types/billing';
import { formatAmount } from './format';

interface SpendingChartProps {
  points: SpendingPoint[];
}

const CHART_HEIGHT = 150;
const BAR_GAP = 10;

function monthLabel(month: string): string {
  const [year, monthPart] = month.split('-');
  const date = new Date(Number(year), Number(monthPart) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('en-US', { month: 'short' });
}

/**
 * Drawn as plain SVG rather than pulling in a charting library — the project
 * has no chart dependency and adding one is a bigger decision than this needs.
 */
export const SpendingChart: React.FC<SpendingChartProps> = ({ points }) => {
  const { primaryCurrency, series, otherCurrencies, total } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of points) {
      totals.set(point.currency, (totals.get(point.currency) ?? 0) + point.amount);
    }

    // Chart one currency — mixing them on a single axis would be misleading.
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const primary = ranked[0]?.[0] ?? 'USD';

    return {
      primaryCurrency: primary,
      series: points.filter((point) => point.currency === primary),
      otherCurrencies: ranked.slice(1).map(([currency, amount]) => ({ currency, amount })),
      total: ranked[0]?.[1] ?? 0,
    };
  }, [points]);

  const max = Math.max(...series.map((point) => point.amount), 0);
  const hasSpend = max > 0;

  if (series.length === 0) {
    return <p className="sc-empty">No payments recorded yet.</p>;
  }

  const barWidth = 100 / series.length;

  return (
    <div className="sc-wrap">
      <div className="sc-total">
        <span className="sc-total-value">{formatAmount(total, primaryCurrency)}</span>
        <span className="sc-total-label">over the last {series.length} months</span>
      </div>

      <div className="sc-chart" role="img" aria-label={`Monthly spending for the last ${series.length} months`}>
        {series.map((point) => {
          const heightPercent = hasSpend ? (point.amount / max) * 100 : 0;
          return (
            <div className="sc-col" key={`${point.month}-${point.currency}`} style={{ width: `${barWidth}%` }}>
              <div className="sc-bar-track">
                <div
                  className={`sc-bar ${point.amount > 0 ? '' : 'empty'}`}
                  style={{ height: `${Math.max(heightPercent, point.amount > 0 ? 4 : 2)}%` }}
                  title={`${monthLabel(point.month)}: ${formatAmount(point.amount, point.currency)}`}
                />
              </div>
              <span className="sc-label">{monthLabel(point.month)}</span>
            </div>
          );
        })}
      </div>

      {otherCurrencies.length > 0 && (
        <p className="sc-note">
          Also spent{' '}
          {otherCurrencies
            .map((entry) => formatAmount(entry.amount, entry.currency))
            .join(', ')}{' '}
          in other currencies, not shown above.
        </p>
      )}

      <style>{`
        .sc-wrap {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .sc-total {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sc-total-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }

        .sc-total-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .sc-chart {
          display: flex;
          align-items: flex-end;
          gap: ${BAR_GAP}px;
          height: ${CHART_HEIGHT}px;
        }

        .sc-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          height: 100%;
        }

        .sc-bar-track {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .sc-bar {
          width: 100%;
          max-width: 46px;
          border-radius: 5px 5px 2px 2px;
          background: linear-gradient(180deg, var(--accent-purple) 0%, rgba(139, 92, 246, 0.35) 100%);
          transition: filter 0.15s ease;
        }

        .sc-bar:hover {
          filter: brightness(1.2);
        }

        .sc-bar.empty {
          background: var(--border-card);
        }

        .sc-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .sc-note,
        .sc-empty {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};
