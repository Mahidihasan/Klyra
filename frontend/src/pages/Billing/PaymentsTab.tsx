import React, { useCallback, useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { billingApi } from '../../services/api/billing';
import { StatusBadge } from '../../components/billing/StatusBadge';
import { PaginationMeta, Payment, PaymentFilter } from '../../types/billing';
import { describeCard, formatAmount, formatDateTime } from './format';
import { BillingFilters, BillingPagination, BillingState, TableSkeleton } from './shared';

const PAGE_SIZE = 10;

const FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

const EMPTY_BODY: Record<PaymentFilter, string> = {
  all: 'Payments appear here once a charge is attempted on one of your invoices.',
  succeeded: 'No completed payments yet.',
  pending: 'Nothing is currently being processed.',
  failed: 'No failed or cancelled charges — good news.',
  refunded: 'Nothing has been refunded.',
};

interface PaymentsTabProps {
  refreshToken: number;
  /** Bumped on the live-refresh interval; triggers a silent background reload. */
  liveRefreshKey?: number;
  onLoadingChange: (isLoading: boolean) => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  refreshToken,
  liveRefreshKey,
  onLoadingChange,
}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(
    async (mode: 'initial' | 'silent' = 'initial') => {
      // Silent (live) refreshes keep the current table on screen instead of
      // flashing the skeleton; only the initial load / manual refresh shows it.
      if (mode !== 'silent') {
        setIsLoading(true);
        onLoadingChange(true);
      }
      setError(null);
      try {
        const result = await billingApi.fetchPayments({
          page,
          limit: PAGE_SIZE,
          status: filter === 'all' ? undefined : filter,
        });
        setPayments(result.payments);
        setMeta(result.meta);
      } catch (err) {
        // A background refresh failing shouldn't wipe out the last good data.
        if (mode === 'silent') return;
        setError(err instanceof Error ? err.message : 'Could not load payments.');
        setPayments([]);
        setMeta(null);
      } finally {
        if (mode !== 'silent') {
          setIsLoading(false);
          onLoadingChange(false);
        }
      }
    },
    [page, filter, onLoadingChange],
  );

  useEffect(() => {
    loadPayments();
  }, [loadPayments, refreshToken]);

  // Live poll: re-sync silently whenever the interval bumps the key.
  useEffect(() => {
    if (liveRefreshKey) loadPayments('silent');
  }, [liveRefreshKey, loadPayments]);

  const handleFilterChange = (next: PaymentFilter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <>
      <BillingFilters
        filters={FILTERS}
        active={filter}
        onChange={handleFilterChange}
      />

      <div className="card-base billing-table-card">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <BillingState
            title="Payments didn't load"
            body={error}
            actionLabel="Try again"
            onAction={loadPayments}
          />
        ) : payments.length === 0 ? (
          <BillingState
            icon={<Receipt size={28} color="var(--text-muted)" />}
            title={filter === 'all' ? 'No payments yet' : `No ${filter} payments`}
            body={EMPTY_BODY[filter]}
          />
        ) : (
          <table className="billing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Invoice</th>
                <th>Status</th>
                <th className="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="muted">{formatDateTime(payment.createdAt)}</td>
                  <td>
                    <div className="stacked-cell">
                      <span className="stacked-primary">
                        {describeCard(payment.paymentMethodDetails, payment.paymentMethod)}
                      </span>
                      {payment.apiName && (
                        <span className="stacked-secondary">{payment.apiName}</span>
                      )}
                    </div>
                  </td>
                  <td className="mono-cell">
                    {payment.invoice ? payment.invoice.invoiceNumber : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="stacked-cell">
                      <StatusBadge status={payment.status} />
                      {payment.failureReason && (
                        <span className="failure-note">{payment.failureReason}</span>
                      )}
                    </div>
                  </td>
                  <td className="align-right amount-cell">
                    {formatAmount(payment.amount, payment.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BillingPagination
        meta={meta}
        isLoading={isLoading}
        noun="payments"
        onPageChange={setPage}
      />
    </>
  );
};
