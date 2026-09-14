import React, { useState } from 'react';
import { Search, Download, CornerUpLeft, CheckCircle2 } from 'lucide-react';

const MOCK_LEDGER = [
  { id: 'txn_98a72', user: 'user_dev1', amount: 49.00, status: 'Success', date: '2026-09-14 08:30:12', method: 'Card •••• 4242' },
  { id: 'txn_98a71', user: 'user_x99a', amount: 299.00, status: 'Success', date: '2026-09-14 07:15:00', method: 'Bank Transfer' },
  { id: 'txn_98a70', user: 'user_fail', amount: 15.00, status: 'Failed', date: '2026-09-13 22:40:11', method: 'Card •••• 5555' },
  { id: 'txn_98a69', user: 'user_old1', amount: 49.00, status: 'Success', date: '2026-09-13 14:20:00', method: 'Card •••• 1234' },
  { id: 'txn_98a68', user: 'user_x99a', amount: 299.00, status: 'Success', date: '2026-09-12 09:10:00', method: 'Bank Transfer' },
];

export const TransactionLedger = () => {
  const [ledger, setLedger] = useState(MOCK_LEDGER);
  const [search, setSearch] = useState('');
  
  // Optimistic UI state for tracking which txns are refunding or refunded
  const [refunding, setRefunding] = useState<string[]>([]);
  const [refunded, setRefunded] = useState<string[]>([]);

  const handleProcessRefund = (id: string) => {
    // Optimistic UI: Immediately show "Refunding..." state
    setRefunding(prev => [...prev, id]);
    
    // Simulate network delay
    setTimeout(() => {
      setRefunding(prev => prev.filter(txId => txId !== id));
      setRefunded(prev => [...prev, id]);
      
      // Update actual ledger state to 'Refunded'
      setLedger(prev => prev.map(tx => tx.id === id ? { ...tx, status: 'Refunded' } : tx));
    }, 600); // Fast 600ms fake delay for buttery feel
  };

  const filteredLedger = ledger.filter(tx => tx.id.includes(search) || tx.user.includes(search));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Transaction Ledger</h2>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input 
              type="text" 
              placeholder="Search TXN or User..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '8px 12px 8px 32px', borderRadius: 6, fontSize: 13, width: 250 }}
            />
          </div>
          <button style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(20, 21, 36, 0.6)', border: '1px solid var(--border-card)', borderRadius: 12, flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'rgba(20, 21, 36, 0.95)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
            <tr>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)' }}>Transaction ID</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)' }}>Date</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)' }}>User</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)' }}>Method</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)' }}>Status</th>
              <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-card)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map(tx => (
              <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                <td style={{ padding: '16px 24px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{tx.id}</td>
                <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-secondary)' }}>{tx.date}</td>
                <td style={{ padding: '16px 24px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{tx.user}</td>
                <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-secondary)' }}>{tx.method}</td>
                <td style={{ padding: '16px 24px', fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right', fontWeight: 600 }}>
                  ${tx.amount.toFixed(2)}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: tx.status === 'Success' ? 'rgba(34,197,94,0.1)' : tx.status === 'Failed' ? 'rgba(239,68,68,0.1)' : 'rgba(168,162,158,0.1)',
                    color: tx.status === 'Success' ? '#22c55e' : tx.status === 'Failed' ? '#ef4444' : '#a8a29e',
                    border: `1px solid ${tx.status === 'Success' ? 'rgba(34,197,94,0.3)' : tx.status === 'Failed' ? 'rgba(239,68,68,0.3)' : 'rgba(168,162,158,0.3)'}`
                  }}>
                    {tx.status}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  {tx.status === 'Success' && !refunding.includes(tx.id) && !refunded.includes(tx.id) && (
                    <button 
                      onClick={() => handleProcessRefund(tx.id)}
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <CornerUpLeft size={12} /> Refund
                    </button>
                  )}
                  {refunding.includes(tx.id) && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <div className="spin-icon" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%' }}></div>
                      Refunding...
                    </span>
                  )}
                  {refunded.includes(tx.id) && (
                    <span style={{ fontSize: 12, color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <CheckCircle2 size={12} /> Refunded
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filteredLedger.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
