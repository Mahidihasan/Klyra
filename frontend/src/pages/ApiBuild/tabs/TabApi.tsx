import React, { useState } from 'react';
import {
  Code, Search, Plus, Upload, RefreshCw, Copy, Check, FlaskConical,
  Terminal, ChevronDown, ChevronUp, ShieldCheck, Clock, ExternalLink,
  Activity, AlertTriangle, CheckCircle2, Filter, RotateCcw
} from 'lucide-react';
import { DetailedEndpoint } from '../types';
import { ProviderProject } from '../../../types/apibuild';

interface TabApiProps {
  project: ProviderProject;
  endpoints: DetailedEndpoint[];
  onSelectEndpoint: (ep: DetailedEndpoint) => void;
  onOpenPlayground: (ep?: DetailedEndpoint) => void;
  onOpenImportModal: () => void;
  onShowToast: (msg: string) => void;
}

export const TabApi: React.FC<TabApiProps> = ({
  project,
  endpoints,
  onSelectEndpoint,
  onOpenPlayground,
  onOpenImportModal,
  onShowToast
}) => {
  const [q, setQ] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [expandedEpId, setExpandedEpId] = useState<string | null>(endpoints[0]?.id || null);
  const [copiedUrl, setCopiedUrl] = useState<'gw' | 'base' | null>(null);

  const filterMethods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  const filteredEndpoints = endpoints.filter(ep => {
    const matchQ = !q || ep.path.toLowerCase().includes(q.toLowerCase()) || ep.summary.toLowerCase().includes(q.toLowerCase());
    const matchMethod = selectedMethod === 'ALL' || ep.method === selectedMethod;
    const matchStatus = selectedStatus === 'ALL' || ep.status === selectedStatus;
    return matchQ && matchMethod && matchStatus;
  });

  const healthyCount = endpoints.filter(ep => ep.isHealthy).length;
  const averageLatency = endpoints.length
    ? Math.round(endpoints.reduce((total, ep) => total + ep.avgLatencyMs, 0) / endpoints.length)
    : 0;
  const totalRequests = endpoints.reduce((total, ep) => total + ep.totalRequests, 0);
  const hasFilters = Boolean(q) || selectedMethod !== 'ALL' || selectedStatus !== 'ALL';

  const resetFilters = () => {
    setQ('');
    setSelectedMethod('ALL');
    setSelectedStatus('ALL');
  };

  const handleCopy = async (text: string, kind: 'gw' | 'base') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(kind);
      onShowToast(`Copied: ${text}`);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      onShowToast(`Copied: ${text}`);
    }
  };

  return (
    <div className="kly-api-page">
      {/* API Product Identity & Gateway Card */}
      <div className="kly-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{project.name} API Specifications</h3>
              <span className="kly-badge kly-badge-pill">OpenAPI 3.1.0</span>
              <span className="kly-badge kly-badge-healthy">Validated</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', marginTop: 4 }}>
              {project.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="kly-btn kly-btn-secondary" onClick={onOpenImportModal}>
              <Upload size={13} />
              <span>Import OpenAPI</span>
            </button>
            <button className="kly-btn kly-btn-secondary" onClick={() => onShowToast('Syncing specification with upstream...')}>
              <RefreshCw size={13} />
              <span>Sync Spec</span>
            </button>
            <button className="kly-btn kly-btn-primary" onClick={() => onOpenPlayground()}>
              <FlaskConical size={13} />
              <span>Test All in Playground</span>
            </button>
          </div>
        </div>

        {/* URLs strip */}
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--kly-border-subtle)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12
        }}>
          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--kly-border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--kly-text-dim)', fontWeight: 600 }}>KLYRA GATEWAY ENTRYPOINT</span>
              <button
                className="kly-btn-icon"
                style={{ padding: '2px 6px' }}
                onClick={() => handleCopy(project.gatewayUrl, 'gw')}
              >
                {copiedUrl === 'gw' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              </button>
            </div>
            <div className="kly-mono" style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 600 }}>
              {project.gatewayUrl}
            </div>
          </div>

          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--kly-border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--kly-text-dim)', fontWeight: 600 }}>UPSTREAM ORIGIN BASE URL</span>
              <button
                className="kly-btn-icon"
                style={{ padding: '2px 6px' }}
                onClick={() => handleCopy(project.baseUrl || 'https://api.kickonass.com', 'base')}
              >
                {copiedUrl === 'base' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              </button>
            </div>
            <div className="kly-mono" style={{ fontSize: 12, color: 'var(--kly-text-muted)' }}>
              {project.baseUrl || 'https://api.kickonass.com'}
            </div>
          </div>
        </div>
      </div>

      <div className="kly-api-summary" aria-label="API health summary">
        <div className="kly-api-summary-item">
          <span className="kly-api-summary-icon is-green"><CheckCircle2 size={15} /></span>
          <span><b>{healthyCount}/{endpoints.length || 0}</b><small>healthy endpoints</small></span>
        </div>
        <div className="kly-api-summary-item">
          <span className="kly-api-summary-icon is-cyan"><Activity size={15} /></span>
          <span><b>{totalRequests.toLocaleString()}</b><small>requests this period</small></span>
        </div>
        <div className="kly-api-summary-item">
          <span className="kly-api-summary-icon is-amber"><Clock size={15} /></span>
          <span><b>{averageLatency}ms</b><small>average latency</small></span>
        </div>
        <div className="kly-api-summary-item">
          <span className="kly-api-summary-icon is-violet"><ShieldCheck size={15} /></span>
          <span><b>{endpoints.filter(ep => ep.authRequired).length}</b><small>protected routes</small></span>
        </div>
      </div>

      {/* Endpoint Filter & Search Toolbar */}
      <div className="kly-api-toolbar">
        <div className="kly-api-filter-group">
          <div className="kly-api-search">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--kly-text-dim)' }} />
            <input
              type="text"
              className="kly-input"
              style={{ paddingLeft: 32, width: '100%' }}
              placeholder="Search routes (e.g. /generate, users)..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Method Pills */}
          <div className="kly-api-segmented" aria-label="Filter by HTTP method">
            {filterMethods.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                style={{
                  background: selectedMethod === m ? 'rgba(139,92,246,0.2)' : 'transparent',
                  color: selectedMethod === m ? '#c4b5fd' : 'var(--kly-text-dim)',
                  border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <label className="kly-api-status-select">
            <Filter size={13} />
            <span className="sr-only">Filter by status</span>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="active">Active</option>
              <option value="beta">Beta</option>
              <option value="deprecated">Deprecated</option>
            </select>
            <ChevronDown size={12} />
          </label>
        </div>

        <div className="kly-api-results-meta">
          <span>Showing <b>{filteredEndpoints.length}</b> of {endpoints.length} endpoints</span>
          {hasFilters && <button className="kly-btn kly-btn-ghost kly-api-reset" onClick={resetFilters}><RotateCcw size={12} /> Reset</button>}
        </div>
      </div>

      {/* Endpoints List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredEndpoints.map((ep) => {
          const isExpanded = expandedEpId === ep.id;
          return (
            <div key={ep.id} className={`kly-card kly-endpoint-card ${isExpanded ? 'is-expanded' : ''}`}>
              {/* Endpoint Row Head */}
              <div
                className="kly-endpoint-row"
                onClick={() => setExpandedEpId(isExpanded ? null : ep.id)}
              >
                <div className="kly-endpoint-identity">
                  <span className={`kly-method-tag kly-method-${ep.method}`}>{ep.method}</span>
                  <span className="kly-mono kly-endpoint-path">{ep.path}</span>
                  <span className="kly-endpoint-summary">{ep.summary}</span>
                  <span className={`kly-endpoint-status is-${ep.status}`}>{ep.status}</span>
                </div>

                <div className="kly-endpoint-stats">
                  <span className={`kly-latency-badge ${ep.avgLatencyMs < 200 ? 'kly-lat-good' : ep.avgLatencyMs < 400 ? 'kly-lat-warn' : 'kly-lat-bad'}`}>
                    ~{ep.avgLatencyMs}ms
                  </span>
                  <span className="kly-endpoint-requests">
                    {(ep.totalRequests / 1000).toFixed(0)}k reqs
                  </span>
                  {isExpanded ? <ChevronUp size={14} color="var(--kly-text-dim)" /> : <ChevronDown size={14} color="var(--kly-text-dim)" />}
                </div>
              </div>

              {/* Expandable Endpoint Detail Pane */}
              {isExpanded && (
                <div className="kly-endpoint-detail">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', margin: 0 }}>
                      {ep.description}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="kly-btn kly-btn-secondary" onClick={() => onSelectEndpoint(ep)}>
                        <span>Inspect Schemas & Drawer</span>
                      </button>
                      <button className="kly-btn kly-btn-primary" onClick={() => onOpenPlayground(ep)}>
                        <FlaskConical size={13} />
                        <span>Test in Playground</span>
                      </button>
                    </div>
                  </div>

                  {/* Parameters Table */}
                  {ep.parameters.length > 0 && (
                    <div>
                      <h5 style={{ fontSize: 11, fontWeight: 700, color: 'var(--kly-text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Parameters
                      </h5>
                      <table className="kly-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>In</th>
                            <th>Type</th>
                            <th>Required</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.parameters.map((p, i) => (
                            <tr key={i}>
                              <td className="kly-mono" style={{ color: '#c4b5fd' }}>{p.name}</td>
                              <td><span className="kly-badge kly-badge-pill">{p.in}</span></td>
                              <td className="kly-mono" style={{ fontSize: 11 }}>{p.type}</td>
                              <td>{p.required ? <span style={{ color: '#fb7185' }}>Yes</span> : 'No'}</td>
                              <td style={{ color: 'var(--kly-text-muted)' }}>{p.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Request Payload Sample */}
                  {ep.requestBody && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <h5 style={{ fontSize: 11, fontWeight: 700, color: 'var(--kly-text-dim)', textTransform: 'uppercase' }}>
                          Request Body ({ep.requestBody.contentType})
                        </h5>
                      </div>
                      <pre className="kly-code-block" style={{ fontSize: 11, maxHeight: 140 }}>
                        {ep.requestBody.sampleBody}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredEndpoints.length === 0 && (
          <div className="kly-card kly-api-empty">
            <span className="kly-api-empty-icon"><AlertTriangle size={18} /></span>
            <strong>No endpoints found</strong>
            <span>Try a different route, method, or status filter.</span>
            {hasFilters && <button className="kly-btn kly-btn-secondary" onClick={resetFilters}>Clear filters</button>}
          </div>
        )}
      </div>
    </div>
  );
};
