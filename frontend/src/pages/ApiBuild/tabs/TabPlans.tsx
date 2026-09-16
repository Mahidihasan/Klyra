import React, { useState } from 'react';
import { Plus, Check, Sparkles, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { PricingPlan } from '../../../types/apibuild';

interface TabPlansProps {
  plans: PricingPlan[];
  onOpenCreatePlan: () => void;
  onShowToast: (msg: string) => void;
}

export const TabPlans: React.FC<TabPlansProps> = ({
  plans,
  onOpenCreatePlan,
  onShowToast
}) => {
  const [view, setView] = useState('ALL');
  const totalSubscribers = plans.reduce((acc, p) => acc + p.subscribers, 0);
  const totalMrr = plans.reduce((acc, p) => acc + p.subscribers * p.priceMonthly, 0);
  const visiblePlans = view === 'ALL' ? plans : plans.filter((plan) => view === 'PAID' ? plan.priceMonthly > 0 : plan.priceMonthly === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Monetization KPIs */}
      <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Total Subscribers</div>
          <div className="kly-metric-val">{totalSubscribers.toLocaleString()}</div>
          <div className="kly-metric-trend kly-trend-up">↑ 14% this month</div>
        </div>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Active MRR</div>
          <div className="kly-metric-val">${totalMrr.toLocaleString()}</div>
          <div className="kly-metric-trend kly-trend-up">↑ $420 growth</div>
        </div>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Average Revenue / User</div>
          <div className="kly-metric-val">${(totalMrr / (totalSubscribers || 1)).toFixed(2)}</div>
          <div className="kly-metric-trend kly-trend-neutral">ARPU blend</div>
        </div>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Trial Conversion</div>
          <div className="kly-metric-val">18.4%</div>
          <div className="kly-metric-trend kly-trend-up">↑ 2.1%</div>
        </div>
      </div>

      <div className="kly-card kly-plan-controls">
        <div><span className="kly-eyebrow"><ShieldCheck size={12} /> Commercial governance</span><strong>Plans are ready for controlled publishing</strong><small>Review limits, overage policy, and subscriber impact before changing a tier.</small></div>
        <div className="kly-segmented-control" role="group" aria-label="Filter plans">
          <button className={view === 'ALL' ? 'is-active' : ''} onClick={() => setView('ALL')}><SlidersHorizontal size={12} /> All tiers</button>
          <button className={view === 'PAID' ? 'is-active' : ''} onClick={() => setView('PAID')}>Paid</button>
          <button className={view === 'FREE' ? 'is-active' : ''} onClick={() => setView('FREE')}>Free</button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="kly-grid-3col">
        {visiblePlans.map((p) => {
          const planMrr = p.subscribers * p.priceMonthly;
          const isPopular = p.name.toLowerCase() === 'pro';
          return (
            <div
              key={p.id}
              className="kly-card"
              style={{
                borderColor: isPopular ? 'var(--kly-primary)' : 'var(--kly-border-subtle)',
                background: isPopular ? 'rgba(139,92,246,0.04)' : 'var(--kly-bg-surface)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</h4>
                  {isPopular && <span className="kly-badge kly-badge-pill" style={{ color: '#c4b5fd', borderColor: 'var(--kly-border-violet)' }}>Popular</span>}
                </div>

                <div style={{ fontSize: 26, fontWeight: 800, margin: '8px 0 14px 0', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span>${p.priceMonthly}</span>
                  <span style={{ fontSize: 12, color: 'var(--kly-text-dim)', fontWeight: 500 }}>/ month</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={14} color="#34d399" />
                    <span><b>{p.requestsPerMonth.toLocaleString()}</b> requests / month</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={14} color="#34d399" />
                    <span><b>{p.rateLimitPerMin}</b> req / minute rate limit</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={14} color="#34d399" />
                    <span><b>{p.trialDays > 0 ? `${p.trialDays} days` : 'No'}</b> free trial</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={14} color="#34d399" />
                    <span>${p.overagePer1k || 0.3} per 1k overage</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--kly-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>Subscribers</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.subscribers.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>Monthly Revenue</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>${planMrr.toLocaleString()}</div>
                </div>
              </div>
            </div>
          );
        })}
        {!visiblePlans.length && <div className="kly-card kly-empty-state"><Sparkles size={18} /><span>No tiers match this view.</span></div>}
      </div>

      {/* Footer Add Plan action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="kly-btn kly-btn-primary" onClick={onOpenCreatePlan}>
          <Plus size={13} />
          <span>Create New Pricing Tier</span>
        </button>
      </div>
    </div>
  );
};
