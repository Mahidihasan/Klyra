import React, { useState, useEffect } from 'react';
import { Terminal, Search, RefreshCw, Eye, Download, Activity, AlertTriangle } from 'lucide-react';
import { ExtendedLogEntry } from '../types';
import { ProviderProject } from '../../../types/apibuild';

interface TabLogsProps {
  project: ProviderProject;
  logs: ExtendedLogEntry[];
  onSelectLog: (log: ExtendedLogEntry) => void;
  onShowToast: (msg: string) => void;
}

export const TabLogs: React.FC<TabLogsProps> = ({
  project,
  logs,
  onSelectLog,
  onShowToast
}) => {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '2xx' | '4xx' | '5xx'>('ALL');
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  const filteredLogs = logs.filter(l => {
    const queryTerms = q.toLowerCase().split(/\s+and\s+|\s+/).map((term) => term.trim()).filter(Boolean);
    const matchQ = queryTerms.every((term) => {
      if (term.startsWith('status:')) return String(l.statusCode) === term.slice(7);
      if (term.startsWith('path:')) return l.path.toLowerCase().includes(term.slice(5));
      return l.path.toLowerCase().includes(term) || l.consumerName.toLowerCase().includes(term) || l.id.toLowerCase().includes(term);
    });
    const matchStatus = statusFilter === 'ALL' || (statusFilter === '2xx' && l.statusCode < 300) || (statusFilter === '4xx' && l.statusCode >= 400 && l.statusCode < 500) || (statusFilter === '5xx' && l.statusCode >= 500);
    return matchQ && matchStatus;
  });
  const errorCount = logs.filter((log) => log.statusCode >= 400).length;
  const averageLatency = logs.length ? Math.round(logs.reduce((total, log) => total + log.latencyMs, 0) / logs.length) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header bar */}
      <div className="kly-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Developer Request Logs & Traces</h3>
            <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', marginTop: 4 }}>
              Zero-latency distributed tracing across edge ingress and upstream origins.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="kly-back-pill"
              onClick={() => {
                setIsLiveStreaming(!isLiveStreaming);
                onShowToast(isLiveStreaming ? 'Log stream paused' : 'Live stream active');
              }}
              style={{
                borderColor: isLiveStreaming ? 'rgba(16,185,129,0.3)' : 'var(--kly-border-subtle)',
                color: isLiveStreaming ? '#34d399' : 'var(--kly-text-dim)'
              }}
            >
              <span className={isLiveStreaming ? 'kly-pulse-dot' : ''} style={{ background: isLiveStreaming ? '#10b981' : '#64748b' }} />
              <span>{isLiveStreaming ? 'Live Tail Active' : 'Tail Paused'}</span>
            </button>

            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--kly-text-dim)' }} />
              <input
                type="text"
                className="kly-input"
                style={{ paddingLeft: 32, width: '100%' }}
                placeholder="Filter logs by path, ip, key..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <select className="kly-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="ALL">All Status Codes</option>
              <option value="2xx">2xx Successful</option>
              <option value="4xx">4xx Client Errors</option>
              <option value="5xx">5xx Origin Errors</option>
            </select>
            <button className="kly-btn kly-btn-secondary" onClick={() => onShowToast(`Exporting ${filteredLogs.length} filtered log entries...`)}><Download size={12} /> Export</button>
          </div>
        </div>
      </div>

      <div className="kly-ops-summary kly-log-summary">
        <div><span><Terminal size={13} /> Visible entries</span><strong>{filteredLogs.length}</strong><small>Current filter scope</small></div>
        <div><span><Activity size={13} /> Average latency</span><strong>{averageLatency}ms</strong><small>Across retained logs</small></div>
        <div><span><AlertTriangle size={13} /> Error responses</span><strong>{errorCount}</strong><small>4xx and 5xx responses</small></div>
        <div><span><RefreshCw size={13} /> Retention</span><strong>30 days</strong><small>Trace archive policy</small></div>
      </div>

      {/* Logs Stream Table */}
      <div className="kly-table-wrapper">
        <table className="kly-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Consumer</th>
              <th>Key Prefix</th>
              <th>Region</th>
              <th style={{ textAlign: 'right' }}>Inspection</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((l) => (
              <tr
                key={l.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectLog(l)}
              >
                <td className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
                  {l.timestamp.slice(11, 19)}
                </td>
                <td>
                  <span className={`kly-method-tag kly-method-${l.method}`}>{l.method}</span>
                </td>
                <td className="kly-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                  {l.path}
                </td>
                <td>
                  <span style={{
                    fontFamily: 'var(--kly-font-mono)', fontSize: 11, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 4,
                    background: l.statusCode < 300 ? 'rgba(16,185,129,0.15)' : l.statusCode < 500 ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                    color: l.statusCode < 300 ? '#34d399' : l.statusCode < 500 ? '#fbbf24' : '#fb7185'
                  }}>
                    {l.statusCode}
                  </span>
                </td>
                <td className="kly-mono" style={{ fontSize: 12, color: l.latencyMs > 500 ? '#fb7185' : 'var(--kly-text-muted)' }}>
                  {l.latencyMs}ms
                </td>
                <td style={{ fontSize: 12 }}>{l.consumerName}</td>
                <td className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
                  {l.keyPrefix}...
                </td>
                <td style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>{l.region}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="kly-btn kly-btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={(e) => { e.stopPropagation(); onSelectLog(l); }}
                  >
                    <Eye size={12} />
                    <span>Inspect</span>
                  </button>
                </td>
              </tr>
            ))}
            {!filteredLogs.length && <tr><td colSpan={9} className="kly-empty-state"><Search size={18} /><span>No log entries match the current query.</span><button className="kly-btn kly-btn-ghost" onClick={() => { setQ(''); setStatusFilter('ALL'); }}>Clear filters</button></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
