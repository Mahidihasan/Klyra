import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { billingApi } from '../../services/api/billing';
import { StatusBadge } from '../../components/billing/StatusBadge';
import { InvoiceDetailModal } from '../../components/billing/InvoiceDetailModal';
import { Invoice, InvoiceFilter, PaginationMeta } from '../../types/billing';
import { formatAmount, formatDate } from './format';
import { BillingFilters, BillingPagination, BillingState, TableSkeleton } from './shared';

const PAGE_SIZE = 10;

const FILTERS: { id: InvoiceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'paid', label: 'Paid' },
  { id: 'void', label: 'Void' },
];

interface InvoicesTabProps {
  /** Bumped by the page-level Refresh button to force a reload. */
  refreshToken: number;
  onLoadingChange: (isLoading: boolean) => void;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  refreshToken,
  onLoadingChange,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    onLoadingChange(true);
    setError(null);
    try {
      const result = await billingApi.fetchInvoices({
        page,
        limit: PAGE_SIZE,
        status: filter === 'all' ? undefined : filter,
      });
      setInvoices(result.invoices);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load invoices.');
      setInvoices([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  }, [page, filter, onLoadingChange]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices, refreshToken]);

  const handleFilterChange = (next: InvoiceFilter) => {
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
            title="Invoices didn't load"
            body={error}
            actionLabel="Try again"
            onAction={loadInvoices}
          />
        ) : invoices.length === 0 ? (
          <BillingState
            icon={<FileText size={28} color="var(--text-muted)" />}
            title={filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}
            body={
              filter === 'all'
                ? 'Invoices appear here once you subscribe to an API plan.'
                : 'Switch filters to see the rest of your billing history.'
            }
          />
        ) : (
          <table className="billing-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Plan</th>
                <th>Issued</th>
                <th>Status</th>
                <th className="align-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="clickable-row"
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
                  <td className="mono-cell">{invoice.invoiceNumber}</td>
                  <td>
                    {invoice.subscription ? (
                      <div className="stacked-cell">
                        <span className="stacked-primary">
                          {invoice.subscription.api.name}
                        </span>
                        <span className="stacked-secondary">
                          {invoice.subscription.plan.name}
                        </span>
                      </div>
                    ) : (
                      <span className="muted">One-off charge</span>
                    )}
                  </td>
                  <td className="muted">{formatDate(invoice.createdAt)}</td>
                  <td>
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="align-right amount-cell">
                    {formatAmount(invoice.amount, invoice.currency)}
                  </td>
                  <td className="align-right">
                    {invoice.pdfUrl ? (
                      <a
                        className="row-link"
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Download size={14} />
                        <span>PDF</span>
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
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
        noun="invoices"
        onPageChange={setPage}
      />

      {openInvoiceId && (
        <InvoiceDetailModal
          invoiceId={openInvoiceId}
          onClose={() => setOpenInvoiceId(null)}
        />
      )}
    </>
  );
};
