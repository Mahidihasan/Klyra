import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { OverviewTab } from './OverviewTab';
import { TransactionsTab } from './TransactionsTab';
import { useWalletLiveRefresh } from './useWalletLiveRefresh';

export type WalletSection = 'overview' | 'transactions';

const SECTIONS: { id: WalletSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
];

export const WalletPage: React.FC = () => {
  const [section, setSection] = useState<WalletSection>('overview');
  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Push-driven: the stream bumps this key when this user's wallet changes.
  const { refreshKey: liveRefreshKey, status: liveStatus } = useWalletLiveRefresh();

  // Each tab reports its own loading state so Refresh can disable.
  const handleLoadingChange = useCallback((next: boolean) => {
    setIsLoading(next);
  }, []);

  return (
    <div className="wallet-page animate-fade-in">
      <div className="wallet-header">
        <div>
          <h1 className="wallet-title">Wallet</h1>
          <p className="wallet-subtitle">
            Your balance, top-ups and spending history.
          </p>
        </div>
        <div className="wallet-header-actions">
          <div
            className="wallet-live-indicator"
            data-status={liveStatus}
            title={
              liveStatus === 'connected'
                ? 'Live — updates as your wallet changes'
                : liveStatus === 'reconnecting'
                  ? 'Reconnecting to live updates…'
                  : 'Connecting to live updates…'
            }
          >
            <span className="wallet-live-dot" />
            <span>
              {liveStatus === 'reconnecting'
                ? 'Reconnecting'
                : liveStatus === 'connecting'
                  ? 'Connecting'
                  : 'Live'}
            </span>
          </div>
          <button
            className="wallet-refresh-btn"
            onClick={() => setRefreshToken((prev) => prev + 1)}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'wallet-spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="wallet-tabs" role="tablist">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={section === item.id}
            className={`wallet-tab ${section === item.id ? 'active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'overview' ? (
        <OverviewTab
          refreshToken={refreshToken}
          liveRefreshKey={liveRefreshKey}
          onLoadingChange={handleLoadingChange}
          onViewAll={() => setSection('transactions')}
        />
      ) : (
        <TransactionsTab
          refreshToken={refreshToken}
          liveRefreshKey={liveRefreshKey}
          onLoadingChange={handleLoadingChange}
        />
      )}

      <WalletStyles />
    </div>
  );
};

/**
 * One style block for the whole module, as every other page here does.
 *
 * Every colour, radius and font is a variable from styles/globals.css. The app
 * has a light theme driven by data-theme on the root element, so a literal hex
 * would break it. The only literals are low-alpha overlays for tints and hover
 * washes, which read correctly on both themes.
 */
const WalletStyles: React.FC = () => (
  <style>{`
    .wallet-page {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .wallet-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .wallet-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .wallet-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .wallet-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .wallet-refresh-btn {
      display: flex;
      align-items: center;
      gap: 7px;
      height: 34px;
      padding: 0 14px;
      border-radius: var(--radius-md);
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .wallet-refresh-btn:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-primary);
    }

    .wallet-refresh-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .wallet-spinning {
      animation: wallet-spin 0.9s linear infinite;
    }

    @keyframes wallet-spin {
      to { transform: rotate(360deg); }
    }

    /* Copied from .billing-live-indicator, pulse and guard included, so the
       two pages read as one product. */
    .wallet-live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      background-color: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.25);
      color: var(--status-active);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .wallet-live-indicator[data-status='connecting'],
    .wallet-live-indicator[data-status='reconnecting'] {
      background-color: rgba(234, 179, 8, 0.08);
      border-color: rgba(234, 179, 8, 0.3);
      color: var(--status-beta);
    }

    .wallet-live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
    }

    .wallet-live-indicator[data-status='connected'] .wallet-live-dot {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
      animation: wallet-live-pulse 2s infinite;
    }

    @keyframes wallet-live-pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
      70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }

    /* ---------------------------------------------------------------- tabs */

    .wallet-tabs {
      display: flex;
      gap: 22px;
      border-bottom: 1px solid var(--border-card);
      overflow-x: auto;
    }

    .wallet-tab {
      position: relative;
      padding: 0 2px 11px 2px;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: color 0.15s ease;
    }

    .wallet-tab:hover { color: var(--text-secondary); }
    .wallet-tab.active { color: var(--text-primary); }

    .wallet-tab.active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--accent-purple);
      border-radius: 2px 2px 0 0;
    }

    /* ------------------------------------------------------------- filters */

    .wallet-filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .wallet-filter {
      height: 30px;
      padding: 0 14px;
      border-radius: 999px;
      background-color: var(--bg-pill);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .wallet-filter:hover {
      color: var(--text-primary);
      border-color: var(--accent-subtle-border);
    }

    .wallet-filter.active {
      background: var(--accent-subtle);
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    /* ---------------------------------------------------------------- grid */

    .wallet-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      align-items: start;
    }

    /* The balance card is the reason the screen exists, so it takes the room
       and the month summary sits beside it. */
    .wallet-grid.balance-row {
      grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
    }

    @media (max-width: 900px) {
      .wallet-grid.balance-row { grid-template-columns: 1fr; }
    }

    .wallet-card {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .wallet-card:hover { transform: none; }

    .wallet-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 2px;
    }

    .wallet-card-head h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .wallet-link-btn {
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

    .wallet-link-btn:hover { background-color: var(--accent-subtle); }

    /* ------------------------------------------------------- balance card */

    .wallet-balance {
      padding: 20px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--accent-subtle-border);
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.10) 0%, var(--bg-card) 55%);
      box-shadow: var(--shadow-purple);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .wallet-balance-label {
      font-size: 12px;
      color: var(--text-muted);
    }

    .wallet-balance-figure {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .wallet-balance-value {
      font-size: 40px;
      font-weight: 700;
      line-height: 1.1;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .wallet-balance-currency {
      font-size: 14px;
      color: var(--text-secondary);
    }

    .wallet-balance-meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .wallet-primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      align-self: flex-start;
      height: 38px;
      padding: 0 20px;
      border-radius: var(--radius-md);
      background: var(--accent-gradient);
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: background 0.15s ease, opacity 0.15s ease;
    }

    .wallet-primary-btn:hover:not(:disabled) { background: var(--accent-gradient-hover); }

    .wallet-primary-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .wallet-pending {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--status-beta);
    }

    /* Money paid but not credited is not money you can spend, so it is stated
       separately rather than folded into the figure above. */
    .wallet-locked-notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid rgba(239, 68, 68, 0.3);
      background-color: rgba(239, 68, 68, 0.06);
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
      max-width: 52ch;
    }

    /* ---------------------------------------------------------- month rows */

    .wallet-summary-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      padding: 5px 0;
    }

    .wallet-summary-row + .wallet-summary-row {
      border-top: 1px solid var(--border-subtle);
    }

    .wallet-summary-label { color: var(--text-muted); }

    .wallet-summary-value {
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .wallet-summary-value.positive { color: var(--status-active); }

    /* --------------------------------------------------------------- chart */

    .wallet-chart {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      height: 150px;
    }

    .wallet-chart-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      height: 100%;
      min-width: 0;
    }

    .wallet-chart-track {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 3px;
    }

    .wallet-bar {
      flex: 1;
      max-width: 20px;
      border-radius: 5px 5px 2px 2px;
      transform-origin: bottom;
      animation: wallet-bar-grow 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .wallet-bar.credit { background: var(--accent-gradient); }

    .wallet-bar.debit {
      background-color: var(--bg-pill);
      border: 1px solid var(--border-card);
    }

    @keyframes wallet-bar-grow {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }

    .wallet-chart-label {
      font-size: 11px;
      color: var(--text-muted);
    }

    .wallet-legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 11px;
      color: var(--text-muted);
    }

    .wallet-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .wallet-legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }

    .wallet-legend-swatch.credit { background: var(--accent-gradient); }

    .wallet-legend-swatch.debit {
      background-color: var(--bg-pill);
      border: 1px solid var(--border-card);
    }

    /* ------------------------------------------------------ recent activity */

    .wallet-row-list {
      display: flex;
      flex-direction: column;
      list-style: none;
    }

    .wallet-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid var(--border-subtle);
    }

    .wallet-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .wallet-row-date {
      flex: 0 0 96px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .wallet-row-desc {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .wallet-row-amount {
      margin-left: auto;
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* ---------------------------------------------------------- amounts */

    /* The sign carries the meaning; colour only reinforces it. */
    .wallet-amount.credit { color: var(--status-active); }
    .wallet-amount.debit { color: var(--text-primary); }

    /* ---------------------------------------------------------- table */

    .wallet-table-card {
      padding: 0;
      overflow-x: auto;
    }

    .wallet-table-card:hover { transform: none; }

    .wallet-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 720px;
    }

    .wallet-table th {
      text-align: left;
      padding: 13px 18px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-card);
      white-space: nowrap;
    }

    .wallet-table td {
      padding: 15px 18px;
      font-size: 13px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: middle;
    }

    .wallet-table tbody tr:last-child td { border-bottom: none; }

    .wallet-table tbody tr:hover { background-color: rgba(255, 255, 255, 0.02); }

    .wallet-table .align-right { text-align: right; }

    .wallet-table td.wallet-balance-cell {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
    }

    .wallet-desc-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .wallet-desc-secondary {
      font-size: 11px;
      color: var(--text-muted);
    }

    .wallet-clickable-row { cursor: pointer; }

    .wallet-clickable-row:focus-visible {
      outline: 2px solid var(--accent-purple);
      outline-offset: -2px;
    }

    /* A row that arrived since the last render, so a credit landing while the
       screen is open is noticed rather than silently changing the total. */
    .wallet-row-new {
      animation: wallet-row-flash 1.2s ease-out both;
    }

    @keyframes wallet-row-flash {
      0% { background-color: var(--accent-subtle); }
      100% { background-color: transparent; }
    }

    /* --------------------------------------------------------------- badge */

    .wallet-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 9px;
      border-radius: 999px;
      background-color: var(--bg-pill);
      border: 1px solid var(--border-subtle);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .wallet-badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* --------------------------------------------------------- in progress */

    /* Money that has been committed but has not moved. Deliberately not a
       ledger row: it is shown apart from the table so it can never be read as
       something that already happened. */
    .wallet-pending-card {
      border-color: var(--accent-subtle-border);
    }

    .wallet-pending-row .wallet-row-desc {
      color: var(--text-secondary);
    }

    .wallet-pending-amount {
      color: var(--status-beta);
    }

    .wallet-cancel-btn {
      height: 28px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      background-color: transparent;
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .wallet-cancel-btn:hover:not(:disabled) {
      border-color: var(--status-maintenance);
      color: var(--status-maintenance);
    }

    .wallet-cancel-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .wallet-row-expiry {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .wallet-pending-note {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.55;
      max-width: 62ch;
      margin-top: 4px;
    }

    /* -------------------------------------------------------------- states */

    .wallet-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 54px 24px;
      text-align: center;
    }

    .wallet-state h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .wallet-state p {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 44ch;
      line-height: 1.55;
    }

    .wallet-retry-btn {
      margin-top: 6px;
      height: 34px;
      padding: 0 18px;
      border-radius: var(--radius-md);
      background: var(--accent-gradient);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }

    .wallet-skeleton {
      display: flex;
      flex-direction: column;
      padding: 12px 18px;
    }

    .wallet-skeleton-row,
    .wallet-skeleton-block {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.02) 25%,
        rgba(255, 255, 255, 0.05) 50%,
        rgba(255, 255, 255, 0.02) 75%
      );
      background-size: 400px 100%;
      animation: wallet-shimmer 1.3s ease-in-out infinite;
    }

    .wallet-skeleton-row {
      height: 44px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .wallet-skeleton-row:last-child { border-bottom: none; }

    .wallet-skeleton-block {
      height: 96px;
      border-radius: var(--radius-md);
    }

    .wallet-skeleton-block.tall { height: 190px; }

    @keyframes wallet-shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 400px 0; }
    }

    /* ---------------------------------------------------------- pagination */

    .wallet-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .wallet-pagination-info {
      font-size: 12px;
      color: var(--text-muted);
    }

    .wallet-pagination-controls {
      display: flex;
      gap: 6px;
    }

    .wallet-pagination-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .wallet-pagination-btn:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    .wallet-pagination-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    /* ------------------------------------------------------------ top-up */

    .tu-panel {
      width: 100%;
      max-width: 420px;
      background-color: var(--bg-modal);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow-y: auto;
    }

    .tu-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .tu-head h2 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .tu-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      background: none;
      border: none;
    }

    .tu-close:hover { color: var(--text-primary); background-color: var(--bg-card-hover); }

    .tu-body {
      padding: 20px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .tu-presets {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tu-field-label {
      font-size: 12px;
      color: var(--text-muted);
    }

    .tu-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 46px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      background-color: var(--bg-input);
      border: 1px solid var(--border-card);
      transition: border-color 0.15s ease;
    }

    .tu-input-wrap:focus-within { border-color: var(--border-focus); }

    .tu-prefix {
      font-size: 18px;
      color: var(--text-muted);
    }

    .tu-input {
      flex: 1;
      min-width: 0;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 18px;
      font-family: inherit;
      font-variant-numeric: tabular-nums;
    }

    .tu-input::-webkit-outer-spin-button,
    .tu-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .tu-preview {
      font-size: 13px;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .tu-error {
      font-size: 12px;
      color: var(--status-maintenance);
      line-height: 1.5;
    }

    .tu-submit {
      width: 100%;
      height: 40px;
    }

    .tu-footnote {
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
    }

    /* ------------------------------------------------------------- shared */

    .wallet-page :focus-visible,
    .tu-panel :focus-visible {
      outline: 2px solid var(--accent-purple);
      outline-offset: 2px;
    }

    .wallet-muted { color: var(--text-muted); }

    @media (max-width: 640px) {
      .wallet-balance-value { font-size: 32px; }
    }

    /* Money screens should feel settled, not lively. With reduced motion asked
       for, everything above still works — it just stops moving. */
    @media (prefers-reduced-motion: reduce) {
      .wallet-spinning,
      .wallet-live-indicator[data-status='connected'] .wallet-live-dot,
      .wallet-bar,
      .wallet-row-new,
      .wallet-skeleton-row,
      .wallet-skeleton-block {
        animation: none;
      }

      .wallet-bar { transform: none; }

      .wallet-refresh-btn,
      .wallet-primary-btn,
      .wallet-filter,
      .wallet-pagination-btn,
      .wallet-cancel-btn,
      .wallet-card,
      .tu-input-wrap {
        transition: none;
      }
    }
  `}</style>
);
