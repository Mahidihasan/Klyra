import React from 'react';
import { Droplet, Mail, CreditCard, Clock } from 'lucide-react';

const MOCK_LEAKS = [
  { id: 'lk_1', user: 'usr_812', amount: 450.00, issue: 'Card Expired', date: '2 days ago' },
  { id: 'lk_2', user: 'usr_441', amount: 1200.00, issue: 'Insufficient Funds', date: '5 days ago' },
];

export const RevenueLeakage = () => {
  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <Droplet size={16} color="#ef4444" /> Revenue Leakage Monitor
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Active uncollected funds</p>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
          $1,650.00
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MOCK_LEAKS.map(leak => (
          <div key={leak.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{leak.user}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={12} /> {leak.issue} • <Clock size={12} /> {leak.date}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>${leak.amount.toFixed(2)}</span>
              <button style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <Mail size={14} /> Dunning
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
