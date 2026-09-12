import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { PricingPlan } from '../../types/apibuild';
import { Field } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

const fmtReq = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`;

export const StepPricing: React.FC<{
  plans: PricingPlan[]; onNext: (p: PricingPlan[]) => void; onBack: () => void;
}> = ({ plans, onNext, onBack }) => {
  const [list, setList] = useState<PricingPlan[]>(plans);
  const [editing, setEditing] = useState<PricingPlan | null>(null);
  const saveEdit = () => {
    if (!editing) return;
    setList((prev) => prev.map((p) => (p.id === editing.id ? editing : p)));
    setEditing(null);
  };
  return (
    <WizardChrome step={6} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div><h2 style={{ fontSize: 19 }}>Pricing Plans</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Decide how customers pay for requests, rate limits and overages.</p></div>
        <button className="ab2-ghost" onClick={() => setList((p) => [...p, { id: `plan-${Date.now()}`, name: `Custom ${p.length + 1}`, requestsPerMonth: 10000, priceMonthly: 9, rateLimitPerMin: 120, overagePer1k: 0.5, trialDays: 7, subscribers: 0 }])}><Plus size={14} /> Add Plan</button>
      </div>
      <div className="ab2-grid3">
        {list.map((p) => (
          <div key={p.id} className="ab2-card ab2-plan">
            <h4>{p.name}</h4>
            <div className="price">${p.priceMonthly}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mo</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtReq(p.requestsPerMonth)} requests/month</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{p.rateLimitPerMin}/min · ${p.overagePer1k}/1k overage · {p.trialDays}d trial</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="ab2-ghost" onClick={() => setEditing({ ...p })}><Pencil size={13} /> Edit</button>
              <button className="ab2-ghost" onClick={() => setList((prev) => prev.filter((x) => x.id !== p.id))}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="ab2-card" style={{ marginTop: 12, background: 'var(--bg-input)' }}>
          <h4 style={{ marginBottom: 10 }}>Edit {editing.name}</h4>
          <div className="ab2-grid2">
            <Field label="Requests per plan"><input type="number" value={editing.requestsPerMonth} onChange={(e) => setEditing({ ...editing, requestsPerMonth: Number(e.target.value) })} /></Field>
            <Field label="Price $/mo"><input type="number" value={editing.priceMonthly} onChange={(e) => setEditing({ ...editing, priceMonthly: Number(e.target.value) })} /></Field>
            <Field label="Rate limit /min"><input type="number" value={editing.rateLimitPerMin} onChange={(e) => setEditing({ ...editing, rateLimitPerMin: Number(e.target.value) })} /></Field>
            <Field label="Overage $/1k"><input type="number" step="0.01" value={editing.overagePer1k} onChange={(e) => setEditing({ ...editing, overagePer1k: Number(e.target.value) })} /></Field>
            <Field label="Trial days"><input type="number" value={editing.trialDays} onChange={(e) => setEditing({ ...editing, trialDays: Number(e.target.value) })} /></Field>
            <Field label="Subscription status"><select value="active" onChange={() => undefined}><option value="active">Active</option><option value="paused">Paused</option></select></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="ab2-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="ab2-primary" onClick={saveEdit}>Save Plan</button>
          </div>
        </div>
      )}
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ab2-primary" onClick={() => onNext(list)}>Continue to Publish <ArrowRight size={14} /></button>
      </div>
    </WizardChrome>
  );
};
