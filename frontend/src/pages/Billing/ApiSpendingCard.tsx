import React, { useMemo } from 'react';
import { ApiSpending } from '../../types/billing';
import { formatAmount } from './format';

interface ApiSpendingCardProps {
  breakdown: ApiSpending[];
}

const TOP_COUNT = 5;

/** Rotating accents so each row is distinguishable without inventing colours. */
const BAR_COLORS = [
  'var(--accent-purple)',
  '#22d3ee',
  '#f59e0b',
  '#22c55e',
  '#ec4899',
  'var(--text-muted)',
];

export const ApiSpendingCard: React.FC<ApiSpendingCardProps> = ({ breakdown }) => {
  const { rows, currency, total } = useMemo(() => {
    if (breakdown.length === 0) {
      return { rows: [] as ApiSpending[], currency: 'USD', total: 0 };
    }

    // One currency per chart — totals across currencies aren't comparable.
    const byCurrency = new Map<string, number>();
    for (const entry of breakdown) {
      byCurrency.set(entry.currency, (byCurrency.get(entry.currency) ?? 0) + entry.amount);
    }
    const primary = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const filtered = breakdown
      .filter((entry) => entry.currency === primary)
      .sort((a, b) => b.amount - a.amount);

    const top = filtered.slice(0, TOP_COUNT);
    const rest = filtered.slice(TOP_COUNT);

    if (rest.length > 0) {
      top.push({
        apiId: null,
        apiName: `Other (${rest.length})`,
        currency: primary,
        amount: rest.reduce((sum, entry) => sum + entry.amount, 0),
        invoiceCount: rest.reduce((sum, entry) => sum + entry.invoiceCount, 0),
      });
    }

    return {
      rows: top,
      currency: primary,
      total: filtered.reduce((sum, entry) => sum + entry.amount, 0),
    };
  }, [breakdown]);

  if (rows.length === 0) {
    return (
      <p className="as-empty">
        Spend appears here once you have invoices against an API subscription.
      </p>
    );
  }

  return (
    <div className="as-wrap">
      <ul className="as-list">
        {rows.map((row, index) => {
          const share = total > 0 ? (row.amount / total) * 100 : 0;
          return (
            <li className="as-row" key={row.apiId ?? row.apiName}>
              <div className="as-head">
                <span className="as-name">{row.apiName}</span>
                <span className="as-amount">{formatAmount(row.amount, row.currency)}</span>
              </div>
              <div className="as-track">
                <div
                  className="as-fill"
                  style={{
                    width: `${Math.max(share, 1.5)}%`,
                    backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                  }}
                />
              </div>
              <div className="as-meta">
                {share.toFixed(0)}% · {row.invoiceCount}{' '}
                {row.invoiceCount === 1 ? 'invoice' : 'invoices'}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="as-note">
        Based on invoices raised in {currency}, excluding voided ones.
      </p>

      <style>{`
        .as-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .as-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .as-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .as-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .as-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .as-amount {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }

        .as-track {
          height: 7px;
          border-radius: 4px;
          background-color: var(--bg-pill);
          overflow: hidden;
        }

        .as-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.25s ease;
        }

        .as-meta {
          font-size: 11px;
          color: var(--text-muted);
        }

        .as-note,
        .as-empty {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};
