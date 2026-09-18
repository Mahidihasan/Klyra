import React, { useState } from 'react';
import {
  Plus, Check, Sparkles, ShieldCheck, SlidersHorizontal, ChevronDown,
  Tag, Users, DollarSign, Zap, Lock, Unlock, Edit3, Trash2, Copy,
  BarChart3, GitBranch, ToggleLeft, ToggleRight, AlertTriangle, Star, Crown, Gift
} from 'lucide-react';
import { PricingPlan } from '../../../types/apibuild';

interface PlanVersion {
  id: string;
  semver: string;
  label: string;
  isDefault: boolean;
}

interface TabPlansProps {
  plans: PricingPlan[];
  onOpenCreatePlan: () => void;
  onShowToast: (msg: string) => void;
}

// Available API versions that a provider can assign to a plan
const AVAILABLE_VERSIONS: PlanVersion[] = [
  { id: 'v2.4.1', semver: 'v2.4.1', label: 'v2.4.1 (Current)', isDefault: true },
  { id: 'v2.4.0', semver: 'v2.4.0', label: 'v2.4.0 (Stable)', isDefault: false },
  { id: 'v1.9.0', semver: 'v1.9.0', label: 'v1.9.0 (Legacy)', isDefault: false },
];

const PLAN_FEATURES: Record<string, string[]> = {
  Free: ['Catalog endpoints', 'Standard rate limit', 'Community support'],
  Pro: ['All endpoints', 'Elevated rate limit', 'Priority support', 'Webhooks', 'Analytics export'],
  Enterprise: ['All endpoints', 'Custom rate limits', 'Dedicated SLA', 'Webhooks', 'Analytics export', 'Custom domains', 'SSO / SAML', 'IP allowlisting'],
};

const PLAN_ICON: Record<string, React.ReactNode> = {
  Free:       <Gift   size={16} />,
  Pro:        <Star   size={16} />,
  Enterprise: <Crown  size={16} />,
};

const PLAN_GRADIENT: Record<string, string> = {
  Free:       'linear-gradient(135deg, rgba(56,189,248,.14), rgba(17,18,28,.9) 60%)',
  Pro:        'linear-gradient(135deg, rgba(139,92,246,.18), rgba(17,18,28,.9) 60%)',
  Enterprise: 'linear-gradient(135deg, rgba(245,158,11,.14), rgba(17,18,28,.9) 60%)',
};

const PLAN_ACCENT: Record<string, string> = {
  Free:       '#38bdf8',
  Pro:        '#c4b5fd',
  Enterprise: '#fbbf24',
};

const PLAN_BORDER: Record<string, string> = {
  Free:       'rgba(56,189,248,.2)',
  Pro:        'rgba(139,92,246,.35)',
  Enterprise: 'rgba(245,158,11,.25)',
};

export const TabPlans: React.FC<TabPlansProps> = ({
  plans,
  onOpenCreatePlan,
  onShowToast
}) => {
  const [view, setView] = useState('ALL');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  // Per-plan version assignment state
  const [planVersions, setPlanVersions] = useState<Record<string, string>>(() =>
    Object.fromEntries(plans.map(p => [p.id, AVAILABLE_VERSIONS[0].id]))
  );
  // Per-plan publish toggle
  const [planPublished, setPlanPublished] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(plans.map(p => [p.id, true]))
  );

  const totalSubscribers = plans.reduce((acc, p) => acc + p.subscribers, 0);
  const totalMrr = plans.reduce((acc, p) => acc + p.subscribers * p.priceMonthly, 0);
  const visiblePlans = view === 'ALL' ? plans : plans.filter(p => view === 'PAID' ? p.priceMonthly > 0 : p.priceMonthly === 0);

  const handleVersionChange = (planId: string, version: string) => {
    setPlanVersions(prev => ({ ...prev, [planId]: version }));
    const vLabel = AVAILABLE_VERSIONS.find(v => v.id === version)?.label || version;
    onShowToast(`Plan version updated to ${vLabel}`);
  };

  const handleTogglePublish = (planId: string, planName: string) => {
    setPlanPublished(prev => {
      const next = !prev[planId];
      onShowToast(`${planName} plan ${next ? 'published' : 'unpublished'}`);
      return { ...prev, [planId]: next };
    });
  };

  return (
    <div className="kly-plans-root">

      {/* ── Monetization KPIs ── */}
      <div className="kly-plans-kpi-strip">
        <div className="kly-plans-kpi">
          <div>
            <div className="kly-plans-kpi-val">{totalSubscribers.toLocaleString()}</div>
            <div className="kly-plans-kpi-label">Total Subscribers</div>
            <div className="kly-plans-kpi-trend kly-trend-up">↑ 14% this month</div>
          </div>
        </div>
        <div className="kly-plans-kpi">
          <div>
            <div className="kly-plans-kpi-val">${totalMrr.toLocaleString()}</div>
            <div className="kly-plans-kpi-label">Active MRR</div>
            <div className="kly-plans-kpi-trend kly-trend-up">↑ $420 growth</div>
          </div>
        </div>
        <div className="kly-plans-kpi">
          <div>
            <div className="kly-plans-kpi-val">${(totalMrr / (totalSubscribers || 1)).toFixed(2)}</div>
            <div className="kly-plans-kpi-label">ARPU Blend</div>
            <div className="kly-plans-kpi-trend kly-trend-neutral">Average revenue / user</div>
          </div>
        </div>
        <div className="kly-plans-kpi">
          <div>
            <div className="kly-plans-kpi-val">18.4%</div>
            <div className="kly-plans-kpi-label">Trial Conversion</div>
            <div className="kly-plans-kpi-trend kly-trend-up">↑ 2.1% last period</div>
          </div>
        </div>
      </div>

      {/* ── Governance & Filter Bar ── */}
      <div className="kly-card kly-plans-governance">
        <div className="kly-plans-gov-left">
          <ShieldCheck size={14} color="#c4b5fd" />
          <div>
            <span className="kly-eyebrow" style={{ marginBottom: 2 }}>Commercial Governance</span>
            <strong style={{ fontSize: 13, display: 'block' }}>Plans are ready for controlled publishing</strong>
            <small style={{ color: 'var(--kly-text-dim)', fontSize: 11 }}>
              Review limits, overage policy, and subscriber impact before changing a tier.
            </small>
          </div>
        </div>
        <div className="kly-plans-gov-right">
          <div className="kly-segmented-control" role="group" aria-label="Filter plans">
            <button id="plans-filter-all"  className={view === 'ALL'  ? 'is-active' : ''} onClick={() => setView('ALL')}>
              <SlidersHorizontal size={11} /> All tiers
            </button>
            <button id="plans-filter-paid" className={view === 'PAID' ? 'is-active' : ''} onClick={() => setView('PAID')}>
              Paid
            </button>
            <button id="plans-filter-free" className={view === 'FREE' ? 'is-active' : ''} onClick={() => setView('FREE')}>
              Free
            </button>
          </div>
          <button className="kly-btn kly-btn-primary" onClick={onOpenCreatePlan} id="plans-create-btn">
            <Plus size={13} />
            <span>New Tier</span>
          </button>
        </div>
      </div>

      {/* ── Plan Cards ── */}
      <div className="kly-plans-grid">
        {visiblePlans.map(p => {
          const planMrr   = p.subscribers * p.priceMonthly;
          const accent    = PLAN_ACCENT[p.name]    || '#8b5cf6';
          const border    = PLAN_BORDER[p.name]    || 'var(--kly-border-subtle)';
          const gradient  = PLAN_GRADIENT[p.name]  || 'var(--kly-bg-surface)';
          const features  = PLAN_FEATURES[p.name]  || [];
          const planIcon  = PLAN_ICON[p.name]       || <Tag size={16} />;
          const isExpanded = expandedPlan === p.id;
          const isPublished = planPublished[p.id];
          const selectedVersion = planVersions[p.id] || AVAILABLE_VERSIONS[0].id;
          const versionObj = AVAILABLE_VERSIONS.find(v => v.id === selectedVersion);

          return (
            <div
              key={p.id}
              className="kly-plans-card"
              style={{ background: gradient, borderColor: border }}
              id={`plan-card-${p.id}`}
            >
              {/* Card Header */}
              <div className="kly-plans-card-header">
                <div className="kly-plans-card-title">
                  <div>
                    <h4 className="kly-plans-name" style={{ color: accent }}>{p.name}</h4>
                    <div className="kly-plans-subscriber-count">
                      <Users size={10} />
                      <span>{p.subscribers.toLocaleString()} subscribers</span>
                    </div>
                  </div>
                </div>
                <div className="kly-plans-card-badges">
                  {p.trialDays > 0 && (
                    <span className="kly-badge kly-badge-pill" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,.3)', background: 'rgba(16,185,129,.08)', fontSize: 10 }}>
                      {p.trialDays}d trial
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="kly-plans-price-row">
                <div className="kly-plans-price">
                  {p.priceMonthly > 0 ? (
                    <>
                      <span className="kly-plans-price-amount" style={{ color: accent }}>${p.priceMonthly}</span>
                      <span className="kly-plans-price-period">/ month</span>
                    </>
                  ) : (
                    <span className="kly-plans-price-free">Free</span>
                  )}
                </div>
              </div>

              {/* ── Version Selector ── */}
              <div className="kly-plans-version-selector">
                <div className="kly-plans-version-label">
                  <GitBranch size={11} />
                  <span>API Version</span>
                  <span className="kly-plans-version-hint">which version consumers on this plan access</span>
                </div>
                <div className="kly-plans-version-control">
                  <div className="kly-plans-version-select-wrapper">
                    <GitBranch size={11} color={accent} />
                    <select
                      id={`plan-version-${p.id}`}
                      className="kly-plans-version-select"
                      value={selectedVersion}
                      onChange={e => handleVersionChange(p.id, e.target.value)}
                      style={{ color: accent }}
                    >
                      {AVAILABLE_VERSIONS.map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} color={accent} />
                  </div>
                  {versionObj && !versionObj.isDefault && (
                    <span className="kly-plans-version-warn">
                      <AlertTriangle size={10} /> Not current
                    </span>
                  )}
                </div>
              </div>

              {/* Core limits */}
              <div className="kly-plans-limits">
                <div className="kly-plans-limit-row">
                  <Check size={12} color="#34d399" />
                  <span><b>{p.requestsPerMonth.toLocaleString()}</b> requests / month</span>
                </div>
                <div className="kly-plans-limit-row">
                  <Check size={12} color="#34d399" />
                  <span><b>{p.rateLimitPerMin}</b> req / min rate limit</span>
                </div>
                <div className="kly-plans-limit-row">
                  <Check size={12} color="#34d399" />
                  <span><b>{p.overagePer1k > 0 ? `$${p.overagePer1k}` : 'No'}</b> overage per 1k</span>
                </div>
              </div>

              {/* Feature matrix expand */}
              <button
                className="kly-plans-feature-toggle"
                id={`plan-features-${p.id}`}
                onClick={() => setExpandedPlan(isExpanded ? null : p.id)}
              >
                <span>{isExpanded ? 'Hide' : 'Show'} included features</span>
                <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>

              {isExpanded && (
                <div className="kly-plans-feature-list">
                  {features.map((f, i) => (
                    <div key={i} className="kly-plans-feature-row" style={{ borderColor: `${accent}20` }}>
                      <span className="kly-plans-feature-check" style={{ color: accent }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Card Footer */}
              <div className="kly-plans-card-footer">
                <div className="kly-plans-footer-stats">
                  <div>
                    <span>Subscribers</span>
                    <strong>{p.subscribers.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>MRR</span>
                    <strong style={{ color: '#34d399' }}>${planMrr.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="kly-plans-footer-actions">
                  <button
                    className="kly-btn kly-btn-ghost"
                    id={`plan-edit-${p.id}`}
                    title="Edit plan"
                    onClick={() => onShowToast(`Editing ${p.name} plan`)}
                    style={{ fontSize: 11 }}
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    className="kly-btn kly-btn-ghost"
                    id={`plan-clone-${p.id}`}
                    title="Duplicate plan"
                    onClick={() => onShowToast(`${p.name} plan duplicated`)}
                    style={{ fontSize: 11 }}
                  >
                    <Copy size={12} />
                  </button>
                  {p.subscribers === 0 && (
                    <button
                      className="kly-btn kly-btn-ghost"
                      id={`plan-delete-${p.id}`}
                      title="Delete plan"
                      onClick={() => onShowToast(`${p.name} plan deleted`)}
                      style={{ fontSize: 11, color: '#fb7185' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  {!isPublished ? (
                    <button
                      className="kly-btn kly-btn-ghost"
                      id={`plan-publish-${p.id}`}
                      style={{ fontSize: 11, color: '#34d399', borderColor: 'rgba(52,211,153,.3)' }}
                      onClick={() => handleTogglePublish(p.id, p.name)}
                    >
                      <Unlock size={12} /> Publish
                    </button>
                  ) : (
                    <button
                      className="kly-btn kly-btn-ghost"
                      id={`plan-unpublish-${p.id}`}
                      style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}
                      onClick={() => handleTogglePublish(p.id, p.name)}
                    >
                      <Lock size={12} /> Unpublish
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!visiblePlans.length && (
          <div className="kly-card kly-empty-state" style={{ gridColumn: '1 / -1' }}>
            <Sparkles size={18} />
            <span>No tiers match this view.</span>
          </div>
        )}
      </div>
    </div>
  );
};

