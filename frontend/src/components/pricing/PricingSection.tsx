import React, { useState, useMemo } from 'react';
import {
  Check,
  Zap,
  Sparkles,
  Shield,
  ShieldCheck,
  Crown,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  Building2,
  Sliders,
  Terminal,
  Cpu,
  Layers,
  Lock,
  Globe,
  Radio,
  FileCheck
} from 'lucide-react';
import { UpgradeModal, PlanDetails } from './UpgradeModal';
import { ContactSalesModal } from './ContactSalesModal';
import './PricingSection.css';

export interface PricingSectionProps {
  currentPlanId?: 'free' | 'plus' | 'pro' | 'enterprise';
  onPlanUpgraded?: (planId: string) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  currentPlanId = 'free',
  onPlanUpgraded,
}) => {
  const [activePlanId, setActivePlanId] = useState<'free' | 'plus' | 'pro' | 'enterprise'>(currentPlanId);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [activeView, setActiveView] = useState<'cards' | 'matrix' | 'both'>('both');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanDetails | null>(null);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Workload Slider State (0 to 100)
  // Mapping: 0-15 -> Free (10K), 16-50 -> Plus (100K), 51-85 -> Pro (1M), 86-100 -> Enterprise (Custom)
  const [sliderValue, setSliderValue] = useState<number>(65);

  const recommendedFromSlider = useMemo(() => {
    if (sliderValue <= 20) return { plan: 'Free', label: 'Up to 10K requests/mo', id: 'free' };
    if (sliderValue <= 50) return { plan: 'Plus', label: '10K to 100K requests/mo', id: 'plus' };
    if (sliderValue <= 85) return { plan: 'Pro', label: '100K to 1M requests/mo (Recommended)', id: 'pro' };
    return { plan: 'Enterprise', label: '1M+ high-throughput workloads', id: 'enterprise' };
  }, [sliderValue]);

  // Plans Specification as specified by user
  const PLANS_DATA: Record<string, PlanDetails & {
    features: string[];
    isRecommended?: boolean;
    ctaText: string;
    ctaAction: 'current' | 'upgrade' | 'contact';
  }> = {
    free: {
      id: 'free',
      name: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      headline: 'For getting started',
      requests: '10,000 requests/month',
      rateLimit: '10 req/sec',
      keys: '2 API keys',
      sla: 'Best effort',
      analytics: '7-day analytics',
      features: [
        '10,000 requests/month',
        '10 req/sec',
        '2 API keys',
        '1 environment',
        '7-day analytics'
      ],
      ctaText: 'Current plan',
      ctaAction: 'current'
    },
    plus: {
      id: 'plus',
      name: 'Plus',
      monthlyPrice: 15,
      annualPrice: 12,
      headline: 'For individual developers',
      requests: '100,000 requests/month',
      rateLimit: '50 req/sec',
      keys: '10 API keys',
      sla: 'Best effort',
      analytics: '30-day analytics',
      features: [
        '100,000 requests/month',
        '50 req/sec',
        '10 API keys',
        '3 environments',
        '30-day analytics'
      ],
      ctaText: 'Upgrade to Plus',
      ctaAction: 'upgrade'
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      monthlyPrice: 49,
      annualPrice: 39,
      headline: 'For growing products',
      requests: '1,000,000 requests/month',
      rateLimit: '200 req/sec',
      keys: 'Unlimited API keys',
      sla: '99.9% SLA',
      analytics: '90-day analytics',
      isRecommended: true,
      features: [
        '1,000,000 requests/month',
        '200 req/sec',
        'Unlimited API keys',
        'Unlimited environments',
        '90-day analytics',
        '99.9% SLA',
        'Priority support'
      ],
      ctaText: 'Upgrade to Pro',
      ctaAction: 'upgrade'
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: 0,
      annualPrice: 0,
      headline: 'For large-scale systems',
      requests: 'Custom request volume',
      rateLimit: 'Dedicated throughput',
      keys: 'Unlimited API keys',
      sla: '99.99% SLA',
      analytics: '1+ year analytics',
      features: [
        'Custom request volume',
        'Dedicated throughput',
        'Custom access control',
        'Multi-region',
        '99.99% SLA',
        'SIEM export',
        'Dedicated support'
      ],
      ctaText: 'Contact Sales',
      ctaAction: 'contact'
    }
  };

  const handleCtaClick = (planKey: string) => {
    const plan = PLANS_DATA[planKey];
    if (!plan) return;

    if (plan.ctaAction === 'current' && plan.id === activePlanId) {
      return;
    }

    if (plan.ctaAction === 'contact') {
      setIsSalesModalOpen(true);
      return;
    }

    setSelectedPlanForModal(plan);
  };

  const handleModalSuccess = (planId: string) => {
    setActivePlanId(planId as any);
    if (onPlanUpgraded) {
      onPlanUpgraded(planId);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <section className="pricing-section-container animate-fade-in" id="upgrade-pro-section">
      {/* Ambient Lighting / Glow Background */}
      <div className="pricing-ambient-mesh" />
      <div className="pricing-mesh-pro-glow" />

      {/* ------------------------------------------------------------------
          1. HEADER AREA
         ------------------------------------------------------------------ */}
      <div className="pricing-header-wrapper">
        <div className="pricing-badge-pill">
          <Sparkles size={13} className="pill-star" />
          <span>KLYRA CLOUD PLANS • INSTANT PROVISIONING</span>
        </div>

        <h1 className="pricing-main-title">
          Upgrade your <span className="gradient-text">KLYRA</span> plan
        </h1>

        <p className="pricing-subtitle">
          Choose the plan that fits your API workload.
        </p>

        {/* Controls: Monthly / Annual Billing Toggle */}
        <div className="pricing-controls-bar">
          <div className="cycle-toggle-container">
            <button
              type="button"
              className={`cycle-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly billing
            </button>
            <button
              type="button"
              className={`cycle-toggle-btn ${billingCycle === 'annual' ? 'active annual-active' : ''}`}
              onClick={() => setBillingCycle('annual')}
            >
              <span>Annual billing</span>
              <span className="discount-tag">Save 20%</span>
            </button>
          </div>

          <div className="view-mode-tabs">
            <button
              type="button"
              className={`view-mode-tab ${activeView === 'cards' ? 'active' : ''}`}
              onClick={() => setActiveView('cards')}
            >
              <Layers size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-mode-tab ${activeView === 'both' ? 'active' : ''}`}
              onClick={() => setActiveView('both')}
            >
              <Sliders size={13} />
              <span>All Details</span>
            </button>
            <button
              type="button"
              className={`view-mode-tab ${activeView === 'matrix' ? 'active' : ''}`}
              onClick={() => setActiveView('matrix')}
            >
              <Radio size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          2. WORKLOAD ESTIMATOR SLIDER
         ------------------------------------------------------------------ */}
      <div className="workload-estimator-card">
        <div className="estimator-header-row">
          <div className="estimator-title-group">
            <div className="estimator-icon">
              <Cpu size={18} />
            </div>
            <div>
              <div className="estimator-title">API Workload Calculator</div>
              <div className="estimator-subtitle">
                Estimate your expected monthly consumption to find the ideal tier.
              </div>
            </div>
          </div>
          <div className="estimator-recommendation-badge">
            <span>Recommended:</span>
            <strong>{recommendedFromSlider.plan} Tier</strong>
            <span style={{ opacity: 0.6 }}>• {recommendedFromSlider.label}</span>
          </div>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="workload-range-slider"
          />
          <div className="slider-scale-ticks">
            <span>0 (Free Sandbox)</span>
            <span>10K req/mo</span>
            <span>100K (Plus)</span>
            <span>1M req/mo (Pro)</span>
            <span>5M+ (Enterprise Fleet)</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          3. FOUR PRICING CARDS (FREE -> PLUS -> PRO -> ENTERPRISE)
         ------------------------------------------------------------------ */}
      {(activeView === 'cards' || activeView === 'both') && (
        <div className="pricing-cards-grid">
          {/* 1. FREE CARD */}
          <div className={`pricing-plan-card plan-free ${activePlanId === 'free' ? 'is-current' : ''}`}>
            <div className="card-header-block">
              <div className="card-title-row">
                <span className="card-tier-name">FREE</span>
                <div className="card-tier-icon">
                  <Terminal size={16} />
                </div>
              </div>
              <div className="card-tier-desc">{PLANS_DATA.free.headline}</div>
              <div className="card-price-box">
                <span className="price-amount">$0</span>
                <span className="price-period">/ month</span>
              </div>
            </div>

            <ul className="card-features-list">
              {PLANS_DATA.free.features.map((feature, idx) => (
                <li key={idx} className="feature-item">
                  <span className="feature-check-icon">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="card-cta-container">
              {activePlanId === 'free' ? (
                <button className="plan-btn btn-current" disabled>
                  <span className="current-dot" />
                  <span>Current plan</span>
                </button>
              ) : (
                <button
                  className="plan-btn btn-current"
                  onClick={() => handleCtaClick('free')}
                >
                  <span>Downgrade to Free</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. PLUS CARD */}
          <div className={`pricing-plan-card plan-plus ${recommendedFromSlider.id === 'plus' ? 'slider-match' : ''}`}>
            <div className="card-header-block">
              <div className="card-title-row">
                <span className="card-tier-name">PLUS</span>
                <div className="card-tier-icon">
                  <Zap size={16} />
                </div>
              </div>
              <div className="card-tier-desc">{PLANS_DATA.plus.headline}</div>
              <div className="card-price-box">
                <span className="price-currency">$</span>
                <span className="price-amount">
                  {billingCycle === 'annual' ? PLANS_DATA.plus.annualPrice : PLANS_DATA.plus.monthlyPrice}
                </span>
                <span className="price-period">/ month</span>
              </div>
              {billingCycle === 'annual' && (
                <div className="annual-billed-subtext">$144 billed annually (Save $36)</div>
              )}
            </div>

            <ul className="card-features-list">
              {PLANS_DATA.plus.features.map((feature, idx) => (
                <li key={idx} className="feature-item">
                  <span className="feature-check-icon">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="card-cta-container">
              {activePlanId === 'plus' ? (
                <button className="plan-btn btn-current" disabled>
                  <span className="current-dot" />
                  <span>Current plan</span>
                </button>
              ) : (
                <button
                  className="plan-btn btn-plus"
                  onClick={() => handleCtaClick('plus')}
                >
                  <span>Upgrade to Plus</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 3. PRO CARD (HERO - SUBTLE PURPLE HIGHLIGHT) */}
          <div className={`pricing-plan-card plan-pro ${recommendedFromSlider.id === 'pro' ? 'slider-match' : ''}`}>
            <div className="pro-card-badge">
              <Crown size={12} />
              <span>MOST POPULAR</span>
            </div>

            <div className="card-header-block">
              <div className="card-title-row">
                <span className="card-tier-name">PRO</span>
                <div className="card-tier-icon">
                  <Sparkles size={16} />
                </div>
              </div>
              <div className="card-tier-desc">{PLANS_DATA.pro.headline}</div>
              <div className="card-price-box">
                <span className="price-currency">$</span>
                <span className="price-amount">
                  {billingCycle === 'annual' ? PLANS_DATA.pro.annualPrice : PLANS_DATA.pro.monthlyPrice}
                </span>
                <span className="price-period">/ month</span>
              </div>
              {billingCycle === 'annual' && (
                <div className="annual-billed-subtext">$468 billed annually (Save $120)</div>
              )}
            </div>

            <ul className="card-features-list">
              {PLANS_DATA.pro.features.map((feature, idx) => (
                <li key={idx} className="feature-item">
                  <span className="feature-check-icon">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className={idx < 2 ? 'feature-text-bold' : ''}>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="card-cta-container">
              {activePlanId === 'pro' ? (
                <button className="plan-btn btn-current" disabled>
                  <span className="current-dot" />
                  <span>Current plan</span>
                </button>
              ) : (
                <button
                  className="plan-btn btn-pro"
                  onClick={() => handleCtaClick('pro')}
                >
                  <span>Upgrade to Pro</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>

          {/* 4. ENTERPRISE CARD (SALES / CONTACT BASED) */}
          <div className={`pricing-plan-card plan-enterprise ${recommendedFromSlider.id === 'enterprise' ? 'slider-match' : ''}`}>
            <div className="card-header-block">
              <div className="card-title-row">
                <span className="card-tier-name">ENTERPRISE</span>
                <div className="card-tier-icon">
                  <Building2 size={16} />
                </div>
              </div>
              <div className="card-tier-desc">{PLANS_DATA.enterprise.headline}</div>
              <div className="card-price-box">
                <span className="price-amount">Custom</span>
              </div>
            </div>

            <ul className="card-features-list">
              {PLANS_DATA.enterprise.features.map((feature, idx) => (
                <li key={idx} className="feature-item">
                  <span className="feature-check-icon">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="card-cta-container">
              <button
                className="plan-btn btn-enterprise"
                onClick={() => handleCtaClick('enterprise')}
              >
                <span>Contact Sales</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          4. COMPARISON MATRIX TABLE
         ------------------------------------------------------------------ */}
      {(activeView === 'matrix' || activeView === 'both') && (
        <div className="pricing-matrix-section">
          <h3 className="matrix-section-title">Detailed Feature Matrix</h3>
          <p className="matrix-section-subtitle">
            Side-by-side technical breakdown across API rate limits, reliability, and security tiers.
          </p>

          <div className="matrix-table-container">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="col-feature">Workload Metric</th>
                  <th>Free</th>
                  <th>Plus</th>
                  <th className="col-pro">Pro (Recommended)</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Price */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">Price</span>
                    <span className="matrix-feature-sub">Billed {billingCycle}</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">$0/mo</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">
                      ${billingCycle === 'annual' ? PLANS_DATA.plus.annualPrice : PLANS_DATA.plus.monthlyPrice}/mo
                    </span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">
                      ${billingCycle === 'annual' ? PLANS_DATA.pro.annualPrice : PLANS_DATA.pro.monthlyPrice}/mo
                    </span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Custom</span>
                  </td>
                </tr>

                {/* 2. Requests */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">Requests</span>
                    <span className="matrix-feature-sub">Monthly quota volume</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">10K/mo</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">100K/mo</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">1M/mo</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Custom</span>
                  </td>
                </tr>

                {/* 3. Rate limit */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">Rate limit</span>
                    <span className="matrix-feature-sub">Burst concurrency threshold</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">10 req/sec</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">50 req/sec</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">200 req/sec</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Dedicated</span>
                  </td>
                </tr>

                {/* 4. API Keys */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">API Keys</span>
                    <span className="matrix-feature-sub">Active token provision limit</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">2</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">10</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">Unlimited</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Unlimited</span>
                  </td>
                </tr>

                {/* 5. Environments */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">Environments</span>
                    <span className="matrix-feature-sub">Dev, Staging, Prod isolation</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">1</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">3</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">Unlimited</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Custom</span>
                  </td>
                </tr>

                {/* 6. Analytics */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">Analytics</span>
                    <span className="matrix-feature-sub">Telemetry & log retention</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">7 days</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">30 days</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">90 days</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">1+ year</span>
                  </td>
                </tr>

                {/* 7. SLA */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">SLA</span>
                    <span className="matrix-feature-sub">Uptime commitment guarantee</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Best effort</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Best effort</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">99.9%</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">99.99%</span>
                  </td>
                </tr>

                {/* 8. Support */}
                <tr>
                  <td>
                    <span className="matrix-feature-name">Support</span>
                    <span className="matrix-feature-sub">Response time & channel</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Community</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Standard</span>
                  </td>
                  <td className="col-pro">
                    <span className="matrix-cell-val highlight">Priority</span>
                  </td>
                  <td>
                    <span className="matrix-cell-val">Dedicated</span>
                  </td>
                </tr>

                {/* Extended Technical Features */}
                <tr className="matrix-category-row">
                  <td colSpan={5}>Advanced Architecture & Governance</td>
                </tr>
                <tr>
                  <td>
                    <span className="matrix-feature-name">AI Studio Assistant</span>
                    <span className="matrix-feature-sub">Auto request generation & code</span>
                  </td>
                  <td>Basic (5/day)</td>
                  <td>50/day</td>
                  <td className="col-pro">Unlimited Pro AI</td>
                  <td>Custom fine-tuned models</td>
                </tr>
                <tr>
                  <td>
                    <span className="matrix-feature-name">SIEM & Log Streaming</span>
                    <span className="matrix-feature-sub">Splunk, Datadog, CloudWatch</span>
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td className="col-pro">Webhook export</td>
                  <td>Real-time SIEM socket</td>
                </tr>
                <tr>
                  <td>
                    <span className="matrix-feature-name">Geographic Routing</span>
                    <span className="matrix-feature-sub">Edge node distribution</span>
                  </td>
                  <td>US East</td>
                  <td>US & EU</td>
                  <td className="col-pro">Global Multi-edge (35+ PoPs)</td>
                  <td>Custom Private VPC Peering</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          5. TRUST & SECURITY STRIP
         ------------------------------------------------------------------ */}
      <div className="pricing-trust-strip">
        <div className="trust-item-card">
          <div className="trust-icon-box">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="trust-item-title">SOC 2 Type II Certified</div>
            <div className="trust-item-sub">Independently audited & verified</div>
          </div>
        </div>

        <div className="trust-item-card">
          <div className="trust-icon-box">
            <Globe size={20} />
          </div>
          <div>
            <div className="trust-item-title">99.99% Global Uptime</div>
            <div className="trust-item-sub">Distributed edge mesh infrastructure</div>
          </div>
        </div>

        <div className="trust-item-card">
          <div className="trust-icon-box">
            <Lock size={20} />
          </div>
          <div>
            <div className="trust-item-title">TLS 1.3 & mTLS Security</div>
            <div className="trust-item-sub">Zero-trust cryptographic isolation</div>
          </div>
        </div>

        <div className="trust-item-card">
          <div className="trust-icon-box">
            <FileCheck size={20} />
          </div>
          <div>
            <div className="trust-item-title">Transparent Metering</div>
            <div className="trust-item-sub">No surprise overage bills, hard caps available</div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          6. DEVELOPER FAQ ACCORDION
         ------------------------------------------------------------------ */}
      <div className="pricing-faq-section">
        <h3 className="faq-title">Frequently Asked Questions</h3>

        <div className={`faq-item ${openFaqIndex === 0 ? 'open' : ''}`}>
          <button className="faq-question-btn" onClick={() => toggleFaq(0)}>
            <span>Can I upgrade or downgrade my plan at any time?</span>
            <ChevronDown size={16} className="faq-arrow" />
          </button>
          {openFaqIndex === 0 && (
            <div className="faq-answer-content">
              Yes, absolutely. Upgrades to Plus or Pro take effect immediately with new rate limits
              and quotas unlocked within seconds. Upgrades are prorated based on the remainder of your
              billing period. Downgrades take effect at the end of the current billing cycle.
            </div>
          )}
        </div>

        <div className={`faq-item ${openFaqIndex === 1 ? 'open' : ''}`}>
          <button className="faq-question-btn" onClick={() => toggleFaq(1)}>
            <span>What happens if I exceed my monthly request limit?</span>
            <ChevronDown size={16} className="faq-arrow" />
          </button>
          {openFaqIndex === 1 && (
            <div className="faq-answer-content">
              We never cut off your production traffic abruptly. On Pro and Plus, you can configure
              soft limits with alert webhooks, or enable automatic overage blocks to prevent unexpected costs.
              Our priority support team is notified to assist high-growth bursts.
            </div>
          )}
        </div>

        <div className={`faq-item ${openFaqIndex === 2 ? 'open' : ''}`}>
          <button className="faq-question-btn" onClick={() => toggleFaq(2)}>
            <span>How does the 99.9% and 99.99% SLA work?</span>
            <ChevronDown size={16} className="faq-arrow" />
          </button>
          {openFaqIndex === 2 && (
            <div className="faq-answer-content">
              Our Pro plan includes a 99.9% uptime guarantee with credit-backed guarantees. Enterprise
              includes an ironclad 99.99% SLA with dedicated ingress proxies, multi-cloud redundancy,
              and 24/7 pager escalation with our infrastructure team.
            </div>
          )}
        </div>

        <div className={`faq-item ${openFaqIndex === 3 ? 'open' : ''}`}>
          <button className="faq-question-btn" onClick={() => toggleFaq(3)}>
            <span>Do you offer custom invoicing or ACH / Wire payments?</span>
            <ChevronDown size={16} className="faq-arrow" />
          </button>
          {openFaqIndex === 3 && (
            <div className="faq-answer-content">
              Yes. Enterprise plans support PO generation, Net 30/60 invoicing, ACH, wire transfers,
              and customized Master Services Agreements (MSA) tailored to your legal department.
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------
          7. MODALS
         ------------------------------------------------------------------ */}
      {selectedPlanForModal && (
        <UpgradeModal
          plan={selectedPlanForModal}
          billingCycle={billingCycle}
          isOpen={Boolean(selectedPlanForModal)}
          onClose={() => setSelectedPlanForModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {isSalesModalOpen && (
        <ContactSalesModal
          isOpen={isSalesModalOpen}
          onClose={() => setIsSalesModalOpen(false)}
        />
      )}
    </section>
  );
};
