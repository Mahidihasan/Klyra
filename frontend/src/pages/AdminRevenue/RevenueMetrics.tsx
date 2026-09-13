import React from 'react';
import { RevenueAnalytics } from '../../types/adminRevenue';
import { DollarSign, Percent, ArrowUpRight, TrendingUp } from 'lucide-react';

interface Props {
  analytics: RevenueAnalytics;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const RevenueMetrics: React.FC<Props> = ({ analytics }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      
      <div className="card-base" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Gross Volume (GMV)</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{formatCurrency(analytics.grossVolume)}</h3>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)', padding: '8px', borderRadius: '8px' }}>
            <TrendingUp size={20} />
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--status-success)', display: 'flex', alignItems: 'center' }}>
          <ArrowUpRight size={14} style={{ marginRight: 4 }} /> +12% from previous
        </p>
      </div>

      <div className="card-base" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Platform Cut (20%)</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{formatCurrency(analytics.klyraCut)}</h3>
          </div>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)', padding: '8px', borderRadius: '8px' }}>
            <Percent size={20} />
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Klyra's net revenue share
        </p>
      </div>

      <div className="card-base" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Pending Payouts</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{formatCurrency(analytics.pendingPayouts)}</h3>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)', padding: '8px', borderRadius: '8px' }}>
            <DollarSign size={20} />
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Awaiting processing
        </p>
      </div>

      <div className="card-base" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Net Platform Revenue</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-purple)' }}>{formatCurrency(analytics.netRevenue)}</h3>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Total earned by Klyra
        </p>
      </div>

    </div>
  );
};
