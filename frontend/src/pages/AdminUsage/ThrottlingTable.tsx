import React from 'react';
import { ThrottlingIncident } from '../../types/adminUsage';

interface Props {
  incidents: ThrottlingIncident[];
}

export const ThrottlingTable: React.FC<Props> = ({ incidents }) => {
  return (
    <div className="au-table-card card-base" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Rate-Limit Offenders (1h)</h2>
      
      <div className="au-table-scroll">
        <table className="au-table">
          <thead>
            <tr>
              <th>Offender IP</th>
              <th>Target API</th>
              <th data-align="end">Blocked Hits</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident, i) => (
              <tr key={i}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {incident.ipAddress || 'Unknown IP'}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 500 }}>
                    {incident.apiName || 'Unknown API'}
                  </span>
                </td>
                <td data-align="end">
                  <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>
                    {incident.hits.toLocaleString()}
                  </span>
                </td>
                <td>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(incident.lastSeen).toLocaleTimeString()}
                  </span>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No rate-limit breaches detected.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
