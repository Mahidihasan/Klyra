import React, { useState } from 'react';
import { ShieldAlert, Zap, ServerCrash, Save } from 'lucide-react';

export const RateLimiter = () => {
  const [limits, setLimits] = useState({
    free: 100,
    pro: 1000,
    enterprise: 10000
  });

  return (
    <div className="rate-limiter-container">
      
      {/* Emergency Kill Switch */}
      <div className="kill-switch-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div className="danger-icon-wrapper">
            <ShieldAlert size={32} color="#ef4444" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 8px', color: '#ef4444', fontSize: 20 }}>Emergency Gateway Override</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              Instantly drop all incoming unauthenticated traffic or enforce an absolute global rate limit across all nodes. Use only under active DDoS or severe platform degradation.
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
          <button className="btn-danger-solid">
            <ServerCrash size={16} /> Drop Unauthenticated Traffic
          </button>
          <button className="btn-danger-outline">
            Ban Malicious IP Range
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        
        {/* Tier Limits */}
        <div className="config-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <Zap size={18} color="#a78bfa" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Global Tier Limits</h3>
          </div>

          <div className="slider-group">
            <div className="slider-label">
              <span>Free Tier (req/min)</span>
              <span className="mono-text">{limits.free}</span>
            </div>
            <input 
              type="range" min="10" max="500" value={limits.free} 
              onChange={e => setLimits({...limits, free: parseInt(e.target.value)})}
              className="klyra-slider"
            />
          </div>

          <div className="slider-group">
            <div className="slider-label">
              <span>Pro Tier (req/min)</span>
              <span className="mono-text">{limits.pro}</span>
            </div>
            <input 
              type="range" min="100" max="5000" value={limits.pro} 
              onChange={e => setLimits({...limits, pro: parseInt(e.target.value)})}
              className="klyra-slider"
            />
          </div>

          <div className="slider-group">
            <div className="slider-label">
              <span>Enterprise Tier (req/min)</span>
              <span className="mono-text">{limits.enterprise.toLocaleString()}</span>
            </div>
            <input 
              type="range" min="1000" max="50000" step="1000" value={limits.enterprise} 
              onChange={e => setLimits({...limits, enterprise: parseInt(e.target.value)})}
              className="klyra-slider"
            />
          </div>
          
          <button className="btn-primary" style={{ marginTop: 24, width: '100%' }}>
            <Save size={16} /> Apply Global Limits
          </button>
        </div>

        {/* Custom Overrides */}
        <div className="config-card">
           <h3 style={{ margin: '0 0 24px', fontSize: 16 }}>Custom API Overrides</h3>
           <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
             Target specific APIs that are exceptionally resource intensive (e.g., Heavy LLM Inference) to bypass global tier limits.
           </p>

           <div className="override-list">
             <div className="override-item">
               <div>
                 <div style={{ fontWeight: 600, fontSize: 13 }}>DeepSeek Coder Inference</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>api_x9j2</div>
               </div>
               <div className="override-limit">50 req/min</div>
             </div>
             <div className="override-item">
               <div>
                 <div style={{ fontWeight: 600, fontSize: 13 }}>Video Render Engine</div>
                 <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>api_v2r</div>
               </div>
               <div className="override-limit">10 req/min</div>
             </div>
           </div>

           <button className="btn-ghost" style={{ marginTop: 16, width: '100%' }}>
             + Add Custom Override
           </button>
        </div>

      </div>
    </div>
  );
};
