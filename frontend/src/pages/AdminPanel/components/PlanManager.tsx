import React, { useState } from 'react';
import { Check, Edit2, Zap, Save, Archive } from 'lucide-react';

const INITIAL_PLANS = [
  { id: 'free', name: 'Freemium', price: 0, interval: 'month', limit: '100 req/min', features: ['Public APIs', 'Community Support'] },
  { id: 'basic', name: 'Basic', price: 15, interval: 'month', limit: '500 req/min', features: ['All Free Features', 'Email Support'] },
  { id: 'pro', name: 'Pro', price: 49, interval: 'month', limit: '5,000 req/min', features: ['Premium APIs', 'Priority Support', 'Custom Overrides'] },
  { id: 'ent', name: 'Enterprise', price: 299, interval: 'month', limit: 'Unlimited', features: ['Dedicated Node', 'SLA', '24/7 Phone Support'] },
];

export const PlanManager = () => {
  const [plans, setPlans] = useState(INITIAL_PLANS);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Temporary edit state
  const [editForm, setEditForm] = useState<any>({});

  const startEdit = (plan: any) => {
    setEditingId(plan.id);
    setEditForm(plan);
  };

  const saveEdit = () => {
    setPlans(prev => prev.map(p => p.id === editingId ? editForm : p));
    setEditingId(null);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={20} color="#a78bfa" />
          Subscription Tiers
        </h2>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6 }}>
          + Create New Tier
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {plans.map(plan => (
          <div key={plan.id} style={{ 
            background: editingId === plan.id ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', 
            border: '1px solid',
            borderColor: editingId === plan.id ? '#a78bfa' : 'rgba(255,255,255,0.05)',
            borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column'
          }}>
            
            {editingId === plan.id ? (
              // EDIT MODE
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <input 
                  type="text" value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24, color: '#fff', fontWeight: 700 }}>$</span>
                  <input 
                    type="number" value={editForm.price} 
                    onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 24, fontWeight: 700, width: '100%' }}
                  />
                </div>
                <input 
                  type="text" value={editForm.limit} 
                  onChange={e => setEditForm({...editForm, limit: e.target.value})}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#a78bfa', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-mono)' }}
                />
                
                <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveEdit} style={{ flex: 1, padding: 8, background: '#a78bfa', border: 'none', color: '#000', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}><Save size={14} /> Save</button>
                </div>
              </div>
            ) : (
              // VIEW MODE
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{plan.name}</h3>
                  <button onClick={() => startEdit(plan)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  ${plan.price} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/{plan.interval}</span>
                </div>
                <div style={{ fontSize: 13, color: '#a78bfa', fontFamily: 'var(--font-mono)', marginBottom: 24, padding: '4px 8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: 4, display: 'inline-block', width: 'fit-content' }}>
                  Limit: {plan.limit}
                </div>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
                  {plan.features.map((f: string, i: number) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      <Check size={14} color="#22c55e" /> {f}
                    </li>
                  ))}
                </ul>

                <button style={{ marginTop: 24, width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                  <Archive size={14} /> Archive Tier
                </button>
              </div>
            )}
            
          </div>
        ))}
      </div>
    </div>
  );
};
