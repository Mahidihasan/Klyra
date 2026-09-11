import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Loader2, AlertTriangle, Download } from 'lucide-react';
import { getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../config/adminAccess';
import { adminRevenueApi } from '../../services/api/adminRevenue';
import { RevenueAnalytics } from '../../types/adminRevenue';

import { RevenueMetrics } from './RevenueMetrics';
import { RevenueChart } from './RevenueChart';
import { PayoutsTable } from './PayoutsTable';

export const AdminRevenuePage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [range, setRange] = useState<'7d' | '30d' | '1y'>('30d');
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminRevenueApi.getAnalytics(range);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load revenue analytics');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (hasAdminAccess(authUser?.role)) {
      void loadData();
    }
  }, [loadData, authUser?.role]);

  const handleExport = () => {
    // Mock export functionality
    alert('Billing reconciliation report exported successfully (Mock).');
  };

  const header = (
    <div className="au-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 className="au-title">Revenue & Monetization</h1>
        <p className="au-subtitle">
          Track gross marketplace volume, platform fees, and process provider payouts.
        </p>
      </div>
      <button className="au-secondary-btn" onClick={handleExport} disabled={isLoading}>
        <Download size={16} style={{ marginRight: 6 }} /> Export CSV
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
          <p>
            You do not have permission to view this page or you are currently impersonating another user.
          </p>
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

      {isLoading && !analytics ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <Loader2 className="au-spin" size={32} style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : analytics ? (
        <>
          <RevenueMetrics analytics={analytics} />

          <div className="card-base" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Revenue Growth</h2>
              <div style={{ display: 'flex', background: 'var(--bg-pill)', padding: '2px', borderRadius: '6px' }}>
                <button 
                  className={`au-ghost-btn ${range === '7d' ? 'active-range' : ''}`} 
                  onClick={() => setRange('7d')}
                  style={{ padding: '4px 12px', height: '28px', fontSize: '13px' }}
                >
                  7D
                </button>
                <button 
                  className={`au-ghost-btn ${range === '30d' ? 'active-range' : ''}`} 
                  onClick={() => setRange('30d')}
                  style={{ padding: '4px 12px', height: '28px', fontSize: '13px' }}
                >
                  30D
                </button>
                <button 
                  className={`au-ghost-btn ${range === '1y' ? 'active-range' : ''}`} 
                  onClick={() => setRange('1y')}
                  style={{ padding: '4px 12px', height: '28px', fontSize: '13px' }}
                >
                  1Y
                </button>
              </div>
            </div>
            
            <div style={{ height: '300px', width: '100%', position: 'relative' }}>
               {isLoading && (
                 <div style={{ position: 'absolute', inset: 0, background: 'rgba(var(--bg-base-rgb), 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                   <Loader2 className="au-spin" size={24} />
                 </div>
               )}
               <RevenueChart data={analytics.timeSeries} range={range} />
            </div>
          </div>

          <PayoutsTable />
        </>
      ) : null}

      <AdminRevenueStyles />
    </div>
  );
};

const AdminRevenueStyles: React.FC = () => (
  <style>{`
    .active-range {
      background: var(--bg-base) !important;
      color: var(--text-base) !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
  `}</style>
);
