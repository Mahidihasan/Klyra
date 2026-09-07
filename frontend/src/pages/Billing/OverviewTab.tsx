import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CreditCard, Download, Plus } from 'lucide-react';
import { billingApi } from '../../services/api/billing';
import { StatusBadge } from '../../components/billing/StatusBadge';
import { InvoiceDetailModal } from '../../components/billing/InvoiceDetailModal';
import {
  ApiSpending,
  BillingOverview,
  CurrencyTotal,
  DueInvoiceSummary,
  SpendingPoint,
} from '../../types/billing';
import { describeCard, formatAmount, formatDate } from './format';
import { BillingState } from './shared';
import { SpendingChart } from './SpendingChart';
import { ApiSpendingCard } from './ApiSpendingCard';

interface OverviewTabProps {
  refreshToken: number;
  /** Bumped on the live-refresh interval; triggers a silent background reload. */
  liveRefreshKey?: number;
  onLoadingChange: (isLoading: boolean) => void;
  onViewInvoices: () => void;
  onViewPayments: () => void;
  onViewMethods: () => void;
}

/** Totals arrive per currency, so render each one rather than adding them up. */
function renderTotals(totals: CurrencyTotal[]): string {
  if (totals.length === 0) return formatAmount(0, 'USD');
  return totals.map((total) => formatAmount(total.amount, total.currency)).join(' + ');
}

function totalCount(totals: CurrencyTotal[]): number {
  return totals.reduce((sum, total) => sum + total.count, 0);
}

function dueLabel(due: DueInvoiceSummary): string {
  const days = due.daysFromNow;
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return 'Overdue since yesterday';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  refreshToken,
  liveRefreshKey,
  onLoadingChange,
  onViewInvoices,
  onViewPayments,
  onViewMethods,
}) => {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [spending, setSpending] = useState<SpendingPoint[]>([]);
  const [apiSpending, setApiSpending] = useState<ApiSpending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  const loadOverview = useCallback(
    async (mode: 'initial' | 'silent' = 'initial') => {
      // Silent (live) refreshes keep the current view on screen instead of
      // flashing the skeleton; only the initial load / manual refresh shows it.
      if (mode !== 'silent') {
        setIsLoading(true);
        onLoadingChange(true);
      }
      setError(null);
      try {
        // The charts are secondary, so a failure there shouldn't blank the page.
        const [overviewResult, spendingResult, byApiResult] = await Promise.allSettled([
          billingApi.fetchOverview(),
          billingApi.fetchSpending(6),
          billingApi.fetchSpendingByApi(),
        ]);

        if (overviewResult.status === 'rejected') throw overviewResult.reason;

        setOverview(overviewResult.value);
        setSpending(spendingResult.status === 'fulfilled' ? spendingResult.value.points : []);
        setApiSpending(byApiResult.status === 'fulfilled' ? byApiResult.value.breakdown : []);
      } catch (err) {
        // A background refresh failing shouldn't wipe out the last good data.
        if (mode === 'silent') return;
        setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
        setOverview(null);
      } finally {
        if (mode !== 'silent') {
          setIsLoading(false);
          onLoadingChange(false);
        }
      }
    },
    [onLoadingChange],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshToken]);

  // Live poll: re-sync silently whenever the interval bumps the key.
  useEffect(() => {
    if (liveRefreshKey) loadOverview('silent');
  }, [liveRefreshKey, loadOverview]);

  if (isLoading) {
    return (
      <div className="ov-wrap">
        <div className="ov-stats">
          <div className="ov-stat ov-skeleton" />
          <div className="ov-stat ov-skeleton" />
          <div className="ov-stat ov-skeleton" />
          <div className="ov-stat ov-skeleton" />
        </div>
        <div className="card-base ov-card ov-skeleton tall" />
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

  const { outstanding, nextPayment, defaultPaymentMethod } = overview;
  const hasOutstanding = outstanding.length > 0;

  return (
    <div className="ov-wrap">
      <div className="ov-stats">
        <div className={`ov-stat ${hasOutstanding ? 'primary' : ''}`}>
          <span className="ov-stat-label">Outstanding</span>
          <span className="ov-stat-value">{renderTotals(outstanding)}</span>
          {hasOutstanding ? (
            <button className="ov-stat-action" onClick={onViewInvoices}>
              <span>{totalCount(outstanding)} unpaid invoices</span>
              <ArrowRight size={12} />
            </button>
          ) : (
            <span className="ov-stat-sub">Nothing due</span>
          )}
        </div>

        <div className="ov-stat">
          <span className="ov-stat-label">This month</span>
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
          <span className="ov-stat-sub">
            {nextPayment
              ? `${nextPayment.invoiceNumber} · ${dueLabel(nextPayment)}`
              : 'Nothing scheduled'}
          </span>
        </div>

        <div className="ov-stat">
          <span className="ov-stat-label">Total spent</span>
          <span className="ov-stat-value">{renderTotals(overview.totalSpent)}</span>
          <span className="ov-stat-sub">
            {totalCount(overview.totalSpent) > 0
              ? `${totalCount(overview.totalSpent)} payments all time`
              : 'No payments yet'}
          </span>
        </div>
      </div>

      <div className="ov-grid split">
        <section className="card-base ov-card">
          <div className="ov-card-head">
            <h3>Spending overview</h3>
          </div>
          <SpendingChart points={spending} />
        </section>

        {/* Stacked so the column matches the chart's height instead of
            leaving a gap underneath the card. */}
        <div className="ov-side-stack">
          <section className="card-base ov-card">
            <div className="ov-card-head">
              <div className="ov-card-title">
                <CreditCard size={15} color="var(--text-muted)" />
                <h3>Payment method</h3>
              </div>
              <button className="ov-link-btn" onClick={onViewMethods}>
                <span>{defaultPaymentMethod ? 'Manage' : 'Add'}</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {defaultPaymentMethod ? (
              <>
                <div className="ov-strong-line">
                  {describeCard(
                    {
                      brand: defaultPaymentMethod.brand,
                      last4: defaultPaymentMethod.last4,
                    },
                    null,
                  )}
                </div>
                <div className="ov-muted-line">
                  Expires {String(defaultPaymentMethod.expMonth).padStart(2, '0')}/
                  {defaultPaymentMethod.expYear}
                  {defaultPaymentMethod.isDefault ? ' · default' : ''}
                </div>
              </>
            ) : (
              <button className="ov-inline-add" onClick={onViewMethods}>
                <Plus size={14} />
                <span>Add payment method</span>
              </button>
            )}
          </section>

          <section className="card-base ov-card">
            <div className="ov-card-head">
              <h3>API spending</h3>
            </div>
            <ApiSpendingCard breakdown={apiSpending} />
          </section>
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
                <a
                  className="ov-row-pdf"
                  href={billingApi.invoicePdfUrl(invoice.id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Download ${invoice.invoiceNumber} as PDF`}
                >
                  <Download size={13} />
                </a>
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
                <span className="ov-row-date fixed">{formatDate(payment.createdAt)}</span>
                <span className="ov-row-method">
                  {describeCard(payment.paymentMethodDetails, payment.paymentMethod)}
                </span>
                <span className="ov-row-mono">
                  {payment.invoice ? payment.invoice.invoiceNumber : '—'}
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
        <InvoiceDetailModal
          invoiceId={openInvoiceId}
          onClose={() => setOpenInvoiceId(null)}
        />
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
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }

    .ov-stat {
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-md);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }

    /* Marked out with an accent rule rather than a filled panel — a solid
       accent background left the muted label unreadable. */
    .ov-stat.primary {
      border-color: var(--accent-subtle-border);
      position: relative;
      overflow: hidden;
    }

    .ov-stat.primary::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--accent-gradient);
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

    .ov-stat.primary .ov-stat-value {
      font-size: 28px;
    }

    .ov-stat-sub {
      font-size: 11px;
      color: var(--text-muted);
    }

    .ov-stat-action {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 0;
      color: var(--text-accent);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .ov-stat-action:hover {
      text-decoration: underline;
    }

    .ov-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      align-items: start;
    }

    /* Chart needs the room; the cards beside it stack to fill the column. */
    .ov-grid.split {
      grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr);
    }

    .ov-side-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    @media (max-width: 900px) {
      .ov-grid.split {
        grid-template-columns: 1fr;
      }
    }

    .ov-card {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ov-card:hover {
      transform: none;
    }

    .ov-skeleton {
      opacity: 0.5;
      min-height: 96px;
    }

    .ov-skeleton.tall {
      min-height: 220px;
    }

    .ov-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 2px;
    }

    .ov-card-title {
      display: flex;
      align-items: center;
      gap: 7px;
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

    .ov-strong-line {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      text-transform: capitalize;
    }

    .ov-muted-line {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .ov-inline-add {
      display: flex;
      align-items: center;
      gap: 7px;
      align-self: flex-start;
      height: 32px;
      padding: 0 13px;
      border-radius: var(--radius-sm);
      background-color: transparent;
      border: 1px dashed var(--border-card);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .ov-inline-add:hover {
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    .ov-empty-note {
      font-size: 12px;
      color: var(--text-muted);
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
      padding: 11px 0;
      border-bottom: 1px solid var(--border-subtle);
    }

    .ov-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
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

    .ov-row-date.fixed {
      flex: 0 0 96px;
    }

    .ov-row-amount {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-left: auto;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    .ov-row-pdf {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-card);
      color: var(--text-muted);
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .ov-row-pdf:hover {
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    @media (max-width: 720px) {
      .ov-row {
        flex-wrap: wrap;
      }

      .ov-row-date.fixed {
        flex: 0 0 auto;
      }
    }
  `}</style>
);
