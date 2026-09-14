import React, { useState } from 'react';
import { Search, FileText, ChevronDown, ChevronRight, XCircle } from 'lucide-react';

const MOCK_LINE_ITEMS = [
  { id: 'li_1', endpoint: 'GET /api/v1/weather', calls: 14500, rate: 0.001, total: 14.50, waived: false },
  { id: 'li_2', endpoint: 'POST /api/v1/ml/predict', calls: 200, rate: 0.05, total: 10.00, waived: false },
  { id: 'li_3', endpoint: 'GET /api/v2/auth', calls: 54000, rate: 0.0001, total: 5.40, waived: false },
];

export const InvoiceForensics = () => {
  const [invoiceId, setInvoiceId] = useState('inv_8B9X2Y');
  const [items, setItems] = useState(MOCK_LINE_ITEMS);
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleWaive = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, waived: !item.waived } : item));
  };

  const totalBilled = items.reduce((acc, curr) => curr.waived ? acc : acc + curr.total, 0);

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <FileText size={16} color="#3b82f6" /> Invoice Forensics
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text" 
            value={invoiceId} 
            onChange={e => setInvoiceId(e.target.value)} 
            style={{ background: 'transparent', border: 'none', color: '#3b82f6', outline: 'none', width: 100, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 2fr 1fr 1fr 1fr 80px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          <div></div>
          <div>Endpoint</div>
          <div style={{ textAlign: 'right' }}>Calls</div>
          <div style={{ textAlign: 'right' }}>Rate</div>
          <div style={{ textAlign: 'right' }}>Total</div>
          <div style={{ textAlign: 'right' }}>Action</div>
        </div>

        {items.map(item => (
          <div key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 2fr 1fr 1fr 1fr 80px', padding: '12px 16px', alignItems: 'center', background: item.waived ? 'rgba(239,68,68,0.05)' : 'transparent', opacity: item.waived ? 0.6 : 1 }}>
              <div onClick={() => setExpanded(expanded === item.id ? null : item.id)} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                {expanded === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: item.waived ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.waived ? 'line-through' : 'none' }}>{item.endpoint}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{item.calls.toLocaleString()}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-muted)' }}>${item.rate}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600, color: item.waived ? 'var(--text-muted)' : '#22c55e' }}>
                ${item.total.toFixed(2)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button 
                  onClick={() => toggleWaive(item.id)}
                  style={{ background: 'none', border: 'none', color: item.waived ? 'var(--text-muted)' : '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}
                >
                  <XCircle size={12} /> {item.waived ? 'Unwaive' : 'Waive'}
                </button>
              </div>
            </div>
            {expanded === item.id && (
              <div style={{ padding: '12px 16px 12px 48px', background: 'rgba(0,0,0,0.2)', fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ marginBottom: 4 }}>Breakdown strategy: Daily Aggregate</div>
                <div>Avg Latency: 42ms | Error Rate: 0.01%</div>
                <button style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>View Raw Logs</button>
              </div>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adjusted Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>${totalBilled.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
