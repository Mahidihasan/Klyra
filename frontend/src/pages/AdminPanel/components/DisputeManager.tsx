import React from 'react';
import { AlertCircle, FileQuestion, ArrowRightLeft } from 'lucide-react';

export const DisputeManager = () => {
  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <AlertCircle size={16} color="#f59e0b" /> Dispute Manager
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left: User Claim */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileQuestion size={14} /> User Claim (usr_992)
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 16 }}>
            "I am being billed for 50,000 requests to the ML endpoint, but my server logs only show 12,000 successful requests. The rest were 502s from your end."
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Billed Amount</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>$2,500.00</div>
          </div>
        </div>

        {/* Right: System Logs */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowRightLeft size={14} /> System Reality
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total 200 OK:</span>
              <span style={{ color: '#22c55e' }}>12,041</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total 502 Bad Gateway:</span>
              <span style={{ color: '#ef4444' }}>37,959</span>
            </div>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Actual Billable Amount</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>$602.05</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Reject Dispute</button>
        <button style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Approve Adjustment</button>
      </div>
    </div>
  );
};
