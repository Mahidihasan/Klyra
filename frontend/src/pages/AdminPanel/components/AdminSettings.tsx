import React, { useState } from 'react';
import { Settings, Users, Server, Shield } from 'lucide-react';

export const AdminSettings = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [publicReg, setPublicReg] = useState(true);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, overflowY: 'auto' }}>
      {/* Core Platform Configs */}
      <div>
        <h2 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Server size={20} color="var(--text-muted)" /> Platform Configuration
        </h2>
        
        <div className="settings-section">
          <div className="settings-row">
            <div>
              <div className="settings-label">Maintenance Mode</div>
              <div className="settings-desc">Redirect all non-admin traffic to the maintenance screen.</div>
            </div>
            <div className={`toggle-switch ${maintenanceMode ? 'on' : ''}`} onClick={() => setMaintenanceMode(!maintenanceMode)}>
              <div className="toggle-knob" />
            </div>
          </div>
          
          <div className="settings-row">
            <div>
              <div className="settings-label">Public Registration</div>
              <div className="settings-desc">Allow new users to sign up for Klyra accounts.</div>
            </div>
            <div className={`toggle-switch ${publicReg ? 'on' : ''}`} onClick={() => setPublicReg(!publicReg)}>
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Global API Rate Limiting</div>
              <div className="settings-desc">Enforce strict rate limits globally to prevent DDoS.</div>
            </div>
            <div className="toggle-switch on"><div className="toggle-knob" /></div>
          </div>
        </div>
      </div>

      {/* RBAC / Admin Management */}
      <div>
        <h2 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Users size={20} color="var(--text-muted)" /> Admin Access Control
        </h2>

        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>Active Administrators</h3>
            <button className="btn-ghost-action" style={{ color: 'var(--accent-purple)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>+ Invite Admin</button>
          </div>

          <div className="settings-row" style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>S</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Super Admin</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>super@klyra.io</div>
              </div>
            </div>
            <span className="kanban-badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>Owner</span>
          </div>

          <div className="settings-row" style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>M</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Moderator A</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>mod@klyra.io</div>
              </div>
            </div>
            <button className="btn-ghost-action btn-danger-action" style={{ padding: '4px 8px' }}>Revoke</button>
          </div>
        </div>

        <div className="settings-section" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ fontSize: 14, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={16} /> Danger Zone
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Actions here are irreversible and affect the entire platform infrastructure.
          </p>
          <button className="btn-ghost-action btn-danger-action" style={{ width: '100%', padding: '12px' }}>
            Purge All Cache & Reset Edge Nodes
          </button>
        </div>
      </div>
    </div>
  );
};
