import React, { useState, useEffect } from 'react';
import { Terminal, Download, Search } from 'lucide-react';

export const SystemLogsTerminal = () => {
  const [logs, setLogs] = useState<any[]>([]);

  // Generate some realistic-looking server logs
  useEffect(() => {
    const rawLogs = [
      { time: '14:32:01.442', level: 'info', msg: '[Auth] User usr_9x8f successfully authenticated via OAuth2 (GitHub)' },
      { time: '14:32:05.119', level: 'info', msg: '[API:Gateway] Route /v1/market/search hit 1,420 times in last 60s' },
      { time: '14:33:12.884', level: 'warn', msg: '[RateLimit] IP 192.168.1.44 approaching bucket limit on /v1/billing' },
      { time: '14:33:15.002', level: 'error', msg: '[DB] Connection timeout attempting to read from replica-us-east-1a' },
      { time: '14:33:15.421', level: 'info', msg: '[DB] Failover to replica-us-east-1b successful. Latency 45ms' },
      { time: '14:35:22.911', level: 'crit', msg: '[Security] Multiple failed login attempts (5) for root admin account from IP 45.33.12.99' },
      { time: '14:35:23.010', level: 'info', msg: '[Security] Auto-ban triggered for IP 45.33.12.99 (Duration: 24h)' },
      { time: '14:38:00.114', level: 'info', msg: '[Cron] Daily MRR aggregation job started' },
      { time: '14:38:05.441', level: 'info', msg: '[Cron] Daily MRR aggregation job completed successfully' },
    ];
    setLogs(rawLogs);
  }, []);

  return (
    <div className="terminal-viewer">
      <div className="terminal-header">
        <div className="terminal-title">
          <Terminal size={14} />
          system.log - var/log/klyra/core
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="search-input-wrapper" style={{ background: '#000' }}>
            <Search size={14} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Grep logs..." 
              style={{ background: '#000', height: 28, fontSize: 12, width: 200 }}
            />
          </div>
          <button className="btn-ghost-action" style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#333' }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>
      
      <div className="terminal-body">
        {logs.map((log, i) => (
          <div key={i} className="log-line">
            <span className="log-time">{log.time}</span>
            <span className={`log-level ${log.level}`}>[{log.level.toUpperCase()}]</span>
            <span className="log-message">{log.msg}</span>
          </div>
        ))}
        <div className="log-line" style={{ marginTop: 16 }}>
          <span className="log-time" style={{ color: '#22c55e' }}>klyra-admin@sys-1:~$</span>
          <span className="log-message" style={{ color: '#fff' }}><span style={{ animation: 'blink 1s step-end infinite' }}>_</span></span>
        </div>
      </div>
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};
