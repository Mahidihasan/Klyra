import React, { useState } from 'react';
import { Database, RefreshCw, ServerCrash } from 'lucide-react';

export const CacheInvalidation = () => {
  const [purgeTarget, setPurgeTarget] = useState('api:weather:*');
  const [isPurging, setIsPurging] = useState(false);

  const handlePurge = () => {
    setIsPurging(true);
    setTimeout(() => {
      setIsPurging(false);
      alert(`Cache matching pattern "${purgeTarget}" purged successfully.`);
    }, 1500);
  };

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Database size={16} color="#3b82f6" /> Redis Cache Control
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Target Pattern / Key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              value={purgeTarget}
              onChange={e => setPurgeTarget(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-mono)' }}
            />
            <button 
              onClick={handlePurge}
              disabled={isPurging}
              style={{ 
                background: 'rgba(245,158,11,0.1)', 
                color: '#f59e0b', 
                border: '1px solid rgba(245,158,11,0.3)', 
                padding: '8px 16px', 
                borderRadius: 6, 
                fontSize: 13, 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={14} className={isPurging ? 'spin-icon' : ''} /> {isPurging ? 'Purging...' : 'Purge Keys'}
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <ServerCrash size={18} color="#ef4444" style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>Emergency Global Flush</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>This will instantly evict all cached responses globally. Expect a massive spike in backend load.</div>
            <button style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Flush All</button>
          </div>
        </div>
      </div>
      <style>{`
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
