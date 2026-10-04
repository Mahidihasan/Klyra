import React, { useEffect, useState, useMemo } from 'react';
import {
  CreditCard,
  Calendar,
  ArrowRight,
  Download,
  ShieldCheck,
  PackageOpen,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { billingApi } from '../../../services/api/billing';
import { adminApi } from '../../../services/api/admin';
import { BillingOverview, Invoice } from '../../../types/billing';
import { PlatformSubscriptionDetails } from '../../../types/adminUsers';

interface KlyraSubscriptionSegmentProps {
  onNavigateTab?: (tab: string) => void;
}

interface RealPlatformSubscription {
  planName: string;
  status: string;
  renewalDate: string | null;
  billingCycle: string | null;
  paymentMethod: string | null;
  nextChargeAmount: string | null;
  quota?: {
    used: number;
    limit: number;
  };
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const KlyraSubscriptionSegment: React.FC<KlyraSubscriptionSegmentProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [adminSub, setAdminSub] = useState<PlatformSubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load real billing and platform subscription data
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    const promises: Promise<any>[] = [
      billingApi.fetchOverview().catch(() => null),
    ];

    if (user?.id) {
      promises.push(adminApi.getSubscriptionDetails(user.id).catch(() => null));
    }

    Promise.all(promises)
      .then(([overviewData, subData]) => {
        if (!mounted) return;
        if (overviewData) setBillingOverview(overviewData);
        if (subData) setAdminSub(subData);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Derive real platform subscription details if any real subscription exists
  const realSubscription = useMemo<RealPlatformSubscription | null>(() => {
    // 1. Check if admin subscription details returned an active paid tier or override
    if (adminSub && adminSub.status === 'ACTIVE' && adminSub.tier !== 'FREE') {
      const tierLabel =
        adminSub.tier === 'ENTERPRISE'
          ? 'Enterprise Plan'
          : adminSub.tier === 'PRO'
          ? 'Developer Pro Plan'
          : `${adminSub.tier} Plan`;

      return {
        planName: adminSub.override?.active ? `${tierLabel} (Override)` : tierLabel,
        status: adminSub.status,
        renewalDate: adminSub.renewalDate ? formatDate(adminSub.renewalDate) : null,
        billingCycle: adminSub.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly',
        paymentMethod:
          billingOverview?.defaultPaymentMethod
            ? `${billingOverview.defaultPaymentMethod.brand.toUpperCase()} ending in ${billingOverview.defaultPaymentMethod.last4}`
            : adminSub.paymentMethod || null,
        nextChargeAmount: billingOverview?.nextPayment
          ? `$${billingOverview.nextPayment.amount.toFixed(2)} ${billingOverview.nextPayment.currency}`
          : null,
        quota: adminSub.quota,
      };
    }

    // 2. Check if billing overview has an invoice with an active subscription plan
    const invoiceSub = billingOverview?.recentInvoices?.find((i) => i.subscription)?.subscription;
    if (invoiceSub?.plan?.name) {
      return {
        planName: invoiceSub.plan.name,
        status: invoiceSub.status || 'ACTIVE',
        renewalDate: billingOverview?.nextPayment?.dueDate
          ? formatDate(billingOverview.nextPayment.dueDate)
          : invoiceSub.periodEnd
          ? formatDate(invoiceSub.periodEnd)
          : null,
        billingCycle: 'Monthly',
        paymentMethod: billingOverview?.defaultPaymentMethod
          ? `${billingOverview.defaultPaymentMethod.brand.toUpperCase()} ending in ${billingOverview.defaultPaymentMethod.last4}`
          : null,
        nextChargeAmount: billingOverview?.nextPayment
          ? `$${billingOverview.nextPayment.amount.toFixed(2)} ${billingOverview.nextPayment.currency}`
          : null,
      };
    }

    return null;
  }, [adminSub, billingOverview]);

  const invoices: Invoice[] = billingOverview?.recentInvoices || [];
  const paymentMethod = billingOverview?.defaultPaymentMethod;

  if (isLoading) {
    return (
      <div className="subscriptions-segment-view">
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px' }}>
          <div
            className="klyra-card-base"
            style={{ height: '240px', background: 'rgba(255, 255, 255, 0.02)', animation: 'pulseDot 1.5s infinite ease-in-out' }}
          />
          <div
            className="klyra-card-base"
            style={{ height: '240px', background: 'rgba(255, 255, 255, 0.02)', animation: 'pulseDot 1.5s infinite ease-in-out' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="subscriptions-segment-view">
      {realSubscription ? (
        /* Real Active Platform Subscription State */
        <div className="klyra-sub-grid">
          {/* Real Plan Hero Card */}
          <div className="klyra-plan-hero-card">
            <div>
              <div className="klyra-plan-header">
                <div>
                  <div className="klyra-plan-badge-group">
                    <span className="klyra-tier-badge">
                      <ShieldCheck size={12} />
                      <span>Platform Plan</span>
                    </span>
                    <span className="klyra-status-badge active">
                      <span className="klyra-status-dot" />
                      <span>{realSubscription.status}</span>
                    </span>
                  </div>
                  {realSubscription.planName && (
                    <h2 className="klyra-plan-name">{realSubscription.planName}</h2>
                  )}
                </div>

                {realSubscription.nextChargeAmount && (
                  <div className="klyra-price-wrap">
                    <div className="klyra-price-number">{realSubscription.nextChargeAmount}</div>
                    <span className="klyra-price-cycle">
                      {realSubscription.billingCycle ? `/${realSubscription.billingCycle.toLowerCase()}` : '/cycle'}
                    </span>
                  </div>
                )}
              </div>

              {/* Real Quota Usage if available */}
              {realSubscription.quota && (
                <div className="klyra-quota-card">
                  <div className="klyra-quota-labels">
                    <span className="klyra-quota-label-text">Platform API Usage (30d)</span>
                    <span className="klyra-quota-value-text">
                      {realSubscription.quota.used.toLocaleString()} / {realSubscription.quota.limit.toLocaleString()} calls
                    </span>
                  </div>
                  <div className="klyra-progress-track">
                    <div
                      className="klyra-progress-bar"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(4, Math.round((realSubscription.quota.used / Math.max(1, realSubscription.quota.limit)) * 100))
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Management Actions */}
            <div className="klyra-plan-actions">
              {onNavigateTab && (
                <button
                  type="button"
                  className="btn-primary-gradient"
                  onClick={() => onNavigateTab('billing')}
                >
                  <CreditCard size={14} />
                  <span>Manage in Billing</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Real Billing & Renewal Details */}
          <div className="klyra-billing-side-stack">
            <div className="klyra-card-base">
              <div className="klyra-card-head">
                <div className="klyra-card-title">
                  <Calendar size={16} />
                  <span>Billing & Renewal</span>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    className="klyra-card-action-link"
                    onClick={() => onNavigateTab('billing')}
                  >
                    <span>Invoices</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {realSubscription.renewalDate && (
                <div className="klyra-detail-row">
                  <span className="detail-label">Renewal Date</span>
                  <span className="detail-val">{realSubscription.renewalDate}</span>
                </div>
              )}

              {realSubscription.nextChargeAmount && (
                <div className="klyra-detail-row">
                  <span className="detail-label">Next Scheduled Charge</span>
                  <span className="detail-val" style={{ color: 'var(--text-accent)' }}>
                    {realSubscription.nextChargeAmount}
                  </span>
                </div>
              )}

              {realSubscription.billingCycle && (
                <div className="klyra-detail-row">
                  <span className="detail-label">Billing Cycle</span>
                  <span className="detail-val">{realSubscription.billingCycle}</span>
                </div>
              )}

            </div>

            {/* Payment Method Card */}
            {paymentMethod && (
              <div className="klyra-card-base">
                <div className="klyra-card-head">
                  <div className="klyra-card-title">
                    <CreditCard size={16} />
                    <span>Payment Method</span>
                  </div>
                  {onNavigateTab && (
                    <button
                      type="button"
                      className="klyra-card-action-link"
                      onClick={() => onNavigateTab('billing')}
                    >
                      <span>Manage</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                <div className="klyra-payment-method-pill">
                  <div className="klyra-card-brand-icon">
                    {paymentMethod.brand.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      •••• •••• •••• {paymentMethod.last4}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                      {paymentMethod.isDefault ? ' · Primary' : ''}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Proper Empty State: No active paid Klyra Platform Subscription */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="klyra-card-base" style={{ padding: '42px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-accent)'
            }}>
              <PackageOpen size={26} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              No Active Klyra Platform Subscription
            </h3>

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.5, margin: 0 }}>
              No active Klyra platform subscription was found for this account.
            </p>

            {onNavigateTab && (
              <button
                type="button"
                className="btn-primary-gradient"
                style={{ marginTop: '8px' }}
                onClick={() => onNavigateTab('billing')}
              >
                <CreditCard size={15} />
                <span>Manage Billing & Plans</span>
              </button>
            )}
          </div>

          {/* If Saved Payment Method Exists, Display It */}
          {paymentMethod && (
            <div className="klyra-card-base">
              <div className="klyra-card-head">
                <div className="klyra-card-title">
                  <CreditCard size={15} />
                  <span>Saved Payment Method</span>
                </div>
              </div>
              <div className="klyra-payment-method-pill">
                <div className="klyra-card-brand-icon">
                  {paymentMethod.brand.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    •••• •••• •••• {paymentMethod.last4}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Real Recent Platform Invoices if any exist */}
      {invoices.length > 0 && (
        <div className="klyra-card-base klyra-invoices-section">
          <div className="klyra-card-head">
            <div className="klyra-card-title">
              <Download size={16} />
              <span>Platform Invoices</span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                className="klyra-card-action-link"
                onClick={() => onNavigateTab('billing')}
              >
                <span>View all in Billing</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          <table className="klyra-invoices-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inv.invoiceNumber}
                  </td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${inv.amount.toFixed(2)} {inv.currency}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background:
                          inv.status === 'PAID'
                            ? 'rgba(34, 197, 94, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                        color: inv.status === 'PAID' ? '#4ade80' : '#fbbf24',
                      }}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <a
                      href={billingApi.invoicePdfUrl(inv.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="invoice-pdf-download-btn"
                    >
                      <Download size={11} />
                      <span>PDF</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
