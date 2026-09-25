import React, { useState } from 'react';
import { SplitSquareHorizontal, ArrowRight } from 'lucide-react';

export const DynamicRouting = () => {
  const [canaryWeight, setCanaryWeight] = useState(20);

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <SplitSquareHorizontal size={16} color="#a78bfa" /> Traffic Splitting (Canary)
      </h3>
      
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>Target Route</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>/api/v2/auth/*</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{100 - canaryWeight}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stable (v1.9)</div>
          </div>
          
          <ArrowRight size={20} color="var(--text-muted)" />
          
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#a78bfa' }}>{canaryWeight}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Canary (v2.0-rc)</div>
          </div>
        </div>
      </div>

      <div>
        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <span>Adjust Weight</span>
        </label>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={canaryWeight}
          onChange={(e) => setCanaryWeight(parseInt(e.target.value))}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#a78bfa' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            Deploy Rules
          </button>
        </div>
      </div>
    </div>
  );
};
