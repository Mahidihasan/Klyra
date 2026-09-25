import React from 'react';
import { Bell, Activity } from 'lucide-react';

export const AdminHeader = () => {
  return (
    <header className="admin-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
        <Activity size={16} color="#22c55e" />
        All Systems Operational
      </div>

      <div className="admin-header-actions">
        <button className="admin-profile-btn" style={{ position: 'relative' }}>
          <Bell size={18} color="var(--text-muted)" />
          <span style={{ position: 'absolute', top: 2, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
        </button>
        
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.03)', margin: '0 8px' }}></div>

        <button className="admin-profile-btn">
          <div className="admin-avatar">A</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Administrator</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>super@klyra.io</div>
          </div>
        </button>
      </div>
    </header>
  );
};
