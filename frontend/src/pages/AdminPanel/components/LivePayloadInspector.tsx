import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Pause, Play, Trash2 } from 'lucide-react';

interface PayloadLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  latency: number;
  headers: Record<string, string>;
  bodySize: string;
}

const generateMockLog = (): PayloadLog => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const paths = ['/api/v1/weather', '/api/v2/auth/verify', '/webhooks/stripe', '/api/v1/users', '/graphql'];
  const statuses = [200, 200, 200, 201, 400, 401, 403, 404, 500, 502, 503];
  
  return {
    id: `log_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    method: methods[Math.floor(Math.random() * methods.length)],
    path: paths[Math.floor(Math.random() * paths.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    latency: Math.floor(Math.random() * 500) + 10,
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'x-forwarded-for': `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      'authorization': 'Bearer sk_live_***',
    },
    bodySize: `${Math.floor(Math.random() * 50)}kb`
  };
};

export const LivePayloadInspector = () => {
  const [logs, setLogs] = useState<PayloadLog[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setLogs(prev => {
        const newLogs = [...prev, generateMockLog()];
        if (newLogs.length > 50) newLogs.shift();
        return newLogs;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    if (!isPaused && tailRef.current) {
      tailRef.current.scrollTop = tailRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  return (
    <div style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <Terminal size={16} color="#a78bfa" /> Live Payload Inspector
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => setIsPaused(!isPaused)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: 12, color: isPaused ? '#f59e0b' : '#22c55e', fontWeight: 600, border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />} {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button 
            onClick={() => setLogs([])}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      <div ref={tailRef} style={{ flex: 1, padding: 16, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#a1a1aa', scrollBehavior: 'smooth' }}>
        {logs.map((log) => {
          const getStatusColor = (status: number) => {
            if (status >= 500) return '#ef4444';
            if (status >= 400) return '#f59e0b';
            return '#22c55e';
          };
          const getMethodColor = (method: string) => {
            switch(method) {
              case 'GET': return '#3b82f6';
              case 'POST': return '#22c55e';
              case 'DELETE': return '#ef4444';
              case 'PUT': return '#f59e0b';
              default: return '#a78bfa';
            }
          };

          return (
            <div key={log.id} style={{ marginBottom: 16, borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 16, animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <span style={{ color: '#52525b' }}>{log.timestamp.split('T')[1].replace('Z', '')}</span>
                <span style={{ color: getMethodColor(log.method), fontWeight: 700, width: 48 }}>{log.method}</span>
                <span style={{ color: '#d4d4d8', flex: 1 }}>{log.path}</span>
                <span style={{ color: getStatusColor(log.status), fontWeight: 700 }}>{log.status}</span>
                <span style={{ color: '#52525b' }}>{log.latency}ms</span>
                <span style={{ color: '#52525b' }}>{log.bodySize}</span>
              </div>
              <div style={{ paddingLeft: 64 }}>
                {Object.entries(log.headers).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: '#71717a' }}>{key}:</span>
                    <span style={{ color: '#8b5cf6' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div style={{ color: '#52525b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="blinking-cursor">_</span> Waiting for inbound traffic...
          </div>
        )}
      </div>

      <style>{`
        .blinking-cursor {
          animation: blink 1s step-end infinite;
          display: inline-block;
          width: 8px;
          height: 14px;
          background: #22c55e;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};
