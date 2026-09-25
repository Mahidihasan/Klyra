import React, { useState, useEffect } from 'react';
import { Search, Download, Terminal } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export const AuditLogViewer = () => {
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const headers: Record<string, string> = {};
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const devRole = localStorage.getItem('klyra-dev-role');
        if (!token && devRole) headers['x-klyra-role'] = devRole;

        const res = await axios.get('/api/v1/admin/explorer/audit-logs', { headers });
        if (res.data.success) {
          setLogs(res.data.data);
        }
      } catch (err: any) {
        toast.error('Failed to fetch audit logs');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    const term = search.toLowerCase();
    return (
      (l.user_id && String(l.user_id).toLowerCase().includes(term)) || 
      (l.action && String(l.action).toLowerCase().includes(term)) || 
      (l.entity_type && String(l.entity_type).toLowerCase().includes(term))
    );
  });

  const handleExportJson = () => {
    if (!logs || logs.length === 0) {
      toast.error("No logs available to export.");
      return;
    }

    try {
      // Convert state array to a formatted JSON string
      const jsonString = JSON.stringify(logs, null, 2);
      
      // Create a Blob from the JSON string
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a temporary object URL
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      // Name the file dynamically with the current date
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `klyra_audit_logs_${dateStr}.json`;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Audit logs exported successfully!");
    } catch (error) {
      console.error("Failed to export JSON:", error);
      toast.error("An error occurred while generating the export file.");
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }}></div>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }}></div>
          </div>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>audit_trail.log</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 8 }} />
            <input type="text" placeholder="Grep logs..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '6px 12px 6px 30px', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
          </div>
          <button onClick={handleExportJson} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: 16, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, color: '#a1a1aa' }}>
        {loading ? (
          <div style={{ color: '#52525b' }}>$ Fetching audit logs from database...</div>
        ) : (
          filteredLogs.map(log => {
            const isDestructive = ['REVOKE_KEY', 'BAN_USER', 'PURGE_TRASH', 'DELETE'].includes(log.action);
            
            return (
              <div key={log.id} style={{ display: 'flex', gap: 16, borderBottom: '1px dashed #27272a', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ color: '#52525b', flexShrink: 0, width: 180 }}>[{new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}]</div>
                <div style={{ color: '#3b82f6', flexShrink: 0, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.user_id || 'system'}>{log.user_id ? log.user_id.substring(0,8) : 'system'}</div>
                <div style={{ color: isDestructive ? '#ef4444' : '#22c55e', flexShrink: 0, width: 160, fontWeight: 600 }}>{log.action}</div>
                <div style={{ color: '#d4d4d8', flexShrink: 0, width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.entity_type}>{log.entity_type}</div>
                <div style={{ color: '#8b5cf6', flexShrink: 0, width: 120 }}>{log.ip_address || 'N/A'}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {(() => {
                    const details = log.new_values ? JSON.stringify(log.new_values) : '-';
                    if (details.startsWith('{') || details.includes('{"')) {
                      return (
                        <div style={{ maxHeight: 80, overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: 11 }} className="custom-scrollbar">
                          {details}
                        </div>
                      );
                    }
                    return <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#a1a1aa' }} title={details}>{details}</span>;
                  })()}
                </div>
              </div>
            );
          })
        )}
        {!loading && filteredLogs.length === 0 && (
          <div style={{ color: '#52525b' }}>$ No logs matching "{search}"</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', marginTop: 8 }}>
          <Terminal size={14} /> <span className="blinking-cursor">_</span>
        </div>
      </div>
      
      <style>{`
        .blinking-cursor {
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};
