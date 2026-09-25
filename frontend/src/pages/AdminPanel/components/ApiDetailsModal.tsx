import React from 'react';
import { AdminApiRow } from '../../../types/adminApis';
import { X, ShieldAlert, GitCommit, ArrowLeftCircle, CheckCircle, Activity, Star } from 'lucide-react';

interface ApiDetailsModalProps {
  api: AdminApiRow | null;
  onClose: () => void;
  onEmergencyTakedown: (apiId: string) => void;
  onToggleFeatured: (apiId: string) => void;
  isFeatured: boolean;
}

export const ApiDetailsModal: React.FC<ApiDetailsModalProps> = ({ 
  api, 
  onClose, 
  onEmergencyTakedown,
  onToggleFeatured,
  isFeatured
}) => {
  if (!api) return null;

  // Mock version history
  const versions = [
    { v: 'v2.1.4', date: '2 hours ago', desc: 'Patched critical rate-limit bypass vulnerability.', active: true },
    { v: 'v2.1.3', date: '3 days ago', desc: 'Added new optional query parameters to /users endpoint.', active: false },
    { v: 'v2.1.0', date: '2 weeks ago', desc: 'Major performance overhaul utilizing Redis caching.', active: false },
    { v: 'v2.0.0', date: '1 month ago', desc: 'Breaking changes to authentication flow (OAuth2).', active: false },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-lg" style={{ width: '600px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{api.name}</h2>
            <p style={{ margin: 0, marginTop: 4 }}>ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{api.id}</span></p>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Version Control UI */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <GitCommit size={16} /> Version History
            </h3>
            <div className="timeline-container">
              {versions.map((ver, i) => (
                <div key={ver.v} className={`timeline-item ${ver.active ? 'active' : ''}`}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-version">{ver.v} {ver.active && <span style={{ color: '#22c55e', fontSize: 11, marginLeft: 4 }}>(Current)</span>}</span>
                      <span className="timeline-date">{ver.date}</span>
                    </div>
                    <div className="timeline-desc">{ver.desc}</div>
                    
                    {!ver.active && (
                      <button className="rollback-btn" onClick={() => alert('Rollback initiated (Mock)')}>
                        <ArrowLeftCircle size={14} /> Rollback to {ver.v}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Marketplace & Emergency */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Health & Stats */}
            <div style={{ background: 'rgba(20,21,36,0.5)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>API Health</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>Health Score</span>
                <span style={{ fontWeight: 600, color: api.healthScore > 90 ? '#22c55e' : '#f59e0b' }}>{api.healthScore}/100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>Daily Requests</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{api.dailyRequestCount.toLocaleString()}</span>
              </div>
            </div>

            {/* Marketplace Curation */}
            <div style={{ background: 'rgba(20,21,36,0.5)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Marketplace Placement</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <Star size={16} color={isFeatured ? '#f59e0b' : 'var(--text-muted)'} fill={isFeatured ? '#f59e0b' : 'none'} />
                  Featured API
                </div>
                <div className={`toggle-switch ${isFeatured ? 'on' : ''}`} onClick={() => onToggleFeatured(api.id)}>
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>

            {/* Emergency Controls */}
            <div className="emergency-panel">
              <div className="emergency-title">
                <ShieldAlert size={16} /> EMERGENCY CONTROLS
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Immediately remove this API from the marketplace and sever all active consumer connections. Use only for malicious activity or critical breaches.
              </p>
              <button className="btn-emergency" onClick={() => onEmergencyTakedown(api.id)}>
                <Activity size={16} /> UNPUBLISH & TAKE DOWN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
