import React from 'react';
import { Shield, Cpu, Activity, AlertTriangle, Crosshair } from 'lucide-react';

export const AIThreatDetection = () => {
  return (
    <div className="threat-grid">
      <div className="threat-main-panel">
        <h2 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <Cpu size={20} color="#8b5cf6" /> Live Neural Threat Analysis
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>Traffic Analysis State</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontWeight: 600 }}>
              <Activity size={16} /> Scanning Live Streams (99.9% clean)
            </div>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>Automated Mitigations</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 600 }}>
              <Shield size={16} color="#8b5cf6" /> 14 IPs Banned Last 24h
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>Detected Anomalies (Real-time)</h3>
        
        <div className="threat-alert-card">
          <AlertTriangle size={24} className="threat-alert-icon" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>DDoS Pattern Detected - Endpoint /v1/images/generate</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Coordinated traffic burst from 300+ unique IPs originating from AWS us-east-1. Pattern matches known stress-testing tools.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-ghost-action btn-danger-action">Initiate Hard Rate Limit</button>
              <button className="btn-ghost-action">View Raw Traffic</button>
            </div>
          </div>
        </div>

        <div className="threat-alert-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <Crosshair size={24} style={{ color: '#f59e0b' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#fcd34d', marginBottom: 4 }}>Potential API Key Leak</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Key belonging to User "usr_9x8f" is suddenly being used across 4 different geographic regions simultaneously.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-ghost-action" style={{ borderColor: 'rgba(245, 158, 11, 0.5)', color: '#f59e0b' }}>Revoke Key & Notify User</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: 'rgba(20, 21, 36, 0.6)', border: '1px solid var(--border-card)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Threat Matrix Settings</h3>
          <div className="settings-row" style={{ padding: '8px 0' }}>
            <div>
              <div className="settings-label">Auto-Ban Malicious IPs</div>
              <div className="settings-desc">Immediately block IPs matching high-confidence threat signatures.</div>
            </div>
            <div className="toggle-switch on"><div className="toggle-knob" /></div>
          </div>
          <div className="settings-row" style={{ padding: '8px 0' }}>
            <div>
              <div className="settings-label">Key Revocation Engine</div>
              <div className="settings-desc">Auto-revoke keys when leaked to public GitHub repos.</div>
            </div>
            <div className="toggle-switch on"><div className="toggle-knob" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
