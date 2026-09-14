import React, { useState } from 'react';
import { Search, Download, Terminal } from 'lucide-react';

const MOCK_AUDIT_LOGS = [
  { id: 'al_09', timestamp: '2026-09-14T08:30:12Z', actor: 'admin_sys1', action: 'UPDATE_RATE_LIMIT', target: 'api_44f', ip: '192.168.1.44', details: 'Changed from 100/min to 500/min' },
  { id: 'al_08', timestamp: '2026-09-14T07:15:00Z', actor: 'admin_sys1', action: 'REVOKE_KEY', target: 'user_45a1', ip: '192.168.1.44', details: 'Revoked all API keys via Security Center' },
  { id: 'al_07', timestamp: '2026-09-13T22:40:11Z', actor: 'admin_sys2', action: 'APPROVE_API', target: 'api_99z', ip: '10.0.0.5', details: 'Approved "Weather GraphQL"' },
  { id: 'al_06', timestamp: '2026-09-13T14:20:00Z', actor: 'system_cron', action: 'PURGE_TRASH', target: 'system', ip: 'localhost', details: 'Purged 42 soft-deleted records older than 30 days' },
  { id: 'al_05', timestamp: '2026-09-12T09:10:00Z', actor: 'admin_sys1', action: 'BAN_USER', target: 'user_spam9', ip: '192.168.1.44', details: 'Suspicious activity detected' },
];

export const AuditLogViewer = () => {
  const [search, setSearch] = useState('');

  const filteredLogs = MOCK_AUDIT_LOGS.filter(l => 
    l.actor.includes(search) || l.action.includes(search) || l.target.includes(search)
  );

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
          <button style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: 16, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, color: '#a1a1aa' }}>
        {filteredLogs.map(log => {
          const isDestructive = ['REVOKE_KEY', 'BAN_USER', 'PURGE_TRASH'].includes(log.action);
          
          return (
            <div key={log.id} style={{ display: 'flex', gap: 16, borderBottom: '1px dashed #27272a', paddingBottom: 8, marginBottom: 8 }}>
              <div style={{ color: '#52525b', flexShrink: 0, width: 180 }}>[{log.timestamp}]</div>
              <div style={{ color: '#3b82f6', flexShrink: 0, width: 100 }}>{log.actor}</div>
              <div style={{ color: isDestructive ? '#ef4444' : '#22c55e', flexShrink: 0, width: 160, fontWeight: 600 }}>{log.action}</div>
              <div style={{ color: '#d4d4d8', flexShrink: 0, width: 120 }}>{log.target}</div>
              <div style={{ color: '#8b5cf6', flexShrink: 0, width: 120 }}>{log.ip}</div>
              <div style={{ color: '#a1a1aa', flex: 1 }}>{log.details}</div>
            </div>
          );
        })}
        {filteredLogs.length === 0 && (
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
