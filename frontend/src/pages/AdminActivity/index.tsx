import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Loader2, AlertTriangle, Play, Pause, Search, Filter } from 'lucide-react';
import { getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../config/adminAccess';
import { adminActivityApi } from '../../services/api/adminActivity';
import { AdminAuditLog } from '../../types/adminActivity';

import { ActivityTable } from './ActivityTable';

export const AdminActivityPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);
    try {
      const data = await adminActivityApi.getLogs({ search: searchTerm, severity: severityFilter, entity: entityFilter });
      setLogs(data);
    } catch (err) {
      if (!isBackground) {
        setError(err instanceof Error ? err.message : 'Failed to load activity logs');
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, severityFilter, entityFilter]);

  useEffect(() => {
    if (!hasAdminAccess(authUser?.role) || getImpersonationSession()) return;
    void loadData();
  }, [loadData, authUser?.role]);

  // Live stream interval
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      void loadData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive, loadData]);

  const header = (
    <div className="au-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 className="au-title">Activity Logs & Security</h1>
        <p className="au-subtitle">
          Audit trail for all administrative actions, billing changes, and API lifecycle events.
        </p>
      </div>
      <button 
        className={isLive ? 'au-primary-btn' : 'au-secondary-btn'} 
        onClick={() => setIsLive(!isLive)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {isLive ? <Pause size={16} /> : <Play size={16} />}
        {isLive ? 'Pause Stream' : 'Live Stream'}
      </button>
    </div>
  );

  if (getImpersonationSession() || !hasAdminAccess(authUser?.role)) {
    return (
      <div className="au-page">
        {header}
        <div className="au-notice card-base">
          <ShieldAlert size={20} aria-hidden="true" />
          <h3>Access Denied</h3>
          <p>You do not have permission to view activity logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="au-page">
      {header}

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div className="card-base" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="au-search-box" style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="au-input" 
              placeholder="Search actions, users, or payload metadata..." 
              style={{ paddingLeft: 34, width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="au-select-box" style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <select 
              className="au-input" 
              style={{ paddingLeft: 34, width: 160 }}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="CRITICAL">Critical</option>
              <option value="SECURITY">Security</option>
            </select>
          </div>

          <div className="au-select-box" style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <select 
              className="au-input" 
              style={{ paddingLeft: 34, width: 160 }}
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="">All Entities</option>
              <option value="USER">User</option>
              <option value="API">API</option>
              <option value="BILLING">Billing</option>
              <option value="PAYOUT">Payout</option>
              <option value="SUBSCRIPTION">Subscription</option>
              <option value="TIER_TEMPLATES">Tier Templates</option>
            </select>
          </div>
        </div>
      </div>

      <ActivityTable logs={logs} isLoading={isLoading && !isLive} />
    </div>
  );
};
