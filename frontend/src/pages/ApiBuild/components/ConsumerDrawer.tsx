import React, { useState } from 'react';
import { X, Key, ShieldCheck, DollarSign, RefreshCw, Trash2, Ban, Mail, Check, AlertCircle } from 'lucide-react';
import { ApiConsumer, ProviderApiKey } from '../../../types/apibuild';

interface ConsumerDrawerProps {
  consumer: ApiConsumer | null;
  keys: ProviderApiKey[];
  onClose: () => void;
  onRotateKey: (keyId: string) => void;
  onRevokeKey: (keyId: string) => void;
  onChangePlan: (consumerId: string, newPlan: string) => void;
  onShowToast: (msg: string) => void;
}

export const ConsumerDrawer: React.FC<ConsumerDrawerProps> = ({
  consumer,
  keys,
  onClose,
  onRotateKey,
  onRevokeKey,
  onChangePlan,
  onShowToast
}) => {
  const [selectedPlan, setSelectedPlan] = useState(consumer?.plan || 'Business');

  if (!consumer) return null;

  const consumerKeys = keys.filter(k => k.consumer.toLowerCase() === consumer.name.toLowerCase() || k.consumer === consumer.email);

  const quotaLimit = consumer.plan === 'Business' ? 500000 : consumer.plan === 'Pro' ? 50000 : 1000;
  const quotaPct = Math.min(Math.round((consumer.requests / quotaLimit) * 100), 100);

  return (
    <div className="kly-drawer-overlay" onClick={onClose}>
      <div className="kly-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--kly-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{consumer.name}</span>
              <span className={`kly-badge ${consumer.status === 'active' ? 'kly-badge-healthy' : 'kly-badge-deploying'}`}>
                {consumer.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--kly-text-dim)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={12} /> {consumer.email} · Joined {consumer.joinedAt}
            </div>
          </div>
          <button className="kly-btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Action Bar */}
        <div style={{
          padding: '10px 20px', background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--kly-border-subtle)', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <button
            className="kly-btn kly-btn-secondary"
            onClick={() => {
              const newPlan = consumer.plan === 'Business' ? 'Pro' : 'Business';
              onChangePlan(consumer.id, newPlan);
              onShowToast(`Plan updated to ${newPlan}`);
            }}
          >
            <DollarSign size={13} color="#34d399" />
            <span>Switch Plan</span>
          </button>
          <button
            className="kly-btn kly-btn-ghost"
            style={{ color: '#fb7185' }}
            onClick={() => onShowToast(`Access suspended for ${consumer.name}`)}
          >
            <Ban size={13} />
            <span>Suspend Access</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quota & Usage Bar */}
          <div className="kly-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--kly-text-muted)' }}>Monthly Quota Usage</span>
              <b style={{ fontSize: 12, color: quotaPct > 80 ? '#fbbf24' : '#34d399' }}>{quotaPct}% ({consumer.requests.toLocaleString()} / {quotaLimit.toLocaleString()} reqs)</b>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${quotaPct}%`,
                background: quotaPct > 85 ? '#f43f5e' : quotaPct > 70 ? '#fbbf24' : '#10b981',
                borderRadius: 3
              }} />
            </div>
          </div>

          {/* Telemetry Strip */}
          <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Current Plan</div>
              <div className="kly-metric-val" style={{ fontSize: 16 }}>{consumer.plan}</div>
              <div className="kly-metric-trend kly-trend-up">${consumer.plan === 'Business' ? '79' : '19'}/mo</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Total Requests</div>
              <div className="kly-metric-val" style={{ fontSize: 16 }}>{consumer.requests.toLocaleString()}</div>
              <div className="kly-metric-trend kly-trend-up">99.2% success</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Assigned Version</div>
              <div className="kly-metric-val kly-mono" style={{ fontSize: 16 }}>v2.4.1</div>
              <div className="kly-metric-trend kly-trend-neutral">Current prod</div>
            </div>
          </div>

          {/* Issued API Keys */}
          <div className="kly-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 13 }}>Consumer API Keys ({consumerKeys.length})</h4>
            </div>

            {consumerKeys.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--kly-text-dim)', fontStyle: 'italic', padding: '10px 0' }}>
                No active keys issued for this consumer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {consumerKeys.map((k) => (
                  <div key={k.id} style={{
                    padding: '8px 12px', background: '#0e0f18', borderRadius: 6,
                    border: '1px solid var(--kly-border-subtle)', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="kly-mono" style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
                          {k.prefix}...
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                          {k.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', marginTop: 2 }}>
                        Last used: {k.lastUsed}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="kly-btn-icon"
                        title="Rotate key with 48h grace period"
                        onClick={() => { onRotateKey(k.id); onShowToast(`Key rotated for ${consumer.name}`); }}
                      >
                        <RefreshCw size={12} color="#10b981" />
                      </button>
                      <button
                        className="kly-btn-icon"
                        title="Revoke key immediately"
                        onClick={() => { onRevokeKey(k.id); onShowToast(`Key revoked`); }}
                      >
                        <Trash2 size={12} color="#fb7185" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
