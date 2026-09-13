import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../config/adminAccess';
import { adminUsageApi } from '../../services/api/adminUsage';
import { TelemetryPayload } from '../../types/adminUsage';

import { TelemetryMetrics } from './TelemetryMetrics';
import { LiveSpikeChart } from './LiveSpikeChart';
import { TopEndpointsTable } from './TopEndpointsTable';
import { ThrottlingTable } from './ThrottlingTable';

export const AdminUsagePage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);
    try {
      const data = await adminUsageApi.getTelemetry();
      setTelemetry(data);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isBackground) {
        setError(err instanceof Error ? err.message : 'Failed to load telemetry');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAdminAccess(authUser?.role) || getImpersonationSession()) return;
    
    // Initial load
    void loadData();

    // Setup 5-second polling for "Live" feel
    const interval = setInterval(() => {
      void loadData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData, authUser?.role]);

  const header = (
    <div className="au-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 className="au-title">Usage & Telemetry</h1>
        <p className="au-subtitle">
          Real-time platform monitoring, endpoint latency, and rate-limit throttling over the last 1 hour.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
        {isLoading && !telemetry ? (
          <Loader2 size={16} className="au-spin" />
        ) : (
          <>
            <RefreshCcw size={14} className="au-spin" style={{ animationDuration: '3s' }} />
            Live (Refreshed {lastRefreshed.toLocaleTimeString()})
          </>
        )}
      </div>
    </div>
  );

  if (getImpersonationSession() || !hasAdminAccess(authUser?.role)) {
    return (
      <div className="au-page">
        {header}
        <div className="au-notice card-base">
          <ShieldAlert size={20} aria-hidden="true" />
          <h3>Access Denied</h3>
          <p>You do not have permission to view telemetry or you are currently impersonating another user.</p>
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

      {isLoading && !telemetry ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <Loader2 className="au-spin" size={32} style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : telemetry ? (
        <>
          <TelemetryMetrics metrics={telemetry.metrics} />

          <div className="card-base" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Live Latency & Request Spikes</h2>
            <div style={{ height: '300px', width: '100%', position: 'relative' }}>
               <LiveSpikeChart data={telemetry.timeSeries} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            <TopEndpointsTable endpoints={telemetry.topEndpoints} />
            <ThrottlingTable incidents={telemetry.throttling} />
          </div>
        </>
      ) : null}
    </div>
  );
};
