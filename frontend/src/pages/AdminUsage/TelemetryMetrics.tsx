import React from 'react';
import { TopMetrics } from '../../types/adminUsage';
import { Activity, Zap, ServerCrash, AlertOctagon } from 'lucide-react';

interface Props {
  metrics: TopMetrics;
}

export const TelemetryMetrics: React.FC<Props> = ({ metrics }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      
      <div className="card-base" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Total Requests (1h)</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{metrics.totalRequests.toLocaleString()}</h3>
          </div>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '8px', borderRadius: '8px' }}>
            <Activity size={20} />
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {metrics.rps.toFixed(2)} req/s average
        </p>
      </div>

      <div className="card-base" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Avg Latency</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{metrics.avgLatency.toFixed(1)} ms</h3>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)', padding: '8px', borderRadius: '8px' }}>
            <Zap size={20} />
          </div>
        </div>
      </div>

      <div className="card-base" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>P99 Latency</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{metrics.p99Latency.toFixed(1)} ms</h3>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)', padding: '8px', borderRadius: '8px' }}>
            <ServerCrash size={20} />
          </div>
        </div>
      </div>

      <div className="card-base" style={{ padding: '20px', background: metrics.errorRate > 5 ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}>Error Rate (4xx/5xx)</p>
            <h3 style={{ fontSize: '24px', fontWeight: 600, color: metrics.errorRate > 5 ? 'var(--status-error)' : 'inherit' }}>
              {metrics.errorRate.toFixed(2)}%
            </h3>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)', padding: '8px', borderRadius: '8px' }}>
            <AlertOctagon size={20} />
          </div>
        </div>
      </div>

    </div>
  );
};
