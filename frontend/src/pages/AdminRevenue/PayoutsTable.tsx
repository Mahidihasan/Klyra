import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, CheckCircle2, ArrowRightCircle } from 'lucide-react';
import { adminRevenueApi } from '../../services/api/adminRevenue';
import { ProviderPayoutRow } from '../../types/adminRevenue';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const PayoutsTable: React.FC = () => {
  const [payouts, setPayouts] = useState<ProviderPayoutRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminRevenueApi.getPayouts();
      setPayouts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (id: string) => {
    setIsProcessing(id);
    setError(null);
    try {
      await adminRevenueApi.approvePayout(id);
      setPayouts(payouts.map(p => 
        p.id === id ? { ...p, status: 'PROCESSED', processedAt: new Date().toISOString() } : p
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payout');
    } finally {
      setIsProcessing(null);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="au-spin" size={24} /></div>;
  }

  return (
    <div className="au-table-card card-base" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Provider Payout Requests</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
        Manage API provider earnings. Funds are typically transferred via Stripe Connect.
      </p>

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div className="au-table-scroll">
        <table className="au-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Destination</th>
              <th data-align="end">Amount</th>
              <th>Requested On</th>
              <th>Status</th>
              <th data-align="end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{payout.providerName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{payout.providerEmail}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'var(--bg-pill)', padding: '2px 6px', borderRadius: '4px' }}>
                      {payout.stripeAccountId || 'Bank Transfer'}
                    </span>
                  </div>
                </td>
                <td data-align="end">
                  <span style={{ fontWeight: 600 }}>{formatCurrency(payout.amount)}</span>
                </td>
                <td>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {new Date(payout.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td>
                  <span className="au-badge" data-status={payout.status === 'PROCESSED' ? 'active' : payout.status === 'PENDING' ? 'warning' : 'offline'}>
                    {payout.status}
                  </span>
                </td>
                <td data-align="end">
                  {payout.status === 'PENDING' ? (
                    <button 
                      className="au-primary-btn" 
                      style={{ padding: '6px 12px' }}
                      onClick={() => handleApprove(payout.id)}
                      disabled={isProcessing === payout.id}
                    >
                      {isProcessing === payout.id ? (
                        <Loader2 size={14} className="au-spin" />
                      ) : (
                        <>
                          <ArrowRightCircle size={14} style={{ marginRight: 4 }} /> Process Payout
                        </>
                      )}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '13px' }}>
                      <CheckCircle2 size={14} style={{ marginRight: 4 }} /> Done
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No payout requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
