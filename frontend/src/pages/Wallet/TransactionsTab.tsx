import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt } from 'lucide-react';

import {
  cancelTopUpSession,
  fetchWallet,
  fetchWalletTransactions,
  WalletApiError,
} from '../../services/api/wallet';
import {
  PaginationMeta,
  WalletTopUpSession,
  WalletTransaction,
  WalletTransactionFilter,
} from '../../types/wallet';
import {
  formatAmount,
  formatDate,
  formatShortDate,
  formatTimeUntil,
  signedAmount,
} from './format';
import {
  TableSkeleton,
  TransactionBadge,
  WalletFilters,
  WalletPagination,
  WalletState,
} from './shared';

const PAGE_SIZE = 10;

const FILTERS: { id: WalletTransactionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'topups', label: 'Top-ups' },
  { id: 'spending', label: 'Spending' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'adjustments', label: 'Adjustments' },
];

const EMPTY_BODY: Record<WalletTransactionFilter, { title: string; body: string }> = {
  all: {
    title: 'No transactions yet',
    body: 'Top-ups and spending will appear here.',
  },
  topups: {
    title: 'No top-up transactions',
    body: 'Try a different filter to see the rest of your history.',
  },
  spending: {
    title: 'No spending transactions',
    body: 'Try a different filter to see the rest of your history.',
  },
  refunds: {
    title: 'No refund transactions',
    body: 'Try a different filter to see the rest of your history.',
  },
  adjustments: {
    title: 'No adjustment transactions',
    body: 'Try a different filter to see the rest of your history.',
  },
};

interface TransactionsTabProps {
  refreshToken: number;
  /** Bumped by the live stream; reloads without showing the skeleton. */
  liveRefreshKey?: number;
  onLoadingChange: (isLoading: boolean) => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  refreshToken,
  liveRefreshKey,
  onLoadingChange,
}) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [filter, setFilter] = useState<WalletTransactionFilter>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ids already on screen, so a row that arrives later can be highlighted.
  // Empty until the first load finishes, otherwise the whole first page would
  // flash as though it had all just happened.
  const seenIds = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // Top-ups that have been started but not paid. These are not ledger rows
  // and are fetched separately, because the ledger records money that moved
  // and these have not moved any.
  const [pending, setPending] = useState<WalletTopUpSession[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'silent' = 'initial') => {
    // Silent reloads keep the table on screen, so a credit arriving simply
    // adds a row (highlighted below) instead of blanking the history.
    if (mode !== 'silent') {
      setIsLoading(true);
      onLoadingChange(true);
    }
    setError(null);
    try {
      const result = await fetchWalletTransactions({
        page,
        limit: PAGE_SIZE,
        type: filter,
      });

      if (seenIds.current === null) {
        setNewIds(new Set());
      } else {
        const previous = seenIds.current;
        setNewIds(
          new Set(
            result.transactions
              .filter((item) => !previous.has(item.id))
              .map((item) => item.id),
          ),
        );
      }
      seenIds.current = new Set(result.transactions.map((item) => item.id));

      setTransactions(result.transactions);
      setMeta(result.meta);
    } catch (err) {
      if (mode === 'silent') return;

      const message =
        err instanceof WalletApiError && err.isUnauthorized
          ? 'Your session has expired. Sign in again to see your transactions.'
          : err instanceof Error
            ? err.message
            : 'Could not load your transactions.';
      setError(message);
      setTransactions([]);
      setMeta(null);
    } finally {
      if (mode !== 'silent') {
        setIsLoading(false);
        onLoadingChange(false);
      }
    }
  }, [page, filter, onLoadingChange]);

  // Kept out of the loader above so a failure here can never blank the table:
  // an unknown pending state is a smaller problem than losing the history.
  const loadPending = useCallback(async () => {
    try {
      const overview = await fetchWallet();
      setPending(overview.pendingSessions);
    } catch {
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, refreshToken]);

  useEffect(() => {
    if (!liveRefreshKey) return;
    void load('silent');
    void loadPending();
  }, [liveRefreshKey, load, loadPending]);

  const handleCancel = async (session: WalletTopUpSession) => {
    setCancelling(session.stripeSessionId);
    setCancelError(null);
    try {
      await cancelTopUpSession(session.stripeSessionId);
      // Drop it locally rather than refetching: the balance cannot have moved,
      // so there is nothing else on this screen to bring up to date.
      setPending((current) =>
        current.filter((item) => item.stripeSessionId !== session.stripeSessionId),
      );
    } catch (err) {
      if (err instanceof WalletApiError && err.isSessionGone) {
        // Already paid, already closed, or expired while the page sat open.
        // Nothing is wrong; the row simply should not be there any more.
        await loadPending();
      } else {
        setCancelError(
          err instanceof Error ? err.message : 'Could not cancel that top-up.',
        );
      }
    } finally {
      setCancelling(null);
    }
  };

  const handleFilterChange = (next: WalletTransactionFilter) => {
    setFilter(next);
    setPage(1);
    // A different slice of history is not new activity.
    seenIds.current = null;
  };

  const empty = EMPTY_BODY[filter];

  // A pending top-up is not a refund or an adjustment, so it only belongs
  // above the filters that would have included it had it completed.
  const showPending =
    pending.length > 0 && (filter === 'all' || filter === 'topups');

  return (
    <>
      <WalletFilters filters={FILTERS} active={filter} onChange={handleFilterChange} />

      {showPending && (
        <section className="card-base wallet-card wallet-pending-card">
          <div className="wallet-card-head">
            <h3>In progress</h3>
          </div>

          <ul className="wallet-row-list">
            {pending.map((session) => (
              <li className="wallet-row wallet-pending-row" key={session.id}>
                <span className="wallet-row-date">
                  {formatShortDate(session.createdAt)}
                </span>
                <span className="wallet-row-desc">Top-up awaiting payment</span>
                <span className="wallet-row-expiry">
                  {formatTimeUntil(session.expiresAt)}
                </span>
                <TransactionBadge type="TOPUP" status="PENDING" />
                <span className="wallet-row-amount wallet-pending-amount">
                  {formatAmount(session.amount, session.currency)}
                </span>
                <button
                  className="wallet-cancel-btn"
                  disabled={cancelling === session.stripeSessionId}
                  onClick={() => void handleCancel(session)}
                  aria-label={`Cancel the ${formatAmount(session.amount, session.currency)} top-up`}
                >
                  {cancelling === session.stripeSessionId ? 'Cancelling…' : 'Cancel'}
                </button>
              </li>
            ))}
          </ul>

          {cancelError && (
            <p className="tu-error" role="alert">
              {cancelError}
            </p>
          )}

          <p className="wallet-pending-note">
            Not part of your balance and not in the history below. A top-up is
            credited once the payment completes. Cancelling one only closes the
            attempt — it moves no money.
          </p>
        </section>
      )}

      <div className="card-base wallet-table-card">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <WalletState
            title="Couldn't load your transactions"
            body={error}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : transactions.length === 0 ? (
          <WalletState
            icon={<Receipt size={28} color="var(--text-muted)" />}
            title={empty.title}
            body={empty.body}
          />
        ) : (
          <table className="wallet-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th className="align-right">Amount</th>
                <th className="align-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id} className={newIds.has(item.id) ? 'wallet-row-new' : ''}>
                  <td className="wallet-muted">{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="wallet-desc-cell">
                      <span>{item.description ?? 'Wallet movement'}</span>
                      {item.referenceType && (
                        <span className="wallet-desc-secondary">
                          {item.referenceType.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <TransactionBadge type={item.type} status={item.status} />
                  </td>
                  <td
                    className={`align-right wallet-amount ${
                      item.direction === 'CREDIT' ? 'credit' : 'debit'
                    }`}
                    style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {signedAmount(item.amount, item.direction, item.currency)}
                  </td>
                  <td className="align-right wallet-balance-cell">
                    {formatAmount(item.balanceAfter, item.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <WalletPagination
        meta={meta}
        isLoading={isLoading}
        noun="transactions"
        onPageChange={setPage}
      />
    </>
  );
};
