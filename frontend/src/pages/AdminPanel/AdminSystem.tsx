import React, { useState, useEffect } from 'react';
import { ModerationInbox } from './components/ModerationInbox';
import { SystemLogsTerminal } from './components/SystemLogsTerminal';
import { AIThreatDetection } from './components/AIThreatDetection';
import { AdminSettings } from './components/AdminSettings';
import { RBACMatrix } from './components/RBACMatrix';
import { SecurityCenter } from './components/SecurityCenter';
import { Shield, Terminal, Settings, MailWarning, Users, ShieldAlert } from 'lucide-react';
import { usePermissions } from '../../context/PermissionsContext';
import './AdminSystem.css';

export const AdminSystem = () => {
  const [activeView, setActiveView] = useState<'MODERATION' | 'LOGS' | 'THREAT' | 'SETTINGS' | 'RBAC' | 'SECURITY'>('MODERATION');
  const { hasPermission } = usePermissions();

  // Redirect if they land on a tab they don't have access to
  useEffect(() => {
    if (activeView === 'MODERATION' && !hasPermission('VIEW_MODERATION_INBOX')) setActiveView('LOGS');
    if (activeView === 'LOGS' && !hasPermission('VIEW_SYSTEM_LOGS')) setActiveView('THREAT');
    if (activeView === 'THREAT' && !hasPermission('VIEW_AI_THREAT_DETECTION')) setActiveView('RBAC');
    if (activeView === 'RBAC' && !hasPermission('ACCESS_RBAC_MATRIX')) setActiveView('SECURITY');
    if (activeView === 'SECURITY' && !hasPermission('VIEW_SECURITY_CENTER')) setActiveView('SETTINGS');
  }, [hasPermission, activeView]);

  return (
    <div className="admin-system-container">
      <div className="system-header">
        <h1>Reports, Moderation & Core Settings</h1>
        
        <div className="view-tabs">
          {hasPermission('VIEW_MODERATION_INBOX') && (
            <div className={`view-tab ${activeView === 'MODERATION' ? 'active alert-tab' : ''}`} onClick={() => setActiveView('MODERATION')}>
              <MailWarning size={14} /> Moderation Inbox
            </div>
          )}
          {hasPermission('VIEW_SYSTEM_LOGS') && (
            <div className={`view-tab ${activeView === 'LOGS' ? 'active' : ''}`} onClick={() => setActiveView('LOGS')}>
              <Terminal size={14} /> System Logs
            </div>
          )}
          {hasPermission('VIEW_AI_THREAT_DETECTION') && (
            <div className={`view-tab ${activeView === 'THREAT' ? 'active' : ''}`} onClick={() => setActiveView('THREAT')}>
              <Shield size={14} /> AI Threat Detection
            </div>
          )}
          {hasPermission('ACCESS_RBAC_MATRIX') && (
            <div className={`view-tab ${activeView === 'RBAC' ? 'active' : ''}`} onClick={() => setActiveView('RBAC')}>
              <Users size={14} /> RBAC Matrix
            </div>
          )}
          {hasPermission('VIEW_SECURITY_CENTER') && (
            <div className={`view-tab ${activeView === 'SECURITY' ? 'active alert-tab' : ''}`} onClick={() => setActiveView('SECURITY')}>
              <ShieldAlert size={14} /> Security Center
            </div>
          )}
          {hasPermission('MANAGE_CORE_SETTINGS') && (
            <div className={`view-tab ${activeView === 'SETTINGS' ? 'active' : ''}`} onClick={() => setActiveView('SETTINGS')}>
              <Settings size={14} /> Core Settings
            </div>
          )}
        </div>
      </div>

      {activeView === 'MODERATION' && hasPermission('VIEW_MODERATION_INBOX') && <ModerationInbox />}
      {activeView === 'LOGS' && hasPermission('VIEW_SYSTEM_LOGS') && <SystemLogsTerminal />}
      {activeView === 'THREAT' && hasPermission('VIEW_AI_THREAT_DETECTION') && <AIThreatDetection />}
      {activeView === 'RBAC' && hasPermission('ACCESS_RBAC_MATRIX') && <RBACMatrix />}
      {activeView === 'SECURITY' && hasPermission('VIEW_SECURITY_CENTER') && <SecurityCenter />}
      {activeView === 'SETTINGS' && hasPermission('MANAGE_CORE_SETTINGS') && <AdminSettings />}
    </div>
  );
};
