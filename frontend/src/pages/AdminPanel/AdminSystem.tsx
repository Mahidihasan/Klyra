import React, { useState } from 'react';
import { ModerationInbox } from './components/ModerationInbox';
import { SystemLogsTerminal } from './components/SystemLogsTerminal';
import { AIThreatDetection } from './components/AIThreatDetection';
import { AdminSettings } from './components/AdminSettings';
import { RBACMatrix } from './components/RBACMatrix';
import { SecurityCenter } from './components/SecurityCenter';
import { Shield, Terminal, Settings, MailWarning, Users, ShieldAlert } from 'lucide-react';
import './AdminSystem.css';

export const AdminSystem = () => {
  const [activeView, setActiveView] = useState<'MODERATION' | 'LOGS' | 'THREAT' | 'SETTINGS' | 'RBAC' | 'SECURITY'>('MODERATION');

  return (
    <div className="admin-system-container">
      <div className="system-header">
        <h1>Reports, Moderation & Core Settings</h1>
        
        <div className="view-tabs">
          <div className={`view-tab ${activeView === 'MODERATION' ? 'active alert-tab' : ''}`} onClick={() => setActiveView('MODERATION')}>
            <MailWarning size={14} /> Moderation Inbox
          </div>
          <div className={`view-tab ${activeView === 'LOGS' ? 'active' : ''}`} onClick={() => setActiveView('LOGS')}>
            <Terminal size={14} /> System Logs
          </div>
          <div className={`view-tab ${activeView === 'THREAT' ? 'active' : ''}`} onClick={() => setActiveView('THREAT')}>
            <Shield size={14} /> AI Threat Detection
          </div>
          <div className={`view-tab ${activeView === 'RBAC' ? 'active' : ''}`} onClick={() => setActiveView('RBAC')}>
            <Users size={14} /> RBAC Matrix
          </div>
          <div className={`view-tab ${activeView === 'SECURITY' ? 'active alert-tab' : ''}`} onClick={() => setActiveView('SECURITY')}>
            <ShieldAlert size={14} /> Security Center
          </div>
          <div className={`view-tab ${activeView === 'SETTINGS' ? 'active' : ''}`} onClick={() => setActiveView('SETTINGS')}>
            <Settings size={14} /> Core Settings
          </div>
        </div>
      </div>

      {activeView === 'MODERATION' && <ModerationInbox />}
      {activeView === 'LOGS' && <SystemLogsTerminal />}
      {activeView === 'THREAT' && <AIThreatDetection />}
      {activeView === 'RBAC' && <RBACMatrix />}
      {activeView === 'SECURITY' && <SecurityCenter />}
      {activeView === 'SETTINGS' && <AdminSettings />}
    </div>
  );
};
