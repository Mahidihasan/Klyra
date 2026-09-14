import React, { useState } from 'react';

// Mock Plan Data Structure
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  isActive: boolean;
  isPopular?: boolean;
}

const initialPlans: SubscriptionPlan[] = [
  { id: 'plan_1', name: 'Free Tier', price: 0, interval: 'monthly', features: ['10,000 API Calls / mo', 'Community Support', 'Standard Endpoints'], isActive: true },
  { id: 'plan_2', name: 'Developer Pro', price: 49, interval: 'monthly', features: ['100,000 API Calls / mo', 'Priority Email Support', 'Premium Endpoints', 'Advanced Analytics'], isActive: true, isPopular: true },
  { id: 'plan_3', name: 'Enterprise', price: 299, interval: 'monthly', features: ['Unlimited API Calls', '24/7 Dedicated Support', 'Custom Rate Limits', 'White-labeling'], isActive: true },
];

export const PlanManager = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(initialPlans);

  const togglePlanStatus = (id: string) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const handleEdit = (id: string) => {
    alert(`Opening Edit Modal for plan: ${id}`);
  };

  const handleCreate = () => {
    alert('Opening Create Plan Modal');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Subscription Tiers</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage platform pricing plans and features dynamically.</p>
        </div>
        <button 
          onClick={handleCreate}
          style={{ background: 'var(--accent-purple)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}
        >
          + Create New Plan
        </button>
      </div>

      <div className="plans-grid">
        {plans.map(plan => (
          <div key={plan.id} className={`plan-card ${plan.isPopular ? 'is-popular' : ''}`} style={{ opacity: plan.isActive ? 1 : 0.5 }}>
            <div className="plan-header">
              <span className="plan-name">{plan.name}</span>
              {plan.isPopular && <span style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Popular</span>}
            </div>
            
            <div className="plan-price">
              ${plan.price}<span>/{plan.interval === 'monthly' ? 'mo' : 'yr'}</span>
            </div>

            <div className="plan-features">
              {plan.features.map((f, i) => (
                <div key={i} className="feature-item">
                  <span style={{ color: '#22c55e' }}>✓</span> {f}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <button className="btn-ghost-action" style={{ flex: 1 }} onClick={() => handleEdit(plan.id)}>Edit Plan</button>
              <button 
                className={`btn-ghost-action ${plan.isActive ? 'btn-danger-action' : ''}`} 
                style={{ flex: 1 }}
                onClick={() => togglePlanStatus(plan.id)}
              >
                {plan.isActive ? 'Archive' : 'Restore'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
