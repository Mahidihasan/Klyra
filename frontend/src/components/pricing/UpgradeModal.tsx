import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Shield,
  CreditCard,
  Sparkles,
  Zap,
  Lock,
  ArrowRight,
  Layers,
  Crown
} from 'lucide-react';

export interface PlanDetails {
  id: 'free' | 'plus' | 'pro' | 'enterprise';
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  headline: string;
  requests: string;
  rateLimit: string;
  keys: string;
  sla: string;
  analytics: string;
  badge?: string;
}

interface UpgradeModalProps {
  plan: PlanDetails;
  billingCycle: 'monthly' | 'annual';
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (planId: string) => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  plan,
  billingCycle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>(billingCycle);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'saved' | 'crypto'>('saved');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const unitPrice = selectedCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  const totalBilled = selectedCycle === 'annual' ? unitPrice * 12 : unitPrice;
  const savings = selectedCycle === 'annual' ? (plan.monthlyPrice - plan.annualPrice) * 12 : 0;

  const handleConfirm = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      if (onSuccess) {
        onSuccess(plan.id);
      }
    }, 1200);
  };

  return (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div
        className="upgrade-modal-dialog glass-card-elevated animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background glow effects */}
        <div className="modal-ambient-glow" />

        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        {isSuccess ? (
          <div className="modal-success-state">
            <div className="success-icon-wrapper">
              <CheckCircle2 size={56} className="success-icon" />
              <div className="success-glow" />
            </div>
            <h2 className="success-title">Plan Upgraded to {plan.name}!</h2>
            <p className="success-desc">
              Your API workload limits have been instantly bumped. Your new rate limit is{' '}
              <strong>{plan.rateLimit}</strong> with <strong>{plan.requests}</strong> monthly calls.
            </p>
            <div className="success-receipt-card">
              <div className="receipt-row">
                <span>Plan Tier</span>
                <span className="receipt-val">{plan.name} Tier</span>
              </div>
              <div className="receipt-row">
                <span>Billing Interval</span>
                <span className="receipt-val">
                  {selectedCycle === 'annual' ? 'Billed Annually' : 'Billed Monthly'}
                </span>
              </div>
              <div className="receipt-row">
                <span>Amount Paid</span>
                <span className="receipt-val highlight">${totalBilled} USD</span>
              </div>
              <div className="receipt-row">
                <span>Status</span>
                <span className="receipt-badge active">● Active & Ready</span>
              </div>
            </div>
            <button className="btn-primary-glow btn-full" onClick={onClose}>
              <span>Launch API Dashboard</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="modal-content-grid">
            {/* Left summary / specs */}
            <div className="modal-summary-panel">
              <div className="modal-plan-badge">
                <Crown size={14} />
                <span>UPGRADE TO {plan.name.toUpperCase()}</span>
              </div>

              <h2 className="modal-heading">
                Unlock {plan.name} Capability
              </h2>
              <p className="modal-subtext">
                Deploy with enterprise-grade resilience, higher throughput, and dedicated developer telemetry.
              </p>

              <div className="modal-feature-pills">
                <div className="feature-pill">
                  <Zap size={14} className="pill-icon" />
                  <span>{plan.requests} volume</span>
                </div>
                <div className="feature-pill">
                  <Sparkles size={14} className="pill-icon" />
                  <span>{plan.rateLimit} throughput</span>
                </div>
                <div className="feature-pill">
                  <Layers size={14} className="pill-icon" />
                  <span>{plan.keys} API keys</span>
                </div>
                <div className="feature-pill">
                  <Shield size={14} className="pill-icon" />
                  <span>{plan.sla} SLA uptime</span>
                </div>
              </div>

              {/* Cycle switch inside modal */}
              <div className="modal-cycle-toggle">
                <button
                  type="button"
                  className={`cycle-btn ${selectedCycle === 'monthly' ? 'active' : ''}`}
                  onClick={() => setSelectedCycle('monthly')}
                >
                  Monthly billing (${plan.monthlyPrice}/mo)
                </button>
                <button
                  type="button"
                  className={`cycle-btn ${selectedCycle === 'annual' ? 'active' : ''}`}
                  onClick={() => setSelectedCycle('annual')}
                >
                  <span>Annual (${plan.annualPrice}/mo)</span>
                  <span className="save-pill">Save 20%</span>
                </button>
              </div>

              <div className="modal-security-note">
                <Lock size={14} />
                <span>256-bit encrypted checkout. Cancel or adjust anytime.</span>
              </div>
            </div>

            {/* Right checkout / payment form */}
            <div className="modal-checkout-panel">
              <h3 className="checkout-title">Payment & Confirmation</h3>

              {/* Payment method selector */}
              <div className="payment-method-selector">
                <button
                  type="button"
                  className={`pay-tab ${paymentMethod === 'saved' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('saved')}
                >
                  <CreditCard size={15} />
                  <span>Saved Card</span>
                </button>
                <button
                  type="button"
                  className={`pay-tab ${paymentMethod === 'card' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <span>New Card</span>
                </button>
              </div>

              {paymentMethod === 'saved' ? (
                <div className="saved-card-box">
                  <div className="saved-card-header">
                    <div className="card-brand-badge">VISA</div>
                    <span className="default-pill">Default</span>
                  </div>
                  <div className="saved-card-digits">•••• •••• •••• 4242</div>
                  <div className="saved-card-footer">
                    <span>Expires 12/28</span>
                    <span>Klyra Dev Account</span>
                  </div>
                </div>
              ) : (
                <div className="new-card-form">
                  <div className="form-group">
                    <label>Card Number</label>
                    <input
                      type="text"
                      placeholder="4242 •••• •••• ••••"
                      className="glass-input"
                    />
                  </div>
                  <div className="form-row-split">
                    <div className="form-group">
                      <label>Expires</label>
                      <input type="text" placeholder="MM/YY" className="glass-input" />
                    </div>
                    <div className="form-group">
                      <label>CVC</label>
                      <input type="text" placeholder="123" className="glass-input" />
                    </div>
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="price-breakdown">
                <div className="breakdown-row">
                  <span>{plan.name} Tier ({selectedCycle === 'annual' ? '12 Months' : '1 Month'})</span>
                  <span>${selectedCycle === 'annual' ? plan.annualPrice * 12 : plan.monthlyPrice}.00</span>
                </div>
                {selectedCycle === 'annual' && savings > 0 && (
                  <div className="breakdown-row discount">
                    <span>Annual discount (20%)</span>
                    <span>-${savings}.00</span>
                  </div>
                )}
                <div className="breakdown-row">
                  <span>Estimated Tax</span>
                  <span>$0.00</span>
                </div>
                <div className="breakdown-divider" />
                <div className="breakdown-row total">
                  <span>Due Today</span>
                  <span className="total-figure">${totalBilled}.00 USD</span>
                </div>
              </div>

              {/* Action */}
              <button
                className="btn-primary-glow btn-full upgrade-submit-btn"
                disabled={isProcessing}
                onClick={handleConfirm}
              >
                {isProcessing ? (
                  <span className="spinner-label">
                    <span className="mini-spinner" />
                    <span>Authorizing upgrade...</span>
                  </span>
                ) : (
                  <span>
                    Confirm & Upgrade to {plan.name} (${totalBilled})
                  </span>
                )}
              </button>

              <div className="instant-activation-note">
                ⚡ Instant activation: Your API keys inherit new limits within 3 seconds.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
