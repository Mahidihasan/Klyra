import React, { useEffect, useState } from 'react';
import { X, Download, CreditCard } from 'lucide-react';
import { billingApi } from '../../services/api/billing';
import { StatusBadge } from './StatusBadge';
import { InvoiceDetail } from '../../types/billing';
import { describeCard, formatAmount, formatDate, formatDateTime } from '../../pages/Billing/format';

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoiceId,
  onClose,
}) => {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await billingApi.fetchInvoice(invoiceId);
        if (!cancelled) setInvoice(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this invoice.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(event) => event.stopPropagation()}>
        <div className="invoice-modal-header">
          <div>
            <div className="invoice-modal-eyebrow">Invoice</div>
            <h2 className="invoice-modal-number">
              {invoice ? invoice.invoiceNumber : 'Loading…'}
            </h2>
          </div>
          <button className="invoice-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="invoice-modal-body">
          {isLoading ? (
            <div className="invoice-modal-state">Loading invoice…</div>
          ) : error ? (
            <div className="invoice-modal-state">
              <p>{error}</p>
            </div>
          ) : invoice ? (
            <>
              <div className="invoice-summary">
                <div className="invoice-total">
                  <span className="invoice-total-value">
                    {formatAmount(invoice.amount, invoice.currency)}
                  </span>
                  <StatusBadge status={invoice.status} />
                </div>
                {invoice.amountDue > 0 && (
                  <div className="invoice-due-note">
                    {formatAmount(invoice.amountPaid, invoice.currency)} paid ·{' '}
                    {formatAmount(invoice.amountDue, invoice.currency)} outstanding
                  </div>
                )}
              </div>

              <dl className="invoice-meta">
                <div>
                  <dt>Issued</dt>
                  <dd>{formatDate(invoice.createdAt)}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>{formatDate(invoice.dueDate)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDate(invoice.paidAt)}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{invoice.currency}</dd>
                </div>
              </dl>

              <section className="invoice-section">
                <h3>Subscription</h3>
                {invoice.subscription ? (
                  <div className="invoice-sub-card">
                    <div className="invoice-sub-top">
                      <span className="invoice-sub-api">{invoice.subscription.api.name}</span>
                      <span className="invoice-sub-plan">{invoice.subscription.plan.name}</span>
                    </div>
                    <div className="invoice-sub-period">
                      Billing period {formatDate(invoice.subscription.periodStart)} –{' '}
                      {formatDate(invoice.subscription.periodEnd)}
                    </div>
                  </div>
                ) : (
                  <p className="invoice-empty-note">
                    This invoice isn&apos;t tied to a subscription.
                  </p>
                )}
              </section>

              <section className="invoice-section">
                <h3>Payment attempts</h3>
                {invoice.payments.length === 0 ? (
                  <p className="invoice-empty-note">
                    No payments recorded against this invoice yet.
                  </p>
                ) : (
                  <ul className="invoice-payments">
                    {invoice.payments.map((payment) => (
                      <li key={payment.id} className="invoice-payment-row">
                        <div className="invoice-payment-icon">
                          <CreditCard size={15} color="var(--text-muted)" />
                        </div>
                        <div className="invoice-payment-main">
                          <div className="invoice-payment-method">
                            {describeCard(payment.paymentMethodDetails, payment.paymentMethod)}
                          </div>
                          <div className="invoice-payment-date">
                            {formatDateTime(payment.createdAt)}
                          </div>
                          {payment.failureReason && (
                            <div className="invoice-payment-failure">
                              {payment.failureReason}
                            </div>
                          )}
                        </div>
                        <div className="invoice-payment-right">
                          <span className="invoice-payment-amount">
                            {formatAmount(payment.amount, payment.currency)}
                          </span>
                          <StatusBadge status={payment.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <a
                className="invoice-pdf-btn"
                href={billingApi.invoicePdfUrl(invoice.id)}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} />
                <span>Download PDF</span>
              </a>
            </>
          ) : null}
        </div>

        <style>{`
          .invoice-modal {
            width: 100%;
            max-width: 620px;
            max-height: 86vh;
            display: flex;
            flex-direction: column;
            background-color: var(--bg-modal);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-md);
            overflow: hidden;
          }

          .invoice-modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border-card);
          }

          .invoice-modal-eyebrow {
            font-size: 11px;
            color: var(--text-muted);
          }

          .invoice-modal-number {
            font-family: var(--font-mono);
            font-size: 17px;
            font-weight: 600;
            color: var(--text-primary);
            margin-top: 3px;
          }

          .invoice-modal-close {
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--radius-sm);
            background-color: transparent;
            border: 1px solid var(--border-card);
            color: var(--text-secondary);
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.15s ease;
          }

          .invoice-modal-close:hover {
            color: var(--text-primary);
            border-color: var(--accent-subtle-border);
          }

          .invoice-modal-body {
            padding: 22px 24px 24px 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 22px;
          }

          .invoice-modal-state {
            padding: 40px 0;
            text-align: center;
            font-size: 13px;
            color: var(--text-muted);
          }

          .invoice-summary {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .invoice-total {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .invoice-total-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-primary);
            font-variant-numeric: tabular-nums;
          }

          .invoice-due-note {
            font-size: 12px;
            color: var(--text-muted);
          }

          .invoice-meta {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            padding: 16px 0;
            border-top: 1px solid var(--border-subtle);
            border-bottom: 1px solid var(--border-subtle);
          }

          @media (max-width: 560px) {
            .invoice-meta {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          .invoice-meta dt {
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 4px;
          }

          .invoice-meta dd {
            font-size: 13px;
            color: var(--text-primary);
          }

          .invoice-section {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .invoice-section h3 {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-secondary);
          }

          .invoice-empty-note {
            font-size: 12px;
            color: var(--text-muted);
          }

          .invoice-sub-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-md);
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .invoice-sub-top {
            display: flex;
            align-items: baseline;
            gap: 10px;
            flex-wrap: wrap;
          }

          .invoice-sub-api {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
          }

          .invoice-sub-plan {
            font-size: 12px;
            color: var(--text-accent);
          }

          .invoice-sub-period {
            font-size: 12px;
            color: var(--text-muted);
          }

          .invoice-payments {
            display: flex;
            flex-direction: column;
            gap: 8px;
            list-style: none;
          }

          .invoice-payment-row {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            background-color: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-md);
            padding: 12px 14px;
          }

          .invoice-payment-icon {
            width: 30px;
            height: 30px;
            border-radius: var(--radius-sm);
            background-color: var(--bg-pill);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .invoice-payment-main {
            flex: 1;
            min-width: 0;
          }

          .invoice-payment-method {
            font-size: 13px;
            color: var(--text-primary);
            font-weight: 500;
          }

          .invoice-payment-date {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 2px;
          }

          .invoice-payment-failure {
            font-size: 11px;
            color: var(--status-maintenance);
            margin-top: 4px;
          }

          .invoice-payment-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 6px;
            flex-shrink: 0;
          }

          .invoice-payment-amount {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            font-variant-numeric: tabular-nums;
          }

          .invoice-pdf-btn {
            align-self: flex-start;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 36px;
            padding: 0 16px;
            border-radius: var(--radius-md);
            background: var(--accent-gradient);
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
          }
        `}</style>
      </div>
    </div>
  );
};
