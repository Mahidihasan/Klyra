import React, { useState } from 'react';
import { PenTool, DollarSign, Plus, Minus, Percent } from 'lucide-react';

export const CustomLedger = () => {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('CREDIT');
  const [reason, setReason] = useState('');

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <PenTool size={16} color="#8b5cf6" /> Custom Ledger Entries
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Manually inject credits, absolute discounts, or penalties into a user's upcoming invoice cycle.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Target User ID</label>
          <input 
            type="text" 
            placeholder="usr_..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-mono)' }}
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Amount</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: 9, color: 'var(--text-muted)' }}><DollarSign size={14} /></div>
              <input 
                type="number" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 12px 8px 32px', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Entry Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
            >
              <option value="CREDIT">Promotional Credit</option>
              <option value="DISCOUNT">Percentage Discount</option>
              <option value="PENALTY">Penalty Charge</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Internal Reason (Audit Trail)</label>
          <input 
            type="text" 
            placeholder="e.g. Compensating for outage on 10/14"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
          />
        </div>

        <button style={{ background: 'var(--accent-purple)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
          {type === 'CREDIT' ? <Plus size={16} /> : type === 'PENALTY' ? <Minus size={16} /> : <Percent size={16} />} 
          Apply {type.toLowerCase()}
        </button>
      </div>
    </div>
  );
};
