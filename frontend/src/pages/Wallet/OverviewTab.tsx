import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Lock, Plus, Wallet as WalletIcon } from 'lucide-react';

import { fetchWallet, fetchWalletSummary, WalletApiError } from '../../services/api/wallet';
import {
  Wallet,
  WalletMonthlyPoint,
  WalletTopUpSession,
  WalletTransaction,
} from '../../types/wallet';
import {
  formatAmount,
  formatMonthLabel,
  formatRelativeTime,
  formatShortDate,
  signedAmount,
} from './format';
import { TransactionBadge, WalletState } from './shared';
import { TopUpModal } from './TopUpModal';

interface OverviewTabProps {
  /** Bumped by the page-level Refresh button to force a reload. */
  refreshToken: number;
  /** Bumped by the live stream; reloads without showing the skeleton. */
  liveRefreshKey?: number;
  onLoadingChange: (isLoading: boolean) => void;
  onViewAll: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts the balance up to a new figure so a credit landing is noticed rather
 * than the number silently changing.
 *
 * The animation is decoration and is never allowed to become the source of the
 * number on screen. Every path that could leave it unfinished — the first
 * render, reduced motion, a hidden tab where requestAnimationFrame does not
 * fire at all, an unmount mid-flight — puts the real figure up immediately,
 * and a timeout backstops the frame loop regardless. A wallet must never
 * display a number that is not the balance; this was caught showing $0.00
 * against a real balance of $66.37 in a background tab.
 */
function useCountUp(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target);
  const previous = useRef(target);
  const firstRun = useRef(true);

  useEffect(() => {
    const from = previous.current;
    previous.current = target;

    const cannotAnimate =
      firstRun.current ||
      from === target ||
      prefersReducedMotion() ||
      (typeof document !== 'undefined' && document.hidden);

    if (cannotAnimate) {
      firstRun.current = false;
      setDisplay(target);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // cubic-bezier(.16, 1, .3, 1) in spirit: fast out, settled landing.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(target);
    };

    frame = requestAnimationFrame(tick);
    const safety = window.setTimeout(() => setDisplay(target), durationMs + 200);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(safety);
      setDisplay(target);
    };
  }, [target, durationMs]);

  return display;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  refreshToken,
  liveRefreshKey,
  onLoadingChange,
  onViewAll,
}) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [pendingTopUp, setPendingTopUp] = useState(0);
  const [pendingSessions, setPendingSessions] = useState<WalletTopUpSession[]>([]);
  const [recent, setRecent] = useState<WalletTransaction[]>([]);
  const [monthly, setMonthly] = useState<WalletMonthlyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTopUpOpen, setTopUpOpen] = useState(false);

  const topUpButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async (mode: 'initial' | 'silent' = 'initial') => {
    // A live refresh keeps the current figures on screen and swaps them when
    // the new ones land. Flashing a skeleton every time money moves would make
    // a settled screen look unstable.
    if (mode !== 'silent') {
      setIsLoading(true);
      onLoadingChange(true);
    }
    setError(null);
    try {
      const [overview, summary] = await Promise.all([
        fetchWallet(),
        fetchWalletSummary(6),
      ]);
      setWallet(overview.wallet);
      setPendingTopUp(overview.pendingTopUp);
      setPendingSessions(overview.pendingSessions);
      setRecent(overview.recentTransactions);
      setMonthly(summary.monthly);
    } catch (err) {
      // A background refresh failing must not wipe out good data that is
      // already on screen.
      if (mode === 'silent') return;

      const message =
        err instanceof WalletApiError && err.isUnauthorized
          ? 'Your session has expired. Sign in again to see your wallet.'
          : err instanceof Error
            ? err.message
            : 'Could not load your wallet.';
      setError(message);
      setWallet(null);
      setRecent([]);
      setMonthly([]);
      setPendingSessions([]);
    } finally {
      if (mode !== 'silent') {
        setIsLoading(false);
        onLoadingChange(false);
      }
    }
  }, [onLoadingChange]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (liveRefreshKey) void load('silent');
  }, [liveRefreshKey, load]);

  const displayBalance = useCountUp(wallet?.balance ?? 0);

  // pendingSessions comes back newest first, so the last one is the oldest —
  // that is the wait worth reporting, not the most recent click.
  const oldestPending = pendingSessions[pendingSessions.length - 1] ?? null;

  const thisMonth = useMemo(
    () => monthly[monthly.length - 1] ?? { month: '', credited: 0, debited: 0, net: 0 },
    [monthly],
  );

  const chartMax = useMemo(
    () => Math.max(...monthly.flatMap((point) => [point.credited, point.debited]), 0),
    [monthly],
  );

  if (isLoading) {
    return (
      <div className="wallet-grid balance-row" aria-busy="true">
        <div className="wallet-skeleton-block tall" />
        <div className="wallet-skeleton-block" />
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="card-base">
        <WalletState
          title="Couldn't load your wallet"
          body={error ?? 'Something went wrong.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </div>
    );
  }

  const currency = wallet.currency;
  const neverUsed = recent.length === 0 && wallet.balance === 0;

  return (
    <>
      <div className="wallet-grid balance-row">
        <section className="wallet-balance">
          <span className="wallet-balance-label">Available balance</span>

          <div className="wallet-balance-figure">
            <span className="wallet-balance-value">
              {formatAmount(displayBalance, currency)}
            </span>
            <span className="wallet-balance-currency">{currency}</span>
          </div>

          <span className="wallet-balance-meta">
            Updated {formatRelativeTime(wallet.updatedAt)}
          </span>

          {wallet.isLocked ? (
            <div className="wallet-locked-notice">
              <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Spending is paused on this wallet. Contact support to resolve it.
              </span>
            </div>
          ) : (
            <button
              className="wallet-primary-btn"
              ref={topUpButtonRef}
              onClick={() => setTopUpOpen(true)}
            >
              <Plus size={15} />
              <span>Add funds</span>
            </button>
          )}

          {pendingTopUp > 0 && (
            <span className="wallet-pending">
              <Clock size={13} />
              {formatAmount(pendingTopUp, currency)} awaiting payment
              {oldestPending ? ` · started ${formatRelativeTime(oldestPending.createdAt)}` : ''}
              {' · '}
              <button
                className="wallet-link-btn"
                style={{ padding: 0, fontSize: 12 }}
                onClick={onViewAll}
              >
                Manage
              </button>
            </span>
          )}

          {neverUsed && !wallet.isLocked && (
            <span className="wallet-balance-meta">
              Add funds to pay for API usage without entering a card each time.
            </span>
          )}
        </section>

        <section className="card-base wallet-card">
          <div className="wallet-card-head">
            <h3>This month</h3>
          </div>

          <div className="wallet-summary-row">
            <span className="wallet-summary-label">Added</span>
            <span className="wallet-summary-value">
              {formatAmount(thisMonth.credited, currency)}
            </span>
          </div>
          <div className="wallet-summary-row">
            <span className="wallet-summary-label">Spent</span>
            <span className="wallet-summary-value">
              {formatAmount(thisMonth.debited, currency)}
            </span>
          </div>
          <div className="wallet-summary-row">
            <span className="wallet-summary-label">Net</span>
            <span
              className={`wallet-summary-value ${thisMonth.net > 0 ? 'positive' : ''}`}
            >
              {thisMonth.net >= 0
                ? `+${formatAmount(thisMonth.net, currency)}`
                : `−${formatAmount(Math.abs(thisMonth.net), currency)}`}
            </span>
          </div>
        </section>
      </div>

      <section className="card-base wallet-card">
        <div className="wallet-card-head">
          <h3>Credits and spending</h3>
          <div className="wallet-legend">
            <span className="wallet-legend-item">
              <span className="wallet-legend-swatch credit" />
              Added
            </span>
            <span className="wallet-legend-item">
              <span className="wallet-legend-swatch debit" />
              Spent
            </span>
          </div>
        </div>

        <div
          className="wallet-chart"
          role="img"
          aria-label={`Money added and spent over the last ${monthly.length} months. ${monthly
            .map(
              (point) =>
                `${formatMonthLabel(point.month)}: added ${formatAmount(point.credited, currency)}, spent ${formatAmount(point.debited, currency)}`,
            )
            .join('. ')}`}
        >
          {monthly.map((point, index) => (
            <div className="wallet-chart-col" key={point.month}>
              <div className="wallet-chart-track" aria-hidden="true">
                <div
                  className="wallet-bar credit"
                  style={{
                    height: `${chartMax > 0 ? Math.max((point.credited / chartMax) * 100, point.credited > 0 ? 4 : 2) : 2}%`,
                    animationDelay: `${index * 40}ms`,
                  }}
                  title={`${formatMonthLabel(point.month)} added ${formatAmount(point.credited, currency)}`}
                />
                <div
                  className="wallet-bar debit"
                  style={{
                    height: `${chartMax > 0 ? Math.max((point.debited / chartMax) * 100, point.debited > 0 ? 4 : 2) : 2}%`,
                    animationDelay: `${index * 40 + 20}ms`,
                  }}
                  title={`${formatMonthLabel(point.month)} spent ${formatAmount(point.debited, currency)}`}
                />
              </div>
              <span className="wallet-chart-label">{formatMonthLabel(point.month)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card-base wallet-card">
        <div className="wallet-card-head">
          <h3>Recent activity</h3>
          {recent.length > 0 && (
            <button className="wallet-link-btn" onClick={onViewAll}>
              View all
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <WalletState
            icon={<WalletIcon size={28} color="var(--text-muted)" />}
            title="No transactions yet"
            body="Top-ups and spending will appear here."
          />
        ) : (
          <ul className="wallet-row-list">
            {recent.map((item) => (
              <li className="wallet-row" key={item.id}>
                <span className="wallet-row-date">{formatShortDate(item.createdAt)}</span>
                <span className="wallet-row-desc" title={item.description ?? undefined}>
                  {item.description ?? 'Wallet movement'}
                </span>
                <TransactionBadge type={item.type} status={item.status} />
                <span
                  className={`wallet-row-amount wallet-amount ${
                    item.direction === 'CREDIT' ? 'credit' : 'debit'
                  }`}
                >
                  {signedAmount(item.amount, item.direction, item.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isTopUpOpen && (
        <TopUpModal
          balance={wallet.balance}
          currency={currency}
          onClose={() => {
            setTopUpOpen(false);
            // Focus goes back to the button that opened the modal.
            topUpButtonRef.current?.focus();
          }}
        />
      )}
    </>
  );
};
