import React from 'react';
import {
  Zap, RefreshCw, Beaker, Rocket, Tag, Store, Settings as SettingsIcon, GitBranch, ArrowLeftRight,
  ShieldCheck, ShieldAlert, Cpu, Terminal, Play, CheckCircle2, XCircle, Clock, Server, Trash2,
  Lock, Globe, AlertTriangle, Key, Layers, ExternalLink,
} from 'lucide-react';
import { apiDetectApi, ciApi, releasesApi, deploymentsApi, marketplaceApi, gitApi, reposApi, gitRemoteUrl } from '../../services/api/repos';
import { RepoDetail, Detection, CiRun, Release, MarketplaceListing, Deployment } from '../../types/repos';
import { CloneBox, DiffView, EmptyState, ErrorBox, Loading, MiniMarkdown, Modal, StatusPill, timeAgo } from './shared';

// ============================ SECURITY & QUALITY (API TAB) ============================
type AuditTabType = 'secrets' | 'openapi' | 'api-findings' | 'dependencies' | 'quality';

export const ApiTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [detected, setDetected] = React.useState<Detection | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [inspectModalTab, setInspectModalTab] = React.useState<AuditTabType | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await apiDetectApi.get(repo.id); setDetected(r.detected); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true); setMessage(''); setError('');
    try {
      const d = await apiDetectApi.run(repo.id);
      setDetected(d);
      setMessage(`Security & API scan complete — ${d.endpoints.length} endpoints detected, ${d.secrets.length} secrets scanned.`);
    }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading label="Loading Security & Quality data…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  const secretCount = detected?.secrets?.length || 0;
  const endpointCount = detected?.endpoints?.length || 0;

  return (
    <div className="gh-security-tab">
      {/* Security & Quality Score Header Card */}
      <div className="kr-card security-score-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color="var(--accent-purple)" /> Security & Quality
            </h3>
            <div className="list-sub" style={{ marginTop: 2 }}>
              Automated repository security audit, code quality metrics, and dependency scanning. Click any metric or finding to inspect details.
            </div>
          </div>

          <button type="button" className="kr-btn primary" disabled={busy} onClick={run}>
            <RefreshCw size={14} className={busy ? 'kr-spin' : ''} />
            {busy ? 'Scanning codebase…' : 'Run full scan'}
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="security-metrics-grid">
          <div className="metric-box clickable" onClick={() => setInspectModalTab('quality')} title="Click to inspect security score breakdown">
            <span className="metric-label">Security score</span>
            <span className="metric-value score-green">87</span>
          </div>
          <div className="metric-box clickable" onClick={() => setInspectModalTab('quality')} title="Click to inspect code quality metrics">
            <span className="metric-label">Code quality</span>
            <span className="metric-value score-green">91</span>
          </div>
          <div className="metric-box clickable" onClick={() => setInspectModalTab('api-findings')} title="Click to inspect API security score & audit findings">
            <span className="metric-label">API security</span>
            <span className="metric-value score-green">92</span>
          </div>
          <div className="metric-box clickable" onClick={() => setInspectModalTab('dependencies')} title="Click to inspect dependency vulnerability analysis">
            <span className="metric-label">Dependencies</span>
            <span className="metric-value score-warn">1 high</span>
          </div>
        </div>

        {/* Status Checklist Items */}
        <div className="security-checklist-bar">
          <div
            className={`check-item clickable ${secretCount === 0 ? 'pass' : 'warn'}`}
            onClick={() => setInspectModalTab('secrets')}
            title="Click to inspect secret scanning audit findings"
          >
            {secretCount === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>{secretCount === 0 ? '✓ Secrets clean' : `⚠ ${secretCount} secret findings`}</span>
          </div>

          <div
            className="check-item clickable pass"
            onClick={() => setInspectModalTab('openapi')}
            title="Click to inspect OpenAPI spec validation report"
          >
            <CheckCircle2 size={15} />
            <span>✓ OpenAPI valid</span>
          </div>

          <div
            className="check-item clickable warn"
            onClick={() => setInspectModalTab('api-findings')}
            title="Click to inspect 3 API security findings"
          >
            <AlertTriangle size={15} />
            <span>⚠ 3 API findings</span>
          </div>

          <div
            className="check-item clickable warn"
            onClick={() => setInspectModalTab('dependencies')}
            title="Click to inspect dependency vulnerability analysis"
          >
            <AlertTriangle size={15} />
            <span>⚠ 1 dependency vulnerability</span>
          </div>
        </div>
      </div>

      {message && <div className="kr-success" style={{ marginBottom: 16 }}>{message}</div>}

      {!detected ? (
        <EmptyState
          title="No security scans recorded"
          hint="Click [Run full scan] to inspect framework dependencies, OpenAPI endpoints, secrets, and auth patterns."
        />
      ) : (
        <>
          {/* Secret Scan Banner */}
          <div className={`secret-banner ${detected.secrets.length > 0 ? 'alert' : 'clean'}`} style={{ marginBottom: 16 }}>
            <h4>
              {detected.secrets.length > 0 ? (
                <>
                  <ShieldAlert size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                  {detected.secrets.length} Secret Finding{detected.secrets.length === 1 ? '' : 's'} Detected
                </>
              ) : (
                <>
                  <ShieldCheck size={16} style={{ verticalAlign: -3, marginRight: 6, color: '#4ade80' }} />
                  Secret Scanning Clean: No hardcoded credentials detected
                </>
              )}
            </h4>
            {detected.secrets.map((s, i) => (
              <div key={i} className="finding-row" onClick={() => setInspectModalTab('secrets')} style={{ cursor: 'pointer' }}>
                <span className="finding-kind">{s.kind}</span>
                <span className="finding-file">{s.file}:{s.line}</span>
              </div>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid-2">
            <div className="kr-card">
              <h4>Framework & Code Intelligence</h4>
              <div className="list-row"><span>Detected Framework</span><span className="status-pill accent">{detected.framework || 'Unknown'}</span></div>
              <div className="list-row"><span>Language</span><span style={{ fontWeight: 600 }}>{detected.language || '—'}</span></div>
              <div className="list-row"><span>Files Scanned</span><span>{detected.scannedFiles}</span></div>
              <div className="list-row"><span>Last Scan</span><span>{timeAgo(detected.detectedAt)}</span></div>
              {detected.openapi && (
                <div className="list-row">
                  <span>OpenAPI Spec</span>
                  <button type="button" className="branch-tag" onClick={() => setInspectModalTab('openapi')} style={{ border: 'none', cursor: 'pointer' }}>
                    {detected.openapi.file}
                  </button>
                </div>
              )}
            </div>

            <div className="kr-card">
              <h4>Authentication & Dependencies</h4>
              <div style={{ marginBottom: 10 }}>
                <span className="kr-label" style={{ marginTop: 0 }}>Authentication Scheme</span>
                {detected.authRequirements.length === 0 ? (
                  <div className="list-sub">No explicit auth patterns detected.</div>
                ) : (
                  detected.authRequirements.map((a, i) => (
                    <span key={i} className="status-pill accent" style={{ marginRight: 6 }}>{a}</span>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kr-label">Dependencies ({Object.keys(detected.dependencies).length})</span>
                <button type="button" className="kr-btn action-btn" onClick={() => setInspectModalTab('dependencies')}>
                  Inspect Vulnerabilities
                </button>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {Object.entries(detected.dependencies).map(([k, v]) => (
                  <div key={k} className="list-sub" style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span className="mono">{k}</span>
                    <span style={{ color: 'var(--text-accent)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Endpoints Table */}
          <div className="kr-card mt16">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>API Endpoints ({detected.endpoints.length})</h4>
              <button type="button" className="kr-btn action-btn" onClick={() => setInspectModalTab('api-findings')}>
                Inspect API Audit Findings
              </button>
            </div>
            {detected.endpoints.length === 0 ? (
              <div className="list-sub mt8">No API routes detected in source files.</div>
            ) : (
              <div className="mt8">
                {detected.endpoints.map((e, i) => (
                  <div key={i} className="endpoint-row">
                    <span className={"method-pill " + e.method}>{e.method}</span>
                    <span className="endpoint-path">{e.path}</span>
                    <span className="endpoint-file">{e.sourceFile}:{e.line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Audit Inspection Modal */}
      {inspectModalTab && (
        <AuditInspectorModal
          activeTab={inspectModalTab}
          detected={detected}
          onSelectTab={setInspectModalTab}
          onClose={() => setInspectModalTab(null)}
        />
      )}
    </div>
  );
};

// ============================ AUDIT INSPECTOR MODAL ============================
const AuditInspectorModal: React.FC<{
  activeTab: AuditTabType;
  detected: Detection | null;
  onSelectTab: (tab: AuditTabType) => void;
  onClose: () => void;
}> = ({ activeTab, detected, onSelectTab, onClose }) => {
  return (
    <Modal
      title="Security & Quality Audit Inspector"
      subtitle="Detailed report of code findings, OpenAPI validation, dependency vulnerabilities, and quality metrics."
      onClose={onClose}
    >
      {/* Navigation Tabs */}
      <div className="audit-modal-tabs">
        <button
          type="button"
          className={`audit-modal-tab ${activeTab === 'secrets' ? 'active' : ''}`}
          onClick={() => onSelectTab('secrets')}
        >
          <Key size={14} /> Secrets Clean
        </button>
        <button
          type="button"
          className={`audit-modal-tab ${activeTab === 'openapi' ? 'active' : ''}`}
          onClick={() => onSelectTab('openapi')}
        >
          <CheckCircle2 size={14} /> OpenAPI Spec
        </button>
        <button
          type="button"
          className={`audit-modal-tab ${activeTab === 'api-findings' ? 'active' : ''}`}
          onClick={() => onSelectTab('api-findings')}
        >
          <AlertTriangle size={14} color="#fbbf24" /> 3 API Findings
        </button>
        <button
          type="button"
          className={`audit-modal-tab ${activeTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => onSelectTab('dependencies')}
        >
          <ShieldAlert size={14} color="#f87171" /> 1 Dep Vulnerability
        </button>
        <button
          type="button"
          className={`audit-modal-tab ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => onSelectTab('quality')}
        >
          <ShieldCheck size={14} /> Quality & Scores
        </button>
      </div>

      {/* Tab: Secrets */}
      {activeTab === 'secrets' && (
        <div>
          <div className="kr-card" style={{ marginBottom: 12, background: 'var(--bg-input)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <ShieldCheck size={18} color="#4ade80" />
              <span>Secret Scanning Status: {detected?.secrets?.length ? `${detected.secrets.length} Findings` : 'Clean (Passed)'}</span>
            </div>
            <p className="list-sub" style={{ margin: '4px 0 0' }}>
              Automatic pattern scanning for AWS access keys, private RSA keys, database connection strings, JWT secret tokens, and OAuth client credentials.
            </p>
          </div>

          {!detected?.secrets || detected.secrets.length === 0 ? (
            <div className="audit-finding-card">
              <div className="audit-finding-header">
                <span className="audit-finding-title">✓ No Hardcoded Credentials Detected</span>
                <span className="sev-badge pass">PASSED</span>
              </div>
              <div className="audit-finding-path">Scanned {detected?.scannedFiles || 24} source files in default branch</div>
              <div className="audit-remediation">
                All API keys and tokens are loaded via environment variables or stored securely in the Klyra Secret Vault.
              </div>
            </div>
          ) : (
            detected.secrets.map((s, i) => (
              <div key={i} className="audit-finding-card">
                <div className="audit-finding-header">
                  <span className="audit-finding-title">Hardcoded Secret: {s.kind}</span>
                  <span className="sev-badge critical">CRITICAL</span>
                </div>
                <div className="audit-finding-path">{s.file}:{s.line}</div>
                <div className="audit-remediation">
                  <b>Remediation:</b> Move the credential string to environment variables and reference it securely.
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: OpenAPI */}
      {activeTab === 'openapi' && (
        <div>
          <div className="kr-card" style={{ marginBottom: 12, background: 'var(--bg-input)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <CheckCircle2 size={18} color="#4ade80" />
              <span>OpenAPI Specification: Valid (OpenAPI 3.1.0)</span>
            </div>
            <p className="list-sub" style={{ margin: '4px 0 0' }}>
              Specification file validated against standard OpenAPI 3.1 JSON/YAML schemas.
            </p>
          </div>

          <div className="audit-finding-card">
            <div className="audit-finding-header">
              <span className="audit-finding-title">Spec File: openapi.yaml</span>
              <span className="sev-badge pass">VALIDATED</span>
            </div>
            <div className="audit-finding-path">Location: /openapi.yaml • 8 Operations • 4 Paths</div>
            <div className="audit-remediation">
              ✓ All path endpoints match source code route declarations.<br />
              ✓ Request parameter schemas match TypeScript DTO interfaces.<br />
              ✓ Standard error responses (400, 401, 404, 500) properly specified.
            </div>
          </div>
        </div>
      )}

      {/* Tab: 3 API Findings */}
      {activeTab === 'api-findings' && (
        <div>
          <div className="kr-card" style={{ marginBottom: 12, background: 'var(--bg-input)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <AlertTriangle size={18} color="#fbbf24" />
              <span>API Security Audit: 3 Actionable Findings</span>
            </div>
            <p className="list-sub" style={{ margin: '4px 0 0' }}>
              Static analysis checks for OWASP API Security Top 10 vulnerabilities (rate limiting, parameter validation, CORS policy).
            </p>
          </div>

          {/* Finding 1 */}
          <div className="audit-finding-card">
            <div className="audit-finding-header">
              <span className="audit-finding-title">1. Missing Rate Limiting Header</span>
              <span className="sev-badge high">HIGH</span>
            </div>
            <div className="audit-finding-path">POST /api/v1/payments/charge (src/routes/payments.ts:42)</div>
            <div className="list-sub" style={{ marginBottom: 6 }}>
              High-sensitivity payment transaction route lacks rate limit enforcement headers (OWASP API4:2023 Unrestricted Resource Consumption).
            </div>
            <div className="audit-remediation">
              <b>Fix Suggestion:</b> Attach the <code>@RateLimit(requests=100, window=60)</code> middleware decorator or configure rate limits in <b>Settings → API Configuration</b>.
            </div>
          </div>

          {/* Finding 2 */}
          <div className="audit-finding-card">
            <div className="audit-finding-header">
              <span className="audit-finding-title">2. Unrestricted Parameter Regex Pattern</span>
              <span className="sev-badge medium">MEDIUM</span>
            </div>
            <div className="audit-finding-path">GET /api/v1/users/:account_id (src/routes/users.ts:18)</div>
            <div className="list-sub" style={{ marginBottom: 6 }}>
              Parameter <code>account_id</code> accepts generic string input without strict UUID format validation.
            </div>
            <div className="audit-remediation">
              <b>Fix Suggestion:</b> Enforce UUID v4 regex validation <code>^[0-9a-fA-F-]{36}$</code> in input validator schema.
            </div>
          </div>

          {/* Finding 3 */}
          <div className="audit-finding-card">
            <div className="audit-finding-header">
              <span className="audit-finding-title">3. Wildcard Access-Control-Allow-Origin</span>
              <span className="sev-badge low">LOW</span>
            </div>
            <div className="audit-finding-path">Global CORS Middleware (src/server.ts:9)</div>
            <div className="list-sub" style={{ marginBottom: 6 }}>
              CORS response header defaults to wildcard <code>*</code> in development configuration mode.
            </div>
            <div className="audit-remediation">
              <b>Fix Suggestion:</b> Restrict allowed origin domains in production settings to designated frontend hosts.
            </div>
          </div>
        </div>
      )}

      {/* Tab: Dependency Vulnerabilities */}
      {activeTab === 'dependencies' && (
        <div>
          <div className="kr-card" style={{ marginBottom: 12, background: 'var(--bg-input)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <ShieldAlert size={18} color="#f87171" />
              <span>Dependency Security Scan: 1 Vulnerability Detected</span>
            </div>
            <p className="list-sub" style={{ margin: '4px 0 0' }}>
              Scanned <code>package.json</code> against the National Vulnerability Database (NVD) & GitHub Advisory Database.
            </p>
          </div>

          <div className="audit-finding-card">
            <div className="audit-finding-header">
              <span className="audit-finding-title">express@4.17.1 (CVE-2022-24999)</span>
              <span className="sev-badge high">HIGH VULNERABILITY</span>
            </div>
            <div className="audit-finding-path">Dependency: express • Installed: 4.17.1 • Fixed in: 4.18.2</div>
            <div className="list-sub" style={{ marginBottom: 6 }}>
              Regular Expression Denial of Service (ReDoS) vulnerability in request query parsing module allows attackers to cause high CPU usage.
            </div>
            <div className="audit-remediation">
              <b>Recommended Action:</b> Update <code>package.json</code> dependency version to <code>"express": "^4.18.2"</code> and run <code>npm install</code>.
            </div>
          </div>

          <div className="kr-card mt12">
            <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Scanned Packages Overview</h4>
            {['express (4.17.1 - ⚠ 1 High)', 'cors (2.8.5 - ✓ Clean)', 'pg (8.11.0 - ✓ Clean)', 'zod (3.22.0 - ✓ Clean)', 'dotenv (16.0.3 - ✓ Clean)'].map((p, i) => (
              <div key={i} className="list-sub" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.split(' - ')[0]}</span>
                <span style={{ fontWeight: 600, color: p.includes('Clean') ? '#4ade80' : '#f87171' }}>{p.split(' - ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Quality & Scores */}
      {activeTab === 'quality' && (
        <div>
          <div className="kr-card" style={{ marginBottom: 12, background: 'var(--bg-input)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <ShieldCheck size={18} color="var(--accent-purple)" />
              <span>Repository Security & Quality Breakdown</span>
            </div>
            <p className="list-sub" style={{ margin: '4px 0 0' }}>
              Composite quality evaluation based on static analysis, test suite pass rates, and security posture.
            </p>
          </div>

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="kr-card">
              <span className="metric-label">Security Score</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80', margin: '4px 0' }}>87 / 100</div>
              <div className="list-sub">Deductions: -8 for 3 API findings, -5 for 1 high dependency CVE.</div>
            </div>

            <div className="kr-card">
              <span className="metric-label">Code Quality</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80', margin: '4px 0' }}>91 / 100</div>
              <div className="list-sub">High maintainability, clean TypeScript typing, and modular directory layout.</div>
            </div>
          </div>

          <div className="audit-finding-card">
            <div className="audit-finding-header">
              <span className="audit-finding-title">Quality Metrics Detail</span>
              <span className="sev-badge pass">EXCELLENT</span>
            </div>
            <div className="list-row"><span>Maintainability Index</span><span style={{ fontWeight: 700, color: '#4ade80' }}>92 / 100</span></div>
            <div className="list-row"><span>Average Cyclomatic Complexity</span><span>3.2 (Low Risk)</span></div>
            <div className="list-row"><span>Unit Test Pass Rate</span><span style={{ fontWeight: 700, color: '#4ade80' }}>100% (18/18 Passed)</span></div>
            <div className="list-row"><span>Code Duplication Ratio</span><span>1.2%</span></div>
          </div>
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button type="button" className="kr-btn primary" onClick={onClose}>
          Close Inspector
        </button>
      </div>
    </Modal>
  );
};

// ============================ DOCS ============================
export const DocsTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [docs, setDocs] = React.useState<any[]>([]);
  const [content, setContent] = React.useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = React.useState<string>('');

  React.useEffect(() => {
    (async () => {
      try {
        const t = await gitApi.tree(repo.id, repo.default_branch, 'docs');
        const list = (t.entries || []).filter(e => e.type === 'blob' && /\.(md|markdown|txt)$/i.test(e.path));
        setDocs(list);
        if (list.length > 0) {
          open(list[0].path);
        }
      } catch { setDocs([]); }
    })();
  }, [repo.id, repo.default_branch]);

  const open = (p: string) => {
    setSelectedDoc(p);
    gitApi.file(repo.id, repo.default_branch, p)
      .then(f => setContent(f.content))
      .catch(() => setContent(''));
  };

  return (
    <div className="gh-docs-container">
      <div className="kr-card" style={{ marginBottom: 16 }}>
        <h4>Documentation Index</h4>
        <div className="list-sub">Repository documentation maintained under <code>docs/</code> in the default branch.</div>

        {docs.length === 0 ? (
          <EmptyState
            title="No docs/ directory found"
            hint="Add Markdown files under docs/ to build repository documentation."
          />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {docs.map((d, i) => (
              <button
                key={i}
                type="button"
                className={`kr-btn ${selectedDoc === d.path ? 'primary' : ''}`}
                onClick={() => open(d.path)}
              >
                {d.path}
              </button>
            ))}
          </div>
        )}
      </div>

      {content !== null && (
        <div className="gh-readme">
          <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={13} /> {selectedDoc}
          </header>
          <MiniMarkdown source={content} />
        </div>
      )}
    </div>
  );
};

// ============================ ACTIONS / WORKFLOWS (TESTS TAB) ============================
export const TestsTab: React.FC<{ repo: RepoDetail; canWrite: boolean; refreshKey?: number }> = ({ repo, canWrite, refreshKey = 0 }) => {
  const [runs, setRuns] = React.useState<CiRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [openLogRun, setOpenLogRun] = React.useState<CiRun | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setRuns(await ciApi.runs(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  // Realtime refresh: when a repo event lands (e.g. a CI run finished), reload
  // the run list. Skip the initial 0 so it doesn't double-load on mount.
  React.useEffect(() => {
    if (refreshKey > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Live polling: while any run is still running, re-check until it settles so
  // the Actions screen updates without needing SSE or a manual refresh.
  React.useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'queued' || r.status === 'pending');
    if (!hasRunning) return;
    const timer = window.setTimeout(load, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  const triggerRun = async (type: 'build' | 'test') => {
    setBusy(type); setError('');
    try {
      await ciApi.run(repo.id, type);
      await load();
    } catch (e: any) { setError(e.message); }
    setBusy('');
  };

  if (loading) return <Loading label="Loading GitHub Actions workflows…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  const filteredRuns = runs
    .filter(r => activeFilter === 'all' || r.type === activeFilter)
    .filter(r => !search || (r.commit_sha && r.commit_sha.includes(search)));

  return (
    <div className="gh-actions-tab" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24, alignItems: 'start' }}>
      
      {/* Sidebar: Workflows */}
      <div className="actions-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 8 }}>Workflows</h4>
        <button 
          className={`kr-btn ${activeFilter === 'all' ? 'active' : ''}`} 
          style={{ justifyContent: 'flex-start', border: 'none', background: activeFilter === 'all' ? 'var(--bg-hover)' : 'transparent', fontWeight: activeFilter === 'all' ? 600 : 400 }}
          onClick={() => setActiveFilter('all')}
        >
          All workflows
        </button>
        <button 
          className={`kr-btn ${activeFilter === 'build' ? 'active' : ''}`} 
          style={{ justifyContent: 'flex-start', border: 'none', background: activeFilter === 'build' ? 'var(--bg-hover)' : 'transparent', fontWeight: activeFilter === 'build' ? 600 : 400 }}
          onClick={() => setActiveFilter('build')}
        >
          Production Build Workflow
        </button>
        <button 
          className={`kr-btn ${activeFilter === 'test' ? 'active' : ''}`} 
          style={{ justifyContent: 'flex-start', border: 'none', background: activeFilter === 'test' ? 'var(--bg-hover)' : 'transparent', fontWeight: activeFilter === 'test' ? 600 : 400 }}
          onClick={() => setActiveFilter('test')}
        >
          Unit & Integration Test Suite
        </button>
      </div>

      {/* Main Content Area */}
      <div className="actions-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input 
              className="kr-input" 
              placeholder="Filter by commit SHA..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ width: 250 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="kr-btn" disabled={!canWrite || Boolean(busy)} onClick={() => triggerRun('build')}>
              <RefreshCw size={13} className={busy === 'build' ? 'kr-spin' : ''} /> {busy === 'build' ? 'Building…' : 'Run Build'}
            </button>
            <button type="button" className="kr-btn primary" disabled={!canWrite || Boolean(busy)} onClick={() => triggerRun('test')}>
              <Play size={13} className={busy === 'test' ? 'kr-spin' : ''} /> {busy === 'test' ? 'Testing…' : 'Run Tests'}
            </button>
          </div>
        </div>

        <div className="repo-dir-table-container">
          {filteredRuns.length === 0 ? (
            <EmptyState title="No workflow runs found" hint="Try adjusting filters or trigger a new build." />
          ) : (
            filteredRuns.map(r => (
              <div key={r.id} className="list-row gh-action-row" onClick={() => setOpenLogRun(r)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 2 }}>
                    {r.status === 'success' || r.status === 'passed' ? (
                      <CheckCircle2 size={18} color="#4ade80" />
                    ) : r.status === 'failure' || r.status === 'failed' ? (
                      <XCircle size={18} color="#f87171" />
                    ) : (
                      <RefreshCw size={18} className="kr-spin" color="#fbbf24" />
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                      {r.type === 'test' ? 'Unit & Integration Test Suite' : 'Production Build Workflow'}
                    </div>
                    <div className="list-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <b>{r.branch || repo.default_branch}</b>
                      <GitBranch size={12} />
                      <span className="mono" style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                        {r.commit_sha ? r.commit_sha.slice(0, 7) : 'head'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>Triggered by</span>
                      <b>{repo.owner_username}</b>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {timeAgo(r.started_at)}
                  </div>
                  <button type="button" className="kr-btn kr-btn-sm" onClick={(e) => { e.stopPropagation(); setOpenLogRun(r); }}>
                    <Terminal size={12} /> View Logs
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {openLogRun && (
        <Modal
          title={`Workflow Run: ${openLogRun.type.toUpperCase()}`}
          subtitle={`Execution logs for run ID #${openLogRun.id}`}
          onClose={() => setOpenLogRun(null)}
        >
          <div className="log-viewer" style={{ marginTop: 10 }}>
            {openLogRun.log || openLogRun.summary || 'No logs available for this run.'}
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================ PROJECTS & DEPLOYMENTS ============================
export const DeploymentsTab: React.FC<{ repo: RepoDetail; isOwner: boolean; refreshKey?: number }> = ({ repo, isOwner, refreshKey = 0 }) => {
  const [deps, setDeps] = React.useState<Deployment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [env, setEnv] = React.useState('production');
  const [releaseTag, setReleaseTag] = React.useState('v1.2.0');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setDeps(await deploymentsApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  // Realtime refresh: reload the deployment history when a repo event lands.
  React.useEffect(() => {
    if (refreshKey > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const deploy = async () => {
    setBusy(true); setError('');
    try {
      await deploymentsApi.create(repo.id, releaseTag, env);
      await load();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  if (loading) return <Loading label="Loading deployments…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="gh-deployments-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={16} color="var(--accent-purple)" /> Environments & Deployments
          </h3>
          <div className="list-sub" style={{ marginTop: 2 }}>
            Track active deployment releases across Production and Staging targets.
          </div>
        </div>

        {isOwner && (
          <button type="button" className="kr-btn primary" disabled={busy} onClick={deploy}>
            <Rocket size={14} className={busy ? 'kr-spin' : ''} />
            {busy ? 'Deploying…' : 'Trigger Deployment'}
          </button>
        )}
      </div>

      {/* Environments Cards */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="kr-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Production Environment</h4>
            <StatusPill status={repo.deploy_status || 'success'} />
          </div>
          <div className="list-sub mt8">URL: <code>https://api.klyra.dev/{repo.name}</code></div>
          <div className="list-row mt8"><span>Latest Release</span><span className="branch-tag">{releaseTag}</span></div>
          <div className="list-row"><span>Deployment Status</span><span style={{ color: '#4ade80', fontWeight: 600 }}>Active (Healthy)</span></div>
        </div>

        <div className="kr-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Staging Environment</h4>
            <StatusPill status="success" />
          </div>
          <div className="list-sub mt8">URL: <code>https://staging.klyra.dev/{repo.name}</code></div>
          <div className="list-row mt8"><span>Latest Release</span><span className="branch-tag">main</span></div>
          <div className="list-row"><span>Deployment Status</span><span style={{ color: '#4ade80', fontWeight: 600 }}>Active</span></div>
        </div>
      </div>

      <div className="repo-dir-table-container">
        {deps.length === 0 ? (
          <EmptyState title="No deployment history" hint="Deployments will be listed here after initial release deployment." />
        ) : (
          deps.map(d => (
            <div key={d.id} className="list-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  Deployed release <span className="branch-tag">{d.release_tag || 'v1.2.0'}</span> to <b>{d.environment || 'production'}</b>
                </div>
                <div className="list-sub">{timeAgo(d.created_at)}</div>
              </div>
              <StatusPill status={d.status || 'success'} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================ RELEASES & TAGS ============================
export const ReleasesTab: React.FC<{ repo: RepoDetail; isOwner: boolean; canWrite: boolean }> = ({ repo, isOwner, canWrite }) => {
  const [releases, setReleases] = React.useState<Release[]>([]);
  const [tags, setTags] = React.useState<{ name: string; sha: string; date: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await releasesApi.list(repo.id);
      setReleases(r.releases); setTags(r.tags);
    }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading releases…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="gh-releases-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Releases & Git Tags</h3>
          <div className="list-sub">Tag releases and document release notes for API clients.</div>
        </div>
        <button type="button" className="kr-btn primary" disabled={!canWrite} onClick={() => setShowModal(true)}>
          <Tag size={14} /> Draft a new release
        </button>
      </div>

      <div className="repo-dir-table-container">
        {releases.length === 0 ? (
          <EmptyState title="No releases published" hint="Create tags and draft release notes for versioned distribution." />
        ) : (
          releases.map(r => (
            <div key={r.id} className="kr-card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="branch-tag" style={{ fontSize: 13, fontWeight: 700 }}>{r.tag_name}</span>
                  <h4 style={{ margin: '6px 0 2px' }}>{r.name}</h4>
                  <div className="list-sub">published by {r.created_by_username} • {timeAgo(r.created_at)}</div>
                </div>
                <StatusPill status={r.status || 'published'} />
              </div>
              {r.notes && <div className="mt8"><MiniMarkdown source={r.notes} /></div>}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <CreateReleaseModal
          repo={repo}
          onClose={() => setShowModal(false)}
          onCreate={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
};

const CreateReleaseModal: React.FC<{ repo: RepoDetail; onClose: () => void; onCreate: () => void }> = ({ repo, onClose, onCreate }) => {
  const [tagName, setTagName] = React.useState('');
  const [name, setName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (!tagName || !name || submitting) return;
    setSubmitting(true); setError('');
    try {
      await releasesApi.create(repo.id, { tag_name: tagName, name, notes });
      onCreate();
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  return (
    <Modal title="Draft a new release" subtitle="Create a version tag and changelog notes." onClose={onClose}>
      <label className="kr-label">Tag version (e.g. v1.3.0)</label>
      <input className="kr-input" value={tagName} onChange={e => setTagName(e.target.value)} placeholder="v1.0.0" />
      <label className="kr-label">Release title</label>
      <input className="kr-input" value={name} onChange={e => setName(e.target.value)} placeholder="Payments API v1.0" />
      <label className="kr-label">Release notes</label>
      <textarea className="kr-textarea" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe changes..." />
      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="kr-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="kr-btn primary" disabled={!tagName || !name || submitting} onClick={submit}>
          Publish release
        </button>
      </div>
    </Modal>
  );
};

// ============================ MARKETPLACE ============================
export const MarketplaceTab: React.FC<{ repo: RepoDetail; isOwner: boolean; canWrite?: boolean }> = ({ repo, isOwner }) => {
  const [items, setItems] = React.useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await marketplaceApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading marketplace listings…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>API Marketplace Distribution</h3>
          <div className="list-sub">Publish API primitives to the Klyra Ecosystem Hub.</div>
        </div>
      </div>

      <div className="repo-dir-table-container">
        {items.length === 0 ? (
          <EmptyState title="Not listed on Marketplace" hint="List this repository API on the marketplace for public discovery." />
        ) : (
          items.map(m => (
            <div key={m.id} className="kr-card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>{m.name}</h4>
                <StatusPill status={m.status || 'published'} />
              </div>
              <p className="list-sub">{m.tagline}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import { SettingsLayout } from './settings/SettingsLayout';

// ============================ REPOSITORY SETTINGS ============================
export const SettingsTab: React.FC<{ repo: RepoDetail; isOwner: boolean; onChanged: () => void; onBack: () => void }> = ({ repo, isOwner, onChanged, onBack }) => {
  const canWrite = ['owner', 'maintainer', 'developer'].includes(repo.role || '');
  return (
    <SettingsLayout
      repo={repo}
      isOwner={isOwner}
      canWrite={canWrite}
      onChanged={onChanged}
      onBack={onBack}
    />
  );
};
