import React, { useState } from 'react';
import { X, DollarSign, Sparkles, Check } from 'lucide-react';
import { PricingPlan } from '../../../types/apibuild';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePlan: (plan: PricingPlan) => void;
  onShowToast: (msg: string) => void;
}

export const CreatePlanModal: React.FC<CreatePlanModalProps> = ({
  isOpen,
  onClose,
  onCreatePlan,
  onShowToast
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(29);
  const [reqs, setReqs] = useState(100000);
  const [rateLimit, setRateLimit] = useState(600);
  const [overage, setOverage] = useState(0.35);
  const [trialDays, setTrialDays] = useState(14);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    const newPlan: PricingPlan = {
      id: `plan-${Date.now()}`,
      name: name.trim(),
      priceMonthly: Number(price),
      requestsPerMonth: Number(reqs),
      rateLimitPerMin: Number(rateLimit),
      overagePer1k: Number(overage),
      trialDays: Number(trialDays),
      subscribers: 0
    };
    onCreatePlan(newPlan);
    onShowToast(`Pricing plan "${newPlan.name}" created`);
    onClose();
  };

  return (
    <div className="kly-modal-overlay" onClick={onClose}>
      <div className="kly-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="kly-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} color="#34d399" />
            <h3 style={{ fontSize: 15 }}>Create Pricing Plan</h3>
          </div>
          <button className="kly-btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="kly-modal-body">
          <div className="kly-input-group">
            <label className="kly-label">Plan Tier Name</label>
            <input
              type="text"
              className="kly-input"
              placeholder="e.g. Growth, Enterprise Starter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="kly-input-group">
              <label className="kly-label">Monthly Price ($ USD)</label>
              <input
                type="number"
                className="kly-input"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="kly-input-group">
              <label className="kly-label">Trial Period (Days)</label>
              <input
                type="number"
                className="kly-input"
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="kly-input-group">
              <label className="kly-label">Requests Quota (Monthly)</label>
              <input
                type="number"
                className="kly-input"
                value={reqs}
                onChange={(e) => setReqs(Number(e.target.value))}
              />
            </div>
            <div className="kly-input-group">
              <label className="kly-label">Rate Limit (req/min)</label>
              <input
                type="number"
                className="kly-input"
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="kly-input-group">
            <label className="kly-label">Overage Fee (per 1,000 requests above quota)</label>
            <input
              type="number"
              step="0.05"
              className="kly-input"
              value={overage}
              onChange={(e) => setOverage(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="kly-modal-footer">
          <button className="kly-btn kly-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="kly-btn kly-btn-primary" disabled={!name.trim()} onClick={handleSubmit}>
            Save Plan
          </button>
        </div>
      </div>
    </div>
  );
};
