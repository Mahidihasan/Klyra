import React, { useState, useEffect } from 'react';
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
import {
  CatalogApi,
  calculateMarketplacePaygo,
} from '../../../services/api/catalog';

interface ApiPricingSectionProps {
  api: CatalogApi;
  onSubscribe: (planId: string, monthlyRequests: number) => void;
  subscribingPlan: string | null;
  onOpenTester?: (api: CatalogApi) => void;
}

interface NormalizedTier {
  id: string;
  name: string;
  badge?: string;
  kicker: string;
  currency: string;
  billingInterval: string;
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
  const [activePromoIndex, setActivePromoIndex] = useState(0);

  const promoHighlights = [
    {
      badge: 'Zero Take-Rate',
      title: '0% Platform Overheads',
      desc: '100% of revenue flows to API builders with zero commission on standard workloads.',
    },
    {
      badge: 'Founder Credits',
      title: '$500 Instant Sandbox Grant',
      desc: 'Pre-loaded developer balance auto-applied to any annual tier or test call.',
    },
    {
      badge: 'Direct Advisory',
      title: '1-on-1 Architecture Review',
      desc: 'Direct consultation with Klyra core systems engineers to review OpenAPI reliability.',
    },
    {
      badge: 'VIP Early Access',
      title: 'Private Preview Model APIs',
      desc: 'Instant access to upcoming frontier models and experimental endpoint features.',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromoIndex((prev) => (prev + 1) % promoHighlights.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [promoHighlights.length]);

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
      const normalizedPlans = rawPlans.map((plan, idx) => {
        const isFree = plan.price === 0;
        const isPopular = idx === 1 || plan.name.toLowerCase().includes('pro');
        return {
          id: plan.id,
          name: plan.name,
          badge: isPopular ? 'Most Popular' : undefined,
          kicker: isFree ? 'For Prototyping' : isPopular ? 'Best for Scale' : 'For Growing Teams',
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          monthlyPrice: plan.price,
          annualPrice: plan.price,
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
          ctaText: isFree ? 'Get Started for Free' : 'Subscribe to Plan',
          type: (isFree ? 'free' : isPopular ? 'pro' : 'starter') as NormalizedTier['type'],
        };
      });

      return normalizedPlans;
    }

    return rawPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      kicker: plan.billingInterval,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      monthlyPrice: plan.price,
      annualPrice: plan.price,
      description: plan.description || `Full access to ${api.name} endpoints.`,
      features: plan.features || [],
      rateLimit: plan.rateLimit || 0,
      requestsQuota: '',
      ctaText: plan.price === 0 ? 'Get Started for Free' : 'Subscribe to Plan',
      type: (plan.price === 0 ? 'free' : 'starter') as NormalizedTier['type'],
    }));
  };

  const tiers = buildNormalizedTiers();

  // Calculation for Pay-As-You-Go
  const calculatePaygoCost = (requests: number): number => {
    return api.payAsYouGo ? calculateMarketplacePaygo(requests, api.payAsYouGo) : 0;
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
        <div className="aps-plan-list">
        {tiers.map((tier) => {
          const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
          const isSelected = selectedTierId === tier.id;
          const isSubscribing = subscribingPlan === tier.id;

          return (
            <div
              key={tier.id}
              className={`aps-tier-card aps-plan-row ${tier.isPopular ? 'popular' : ''} ${
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
                  <span className="aps-currency">{tier.currency}</span>
                  <span className="aps-amount">{price}</span>
                  <span className="aps-interval">{price === 0 ? 'forever' : `/ ${tier.billingInterval.toLowerCase()}`}</span>
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
                  onSubscribe(tier.id, monthlyRequests);
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
          className={`aps-tier-card aps-plan-row paygo ${selectedTierId === 'paygo' ? 'selected' : ''}`}
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
              <span className="aps-amount paygo">{api.payAsYouGo ? `$${api.payAsYouGo.ratePerRequest.toFixed(4)}` : 'Unavailable'}</span>
              <span className="aps-interval">/ request</span>
            </div>
              <span className="aps-annual-note">First {(api.payAsYouGo?.includedRequests || 0).toLocaleString()} requests/mo free</span>
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
          className={`aps-tier-card aps-plan-row enterprise ${
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
        </div>

        {/* Klyra Promotional & Marketing Accelerator Banner - Spanning 3 panels beside Enterprise */}
        <div className="aps-tier-card aps-promo-banner-card">
          <div className="aps-promo-ambient-glow" />
          <div className="aps-popular-badge promo">
            <Gift size={12} />
            <span>KLYRA ECOSYSTEM ADVANTAGE</span>
          </div>

          <div className="aps-promo-3panel-grid">
            {/* Panel 1: Offer & Founder Balance */}
            <div className="aps-promo-panel-left">
              <div className="aps-card-header">
                <span className="aps-card-kicker promo">FOUNDER ACCELERATOR</span>
                <h3 className="aps-plan-name promo">$500 Free Credits & Perks</h3>
                <p className="aps-plan-desc">
                  Accelerate production AI workflows with zero platform take-rate and bundled perks.
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
                <p className="aps-pcb-note">Auto-applied to any annual tier or live test calls</p>
              </div>
            </div>

            {/* Panel 2: Natural Animated Messaging */}
            <div className="aps-promo-panel-mid">
              <div className="aps-promo-animated-box">
                <div className="aps-pam-header">
                  <span className="aps-pam-live-dot" />
                  <span className="aps-pam-badge">{promoHighlights[activePromoIndex].badge}</span>
                  <span className="aps-pam-step">{activePromoIndex + 1} of {promoHighlights.length}</span>
                </div>
                <div className="aps-pam-body" key={activePromoIndex}>
                  <h4 className="aps-pam-title">{promoHighlights[activePromoIndex].title}</h4>
                  <p className="aps-pam-desc">{promoHighlights[activePromoIndex].desc}</p>
                </div>
                <div className="aps-pam-dots">
                  {promoHighlights.map((_, i) => (
                    <button
                      key={i}
                      className={`aps-pam-dot ${activePromoIndex === i ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePromoIndex(i);
                      }}
                      aria-label={`Show perk ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="aps-features-list promo-features compact">
                <div className="aps-feature-item">
                  <Sparkles size={13} className="aps-feature-check promo" />
                  <span><b>20% Annual Bundle Savings</b> across all tiers</span>
                </div>
                <div className="aps-feature-item">
                  <Shield size={13} className="aps-feature-check promo" />
                  <span><b>Free Architecture Review</b> with Klyra Leads</span>
                </div>
                <div className="aps-feature-item">
                  <Zap size={13} className="aps-feature-check promo" />
                  <span><b>Zero Platform Take-Rate</b> on standard workloads</span>
                </div>
              </div>
            </div>

            {/* Panel 3: Exclusive Voucher & CTA */}
            <div className="aps-promo-panel-right">
              <div className="aps-promo-code-box" onClick={handleCopyPromo}>
                <span className="aps-pcb-label">EXCLUSIVE VOUCHER CODE</span>
                <div className="aps-pcb-code-row">
                  <code className="aps-pcb-code">KLYRA-ACCEL-2026</code>
                  <Copy size={13} className="aps-pcb-copy-icon" />
                </div>
              </div>

              <div className="aps-promo-cta-box">
                <button className="aps-subscribe-btn promo-btn" onClick={handleCopyPromo}>
                  {promoCopied ? (
                    <>
                      <Check size={14} color="#22c55e" />
                      <span>Code Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Claim $500 Voucher</span>
                    </>
                  )}
                </button>
                <span className="aps-promo-subtext">✨ Instant activation · No credit card required</span>
              </div>
            </div>
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
              <span>{api.payAsYouGo ? `Based on $${api.payAsYouGo.ratePerRequest.toFixed(4)} / billable request after ${api.payAsYouGo.includedRequests.toLocaleString()} free` : 'Pay-as-you-go is unavailable for this API.'}</span>
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

        @media (min-width: 1080px) {
          .aps-tiers-grid {
            grid-template-columns: repeat(4, 1fr);
          }
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

        /* Promo Banner Card - Spanning 3 Panels beside Enterprise */
        .aps-tier-card.aps-promo-banner-card {
          align-self: stretch;
          height: 100%;
          min-height: 100%;
          width: 100%;
          background: linear-gradient(145deg, rgba(20, 21, 36, 0.96), rgba(17, 18, 32, 0.98)),
                      radial-gradient(ellipse at top left, rgba(217, 70, 239, 0.22), transparent 70%);
          border: 1px solid rgba(217, 70, 239, 0.4);
          position: relative;
          overflow: visible;
          box-shadow: 0 8px 32px rgba(217, 70, 239, 0.15);
          animation: promoBorderShimmer 6s ease-in-out infinite;
          box-sizing: border-box;
          padding: 24px;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 1080px) {
          .aps-tier-card.aps-promo-banner-card {
            grid-column: 2 / span 3;
            grid-row: auto;
          }
        }

        @media (max-width: 1079px) {
          .aps-tier-card.aps-promo-banner-card {
            grid-column: 1 / -1;
          }
        }

        .aps-promo-3panel-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr 1fr;
          gap: 20px;
          align-items: stretch;
          height: 100%;
          width: 100%;
          flex: 1;
        }

        @media (max-width: 1079px) {
          .aps-promo-3panel-grid {
            grid-template-columns: 1fr;
            gap: 18px;
          }
        }

        .aps-promo-panel-left,
        .aps-promo-panel-mid,
        .aps-promo-panel-right {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          min-width: 0;
          gap: 14px;
        }

        .aps-promo-panel-left .aps-card-header {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 6px;
        }

        /* Animated messaging container */
        .aps-promo-animated-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(217, 70, 239, 0.2);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
          flex: 1;
          min-height: 120px;
          justify-content: space-between;
          box-sizing: border-box;
        }

        .aps-pam-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .aps-pam-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ec4899;
          box-shadow: 0 0 8px #ec4899;
          animation: pamDotBreathe 2s infinite ease-in-out;
        }

        @keyframes pamDotBreathe {
          0%, 100% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
        }

        .aps-pam-badge {
          font-size: 10px;
          font-weight: 700;
          color: #f472b6;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .aps-pam-step {
          font-size: 10px;
          color: var(--text-muted);
          margin-left: auto;
          font-family: var(--font-mono);
        }

        .aps-pam-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          animation: pamBodyFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes pamBodyFade {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .aps-pam-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .aps-pam-desc {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        .aps-pam-dots {
          display: flex;
          gap: 5px;
          align-items: center;
          margin-top: 4px;
        }

        .aps-pam-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .aps-pam-dot.active {
          width: 18px;
          background: #ec4899;
          box-shadow: 0 0 8px rgba(236, 72, 153, 0.5);
        }

        .aps-features-list.promo-features.compact {
          gap: 8px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-md);
          min-height: 96px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }

        .aps-promo-code-box {
          background: rgba(0, 0, 0, 0.25);
          border: 1px dashed rgba(217, 70, 239, 0.35);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
          min-height: 120px;
          box-sizing: border-box;
        }

        .aps-promo-code-box:hover {
          background: rgba(217, 70, 239, 0.08);
          border-color: rgba(217, 70, 239, 0.6);
        }

        .aps-pcb-label {
          font-size: 9.5px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.06em;
        }

        .aps-pcb-code-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .aps-pcb-code {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          color: #f472b6;
          letter-spacing: 0.05em;
        }

        .aps-pcb-copy-icon {
          color: var(--text-muted);
        }

        .aps-promo-code-box:hover .aps-pcb-copy-icon {
          color: #f472b6;
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
          z-index: 2;
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
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          min-height: 96px;
          box-sizing: border-box;
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
          min-height: 96px;
          justify-content: center;
          box-sizing: border-box;
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

        /* Pricing refresh: fluid plan grid and clearer product hierarchy. */
        .aps-container {
          gap: clamp(22px, 3vw, 36px);
          max-width: 1440px;
          margin-inline: auto;
          color-scheme: dark;
        }

        .aps-top-bar {
          align-items: center;
          padding: clamp(22px, 3.2vw, 34px);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 22px;
          background:
            radial-gradient(ellipse at 4% 0%, rgba(139, 92, 246, 0.17), transparent 48%),
            linear-gradient(135deg, rgba(17, 24, 39, 0.96), rgba(12, 17, 30, 0.98));
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
        }

        .aps-intro-copy {
          max-width: 760px;
        }

        .aps-kicker {
          gap: 8px;
          color: #b9a5ff;
          letter-spacing: 0.12em;
        }

        .aps-title {
          margin: 0 0 10px;
          font-size: clamp(26px, 3vw, 38px);
          line-height: 1.12;
          letter-spacing: -0.045em;
        }

        .aps-subtitle {
          max-width: 660px;
          font-size: 14px;
          line-height: 1.75;
          color: var(--text-secondary);
        }

        .aps-billing-toggle-card {
          flex-shrink: 0;
          border-color: rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          padding: 6px;
          background: rgba(8, 12, 24, 0.68);
        }

        .aps-billing-toggle {
          gap: 5px;
        }

        .aps-toggle-btn {
          min-height: 38px;
          justify-content: center;
          padding: 8px 13px;
          border-radius: 10px;
          white-space: nowrap;
        }

        .aps-toggle-btn.active {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.26), rgba(99, 102, 241, 0.16));
          color: #f5f3ff;
          box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.22);
        }

        .aps-tiers-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 265px), 1fr));
          align-items: stretch;
          gap: 18px;
        }

        .aps-container .aps-tier-card {
          box-sizing: border-box;
          min-width: 0;
          height: 100%;
          gap: 18px;
          padding: 25px;
          border-color: rgba(148, 163, 184, 0.19);
          border-radius: 18px;
          background: linear-gradient(160deg, rgba(24, 31, 48, 0.98), rgba(15, 20, 34, 0.98));
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.15);
        }

        .aps-container .aps-tier-card:hover {
          transform: translateY(-3px);
          border-color: rgba(167, 139, 250, 0.56);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.26), 0 0 24px rgba(139, 92, 246, 0.08);
        }

        .aps-container .aps-tier-card.selected {
          border-color: rgba(167, 139, 250, 0.9);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.17), transparent 48%),
            linear-gradient(160deg, rgba(29, 31, 54, 0.99), rgba(15, 20, 34, 0.99));
          box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.18), 0 16px 36px rgba(0, 0, 0, 0.22);
        }

        .aps-container .aps-tier-card.popular {
          border: 1px solid rgba(167, 139, 250, 0.62);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.2), transparent 52%),
            linear-gradient(160deg, rgba(29, 28, 54, 0.99), rgba(15, 20, 34, 0.99));
          box-shadow: 0 12px 34px rgba(78, 55, 150, 0.18);
        }

        .aps-container .aps-tier-card.aps-promo-banner-card {
          grid-column: 1 / -1;
          grid-row: auto;
          min-height: 0;
          height: auto;
          overflow: hidden;
          padding: clamp(22px, 3vw, 30px);
          border-color: rgba(217, 70, 239, 0.32);
          border-radius: 20px;
          background:
            radial-gradient(ellipse at 0% 0%, rgba(139, 92, 246, 0.18), transparent 38%),
            linear-gradient(135deg, rgba(23, 20, 43, 0.98), rgba(13, 19, 34, 0.98));
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.2);
        }

        .aps-promo-3panel-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 245px), 1fr));
          gap: 18px;
          height: auto;
        }

        .aps-promo-panel-left,
        .aps-promo-panel-mid,
        .aps-promo-panel-right {
          min-height: 100%;
          justify-content: flex-start;
          padding: 17px;
          border: 1px solid rgba(167, 139, 250, 0.14);
          border-radius: 14px;
          background: rgba(7, 11, 24, 0.28);
        }

        .aps-promo-panel-left .aps-card-header {
          gap: 9px;
        }

        .aps-container .aps-tier-card:not(.aps-promo-banner-card) .aps-card-header {
          min-height: 105px;
          gap: 7px;
        }

        .aps-popular-badge {
          top: 14px;
          left: auto;
          right: 14px;
          z-index: 1;
          transform: none;
          padding: 5px 9px;
          border: 1px solid rgba(221, 214, 254, 0.2);
          font-size: 9px;
          letter-spacing: 0.07em;
        }

        .aps-popular-badge.promo {
          top: 14px;
          left: 14px;
          right: auto;
        }

        .aps-card-kicker {
          font-size: 10px;
          letter-spacing: 0.11em;
          color: #b9a5ff;
        }

        .aps-plan-name {
          font-size: clamp(19px, 1.5vw, 22px);
          line-height: 1.2;
          letter-spacing: -0.025em;
        }

        .aps-plan-desc {
          min-height: 0;
          font-size: 12.5px;
          line-height: 1.65;
        }

        .aps-price-row {
          min-height: 64px;
          justify-content: center;
          padding: 13px 14px;
          border: 1px solid rgba(148, 163, 184, 0.13);
          border-radius: 13px;
          background: rgba(5, 9, 20, 0.28);
        }

        .aps-price-wrap {
          align-items: baseline;
          gap: 6px;
          flex-wrap: wrap;
        }

        .aps-currency {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .aps-amount {
          font-size: clamp(30px, 2.4vw, 36px);
          letter-spacing: -0.045em;
        }

        .aps-amount.paygo {
          font-size: 25px;
        }

        .aps-interval {
          font-size: 11px;
          white-space: nowrap;
        }

        .aps-annual-note {
          font-size: 10.5px;
          line-height: 1.45;
        }

        .aps-quota-pill {
          min-height: 34px;
          flex-wrap: wrap;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 10px;
          line-height: 1.4;
        }

        .aps-features-list {
          gap: 10px;
          margin-top: 0;
          padding-top: 2px;
        }

        .aps-feature-item {
          gap: 9px;
          font-size: 12.5px;
          line-height: 1.55;
        }

        .aps-feature-check {
          margin-top: 3px;
        }

        .aps-subscribe-btn {
          min-height: 43px;
          margin-top: auto;
          padding: 11px 14px;
          border-radius: 11px;
          font-size: 12.5px;
          font-weight: 700;
        }

        .aps-container .aps-subscribe-btn.popular {
          background: linear-gradient(110deg, #7c3aed, #6366f1);
          box-shadow: 0 8px 20px rgba(109, 74, 220, 0.24);
        }

        .aps-calculator-card {
          grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
          align-items: stretch;
          gap: clamp(20px, 3vw, 34px);
          padding: clamp(22px, 3vw, 32px);
          border-color: rgba(148, 163, 184, 0.17);
          border-radius: 20px;
          background:
            radial-gradient(ellipse at 100% 0%, rgba(99, 102, 241, 0.1), transparent 42%),
            var(--bg-card);
          box-shadow: 0 16px 38px rgba(0, 0, 0, 0.17);
        }

        .aps-calc-left {
          justify-content: center;
          gap: 15px;
          min-width: 0;
        }

        .aps-calc-title {
          font-size: clamp(20px, 2vw, 25px);
          letter-spacing: -0.03em;
        }

        .aps-calc-desc {
          max-width: 620px;
          font-size: 13px;
          line-height: 1.7;
        }

        .aps-presets-row {
          gap: 8px;
        }

        .aps-preset-pill {
          min-height: 31px;
          padding: 6px 11px;
          border-radius: 9px;
        }

        .aps-slider-box {
          padding: 17px;
          border-radius: 14px;
        }

        .aps-num-input {
          min-height: 35px;
          border-radius: 9px;
        }

        .aps-range-slider {
          accent-color: #9b83ff;
        }

        .aps-calc-result-box {
          height: 100%;
          box-sizing: border-box;
          justify-content: center;
          padding: clamp(20px, 2.8vw, 28px);
          border-color: rgba(167, 139, 250, 0.27);
          border-radius: 16px;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.15), transparent 55%),
            rgba(9, 13, 27, 0.64);
        }

        .aps-result-label {
          line-height: 1.5;
          letter-spacing: 0.09em;
        }

        .aps-result-num {
          font-size: clamp(38px, 5vw, 50px);
        }

        .aps-smart-rec {
          padding: 13px 15px;
          border-radius: 12px;
        }

        .aps-rec-text {
          font-size: 12px;
          line-height: 1.55;
        }

        .aps-calc-test-btn {
          min-height: 40px;
          border-radius: 10px;
        }

        .aps-comparison-section {
          gap: 12px;
        }

        .aps-comparison-toggle-btn {
          min-height: 54px;
          padding: 14px 18px;
          border-color: rgba(148, 163, 184, 0.16);
          border-radius: 13px;
          background: linear-gradient(120deg, rgba(20, 27, 43, 0.96), rgba(15, 20, 34, 0.96));
        }

        .aps-table-wrapper {
          border-color: rgba(148, 163, 184, 0.17);
          border-radius: 15px;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.16);
          scrollbar-color: rgba(139, 92, 246, 0.55) var(--bg-card);
        }

        .aps-matrix-table {
          min-width: 900px;
          font-size: 12px;
        }

        .aps-matrix-table th {
          position: sticky;
          top: 0;
          padding: 14px 15px;
          background: #171d2d;
          white-space: nowrap;
        }

        .aps-matrix-table td {
          padding: 12px 15px;
          line-height: 1.5;
        }

        .aps-matrix-table tbody tr:not(.aps-group-row):hover td {
          background-color: rgba(139, 92, 246, 0.045);
        }

        .aps-group-row td {
          padding-block: 10px;
        }

        .aps-modal-card {
          border-color: rgba(167, 139, 250, 0.25);
          border-radius: 20px;
          background: linear-gradient(155deg, #171d2d, #101625);
        }

        .aps-form-row input,
        .aps-form-row select,
        .aps-form-row textarea {
          min-height: 40px;
          box-sizing: border-box;
          border-radius: 10px;
        }

        .aps-container button:focus-visible,
        .aps-container input:focus-visible,
        .aps-container select:focus-visible,
        .aps-container textarea:focus-visible {
          outline: 2px solid #a78bfa;
          outline-offset: 3px;
        }

        @media (max-width: 900px) {
          .aps-top-bar {
            align-items: flex-start;
          }

          .aps-billing-toggle-card {
            width: 100%;
            box-sizing: border-box;
          }

          .aps-billing-toggle {
            width: 100%;
          }

          .aps-toggle-btn {
            flex: 1;
          }

          .aps-calculator-card {
            grid-template-columns: minmax(0, 1fr);
          }

          .aps-calc-result-box {
            min-height: 340px;
          }
        }

        @media (max-width: 560px) {
          .aps-container {
            gap: 20px;
          }

          .aps-top-bar {
            padding: 20px 17px;
            border-radius: 17px;
          }

          .aps-title {
            font-size: 27px;
          }

          .aps-subtitle {
            font-size: 13px;
          }

          .aps-tiers-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 13px;
          }

          .aps-container .aps-tier-card {
            padding: 21px;
          }

          .aps-container .aps-tier-card:not(.aps-promo-banner-card) .aps-card-header {
            min-height: 0;
          }

          .aps-popular-badge:not(.promo) {
            top: 12px;
            right: 12px;
            max-width: 46%;
            white-space: normal;
            text-align: center;
          }

          .aps-container .aps-tier-card.popular .aps-card-header {
            padding-top: 17px;
          }

          .aps-container .aps-tier-card.aps-promo-banner-card {
            padding: 18px;
          }

          .aps-promo-3panel-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
            padding-top: 20px;
          }

          .aps-promo-panel-left,
          .aps-promo-panel-mid,
          .aps-promo-panel-right {
            padding: 14px;
          }

          .aps-calculator-card {
            padding: 19px 16px;
            border-radius: 17px;
          }

          .aps-presets-row {
            align-items: flex-start;
          }

          .aps-preset-label {
            width: 100%;
          }

          .aps-slider-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .aps-slider-val-box {
            width: 100%;
          }

          .aps-num-input {
            width: 100%;
            flex: 1;
            text-align: left;
          }

          .aps-calc-result-box {
            min-height: 0;
            padding: 20px 15px;
          }

          .aps-comparison-toggle-btn {
            align-items: flex-start;
            gap: 12px;
            padding: 13px;
            font-size: 12px;
          }

          .aps-ct-right {
            font-size: 11px;
            white-space: nowrap;
          }

          .aps-modal-card {
            padding: 25px 19px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .aps-container *,
          .aps-container *::before,
          .aps-container *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        .aps-container .aps-tiers-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: stretch;
          gap: 18px;
        }

        .aps-container .aps-tiers-grid > .aps-tier-card:not(.aps-promo-banner-card) {
          flex: 1 1 265px;
          width: 100%;
          max-width: 340px;
        }

        .aps-plan-list {
          display: contents;
        }

        .aps-container .aps-plan-row {
          flex: 1 1 100%;
          width: 100%;
          max-width: none;
          display: grid;
          grid-template-columns: minmax(170px, 1fr) minmax(150px, 0.8fr) minmax(0, 2fr) minmax(170px, 0.9fr);
          grid-template-areas:
            "header price features action"
            "header quota features action";
          align-items: center;
          column-gap: 20px;
          row-gap: 9px;
          padding: 16px 20px;
        }

        .aps-plan-row .aps-card-header {
          grid-area: header;
          min-height: 0 !important;
          gap: 6px;
        }

        .aps-plan-row .aps-plan-desc {
          min-height: 0;
        }

        .aps-plan-row .aps-price-row {
          grid-area: price;
          min-height: 0;
          padding: 0;
          border: 0;
          background: transparent;
        }

        .aps-plan-row .aps-quota-pill {
          grid-area: quota;
          justify-self: center;
          justify-content: center;
          width: fit-content;
          max-width: 100%;
          flex-wrap: nowrap;
          white-space: nowrap;
          padding-inline: 14px;
        }

        .aps-plan-row .aps-features-list {
          grid-area: features;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
          gap: 9px 16px;
          margin: 0;
          padding: 2px 0 2px 22px;
          border-left: 1px solid rgba(148, 163, 184, 0.18);
        }

        .aps-plan-row .aps-subscribe-btn {
          grid-area: action;
          width: 100%;
          min-width: 0;
          margin: 0;
          align-self: center;
        }

        .aps-plan-row .aps-popular-badge {
          top: 10px;
          right: 12px;
          left: auto;
          transform: none;
        }

        .aps-plan-row.popular .aps-card-header {
          padding-right: 92px;
        }

        .aps-container .aps-plan-row.popular {
          border-color: rgba(214, 170, 96, 0.72);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(214, 170, 96, 0.11), transparent 52%),
            linear-gradient(160deg, rgba(31, 29, 43, 0.99), rgba(15, 20, 34, 0.99));
          box-shadow: 0 0 0 1px rgba(214, 170, 96, 0.1), 0 12px 34px rgba(151, 111, 46, 0.2);
        }

        .aps-container .aps-plan-row.popular .aps-popular-badge {
          border-color: rgba(214, 170, 96, 0.4);
          background: rgba(82, 62, 31, 0.78);
          color: #e8c98f;
        }

        @media (max-width: 900px) {
          .aps-container .aps-plan-row {
            grid-template-columns: minmax(0, 1fr) minmax(150px, auto);
            grid-template-areas:
              "header price"
              "quota price"
              "features features"
              "action action";
            column-gap: 16px;
            padding: 16px 19px;
          }

          .aps-plan-row .aps-features-list {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            padding: 15px 0 0;
            border-top: 1px solid rgba(148, 163, 184, 0.18);
            border-left: 0;
          }

          .aps-plan-row .aps-subscribe-btn {
            justify-self: end;
            width: min(100%, 280px);
          }
        }

        @media (max-width: 560px) {
          .aps-container .aps-plan-row {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas:
              "header"
              "price"
              "quota"
              "features"
              "action";
            gap: 14px;
            padding: 19px;
          }

          .aps-plan-row .aps-quota-pill {
            flex-wrap: wrap;
            white-space: normal;
          }

          .aps-plan-row.popular .aps-card-header {
            padding: 17px 0 0;
          }

          .aps-plan-row .aps-features-list {
            grid-template-columns: minmax(0, 1fr);
          }

          .aps-plan-row .aps-subscribe-btn {
            justify-self: stretch;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
