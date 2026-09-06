import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Plus, Trash2, Check } from 'lucide-react';
import { billingApi, BillingApiError } from '../../services/api/billing';
import { PaymentMethod } from '../../types/billing';
import { BillingState } from './shared';
import { PendingTab } from './PendingTab';

const BRAND_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
};

function brandLabel(brand: string): string {
  return BRAND_LABEL[brand.toLowerCase()] ?? brand;
}

function expiryLabel(month: number, year: number): string {
  if (!month || !year) return 'Expiry unknown';
  return `Expires ${String(month).padStart(2, '0')}/${year}`;
}

function isExpired(month: number, year: number): boolean {
  if (!month || !year) return false;
  const now = new Date();
  // A card is valid through the last day of its expiry month.
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

interface PaymentMethodsTabProps {
  refreshToken: number;
  /** Bumped on the live-refresh interval; triggers a silent background reload. */
  liveRefreshKey?: number;
  onLoadingChange: (isLoading: boolean) => void;
}

export const PaymentMethodsTab: React.FC<PaymentMethodsTabProps> = ({
  refreshToken,
  liveRefreshKey,
  onLoadingChange,
}) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeMissing, setStripeMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isStartingSetup, setIsStartingSetup] = useState(false);

  const loadMethods = useCallback(
    async (mode: 'initial' | 'silent' = 'initial') => {
      // Silent (live) refreshes keep the current list on screen instead of
      // flashing the skeleton; only the initial load / manual refresh shows it.
      if (mode !== 'silent') {
        setIsLoading(true);
        onLoadingChange(true);
      }
      setError(null);
      try {
        const result = await billingApi.fetchPaymentMethods();
        setMethods(result.paymentMethods);
        setStripeMissing(false);
      } catch (err) {
        // Stripe not being configured isn't a failure — it's a known gap, so the
        // screen explains it instead of showing an error.
        if (err instanceof BillingApiError && err.code === 'STRIPE_NOT_CONFIGURED') {
          setStripeMissing(true);
        } else if (mode !== 'silent') {
          // A background refresh failing shouldn't wipe out the last good data.
          setError(err instanceof Error ? err.message : 'Could not load payment methods.');
        }
        setMethods([]);
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
    loadMethods();
  }, [loadMethods, refreshToken]);

  // Live poll: re-sync silently whenever the interval bumps the key.
  useEffect(() => {
    if (liveRefreshKey) loadMethods('silent');
  }, [liveRefreshKey, loadMethods]);

  const handleAddCard = async () => {
    setIsStartingSetup(true);
    setError(null);
    try {
      const { url } = await billingApi.createCardSetupSession(window.location.href);
      // Card details are entered on Stripe's page, never in this app.
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start card setup.');
      setIsStartingSetup(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await billingApi.setDefaultPaymentMethod(id);
      await loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the default card.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (method: PaymentMethod) => {
    const confirmed = window.confirm(
      `Remove ${brandLabel(method.brand)} ending ${method.last4}?`,
    );
    if (!confirmed) return;

    setBusyId(method.id);
    setError(null);
    try {
      await billingApi.removePaymentMethod(method.id);
      await loadMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the card.');
    } finally {
      setBusyId(null);
    }
  };

  if (stripeMissing) {
    return <PendingTab kind="methods" />;
  }

  return (
    <div className="pm-wrap">
      {error && <div className="pm-error">{error}</div>}

      <div className="card-base pm-card">
        {isLoading ? (
          <div className="pm-skeleton">
            <div className="pm-skeleton-row" />
            <div className="pm-skeleton-row" />
          </div>
        ) : methods.length === 0 ? (
          <BillingState
            icon={<CreditCard size={28} color="var(--text-muted)" />}
            title="No cards saved"
            body="Add a card to pay invoices automatically when they're issued."
            actionLabel={isStartingSetup ? 'Opening Stripe…' : 'Add a card'}
            onAction={isStartingSetup ? undefined : handleAddCard}
          />
        ) : (
          <ul className="pm-list">
            {methods.map((method) => {
              const expired = isExpired(method.expMonth, method.expYear);
              return (
                <li key={method.id} className="pm-row">
                  <div className="pm-icon">
                    <CreditCard size={18} color="var(--text-secondary)" />
                  </div>

                  <div className="pm-main">
                    <div className="pm-name">
                      <span>
                        {brandLabel(method.brand)} ···· {method.last4}
                      </span>
                      {method.isDefault && <span className="pm-default-badge">Default</span>}
                      {expired && <span className="pm-expired-badge">Expired</span>}
                    </div>
                    <div className="pm-expiry">
                      {expiryLabel(method.expMonth, method.expYear)}
                    </div>
                  </div>

                  <div className="pm-actions">
                    {!method.isDefault && (
                      <button
                        className="pm-action"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={busyId === method.id}
                      >
                        <Check size={13} />
                        <span>Make default</span>
                      </button>
                    )}
                    <button
                      className="pm-action danger"
                      onClick={() => handleRemove(method)}
                      disabled={busyId === method.id}
                      aria-label={`Remove card ending ${method.last4}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {methods.length > 0 && (
        <button className="pm-add-btn" onClick={handleAddCard} disabled={isStartingSetup}>
          <Plus size={15} />
          <span>{isStartingSetup ? 'Opening Stripe…' : 'Add a card'}</span>
        </button>
      )}

      <p className="pm-note">
        Cards are stored by Stripe, not by Klyra. You&apos;ll enter card details on
        Stripe&apos;s own page and return here when you&apos;re done.
      </p>

      <style>{`
        .pm-wrap {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: flex-start;
        }

        .pm-error {
          width: 100%;
          padding: 11px 14px;
          border-radius: var(--radius-md);
          background-color: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--status-maintenance);
          font-size: 13px;
        }

        .pm-card {
          width: 100%;
          padding: 0;
        }

        .pm-card:hover {
          transform: none;
        }

        .pm-list {
          list-style: none;
          display: flex;
          flex-direction: column;
        }

        .pm-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .pm-row:last-child {
          border-bottom: none;
        }

        .pm-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background-color: var(--bg-pill);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .pm-main {
          flex: 1;
          min-width: 0;
        }

        .pm-name {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .pm-default-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          background-color: rgba(34, 197, 94, 0.15);
          color: var(--status-active);
        }

        .pm-expired-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          background-color: rgba(239, 68, 68, 0.15);
          color: var(--status-maintenance);
        }

        .pm-expiry {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 3px;
        }

        .pm-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .pm-action {
          display: flex;
          align-items: center;
          gap: 5px;
          height: 30px;
          padding: 0 11px;
          border-radius: var(--radius-sm);
          background-color: transparent;
          border: 1px solid var(--border-card);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pm-action:hover:not(:disabled) {
          border-color: var(--accent-subtle-border);
          color: var(--text-accent);
        }

        .pm-action.danger:hover:not(:disabled) {
          border-color: rgba(239, 68, 68, 0.4);
          color: var(--status-maintenance);
        }

        .pm-action:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .pm-add-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 0 18px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          border: none;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .pm-add-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .pm-note {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
          max-width: 56ch;
        }

        .pm-skeleton {
          padding: 12px 18px;
        }

        .pm-skeleton-row {
          height: 52px;
          border-bottom: 1px solid var(--border-subtle);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.02) 25%,
            rgba(255, 255, 255, 0.05) 50%,
            rgba(255, 255, 255, 0.02) 75%
          );
          background-size: 400px 100%;
          animation: pm-shimmer 1.3s ease-in-out infinite;
        }

        .pm-skeleton-row:last-child {
          border-bottom: none;
        }

        @keyframes pm-shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 400px 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pm-skeleton-row { animation: none; }
        }
      `}</style>
    </div>
  );
};
