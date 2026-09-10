import React, { useState } from 'react';
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { AdminAuditLog } from '../../types/adminActivity';

interface Props {
  logs: AdminAuditLog[];
  isLoading: boolean;
}

const getSeverityColor = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case 'SECURITY': return 'var(--status-error)';
    case 'CRITICAL': return 'var(--status-error)';
    case 'WARN': return 'var(--status-warning)';
    case 'INFO': default: return '#3b82f6';
  }
};

export const ActivityTable: React.FC<Props> = ({ logs, isLoading }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (isLoading) {
    return <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="au-spin" size={32} style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="au-table-card card-base">
      <div className="au-table-scroll">
        <table className="au-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Timestamp</th>
              <th>Severity</th>
              <th>Action</th>
              <th>Actor</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No audit logs found.</td></tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedRow === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => toggleRow(log.id)} 
                      style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-pill)' : 'transparent', borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)' }}
                    >
                      <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                          color: getSeverityColor(log.severity),
                          border: \`1px solid \${getSeverityColor(log.severity)}\`,
                          opacity: 0.8
                        }}>
                          {log.severity || 'INFO'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>
                          {log.action}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {log.resourceType} {log.resourceId ? \`#\${log.resourceId.substring(0,8)}\` : ''}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {log.actorName || 'System'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {log.ipAddress || '-'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-pill)' }}>
                        <td></td>
                        <td colSpan={5} style={{ padding: '0 24px 24px 0' }}>
                          <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payload Details</h4>
                            <pre style={{ 
                              margin: 0, 
                              fontFamily: 'monospace', 
                              fontSize: '12px', 
                              color: 'var(--text-base)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all'
                            }}>
                              {log.details ? JSON.stringify(log.details, null, 2) : 'No payload details provided.'}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
