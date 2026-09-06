import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getDevUserId } from '../../config/devAuth';
import { OverviewTab } from './OverviewTab';
import { InvoicesTab } from './InvoicesTab';
import { PaymentsTab } from './PaymentsTab';
import { PaymentMethodsTab } from './PaymentMethodsTab';
import { BillingInfoTab } from './BillingInfoTab';

export type BillingSection =
  | 'overview'
  | 'payments'
  | 'invoices'
  | 'methods'
  | 'info';

const SECTIONS: { id: BillingSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payment History' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'methods', label: 'Payment Methods' },
  { id: 'info', label: 'Billing Information' },
];

export const BillingPage: React.FC = () => {
  const [section, setSection] = useState<BillingSection>('overview');
  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Each tab reports its own loading state so Refresh can disable.
  const handleLoadingChange = useCallback((next: boolean) => {
    setIsLoading(next);
  }, []);

  const devUserId = getDevUserId();

  const header = (
    <div className="billing-header">
      <div>
        <h1 className="billing-title">Billing</h1>
        <p className="billing-subtitle">
          Invoices, payments and spending for your API subscriptions.
        </p>
      </div>
      {devUserId && (
        <button
          className="billing-refresh-btn"
          onClick={() => setRefreshToken((prev) => prev + 1)}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      )}
    </div>
  );

  // Auth middleware isn't built yet, so these screens need a user id to query.
  if (!devUserId) {
    return (
      <div className="billing-page">
        {header}
        <div className="billing-notice card-base">
          <h3>No user selected</h3>
          <p>
            Billing data is scoped to a signed-in user. Sign-in isn&apos;t wired up yet,
            so set a user id for local development:
          </p>
          <code>localStorage.setItem('klyra-dev-user-id', '&lt;uuid&gt;')</code>
          <p>
            Or add <code>VITE_DEV_USER_ID</code> to{' '}
            <code>frontend/.env.development</code>, then reload.
          </p>
        </div>
        <BillingStyles />
      </div>
    );
  }

  return (
    <div className="billing-page">
      {header}

      <div className="billing-tabs" role="tablist">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={section === item.id}
            className={`billing-tab ${section === item.id ? 'active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'overview' ? (
        <OverviewTab
          refreshToken={refreshToken}
          onLoadingChange={handleLoadingChange}
          onViewInvoices={() => setSection('invoices')}
          onViewPayments={() => setSection('payments')}
          onViewMethods={() => setSection('methods')}
        />
      ) : section === 'invoices' ? (
        <InvoicesTab refreshToken={refreshToken} onLoadingChange={handleLoadingChange} />
      ) : section === 'payments' ? (
        <PaymentsTab refreshToken={refreshToken} onLoadingChange={handleLoadingChange} />
      ) : section === 'methods' ? (
        <PaymentMethodsTab
          refreshToken={refreshToken}
          onLoadingChange={handleLoadingChange}
        />
      ) : (
        <BillingInfoTab refreshToken={refreshToken} onLoadingChange={handleLoadingChange} />
      )}

      <BillingStyles />
    </div>
  );
};

const BillingStyles: React.FC = () => (
  <style>{`
    .billing-page {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .billing-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .billing-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .billing-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .billing-refresh-btn {
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

    .billing-refresh-btn:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-primary);
    }

    .billing-refresh-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .spinning {
      animation: billing-spin 0.9s linear infinite;
    }

    @keyframes billing-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinning { animation: none; }
    }

    .billing-tabs {
      display: flex;
      gap: 22px;
      border-bottom: 1px solid var(--border-card);
      overflow-x: auto;
    }

    .billing-tab {
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

    .billing-tab:hover {
      color: var(--text-secondary);
    }

    .billing-tab.active {
      color: var(--text-primary);
    }

    .billing-tab.active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--accent-purple);
      border-radius: 2px 2px 0 0;
    }

    .billing-filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .billing-filter {
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

    .billing-filter:hover {
      color: var(--text-primary);
      border-color: var(--accent-subtle-border);
    }

    .billing-filter.active {
      background: var(--accent-subtle);
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    .billing-table-card {
      padding: 0;
      overflow-x: auto;
    }

    .billing-table-card:hover {
      transform: none;
    }

    .billing-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 720px;
    }

    .billing-table th {
      text-align: left;
      padding: 13px 18px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-card);
      white-space: nowrap;
    }

    .billing-table td {
      padding: 15px 18px;
      font-size: 13px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: middle;
    }

    .billing-table tbody tr:last-child td {
      border-bottom: none;
    }

    .billing-table tbody tr:hover {
      background-color: rgba(255, 255, 255, 0.02);
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:focus-visible {
      outline: 2px solid var(--accent-purple);
      outline-offset: -2px;
    }

    .align-right {
      text-align: right;
    }

    .mono-cell {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-accent);
    }

    .stacked-cell {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }

    .stacked-primary {
      font-weight: 600;
    }

    .stacked-secondary {
      font-size: 11px;
      color: var(--text-muted);
    }

    .failure-note {
      font-size: 11px;
      color: var(--status-maintenance);
      max-width: 26ch;
    }

    .amount-cell {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .muted {
      color: var(--text-muted);
    }

    .row-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .row-link:hover {
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    .billing-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 54px 24px;
      text-align: center;
    }

    .billing-state h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .billing-state p {
      font-size: 13px;
      color: var(--text-muted);
      max-width: 44ch;
      line-height: 1.55;
    }

    .billing-retry-btn {
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

    .billing-notice {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }

    .billing-notice h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .billing-notice p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 62ch;
    }

    .billing-notice code {
      font-family: var(--font-mono);
      font-size: 12px;
      background-color: var(--bg-input);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      color: var(--text-accent);
      display: inline-block;
    }

    .billing-notice p code {
      padding: 2px 6px;
    }

    .billing-skeleton {
      display: flex;
      flex-direction: column;
      padding: 12px 18px;
    }

    .skeleton-row {
      height: 44px;
      border-bottom: 1px solid var(--border-subtle);
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.02) 25%,
        rgba(255, 255, 255, 0.05) 50%,
        rgba(255, 255, 255, 0.02) 75%
      );
      background-size: 400px 100%;
      animation: skeleton-shimmer 1.3s ease-in-out infinite;
    }

    .skeleton-row:last-child {
      border-bottom: none;
    }

    @keyframes skeleton-shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 400px 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-row { animation: none; }
    }

    .billing-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pagination-info {
      font-size: 12px;
      color: var(--text-muted);
    }

    .pagination-controls {
      display: flex;
      gap: 6px;
    }

    .pagination-btn {
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

    .pagination-btn:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    .pagination-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `}</style>
);
