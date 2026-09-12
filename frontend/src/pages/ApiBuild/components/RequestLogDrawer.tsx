import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ExternalLink, Activity } from 'lucide-react';
import { ExtendedLogEntry } from '../types';

interface RequestLogDrawerProps {
  log: ExtendedLogEntry | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const RequestLogDrawer: React.FC<RequestLogDrawerProps> = ({
  log,
  onClose,
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'request' | 'response' | 'trace'>('overview');

  if (!log) return null;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopied(true);
      onShowToast('Request log JSON copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast('Copied');
    }
  };

  return (
    <div className="kly-drawer-overlay" onClick={onClose}>
      <div className="kly-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--kly-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`kly-method-tag kly-method-${log.method}`}>{log.method}</span>
              <span className="kly-ep-path" style={{ fontSize: 15 }}>{log.path}</span>
              <span style={{
                fontFamily: 'var(--kly-font-mono)', fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 4,
                background: log.statusCode < 300 ? 'rgba(16,185,129,0.15)' : log.statusCode < 500 ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                color: log.statusCode < 300 ? '#34d399' : log.statusCode < 500 ? '#fbbf24' : '#fb7185'
              }}>
                {log.statusCode}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', marginTop: 4 }}>
              ID: {log.id} · {log.timestamp} · {log.latencyMs}ms · {log.region}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="kly-btn-icon" onClick={handleCopyJson} title="Copy log JSON">
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
            <button className="kly-btn-icon" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--kly-border-subtle)', padding: '0 20px' }}>
          {(['overview', 'request', 'response', 'trace'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: activeTab === t ? '2px solid var(--kly-primary)' : '2px solid transparent',
                color: activeTab === t ? 'var(--kly-text-main)' : 'var(--kly-text-dim)',
                padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t === 'overview' ? 'Overview' : t === 'request' ? 'Request Payload' : t === 'response' ? 'Response Data' : 'Trace Waterfall'}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="kly-metric-box">
                  <div className="kly-metric-label">Latency</div>
                  <div className="kly-metric-val">{log.latencyMs}ms</div>
                </div>
                <div className="kly-metric-box">
                  <div className="kly-metric-label">Status Code</div>
                  <div className="kly-metric-val">{log.statusCode}</div>
                </div>
                <div className="kly-metric-box">
                  <div className="kly-metric-label">Client IP</div>
                  <div className="kly-metric-val kly-mono" style={{ fontSize: 13 }}>{log.ipAddress}</div>
                </div>
              </div>

              <div className="kly-card">
                <h4 style={{ fontSize: 13, marginBottom: 10 }}>Caller Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Consumer</span>
                    <b>{log.consumerName}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>API Key Prefix</span>
                    <b className="kly-mono">{log.keyPrefix}...</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Target Version</span>
                    <b className="kly-mono">{log.version}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Edge Region</span>
                    <b>{log.region}</b>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'request' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h4 style={{ fontSize: 12, color: 'var(--kly-text-muted)', marginBottom: 6 }}>Request Headers</h4>
                <div className="kly-code-block" style={{ fontSize: 11 }}>
                  {Object.entries(log.requestHeaders).map(([k, v]) => (
                    <div key={k}><b style={{ color: '#93c5fd' }}>{k}:</b> {v}</div>
                  ))}
                </div>
              </div>

              {log.requestBody && (
                <div>
                  <h4 style={{ fontSize: 12, color: 'var(--kly-text-muted)', marginBottom: 6 }}>Request Body</h4>
                  <pre className="kly-code-block">{log.requestBody}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'response' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h4 style={{ fontSize: 12, color: 'var(--kly-text-muted)', marginBottom: 6 }}>Response Headers</h4>
                <div className="kly-code-block" style={{ fontSize: 11 }}>
                  {Object.entries(log.responseHeaders).map(([k, v]) => (
                    <div key={k}><b style={{ color: '#86efac' }}>{k}:</b> {v}</div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 12, color: 'var(--kly-text-muted)', marginBottom: 6 }}>Response Body</h4>
                <pre className="kly-code-block">{log.responseBody}</pre>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div>
              <h4 style={{ fontSize: 13, marginBottom: 12 }}>Distributed Trace Stages</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {log.trace.map((tr, i) => {
                  const pct = Math.max(Math.round((tr.durationMs / log.latencyMs) * 100), 4);
                  return (
                    <div key={i} style={{ padding: '8px 12px', background: '#0e0f18', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{tr.stage}</span>
                        <span className="kly-mono" style={{ color: '#c4b5fd' }}>{tr.durationMs}ms ({pct}%)</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--kly-primary)', borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
