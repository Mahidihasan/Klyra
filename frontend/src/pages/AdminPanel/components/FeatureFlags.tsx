import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Flag } from 'lucide-react';

const INITIAL_FLAGS = [
  { id: 'ff_1', name: 'New Payment Gateway', description: 'Route processing to Stripe v3 API', enabled: true, rollout: 100 },
  { id: 'ff_2', name: 'Beta Auth Flow', description: 'Passwordless login using Passkeys', enabled: false, rollout: 0 },
  { id: 'ff_3', name: 'GraphQL Endpoint', description: 'Enable experimental GraphQL API', enabled: true, rollout: 25 },
];

export const FeatureFlags = () => {
  const [flags, setFlags] = useState(INITIAL_FLAGS);

  const toggleFlag = (id: string) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const updateRollout = (id: string, val: number) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, rollout: val } : f));
  };

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Flag size={16} color="#a78bfa" /> Feature Flag Manager
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {flags.map(flag => (
          <div key={flag.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{flag.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{flag.description}</div>
              </div>
              <button 
                onClick={() => toggleFlag(flag.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: flag.enabled ? '#22c55e' : 'var(--text-muted)', padding: 0 }}
              >
                {flag.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Rollout</span>
              <input 
                type="range" 
                min="0" max="100" 
                value={flag.rollout}
                onChange={(e) => updateRollout(flag.id, parseInt(e.target.value))}
                disabled={!flag.enabled}
                style={{ flex: 1, accentColor: flag.enabled ? '#a78bfa' : '#52525b', opacity: flag.enabled ? 1 : 0.5 }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: flag.enabled ? '#a78bfa' : 'var(--text-muted)', width: 32, textAlign: 'right' }}>
                {flag.rollout}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
