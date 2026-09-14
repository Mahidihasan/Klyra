import React, { useState } from 'react';
import { Zap, AlertTriangle, CheckCircle } from 'lucide-react';

const MOCK_BREAKERS = [
  { id: 'b_1', name: 'OpenWeather Upstream', status: 'CLOSED', desc: 'Main weather data provider' },
  { id: 'b_2', name: 'Stripe Billing Webhooks', status: 'CLOSED', desc: 'Critical revenue path' },
  { id: 'b_3', name: 'Legacy Geo-IP Resolver', status: 'TRIPPED', desc: 'Failing > 30% of requests' },
];

export const CircuitBreakers = () => {
  const [breakers, setBreakers] = useState(MOCK_BREAKERS);

  const handleToggle = (id: string) => {
    setBreakers(prev => prev.map(b => {
      if (b.id === id) {
        return { ...b, status: b.status === 'CLOSED' ? 'TRIPPED' : 'CLOSED' };
      }
      return b;
    }));
  };

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Zap size={16} color="#ef4444" /> Circuit Breakers
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Instantly cut off traffic to failing backends. Tripped circuits return HTTP 503 at the gateway edge.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {breakers.map(b => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: b.status === 'TRIPPED' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${b.status === 'TRIPPED' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)'}`, padding: '12px 16px', borderRadius: 8, transition: 'all 0.3s ease' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: b.status === 'TRIPPED' ? '#ef4444' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {b.name}
                {b.status === 'TRIPPED' && <AlertTriangle size={14} color="#ef4444" className="pulse-alert" />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.desc}</div>
            </div>
            
            <button 
              onClick={() => handleToggle(b.id)}
              style={{ 
                padding: '6px 12px', 
                borderRadius: 6, 
                fontSize: 12, 
                fontWeight: 600, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                background: b.status === 'CLOSED' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: b.status === 'CLOSED' ? '#ef4444' : '#22c55e',
                border: `1px solid ${b.status === 'CLOSED' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`
              }}
            >
              {b.status === 'CLOSED' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {b.status === 'CLOSED' ? 'Trip Circuit' : 'Reset Circuit'}
            </button>
          </div>
        ))}
      </div>
      <style>{`
        .pulse-alert {
          animation: pulse-red 2s infinite;
        }
        @keyframes pulse-red {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
