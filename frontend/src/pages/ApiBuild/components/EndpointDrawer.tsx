import React, { useEffect, useState } from 'react';
import { Copy, Check, FlaskConical, Terminal, ShieldCheck, Clock, Activity, Save, ToggleRight } from 'lucide-react';
import { DetailedEndpoint } from '../types';
import { DrawerShell } from './DrawerShell';

interface EndpointDrawerProps {
  endpoint: DetailedEndpoint | null;
  /** Project gateway URL — cURL examples must target the real, resolvable host. */
  gatewayUrl?: string;
  onClose: () => void;
  onOpenPlayground: (ep: DetailedEndpoint) => void;
  onViewLogs: (path: string) => void;
  onUpdateEndpoint: (endpointId: string, patch: Partial<DetailedEndpoint>) => void;
  onShowToast: (msg: string) => void;
}

export const EndpointDrawer: React.FC<EndpointDrawerProps> = ({
  endpoint,
  gatewayUrl,
  onClose,
  onOpenPlayground,
  onViewLogs,
  onUpdateEndpoint,
  onShowToast
}) => {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'body' | 'responses' | 'metrics' | 'policy'>('params');
  const [mockMode, setMockMode] = useState(false);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [routeRateLimit, setRouteRateLimit] = useState(0);
  const [fallbackResponse, setFallbackResponse] = useState(`{
  "status": "temporarily_unavailable"
}`);

  useEffect(() => {
    if (!endpoint) return;
    setMockMode(Boolean(endpoint.mockMode));
    setFallbackEnabled(Boolean(endpoint.fallbackEnabled));
    setRouteRateLimit(endpoint.rateLimitPerMin);
    setFallbackResponse(endpoint.fallbackResponse || `{
  "status": "temporarily_unavailable"
}`);
  }, [endpoint]);

  if (!endpoint) return null;

  const savePolicy = () => {
    onUpdateEndpoint(endpoint.id, { mockMode, fallbackEnabled, fallbackResponse, rateLimitPerMin: routeRateLimit });
    onShowToast(`${endpoint.method} ${endpoint.path} policy saved`);
  };

  const curlExample = `curl -X ${endpoint.method} "${gatewayUrl || '${GATEWAY_URL}'}${endpoint.path}" \\
  -H "Authorization: Bearer kly_live_your_key_here" \\
  -H "Content-Type: application/json"${endpoint.requestBody?.sampleBody ? ` \\\n  -d '${endpoint.requestBody.sampleBody.replace(/\n/g, '')}'` : ''}`;

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlExample);
      setCopiedCurl(true);
      onShowToast('cURL command copied to clipboard');
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      onShowToast('Copied cURL');
    }
  };

  return (
    <DrawerShell
      open={!!endpoint}
      onClose={onClose}
      storageKey="endpoint"
      ariaLabel="Endpoint details"
      title={
        <>
          <span className={`kly-method-tag kly-method-${endpoint.method}`}>{endpoint.method}</span>
          <span className="kly-ep-path">{endpoint.path}</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            background: endpoint.isHealthy ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: endpoint.isHealthy ? '#34d399' : '#fbbf24', fontWeight: 600
          }}>
            {endpoint.isHealthy ? 'Healthy' : 'Degraded'}
          </span>
        </>
      }
      subtitle={endpoint.summary}
      toolbar={
        <>
          <button className="kly-btn kly-btn-secondary" onClick={() => onOpenPlayground(endpoint)}>
            <FlaskConical size={13} color="#a855f7" />
            <span>Test in Playground</span>
          </button>
          <button className="kly-btn kly-btn-secondary" onClick={handleCopyCurl}>
            {copiedCurl ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
          </button>
          <button className="kly-btn kly-btn-ghost" onClick={() => onViewLogs(endpoint.path)}>
            <Terminal size={13} />
            <span>Inspect Logs</span>
          </button>
        </>
      }
    >

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--kly-border-subtle)', padding: '0', margin: '-6px 0 14px'
        }}>
          {(['params', 'body', 'responses', 'metrics', 'policy'] as const).map((t) => (
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
              {t === 'params' ? 'Parameters' : t === 'body' ? 'Request Body' : t === 'responses' ? 'Responses' : t === 'metrics' ? 'Live Metrics' : 'Route Policy'}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'params' && (
            <div>
              <h4 style={{ fontSize: 13, marginBottom: 10, color: 'var(--kly-text-muted)' }}>Parameters & Headers</h4>
              {endpoint.parameters.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--kly-text-dim)', fontStyle: 'italic' }}>No path or query parameters required.</div>
              ) : (
                <table className="kly-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Required</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((p, i) => (
                      <tr key={i}>
                        <td className="kly-mono" style={{ color: '#c4b5fd', fontWeight: 600 }}>{p.name}</td>
                        <td><span className="kly-badge kly-badge-pill">{p.in}</span></td>
                        <td className="kly-mono" style={{ fontSize: 11 }}>{p.type}</td>
                        <td>{p.required ? <span style={{ color: '#fb7185', fontWeight: 700 }}>Yes</span> : <span style={{ color: 'var(--kly-text-dim)' }}>No</span>}</td>
                        <td style={{ fontSize: 12, color: 'var(--kly-text-muted)' }}>{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 13, marginBottom: 10, color: 'var(--kly-text-muted)' }}>cURL Snippet</h4>
                <pre className="kly-code-block">{curlExample}</pre>
              </div>
            </div>
          )}

          {activeTab === 'body' && (
            <div>
              {endpoint.requestBody ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="kly-badge kly-badge-pill">{endpoint.requestBody.contentType}</span>
                    <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>JSON Schema Model</span>
                  </div>
                  <pre className="kly-code-block">{endpoint.requestBody.schema}</pre>
                  <h4 style={{ fontSize: 13, marginTop: 10, color: 'var(--kly-text-muted)' }}>Sample Request Payload</h4>
                  <pre className="kly-code-block">{endpoint.requestBody.sampleBody}</pre>
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--kly-text-dim)', fontSize: 13 }}>
                  This endpoint does not accept a request body payload.
                </div>
              )}
            </div>
          )}

          {activeTab === 'responses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {endpoint.responses.map((r, i) => (
                <div key={i} className="kly-card" style={{ background: '#0e0f18' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--kly-font-mono)', fontSize: 12, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 4,
                        background: r.statusCode < 300 ? 'rgba(16,185,129,0.15)' : r.statusCode < 500 ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                        color: r.statusCode < 300 ? '#34d399' : r.statusCode < 500 ? '#fbbf24' : '#fb7185'
                      }}>
                        {r.statusCode}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.description}</span>
                    </div>
                  </div>
                  <pre className="kly-code-block" style={{ fontSize: 11, maxHeight: 180 }}>{r.sampleBody}</pre>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="kly-metric-box">
                  <div className="kly-metric-label">Average Latency</div>
                  <div className="kly-metric-val">{endpoint.avgLatencyMs}ms</div>
                  <div className="kly-metric-trend kly-trend-up">P95: {endpoint.p95LatencyMs}ms</div>
                </div>
                <div className="kly-metric-box">
                  <div className="kly-metric-label">Total Requests</div>
                  <div className="kly-metric-val">{endpoint.totalRequests.toLocaleString()}</div>
                  <div className="kly-metric-trend kly-trend-up">Error rate: {endpoint.errorRate}%</div>
                </div>
              </div>

              <div className="kly-card">
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Security & Policy</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kly-text-muted)' }}>
                    <span>Authentication</span>
                    <b>{endpoint.authRequired ? 'API Key / Bearer Required' : 'Public'}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kly-text-muted)' }}>
                    <span>Rate Limit Policy</span>
                    <b>{endpoint.rateLimitPerMin} req/min per key</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--kly-text-muted)' }}>
                    <span>Category</span>
                    <b>{endpoint.category}</b>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'policy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="kly-policy-callout"><ToggleRight size={17} color="#a78bfa" /><div><strong>Per-route runtime controls</strong><p>Apply a safe response policy without changing the upstream contract.</p></div></div>
              <label className="kly-policy-toggle"><span><b>Mock mode</b><small>Return the configured response and do not call upstream.</small></span><input type="checkbox" checked={mockMode} onChange={(event) => setMockMode(event.target.checked)} /></label>
              <label className="kly-policy-toggle"><span><b>Fallback response</b><small>Serve the response when the upstream exceeds its timeout.</small></span><input type="checkbox" checked={fallbackEnabled} onChange={(event) => setFallbackEnabled(event.target.checked)} /></label>
              <div className="kly-input-group"><label className="kly-label">Route rate limit (requests/minute)</label><input className="kly-input" type="number" min={1} value={routeRateLimit || endpoint.rateLimitPerMin} onChange={(event) => setRouteRateLimit(Number(event.target.value))} /></div>
              <div className="kly-input-group"><label className="kly-label">Fallback JSON response</label><textarea className="kly-textarea kly-mono" rows={7} value={fallbackResponse} onChange={(event) => setFallbackResponse(event.target.value)} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="kly-btn kly-btn-primary" onClick={savePolicy}><Save size={13} /> Save route policy</button></div>
            </div>
          )}
        </div>
      </DrawerShell>
  );
};
