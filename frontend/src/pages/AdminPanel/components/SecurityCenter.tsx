import React, { useState } from 'react';
import { AlertTriangle, Key, Globe, Clock, Trash2, X, ShieldCheck } from 'lucide-react';

const MOCK_ANOMALIES = [
  { id: 'an_1', user: 'user_992x', email: 'dev@shadow.net', type: 'Concurrent Logins', details: 'Active sessions in US and RU simultaneously.', time: '10 mins ago', risk: 'High' },
  { id: 'an_2', user: 'user_45a1', email: 'billing@corp.com', type: 'API Key Leak', details: 'Pattern matching Klyra keys found on public GitHub repo.', time: '1 hour ago', risk: 'Critical' },
  { id: 'an_3', user: 'user_llm2', email: 'bot@ai.io', type: 'Rate Limit Abuse', details: '9,000+ requests dropped in 60s.', time: '3 hours ago', risk: 'Medium' }
];

export const SecurityCenter = () => {
  const [anomalies, setAnomalies] = useState(MOCK_ANOMALIES);
  const [revokeModalTarget, setRevokeModalTarget] = useState<any>(null);

  const handleRevoke = () => {
    // Perform revocation
    setAnomalies(prev => prev.filter(a => a.id !== revokeModalTarget.id));
    setRevokeModalTarget(null);
  };

  return (
    <div className="security-center-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <AlertTriangle size={24} color="#ef4444" />
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Security Center</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Detect anomalies and instantly revoke compromised credentials.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        
        {/* Left Side: Anomalies List */}
        <div style={{ flex: 2 }}>
          <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>Detected Anomalies (24h)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {anomalies.map(anomaly => (
              <div key={anomaly.id} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 16, borderRadius: 12, display: 'flex', gap: 16 }}>
                <div style={{ marginTop: 2 }}>
                  {anomaly.risk === 'Critical' ? <AlertTriangle size={20} color="#ef4444" /> : <Globe size={20} color="#f59e0b" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: anomaly.risk === 'Critical' ? '#ef4444' : '#f59e0b' }}>{anomaly.type}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {anomaly.time}</span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-primary)' }}>{anomaly.details}</p>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>User: <span style={{ fontFamily: 'var(--font-mono)' }}>{anomaly.user}</span> ({anomaly.email})</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button 
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setRevokeModalTarget(anomaly)}
                  >
                    <Key size={14} /> Revoke Keys
                  </button>
                </div>
              </div>
            ))}

            {anomalies.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <ShieldCheck size={40} color="#22c55e" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                No active threats detected.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Global Security Metrics */}
        <div style={{ flex: 1 }}>
           <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>System Security Status</h3>
           <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div>
               <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Active API Keys</div>
               <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>12,450</div>
             </div>
             <div>
               <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Blocked IPs (24h)</div>
               <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22c55e' }}>842</div>
             </div>
             <div>
               <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>MFA Adoption Rate</div>
               <div style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>68%</div>
             </div>
           </div>
        </div>

      </div>

      {/* Revocation Modal */}
      {revokeModalTarget && (
        <div className="drawer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content-lg" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={20} /> Revoke API Keys</h2>
              <button className="drawer-close" onClick={() => setRevokeModalTarget(null)}><X size={16} /></button>
            </div>
            
            <p style={{ color: 'var(--text-primary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to permanently revoke all API keys for <strong>{revokeModalTarget.email}</strong>? 
              This will instantly drop all active connections relying on these keys.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-secondary" onClick={() => setRevokeModalTarget(null)} style={{ padding: '8px 16px', borderRadius: 6 }}>Cancel</button>
              <button 
                className="btn-danger" 
                onClick={handleRevoke}
                style={{ padding: '8px 16px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <Trash2 size={16} /> Yes, Revoke Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
