import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, Ban, Search, Filter } from 'lucide-react';
import { adminSubscriptionsApi } from '../../services/api/adminSubscriptions';
import { AdminSubscriptionRow } from '../../types/adminSubscriptions';

export const ActiveSubscriptionsTab: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminSubscriptionsApi.getSubscriptions({ search: searchTerm, status: statusFilter });
      setSubscriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter]);

  // Debounced load for search
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to forcibly cancel this subscription?')) return;
    setIsProcessing(id);
    setError(null);
    try {
      await adminSubscriptionsApi.cancelSubscription(id);
      setSubscriptions(subscriptions.map(s => s.id === id ? { ...s, status: 'CANCELED', autoRenew: false } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="au-table-card card-base" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Active Subscriptions</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Monitor subscriber instances across all APIs.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="au-search-box" style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="au-input" 
              placeholder="Search customer email..." 
              style={{ paddingLeft: 34, width: 220 }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="au-select-box" style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <select 
              className="au-input" 
              style={{ paddingLeft: 34, width: 160 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past Due</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div className="au-table-scroll">
        <table className="au-table" style={{ opacity: isLoading && !subscriptions.length ? 0.6 : 1 }}>
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>API & Tier</th>
              <th>Billing Cycle</th>
              <th>Renew Date</th>
              <th>Status</th>
              <th data-align="end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && subscriptions.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="au-spin" size={24} style={{ display: 'inline' }} /></td></tr>
            ) : subscriptions.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No subscriptions found.</td></tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{sub.subscriberName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub.subscriberEmail}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{sub.apiName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-purple)' }}>{sub.planName}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{sub.billingInterval.toLowerCase()}</span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {sub.periodEnd ? new Date(sub.periodEnd).toLocaleDateString() : 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="au-badge" data-status={sub.status === 'ACTIVE' ? 'active' : sub.status === 'PAST_DUE' ? 'warning' : 'offline'}>
                      {sub.status}
                    </span>
                  </td>
                  <td data-align="end">
                    {sub.status !== 'CANCELED' ? (
                      <button 
                        className="au-ghost-btn" 
                        style={{ color: 'var(--status-error)' }}
                        onClick={() => handleCancel(sub.id)}
                        disabled={isProcessing === sub.id}
                        title="Force Cancel Subscription"
                      >
                        {isProcessing === sub.id ? <Loader2 size={16} className="au-spin" /> : <Ban size={16} />}
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Canceled</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
