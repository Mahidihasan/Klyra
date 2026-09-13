import React from 'react';
import { EndpointStat } from '../../types/adminUsage';

interface Props {
  endpoints: EndpointStat[];
}

export const TopEndpointsTable: React.FC<Props> = ({ endpoints }) => {
  return (
    <div className="au-table-card card-base" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Top Consumed Endpoints</h2>
      
      <div className="au-table-scroll">
        <table className="au-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th data-align="end">Hits</th>
              <th data-align="end">Avg Latency</th>
              <th data-align="end">Throttled</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                      background: ep.method === 'GET' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: ep.method === 'GET' ? '#3b82f6' : 'var(--status-success)'
                    }}>
                      {ep.method}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{ep.path}</span>
                  </div>
                </td>
                <td data-align="end" style={{ fontWeight: 500 }}>{ep.hits.toLocaleString()}</td>
                <td data-align="end" style={{ color: ep.avgLatency > 500 ? 'var(--status-error)' : 'inherit' }}>
                  {ep.avgLatency.toFixed(1)}ms
                </td>
                <td data-align="end" style={{ color: ep.throttleCount > 0 ? 'var(--status-warning)' : 'var(--text-muted)' }}>
                  {ep.throttleCount > 0 ? ep.throttleCount.toLocaleString() : '-'}
                </td>
              </tr>
            ))}
            {endpoints.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>No endpoints accessed.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
