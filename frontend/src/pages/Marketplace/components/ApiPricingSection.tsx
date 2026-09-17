import React, { useState } from 'react';
import {
  Check,
  Zap,
  Shield,
  HelpCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Building2,
  ArrowRight,
  Send,
  X,
  Sliders,
  CheckCircle2,
  Layers,
  Lock,
  MessageSquare,
  Flame,
  Gift,
  Copy,
  Award,
} from 'lucide-react';
import { CatalogApi, CatalogPricingPlan } from '../../../services/api/catalog';

interface ApiPricingSectionProps {
  api: CatalogApi;
  onSubscribe: (planId: string) => void;
  subscribingPlan: string | null;
  onOpenTester?: (api: CatalogApi) => void;
}

interface NormalizedTier {
  id: string;
  name: string;
  badge?: string;
  kicker: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  rateLimit: number;
  requestsQuota: string;
  isPopular?: boolean;
  ctaText: string;
  type: 'free' | 'starter' | 'pro' | 'paygo' | 'enterprise';
}

export const ApiPricingSection: React.FC<ApiPricingSectionProps> = ({
  api,
  onSubscribe,
  subscribingPlan,
  onOpenTester,
}) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string>('tier-pro');
  const [showComparison, setShowComparison] = useState(false);
  const [monthlyRequests, setMonthlyRequests] = useState<number>(250000);
  const [promoCopied, setPromoCopied] = useState(false);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);
  const [enterpriseFormData, setEnterpriseFormData] = useState({
    company: '',
    email: '',
    expectedVolume: '10M+ requests/mo',
    customNeeds: '',
  });

  const handleCopyPromo = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('KLYRA-ACCEL-2026');
    setPromoCopied(true);
    setTimeout(() => setPromoCopied(false), 2500);
  };

  // Dynamically normalize or construct intelligent tiers based on api.pricingPlans and api.pricingModel
  const buildNormalizedTiers = (): NormalizedTier[] => {
    const rawPlans = api.pricingPlans || [];

    if (rawPlans.length >= 2) {
      return rawPlans.map((plan, idx) => {
        const isFree = plan.price === 0;
        const isPopular = idx === 1 || plan.name.toLowerCase().includes('pro');
        return {
          id: plan.id,
          name: plan.name,
          badge: isPopular ? 'Most Popular' : undefined,
          kicker: isFree ? 'For Prototyping' : isPopular ? 'Best for Scale' : 'For Growing Teams',
          monthlyPrice: plan.price,
          annualPrice: Math.round(plan.price * 0.8),
          description: plan.description || `Full access to ${api.name} endpoints.`,
          features:
            plan.features && plan.features.length > 0
              ? plan.features
              : [
                  'Production endpoint access',
                  'Standard JSON payloads',
                  'Community & email support',
                ],
          rateLimit: plan.rateLimit || 120 * (idx + 1),
          requestsQuota: isFree ? '10,000 req/mo' : `${((idx + 1) * 250).toLocaleString()}k req/mo`,
          isPopular,
          ctaText: isFree ? 'Get Started Free' : 'Subscribe to Plan',
          type: isFree ? 'free' : isPopular ? 'pro' : 'starter',
        };
      });
    }

    // Default premium interactive tiers matching Klyra standards
    return [
      {
        id: 'tier-free',
        name: 'Developer Sandbox',
        kicker: 'Free Forever',
        monthlyPrice: 0,
        annualPrice: 0,
        description: 'Zero commitment sandbox environment for prototyping and testing.',
        features: [
          '10,000 sandbox requests / mo',
          'Rate limit: 60 requests / min',
          'Standard public edge routing',
          'Community Discord support',
          'OpenAPI 3.1 documentation',
        ],
        rateLimit: 60,
        requestsQuota: '10,000 req/mo',
        ctaText: 'Start Free Trial',
        type: 'free',
      },
      {
        id: 'tier-starter',
        name: 'Starter Pro',
        kicker: 'For Indie Builders',
        monthlyPrice: 29,
        annualPrice: 23,
        description: 'Essential throughput and email support for production MVPs.',
        features: [
          '250,000 production requests / mo',
          'Rate limit: 300 requests / min',
          'Automated error alerts & logs',
          'Standard email SLA (< 24h)',
          'Custom webhook notifications',
        ],
        rateLimit: 300,
        requestsQuota: '250,000 req/mo',
        ctaText: 'Subscribe Starter',
        type: 'starter',
      },
      {
        id: 'tier-pro',
        name: 'Scale & Team',
        badge: 'Recommended for AI Apps',
        kicker: 'Maximum Value',
        monthlyPrice: 99,
        annualPrice: 79,
        description: 'High concurrency, sub-millisecond edge caching, and priority routing.',
        features: [
          '2,000,000 production requests / mo',
          'Rate limit: 1,200 requests / min',
          'P99 latency guarantee at edge',
          '99.9% Uptime SLA commitment',
          'Priority email & Slack support',
          'Idempotency & batch processing',
        ],
        rateLimit: 1200,
        requestsQuota: '2,000,000 req/mo',
        isPopular: true,
        ctaText: 'Subscribe Scale',
        type: 'pro',
      },
    ];
  };

  const tiers = buildNormalizedTiers();

  // Calculation for Pay-As-You-Go
  const calculatePaygoCost = (requests: number): number => {
    const freeAllowance = 10000;
    const billable = Math.max(0, requests - freeAllowance);
    // Rate: $0.80 per 1,000 requests ($0.0008/req)
    return Number(((billable / 1000) * 0.8).toFixed(2));
  };

  const paygoCost = calculatePaygoCost(monthlyRequests);

  // Determine smart recommendation
  const getSmartRecommendation = (requests: number) => {
    if (requests <= 25000) {
      return {
        text: 'The Developer Sandbox plan covers your current volume at $0/mo.',
        tier: 'Developer Sandbox',
        saving: null,
      };
    }
    if (requests > 25000 && requests <= 150000) {
      const saving = (calculatePaygoCost(requests) - (isAnnual ? 23 : 29)).toFixed(0);
      return {
        text: `Starter Pro is ideal here. Save ~$${Math.max(
          0,
          Number(saving),
        )}/mo compared to variable Pay-As-You-Go.`,
        tier: 'Starter Pro',
        saving,
      };
    }
    const teamCost = isAnnual ? 79 : 99;
    const saving = (calculatePaygoCost(requests) - teamCost).toFixed(0);
    return {
      text: `At ${requests.toLocaleString()} req/mo, the Scale & Team tier saves you ~$${Math.max(
        0,
        Number(saving),
      )}/mo with priority SLAs!`,
      tier: 'Scale & Team',
      saving,
    };
  };

  const recommendation = getSmartRecommendation(monthlyRequests);

  const handleEnterpriseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnterpriseSubmitted(true);
    setTimeout(() => {
      setIsEnterpriseModalOpen(false);
      setEnterpriseSubmitted(false);
    }, 2200);
  };

  return (
    <div className="aps-container">
      {/* Intro & Billing Switcher */}
      <div className="aps-top-bar">
        <div className="aps-intro-copy">
          <div className="aps-kicker">
            <Sparkles size={13} />
            <span>TRANSPARENT VALUE-BASED ACCESS</span>
          </div>
          <h2 className="aps-title">Predictable Pricing Built to Scale</h2>
          <p className="aps-subtitle">
            Choose a plan calibrated for your application. Upgrade, downgrade, or switch to elastic
            Pay-As-You-Go anytime with zero vendor lock-in.
          </p>
        </div>

        {/* Monthly / Annual Billing Toggle */}
        <div className="aps-billing-toggle-card">
          <div className="aps-billing-toggle">
            <button
              className={`aps-toggle-btn ${!isAnnual ? 'active' : ''}`}
              onClick={() => setIsAnnual(false)}
            >
              Monthly Billing
            </button>
            <button
              className={`aps-toggle-btn ${isAnnual ? 'active' : ''}`}
              onClick={() => setIsAnnual(true)}
            >
              <span>Annual Billing</span>
              <span className="aps-save-badge">Save 20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tier Cards Grid */}
      <div className="aps-tiers-grid">
        {tiers.map((tier) => {
          const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
          const isSelected = selectedTierId === tier.id;
          const isSubscribing = subscribingPlan === tier.id;

          return (
            <div
              key={tier.id}
              className={`aps-tier-card ${tier.isPopular ? 'popular' : ''} ${
                isSelected ? 'selected' : ''
              }`}
              onClick={() => setSelectedTierId(tier.id)}
            >
              {tier.badge && (
                <div className="aps-popular-badge">
                  <Flame size={12} />
                  <span>{tier.badge}</span>
                </div>
              )}

              <div className="aps-card-header">
                <span className="aps-card-kicker">{tier.kicker}</span>
                <h3 className="aps-plan-name">{tier.name}</h3>
                <p className="aps-plan-desc">{tier.description}</p>
              </div>

              <div className="aps-price-row">
                <div className="aps-price-wrap">
                  <span className="aps-currency">$</span>
                  <span className="aps-amount">{price}</span>
                  <span className="aps-interval">{price === 0 ? 'forever' : '/ month'}</span>
                </div>
                {isAnnual && price > 0 && (
                  <span className="aps-annual-note">Billed annually (${price * 12}/yr)</span>
                )}
              </div>

              <div className="aps-quota-pill">
                <Zap size={13} className="aps-quota-icon" />
                <span>{tier.requestsQuota}</span>
                <span className="aps-quota-dot">·</span>
                <span>{tier.rateLimit} req/min</span>
              </div>

              <div className="aps-features-list">
                {tier.features.map((feature, i) => (
                  <div key={i} className="aps-feature-item">
                    <Check size={14} className="aps-feature-check" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={`aps-subscribe-btn ${tier.isPopular ? 'popular' : ''}`}
                disabled={isSubscribing}
                onClick={(e) => {
                  e.stopPropagation();
                  onSubscribe(tier.id);
                }}
              >
                {isSubscribing ? (
                  <span>Subscribing...</span>
                ) : (
                  <>
                    <span>{tier.ctaText}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          );
        })}

        {/* Pay-As-You-Go Card */}
        <div
          className={`aps-tier-card paygo ${selectedTierId === 'paygo' ? 'selected' : ''}`}
          onClick={() => setSelectedTierId('paygo')}
        >
          <div className="aps-card-header">
            <span className="aps-card-kicker">Elastic On-Demand</span>
            <h3 className="aps-plan-name">Pay-As-You-Go</h3>
            <p className="aps-plan-desc">
              Automatic scale with no monthly minimums. Ideal for bursty AI workloads.
            </p>
          </div>

          <div className="aps-price-row">
            <div className="aps-price-wrap">
              <span className="aps-amount paygo">$0.0008</span>
              <span className="aps-interval">/ request</span>
            </div>
            <span className="aps-annual-note">First 10k requests/mo free</span>
          </div>

          <div className="aps-quota-pill paygo">
            <Sliders size={13} className="aps-quota-icon" />
            <span>Uncapped elastic throughput</span>
          </div>

          <div className="aps-features-list">
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>Zero upfront monthly commitment</span>
            </div>
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>Custom hard-limit budget alerts</span>
            </div>
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>Pay only for exact compute cycles</span>
            </div>
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>Access to all endpoints & versions</span>
            </div>
          </div>

          <button
            className="aps-subscribe-btn outline"
            onClick={(e) => {
              e.stopPropagation();
              const calcEl = document.getElementById('aps-calculator-section');
              calcEl?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span>Model in Calculator</span>
            <Calculator size={14} />
          </button>
        </div>

        {/* Enterprise Card */}
        <div
          className={`aps-tier-card enterprise ${
            selectedTierId === 'enterprise' ? 'selected' : ''
          }`}
          onClick={() => setSelectedTierId('enterprise')}
        >
          <div className="aps-card-header">
            <span className="aps-card-kicker">Custom Infrastructure</span>
            <h3 className="aps-plan-name">Enterprise Custom</h3>
            <p className="aps-plan-desc">
              Dedicated tenancy, custom SLAs, and custom compliance frameworks.
            </p>
          </div>

          <div className="aps-price-row">
            <div className="aps-price-wrap">
              <span className="aps-amount enterprise">Custom</span>
            </div>
            <span className="aps-annual-note">Volume discounts & invoicing</span>
          </div>

          <div className="aps-quota-pill enterprise">
            <Shield size={13} className="aps-quota-icon" />
            <span>99.99% Guaranteed SLA</span>
          </div>

          <div className="aps-features-list">
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>Dedicated VPC Peering & PrivateLink</span>
            </div>
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>Custom SAML SSO & SCIM Directory</span>
            </div>
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>24/7 Dedicated Slack channel & CSM</span>
            </div>
            <div className="aps-feature-item">
              <Check size={14} className="aps-feature-check" />
              <span>HIPAA, BAA & SOC2 Type II certs</span>
            </div>
          </div>

          <button
            className="aps-subscribe-btn enterprise"
            onClick={(e) => {
              e.stopPropagation();
              setIsEnterpriseModalOpen(true);
            }}
          >
            <span>Talk to Solutions Team</span>
            <Building2 size={14} />
          </button>
        </div>

        {/* Klyra Promotional & Marketing Accelerator Banner */}
        <div className="aps-tier-card aps-promo-banner-card">
          <div className="aps-promo-ambient-glow" />
          <div className="aps-popular-badge promo">
            <Gift size={12} />
            <span>KLYRA ECOSYSTEM ADVANTAGE</span>
          </div>

          <div className="aps-card-header">
            <h3 className="aps-plan-name promo">$500 Free Credits & Perks</h3>
            <p className="aps-plan-desc">
              Accelerate production AI workflows with zero platform take-rate and bundled
              architecture perks.
            </p>
          </div>

          <div className="aps-promo-credit-box">
            <div className="aps-pcb-top">
              <span className="aps-pcb-kicker">INSTANT FOUNDER CREDIT</span>
              <div className="aps-pcb-amount">
                <span className="aps-pcb-sym">$</span>
                <span className="aps-pcb-num">500</span>
                <span className="aps-pcb-lbl">FREE BALANCE</span>
              </div>
            </div>
            <p className="aps-pcb-note">Auto-applied to any annual tier or test calls</p>
          </div>

          <div className="aps-features-list promo-features">
            <div className="aps-feature-item">
              <Sparkles size={14} className="aps-feature-check promo" />
              <span>
                <b>20% Annual Bundle Savings</b> across all tiers
              </span>
            </div>
            <div className="aps-feature-item">
              <Shield size={14} className="aps-feature-check promo" />
              <span>
                <b>Free 1-on-1 Architecture Review</b> with Klyra Leads
              </span>
            </div>
            <div className="aps-feature-item">
              <Zap size={14} className="aps-feature-check promo" />
              <span>
                <b>0% Platform Overheads</b> for verified builders
              </span>
            </div>
            <div className="aps-feature-item">
              <Award size={14} className="aps-feature-check promo" />
              <span>Early VIP access to private preview APIs</span>
            </div>
          </div>

          <div className="aps-promo-cta-box">
            <button className="aps-subscribe-btn promo-btn" onClick={handleCopyPromo}>
              {promoCopied ? (
                <>
                  <Check size={14} color="#22c55e" />
                  <span>Code KLYRA-ACCEL-2026 Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Claim $500 Voucher (Copy Code)</span>
                </>
              )}
            </button>
            <span className="aps-promo-subtext">✨ No card required for sandbox claims</span>
          </div>
        </div>
      </div>

      {/* Interactive Pay-As-You-Go & ROI Usage Calculator */}
      <section className="aps-calculator-card" id="aps-calculator-section">
        <div className="aps-calc-left">
          <div className="aps-kicker">
            <Calculator size={13} />
            <span>INTERACTIVE USAGE CALCULATOR</span>
          </div>
          <h3 className="aps-calc-title">Estimate Your Monthly Investment</h3>
          <p className="aps-calc-desc">
            Slide or enter your anticipated monthly request volume to evaluate Pay-As-You-Go vs
            tiered subscription cost efficiency.
          </p>

          <div className="aps-presets-row">
            <span className="aps-preset-label">Quick Presets:</span>
            {[
              { label: '10K (Hobby)', val: 10000 },
              { label: '100K (Startup)', val: 100000 },
              { label: '500K (Growth)', val: 500000 },
              { label: '2M (Scale)', val: 2000000 },
            ].map((p) => (
              <button
                key={p.val}
                className={`aps-preset-pill ${monthlyRequests === p.val ? 'active' : ''}`}
                onClick={() => setMonthlyRequests(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="aps-slider-box">
            <div className="aps-slider-header">
              <span className="aps-slider-title">Monthly Requests</span>
              <div className="aps-slider-val-box">
                <input
                  type="number"
                  min="1000"
                  max="5000000"
                  step="1000"
                  value={monthlyRequests}
                  onChange={(e) =>
                    setMonthlyRequests(
                      Math.max(1000, Math.min(5000000, Number(e.target.value) || 1000)),
                    )
                  }
                  className="aps-num-input"
                />
                <span className="aps-num-unit">req / month</span>
              </div>
            </div>

            <input
              type="range"
              min="10000"
              max="5000000"
              step="10000"
              value={monthlyRequests}
              onChange={(e) => setMonthlyRequests(Number(e.target.value))}
              className="aps-range-slider"
            />

            <div className="aps-range-marks">
              <span>10K</span>
              <span>1M</span>
              <span>2.5M</span>
              <span>5M+</span>
            </div>
          </div>
        </div>

        <div className="aps-calc-right">
          <div className="aps-calc-result-box">
            <span className="aps-result-label">Estimated Monthly Pay-As-You-Go Cost</span>
            <div className="aps-result-price">
              <span className="aps-result-sym">$</span>
              <span className="aps-result-num">{paygoCost}</span>
              <span className="aps-result-int">/ mo</span>
            </div>
            <div className="aps-result-breakdown">
              <span>Based on $0.0008 / billable request after 10k free</span>
            </div>

            <div className="aps-smart-rec">
              <div className="aps-rec-top">
                <Sparkles size={14} className="aps-rec-icon" />
                <span>Smart Recommendation</span>
              </div>
              <p className="aps-rec-text">{recommendation.text}</p>
            </div>

            {onOpenTester && (
              <button className="aps-calc-test-btn" onClick={() => onOpenTester(api)}>
                <span>Test Latency Before Subscribing</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Expandable Feature Comparison Table */}
      <section className="aps-comparison-section">
        <button
          className="aps-comparison-toggle-btn"
          onClick={() => setShowComparison(!showComparison)}
        >
          <div className="aps-ct-left">
            <Layers size={16} className="aps-ct-icon" />
            <span>Detailed Feature & SLA Comparison Matrix</span>
          </div>
          <div className="aps-ct-right">
            <span>{showComparison ? 'Hide Specifications' : 'Compare All Tiers'}</span>
            {showComparison ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showComparison && (
          <div className="aps-table-wrapper animate-fade-in">
            <table className="aps-matrix-table">
              <thead>
                <tr>
                  <th className="aps-col-feature">Platform Capability</th>
                  <th>Developer Sandbox</th>
                  <th>Starter Pro</th>
                  <th className="aps-col-highlight">Scale & Team</th>
                  <th>Pay-As-You-Go</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="aps-group-row">
                  <td colSpan={6}>Volume & Rate Limits</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Monthly Request Quota</td>
                  <td>10,000</td>
                  <td>250,000</td>
                  <td className="aps-col-highlight">2,000,000</td>
                  <td>Elastic Uncapped</td>
                  <td>Custom Quota</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Rate Limit (Per Minute)</td>
                  <td>60 req/min</td>
                  <td>300 req/min</td>
                  <td className="aps-col-highlight">1,200 req/min</td>
                  <td>Adaptive</td>
                  <td>10,000+ req/min</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Burst Concurrency</td>
                  <td>Standard</td>
                  <td>3x Burst</td>
                  <td className="aps-col-highlight">10x Burst</td>
                  <td>Auto-Scaling</td>
                  <td>Dedicated Buffer</td>
                </tr>

                <tr className="aps-group-row">
                  <td colSpan={6}>Reliability, Caching & SLA</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Uptime SLA Guarantee</td>
                  <td>Best Effort</td>
                  <td>99.5%</td>
                  <td className="aps-col-highlight">99.9%</td>
                  <td>99.5%</td>
                  <td>99.99% Financially Backed</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Global Anycast Caching</td>
                  <td>Standard</td>
                  <td>Multi-Region</td>
                  <td className="aps-col-highlight">Global Edge PoPs</td>
                  <td>Global Edge PoPs</td>
                  <td>Custom Private PoP</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Sub-{api.latencyMs}ms P99 Routing</td>
                  <td>—</td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td className="aps-col-highlight">
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                </tr>

                <tr className="aps-group-row">
                  <td colSpan={6}>Developer Experience & Security</td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Idempotency Keys</td>
                  <td>—</td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td className="aps-col-highlight">
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Custom Webhooks & Alerts</td>
                  <td>—</td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td className="aps-col-highlight">
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Dedicated VPC Peering</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="aps-col-highlight">—</td>
                  <td>—</td>
                  <td>
                    <Check size={14} className="aps-tbl-check" />
                  </td>
                </tr>
                <tr>
                  <td className="aps-feature-name">Support SLA</td>
                  <td>Community Discord</td>
                  <td>Email (&lt; 24h)</td>
                  <td className="aps-col-highlight">Priority Email & Slack</td>
                  <td>Standard Email</td>
                  <td>24/7 Dedicated CSM</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Enterprise Inquiry Modal */}
      {isEnterpriseModalOpen && (
        <div className="aps-modal-backdrop" onClick={() => setIsEnterpriseModalOpen(false)}>
          <div className="aps-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="aps-modal-close" onClick={() => setIsEnterpriseModalOpen(false)}>
              <X size={18} />
            </button>

            <div className="aps-modal-header">
              <div className="aps-kicker">
                <Building2 size={14} />
                <span>ENTERPRISE SOLUTIONS INQUIRY</span>
              </div>
              <h3>Custom Architecture for {api.name}</h3>
              <p>
                Collaborate with our solutions architects for custom volume rates, dedicated VPC
                peering, and signed BAA/HIPAA compliance agreements.
              </p>
            </div>

            {enterpriseSubmitted ? (
              <div className="aps-submitted-state">
                <CheckCircle2 size={42} color="#22c55e" />
                <h4>Inquiry Received!</h4>
                <p>
                  A technical solutions specialist will connect with you within 2 business hours
                  with custom volume pricing.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnterpriseSubmit} className="aps-modal-form">
                <div className="aps-form-row">
                  <label>Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={enterpriseFormData.company}
                    onChange={(e) =>
                      setEnterpriseFormData({ ...enterpriseFormData, company: e.target.value })
                    }
                  />
                </div>
                <div className="aps-form-row">
                  <label>Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="engineering@company.com"
                    value={enterpriseFormData.email}
                    onChange={(e) =>
                      setEnterpriseFormData({ ...enterpriseFormData, email: e.target.value })
                    }
                  />
                </div>
                <div className="aps-form-row">
                  <label>Projected Volume</label>
                  <select
                    value={enterpriseFormData.expectedVolume}
                    onChange={(e) =>
                      setEnterpriseFormData({
                        ...enterpriseFormData,
                        expectedVolume: e.target.value,
                      })
                    }
                  >
                    <option>5M - 20M requests / month</option>
                    <option>20M - 100M requests / month</option>
                    <option>100M+ requests / month</option>
                    <option>Custom Dedicated On-Premises</option>
                  </select>
                </div>
                <div className="aps-form-row">
                  <label>Technical & Compliance Requirements</label>
                  <textarea
                    rows={3}
                    placeholder="Specific SLAs, VPC peering, SAML SSO, or custom legal requirements..."
                    value={enterpriseFormData.customNeeds}
                    onChange={(e) =>
                      setEnterpriseFormData({
                        ...enterpriseFormData,
                        customNeeds: e.target.value,
                      })
                    }
                  />
                </div>
                <button type="submit" className="aps-modal-submit-btn">
                  <Send size={14} />
                  <span>Request Custom Enterprise Agreement</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        .aps-container {
          display: flex;
          flex-direction: column;
          gap: 28px;
          animation: fadeIn 0.3s ease;
        }

        /* Top Bar */
        .aps-top-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .aps-intro-copy {
          max-width: 680px;
        }

        .aps-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-purple);
          margin-bottom: 4px;
        }

        .aps-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }

        .aps-subtitle {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* Billing Switcher */
        .aps-billing-toggle-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 5px;
          display: inline-flex;
        }

        .aps-billing-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .aps-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: var(--radius-md);
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-muted);
          border: none;
          background: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .aps-toggle-btn:hover {
          color: var(--text-primary);
        }

        .aps-toggle-btn.active {
          background: var(--bg-pill);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        .aps-save-badge {
          background: rgba(34, 197, 94, 0.18);
          color: #22c55e;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        /* Tiers Grid */
        .aps-tiers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }

        .aps-tier-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .aps-tier-card:hover {
          transform: translateY(-4px);
          border-color: rgba(139, 92, 246, 0.35);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
        }

        .aps-tier-card.selected {
          border-color: var(--accent-purple);
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, var(--bg-card) 100%);
        }

        .aps-tier-card.popular {
          border: 2px solid var(--accent-purple);
          background: radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, var(--bg-card) 75%);
          box-shadow: 0 4px 24px -4px rgba(139, 92, 246, 0.4);
        }

        .aps-tier-card.paygo {
          border-color: rgba(139, 92, 246, 0.25);
        }

        .aps-tier-card.enterprise {
          border-color: rgba(59, 130, 246, 0.25);
        }

        /* Promo Banner Card */
        .aps-tier-card.aps-promo-banner-card {
          align-self: stretch;
          grid-column: -2;
          grid-row: span 3;
          min-height: 100%;
          width: 100%;
          background: linear-gradient(145deg, rgba(20, 21, 36, 0.95), rgba(17, 18, 32, 0.98)),
                      radial-gradient(ellipse at top left, rgba(217, 70, 239, 0.25), transparent 70%);
          border: 1px solid rgba(217, 70, 239, 0.4);
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(217, 70, 239, 0.15);
          animation: promoBorderShimmer 6s ease-in-out infinite;
        }

        @media (max-width: 1050px) {
          .aps-tier-card.aps-promo-banner-card { grid-column: 1 / -1; grid-row: auto; }
        }

        @keyframes promoBorderShimmer {
          0%, 100% {
            border-color: rgba(217, 70, 239, 0.4);
            box-shadow: 0 8px 30px rgba(217, 70, 239, 0.18);
          }
          50% {
            border-color: rgba(99, 102, 241, 0.6);
            box-shadow: 0 8px 35px rgba(99, 102, 241, 0.25);
          }
        }

        .aps-promo-ambient-glow {
          position: absolute;
          top: -40px;
          right: -40px;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(217, 70, 239, 0.35), transparent 70%);
          filter: blur(20px);
          pointer-events: none;
          animation: promoGlowFloat 4s ease-in-out infinite alternate;
        }

        @keyframes promoGlowFloat {
          from { transform: translate(0, 0) scale(1); opacity: 0.5; }
          to { transform: translate(-20px, 20px) scale(1.2); opacity: 0.8; }
        }

        .aps-popular-badge.promo {
          background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%);
        }

        .aps-card-kicker.promo {
          color: #f472b6;
        }

        .aps-plan-name.promo {
          background: linear-gradient(135deg, #fff 40%, #f472b6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .aps-promo-credit-box {
          background: rgba(217, 70, 239, 0.08);
          border: 1px solid rgba(217, 70, 239, 0.25);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .aps-pcb-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }

        .aps-pcb-kicker {
          font-size: 9.5px;
          font-weight: 700;
          color: #f472b6;
          letter-spacing: 0.06em;
        }

        .aps-pcb-amount {
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .aps-pcb-sym {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }

        .aps-pcb-num {
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .aps-pcb-lbl {
          font-size: 9px;
          font-weight: 700;
          color: #a78bfa;
          margin-left: 4px;
        }

        .aps-pcb-note {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .aps-feature-check.promo {
          color: #f472b6;
        }

        .aps-promo-cta-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: auto;
        }

        .aps-subscribe-btn.promo-btn {
          background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
          color: #fff;
          border: none;
          box-shadow: 0 4px 18px rgba(236, 72, 153, 0.35);
        }

        .aps-subscribe-btn.promo-btn:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .aps-promo-subtext {
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
        }

        .aps-popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--accent-gradient);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          box-shadow: var(--shadow-purple);
        }

        .aps-card-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .aps-card-kicker {
          font-size: 10px;
          font-weight: 700;
          color: var(--accent-purple);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .aps-plan-name {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .aps-plan-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          min-height: 36px;
        }

        .aps-price-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .aps-price-wrap {
          display: flex;
          align-items: baseline;
          gap: 3px;
        }

        .aps-currency {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .aps-amount {
          font-size: 32px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1;
        }

        .aps-amount.paygo {
          font-size: 24px;
          color: var(--text-accent);
        }

        .aps-amount.enterprise {
          font-size: 26px;
          color: #60a5fa;
        }

        .aps-interval {
          font-size: 12px;
          color: var(--text-muted);
        }

        .aps-annual-note {
          font-size: 10.5px;
          color: #22c55e;
          font-weight: 600;
        }

        .aps-quota-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .aps-quota-pill.paygo {
          border-color: rgba(139, 92, 246, 0.2);
          color: var(--text-accent);
        }

        .aps-quota-pill.enterprise {
          border-color: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }

        .aps-quota-icon {
          color: var(--accent-purple);
        }

        .aps-quota-dot {
          color: var(--text-muted);
        }

        .aps-features-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          margin-top: 4px;
        }

        .aps-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .aps-feature-check {
          color: var(--status-active);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .aps-subscribe-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px;
          border-radius: var(--radius-md);
          background: var(--bg-pill);
          color: var(--text-primary);
          border: 1px solid var(--border-card);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .aps-subscribe-btn:hover {
          border-color: var(--accent-purple);
          color: var(--accent-purple);
          background: var(--accent-subtle);
        }

        .aps-subscribe-btn.popular {
          background: var(--accent-gradient);
          color: #fff;
          border: none;
          box-shadow: var(--shadow-purple);
        }

        .aps-subscribe-btn.popular:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .aps-subscribe-btn.outline {
          border-color: rgba(139, 92, 246, 0.35);
          color: var(--text-accent);
        }

        .aps-subscribe-btn.enterprise {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.35);
          color: #93c5fd;
        }

        .aps-subscribe-btn.enterprise:hover {
          background: rgba(59, 130, 246, 0.25);
        }

        /* Calculator Section */
        .aps-calculator-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-xl);
          padding: 28px;
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 28px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }

        .aps-calc-left {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .aps-calc-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .aps-calc-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.55;
        }

        .aps-presets-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .aps-preset-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .aps-preset-pill {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }

        .aps-preset-pill:hover,
        .aps-preset-pill.active {
          background: var(--accent-subtle);
          border-color: var(--accent-purple);
          color: var(--text-accent);
        }

        .aps-slider-box {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          padding: 18px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .aps-slider-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .aps-slider-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .aps-slider-val-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .aps-num-input {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 700;
          padding: 6px 10px;
          width: 120px;
          text-align: right;
        }

        .aps-num-unit {
          font-size: 11px;
          color: var(--text-muted);
        }

        .aps-range-slider {
          width: 100%;
          accent-color: var(--accent-purple);
          cursor: pointer;
        }

        .aps-range-marks {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .aps-calc-right {
          display: flex;
          align-items: center;
        }

        .aps-calc-result-box {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: var(--radius-lg);
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          text-align: center;
        }

        .aps-result-label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .aps-result-price {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
        }

        .aps-result-sym {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .aps-result-num {
          font-size: 38px;
          font-weight: 900;
          color: var(--text-accent);
          letter-spacing: -0.02em;
        }

        .aps-result-int {
          font-size: 13px;
          color: var(--text-muted);
        }

        .aps-result-breakdown {
          font-size: 11px;
          color: var(--text-muted);
        }

        .aps-smart-rec {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          text-align: left;
        }

        .aps-rec-top {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 700;
          color: var(--accent-purple);
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .aps-rec-text {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .aps-calc-test-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px;
          border-radius: var(--radius-md);
          background: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          margin-top: 4px;
        }

        .aps-calc-test-btn:hover {
          color: var(--text-primary);
          border-color: var(--accent-purple);
        }

        /* Feature Matrix Comparison */
        .aps-comparison-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aps-comparison-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .aps-comparison-toggle-btn:hover {
          border-color: var(--accent-purple);
        }

        .aps-ct-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .aps-ct-icon {
          color: var(--accent-purple);
        }

        .aps-ct-right {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .aps-table-wrapper {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          overflow-x: auto;
        }

        .aps-matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .aps-matrix-table th {
          padding: 12px 14px;
          text-align: left;
          background: var(--bg-input);
          color: var(--text-primary);
          font-weight: 700;
          border-bottom: 1px solid var(--border-card);
        }

        .aps-matrix-table td {
          padding: 11px 14px;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }

        .aps-col-feature {
          font-weight: 600;
          width: 25%;
        }

        .aps-feature-name {
          color: var(--text-primary);
          font-weight: 500;
        }

        .aps-col-highlight {
          background: rgba(139, 92, 246, 0.06);
          font-weight: 700;
          color: var(--text-primary);
        }

        .aps-group-row td {
          background: var(--bg-pill);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 8px 14px;
        }

        .aps-tbl-check {
          color: var(--status-active);
        }

        /* Enterprise Modal */
        .aps-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(5, 6, 10, 0.85);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .aps-modal-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-xl);
          padding: 30px;
          max-width: 520px;
          width: 100%;
          position: relative;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
        }

        .aps-modal-close {
          position: absolute;
          top: 18px;
          right: 18px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .aps-modal-close:hover {
          color: var(--text-primary);
        }

        .aps-modal-header {
          margin-bottom: 20px;
        }

        .aps-modal-header h3 {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .aps-modal-header p {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .aps-modal-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .aps-form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .aps-form-row label {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .aps-form-row input,
        .aps-form-row select,
        .aps-form-row textarea {
          background: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 9px 12px;
          color: var(--text-primary);
          font-size: 12.5px;
        }

        .aps-form-row input:focus,
        .aps-form-row select:focus,
        .aps-form-row textarea:focus {
          border-color: var(--accent-purple);
        }

        .aps-modal-submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: var(--shadow-purple);
          margin-top: 8px;
          transition: all 0.2s;
        }

        .aps-modal-submit-btn:hover {
          filter: brightness(1.1);
        }

        .aps-submitted-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 30px 20px;
          gap: 12px;
        }

        .aps-submitted-state h4 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .aps-submitted-state p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .aps-calculator-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
