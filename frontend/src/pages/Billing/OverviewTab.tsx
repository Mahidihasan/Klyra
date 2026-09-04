import { ArrowRight } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { InvoiceDetailModal } from '../../components/billing/InvoiceDetailModal';
import { StatusBadge } from '../../components/billing/StatusBadge';
import { billingApi } from '../../services/api/billing';
import { BillingOverview, CurrencyTotal } from '../../types/billing';

import { describeCard, formatAmount, formatDate } from './format';
import { BillingState } from './shared';

interface OverviewTabProps {
  refreshToken: number;
  onLoadingChange: (isLoading: boolean) => void;
  onViewInvoices: () => void;
  onViewPayments: () => void;
}

/** Totals arrive per currency, so render each one rather than adding them up. */
function renderTotals(totals: CurrencyTotal[]): string {
  if (totals.length === 0) {
    return formatAmount(0, 'USD');
  }
  return totals.map((total) => formatAmount(total.amount, total.currency)).join(' + ');
}

function totalCount(totals: CurrencyTotal[]): number {
  return totals.reduce((sum, total) => sum + total.count, 0);
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  refreshToken,
  onLoadingChange,
  onViewInvoices,
  onViewPayments,
}) => {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    onLoadingChange(true);
    setError(null);
    try {
      setOverview(await billingApi.fetchOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
      setOverview(null);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  }, [onLoadingChange]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshToken]);

  if (isLoading) {
    return (
      <div className="ov-grid">
        <div className="card-base ov-skeleton" />
        <div className="card-base ov-skeleton" />
        <div className="card-base ov-skeleton" />
        <OverviewStyles />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="card-base">
        <BillingState
          title="Dashboard didn't load"
          body={error || 'No billing data available.'}
          actionLabel="Try again"
          onAction={loadOverview}
        />
        <OverviewStyles />
      </div>
    );
  }

  const { nextPayment } = overview;
  const hasOutstanding = overview.outstanding.length > 0;

  return (
    <div className="ov-wrap">
      <div className="ov-stats">
        <div className="ov-stat">
          <span className="ov-stat-label">Outstanding</span>
          <span className="ov-stat-value">{renderTotals(overview.outstanding)}</span>
          <span className="ov-stat-sub">
            {hasOutstanding ? `${totalCount(overview.outstanding)} unpaid` : 'Nothing due'}
          </span>
        </div>

        <div className="ov-stat">
          <span className="ov-stat-label">Paid this month</span>
          <span className="ov-stat-value">{renderTotals(overview.paidThisMonth)}</span>
          <span className="ov-stat-sub">
            {overview.paidLastMonth.length > 0
              ? `${renderTotals(overview.paidLastMonth)} last month`
              : 'Nothing last month'}
          </span>
        </div>

        <div className="ov-stat">
          <span className="ov-stat-label">Next payment</span>
          <span className="ov-stat-value">
            {nextPayment ? formatAmount(nextPayment.amount, nextPayment.currency) : '—'}
          </span>
          <span className={`ov-stat-sub ${nextPayment?.isOverdue ? 'overdue' : ''}`}>
            {nextPayment
              ? `${nextPayment.isOverdue ? 'Was due' : 'Due'} ${formatDate(nextPayment.dueDate)}`
              : 'No scheduled payment'}
          </span>
        </div>
      </div>

      <section className="card-base ov-card">
        <div className="ov-card-head">
          <h3>Recent invoices</h3>
          <button className="ov-link-btn" onClick={onViewInvoices}>
            <span>View all</span>
            <ArrowRight size={13} />
          </button>
        </div>
        {overview.recentInvoices.length === 0 ? (
          <p className="ov-empty-note">No invoices yet.</p>
        ) : (
          <ul className="ov-row-list">
            {overview.recentInvoices.map((invoice) => (
              <li
                key={invoice.id}
                className="ov-row clickable"
                tabIndex={0}
                role="button"
                onClick={() => setOpenInvoiceId(invoice.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setOpenInvoiceId(invoice.id);
                  }
                }}
              >
                <span className="ov-row-mono">{invoice.invoiceNumber}</span>
                <span className="ov-row-date">{formatDate(invoice.createdAt)}</span>
                <StatusBadge status={invoice.status} />
                <span className="ov-row-amount">
                  {formatAmount(invoice.amount, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-base ov-card">
        <div className="ov-card-head">
          <h3>Recent payments</h3>
          <button className="ov-link-btn" onClick={onViewPayments}>
            <span>View all</span>
            <ArrowRight size={13} />
          </button>
        </div>
        {overview.recentPayments.length === 0 ? (
          <p className="ov-empty-note">No payments recorded yet.</p>
        ) : (
          <ul className="ov-row-list">
            {overview.recentPayments.map((payment) => (
              <li key={payment.id} className="ov-row">
                <span className="ov-row-method">
                  {describeCard(payment.paymentMethodDetails, payment.paymentMethod)}
                </span>
                <StatusBadge status={payment.status} />
                <span className="ov-row-amount">
                  {formatAmount(payment.amount, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openInvoiceId && (
        <InvoiceDetailModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
      )}

      <OverviewStyles />
    </div>
  );
};

const OverviewStyles: React.FC = () => (
  <style>{`
    .ov-wrap {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .ov-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .ov-stat {
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-md);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .ov-stat-label {
      font-size: 12px;
      color: var(--text-muted);
    }

    .ov-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .ov-stat-sub {
      font-size: 11px;
      color: var(--text-muted);
    }

    .ov-stat-sub.overdue {
      color: var(--status-maintenance);
    }

    .ov-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      align-items: start;
    }

    .ov-card {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ov-card:hover {
      transform: none;
    }

    .ov-skeleton {
      height: 130px;
      opacity: 0.5;
    }

    .ov-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .ov-card-head h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .ov-link-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      color: var(--text-accent);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: var(--radius-sm);
    }

    .ov-link-btn:hover {
      background-color: var(--accent-subtle);
    }

    .ov-empty-note {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 44ch;
    }

    .ov-row-list {
      display: flex;
      flex-direction: column;
      list-style: none;
    }

    .ov-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border-subtle);
    }

    .ov-row.clickable {
      cursor: pointer;
    }

    .ov-row.clickable:hover .ov-row-mono {
      color: var(--accent-purple);
    }

    .ov-row.clickable:focus-visible {
      outline: 2px solid var(--accent-purple);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }

    .ov-row-mono {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-accent);
      flex-shrink: 0;
    }

    .ov-row-method {
      font-size: 13px;
      color: var(--text-primary);
      flex: 1;
      min-width: 0;
    }

    .ov-row-date {
      font-size: 12px;
      color: var(--text-muted);
      flex: 1;
    }

    .ov-row-amount {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-left: auto;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

  `}</style>
);
