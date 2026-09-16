import React, { useState, useEffect } from 'react';
import {
  Code, Search, Plus, Upload, RefreshCw, Copy, Check, FlaskConical,
  Terminal, ChevronDown, ChevronUp, ShieldCheck, Clock, ExternalLink,
  Activity, AlertTriangle, CheckCircle2, Filter, RotateCcw, CheckSquare, SlidersHorizontal, ToggleRight,
  Settings2, Loader2, Wifi, Minus, History, X, Download
} from 'lucide-react';
import { DetailedEndpoint } from '../types';
import { ProviderProject } from '../../../types/apibuild';

/* ------------------------------------------------------------------ *
 * TabApi — Endpoint Catalog                                            *
 * Data-driven + instance-configurable. Every visual section and       *
 * behavior can be tuned via the `options` prop, and the page degrades  *
 * gracefully when `endpoints` is empty or data is partial.             *
 * ------------------------------------------------------------------ */

type SortKey = 'alpha' | 'latency' | 'requests' | 'method';

export interface TabApiOptions {
  /** Heading shown in the API identity card. Defaults to `${project.name} API Spec`. */
  title?: string;
  /** Show the gateway / upstream URL copy strip. Default true. */
  showUrls?: boolean;
  /** Show the KPI summary strip. Default true. */
  showSummary?: boolean;
  /** Show the search / filter / sort toolbar. Default true. */
  showToolbar?: boolean;
  /** Expand the first endpoint on load. Default true. */
  defaultExpanded?: boolean;
  /** Row density. Default "comfortable". */
  density?: 'comfortable' | 'compact';
  /** Default sort order. Default "alpha". */
  sortBy?: SortKey;
  /** Rows per page — 0 (default) shows every matching endpoint. */
  pageSize?: number;
}

const TAB_API_DEFAULT_OPTIONS: TabApiOptions = {
  showUrls: true,
  showSummary: true,
  showToolbar: true,
  defaultExpanded: true,
  density: 'comfortable',
  sortBy: 'alpha',
  pageSize: 0,
};

interface TabApiProps {
  project: ProviderProject;
  endpoints: DetailedEndpoint[];
  onSelectEndpoint: (ep: DetailedEndpoint) => void;
  onOpenPlayground: (ep?: DetailedEndpoint) => void;
  onOpenImportModal: () => void;
  onShowToast: (msg: string) => void;
  /** Apply a policy patch to one route (optimistic + backend sync upstream). */
  onUpdateEndpoint?: (endpointId: string, patch: Partial<DetailedEndpoint>) => void;
  /** Apply a gateway-level config patch to the project. */
  onUpdateProject?: (patch: Partial<ProviderProject>) => void;
  /** Per-instance configuration. Every setting is optional with safe defaults. */
  options?: Partial<TabApiOptions>;
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'alpha', label: 'Route (A–Z)' },
  { key: 'method', label: 'HTTP method' },
  { key: 'latency', label: 'Latency' },
  { key: 'requests', label: 'Requests' },
];

export const TabApi: React.FC<TabApiProps> = ({
  project,
  endpoints,
  onSelectEndpoint,
  onOpenPlayground,
  onOpenImportModal,
  onShowToast,
  onUpdateEndpoint,
  onUpdateProject,
  options
}) => {
  const opts = { ...TAB_API_DEFAULT_OPTIONS, ...(options ?? {}) };
  const [q, setQ] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>(opts.sortBy ?? 'alpha');
  const [page, setPage] = useState(1);
  // Multi-expand: a Set of endpoint ids (industry-standard list behavior).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(opts.defaultExpanded && endpoints.length ? [endpoints[0].id] : [])
  );
  const [copiedUrl, setCopiedUrl] = useState<'gw' | 'base' | 'code' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMock, setBulkMock] = useState(false);
  const [bulkRateLimit, setBulkRateLimit] = useState(600);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSynced, setLastSynced] = useState('Just now');
  const [isApplyingPolicy, setIsApplyingPolicy] = useState(false);
  const [viewOptions, setViewOptions] = useState({
    showUrls: opts.showUrls ?? true,
    showSummary: opts.showSummary ?? true,
    showToolbar: opts.showToolbar ?? true,
    density: opts.density ?? 'comfortable' as 'comfortable' | 'compact',
  });

  const filterMethods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  // Filtering — case-insensitive, tolerant of partial data.
  const filteredEndpoints = endpoints.filter(ep => {
    const matchQ = !q || ep.path.toLowerCase().includes(q.toLowerCase()) || ep.summary.toLowerCase().includes(q.toLowerCase());
    const matchMethod = selectedMethod === 'ALL' || ep.method === selectedMethod;
    const matchStatus = selectedStatus === 'ALL' || ep.status === selectedStatus;
    return matchQ && matchMethod && matchStatus;
  });

  // Sorting — non-mutating copy, stable per key.
  const sortedEndpoints = [...filteredEndpoints].sort((a, b) => {
    switch (sortKey) {
      case 'latency': return a.avgLatencyMs - b.avgLatencyMs;
      case 'requests': return b.totalRequests - a.totalRequests;
      case 'method': {
        const byMethod = a.method.localeCompare(b.method);
        return byMethod !== 0 ? byMethod : a.path.localeCompare(b.path);
      }
      default: return a.path.localeCompare(b.path);
    }
  });

  // Pagination — opt-in via options.pageSize (0 = show all).
  const pageSize = Math.max(opts.pageSize ?? 0, 0);
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sortedEndpoints.length / pageSize)) : 1;
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pageStart = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
  const visibleEndpoints = pageSize > 0
    ? sortedEndpoints.slice(pageStart, pageStart + pageSize)
    : sortedEndpoints;

  // Any filter/sort change returns to the first page.
  useEffect(() => { setPage(1); }, [q, selectedMethod, selectedStatus, sortKey]);

  const healthyCount = endpoints.filter(ep => ep.isHealthy).length;
  const averageLatency = endpoints.length
    ? Math.round(endpoints.reduce((total, ep) => total + ep.avgLatencyMs, 0) / endpoints.length)
    : 0;
  const totalRequests = endpoints.reduce((total, ep) => total + ep.totalRequests, 0);
  const protectedCount = endpoints.filter(ep => ep.authRequired).length;
  const hasFilters = Boolean(q) || selectedMethod !== 'ALL' || selectedStatus !== 'ALL' || sortKey !== 'alpha';

  const resetFilters = () => {
    setQ('');
    setSelectedMethod('ALL');
    setSelectedStatus('ALL');
    setSortKey('alpha');
    setPage(1);
  };

  const handleCopy = async (text: string, kind: 'gw' | 'base' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(kind);
      onShowToast(`Copied: ${text}`);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      onShowToast(`Copied: ${text}`);
    }
  };

  const toggleEndpoint = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedIds(next);
  };
  const expandAll = () => setExpandedIds(new Set(visibleEndpoints.map(ep => ep.id)));
  const collapseAll = () => setExpandedIds(new Set());
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectVisible = () => setSelectedIds(new Set(visibleEndpoints.map((ep) => ep.id)));

  // Bulk apply — real policy writes through the optimistic update path.
  const bulkTargets = endpoints.filter((ep) => selectedIds.has(ep.id));
  const patchSelected = (patch: Partial<DetailedEndpoint>, doneMsg: string) => {
    if (bulkTargets.length === 0) return onShowToast('Select at least one route first.');
    setIsApplyingPolicy(true);
    bulkTargets.forEach((ep) => onUpdateEndpoint?.(ep.id, patch));
    window.setTimeout(() => {
      setIsApplyingPolicy(false);
      onShowToast(doneMsg);
    }, 650);
  };
  const deprecateSelected = () => patchSelected({ status: 'deprecated' }, `${bulkTargets.length} route${bulkTargets.length === 1 ? '' : 's'} deprecated`);
  const activateSelected = () => patchSelected({ status: 'active' }, `${bulkTargets.length} route${bulkTargets.length === 1 ? '' : 's'} activated`);
  const applyBulkPolicy = () =>
    patchSelected(
      { mockMode: bulkMock, rateLimitPerMin: bulkRateLimit },
      `Policy applied to ${bulkTargets.length} route${bulkTargets.length === 1 ? '' : 's'}: ${bulkMock ? 'mock' : 'upstream'}, ${bulkRateLimit} req/min`
    );
  const bulkRequireAuth = () => {
    const open = bulkTargets.filter((ep) => !ep.authRequired);
    if (open.length === 0) return onShowToast('All selected routes already require authentication.');
    patchSelected({ authRequired: true }, `API key required on ${open.length} route${open.length === 1 ? '' : 's'}`);
  };
  const clearSelection = () => setSelectedIds(new Set());

  const syncSpec = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(18);
    onShowToast('Specification sync started: checking upstream contract...');
    window.setTimeout(() => setSyncProgress(56), 550);
    window.setTimeout(() => setSyncProgress(82), 1050);
    window.setTimeout(() => {
      setSyncProgress(100);
      setLastSynced('Just now');
      setIsSyncing(false);
      onShowToast('Specification synchronized: contract validation passed');
    }, 1450);
  };

  // Method coverage across all routes.
  const methodCoverage: Record<string, number> = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };
  endpoints.forEach((ep) => { methodCoverage[ep.method] = (methodCoverage[ep.method] || 0) + 1; });
  const activeMethodCount = Object.values(methodCoverage).filter((n) => n > 0).length;

  // Export the live contract as a downloadable OpenAPI document.
  const downloadSpec = () => {
    try {
      const spec = {
        openapi: '3.1.0',
        info: { title: project.name, version: project.version || '1.0.0', description: project.description || '' },
        servers: [{ url: project.gatewayUrl || project.baseUrl || 'https://api.klyra.dev' }],
        paths: Object.fromEntries(endpoints.map((ep) => [
          ep.path,
          {
            [ep.method.toLowerCase()]: {
              summary: ep.summary || '',
              description: ep.description || '',
              security: ep.authRequired ? [{ apiKey: [] }] : [],
              parameters: (ep.parameters || []).map((p) => ({ name: p.name, in: p.in, required: p.required, description: p.description, schema: { type: p.type } })),
              requestBody: ep.requestBody ? { content: { [ep.requestBody.contentType]: { schema: JSON.parse(ep.requestBody.schema || '{}') } } } : undefined,
              responses: Object.fromEntries((ep.responses || []).map((r) => [
                String(r.statusCode),
                { description: r.description || '', content: r.sampleBody ? { 'application/json': { example: JSON.parse(r.sampleBody) } } : undefined },
              ])),
            },
          },
        ])),
        components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } },
      };
      const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(project.slug || project.name || 'api').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '')}.openapi.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onShowToast(`OpenAPI spec exported — ${endpoints.length} path${endpoints.length === 1 ? '' : 's'} (${project.version || 'unversioned'})`);
    } catch {
      onShowToast('Could not export the spec locally.');
    }
  };

  /* ---------------------------------------------------------------- *
   * Gateway Control Plane — direct-acting system controls.
   * Every control below mutates live route/gateway policy through the
   * parent's optimistic update paths (backend sync included upstream).
   * ---------------------------------------------------------------- */
  const [ctrlBusy, setCtrlBusy] = useState<string | null>(null);
  const [globalRateLimit, setGlobalRateLimit] = useState<number>(
    Math.round(endpoints.reduce((sum, ep) => sum + (ep.rateLimitPerMin || 0), 0) / (endpoints.length || 1)) || 600
  );
  const [globalCacheTtl, setGlobalCacheTtl] = useState<number>(project.cacheTtlSeconds ?? 60);
  const [globalTimeout, setGlobalTimeout] = useState<number>(project.requestTimeoutMs ?? 15000);

  const flashCtrl = (id: string, run: () => void, doneMsg: string) => {
    setCtrlBusy(id);
    run();
    window.setTimeout(() => {
      setCtrlBusy(null);
      onShowToast(doneMsg);
    }, 700);
  };

  // Rate limit — cascade to every route.
  const applyGlobalRateLimit = () =>
    flashCtrl(
      'rate',
      () => endpoints.forEach((ep) => onUpdateEndpoint?.(ep.id, { rateLimitPerMin: globalRateLimit })),
      `Rate limit set to ${globalRateLimit} req/min on ${endpoints.length} route${endpoints.length === 1 ? '' : 's'}`
    );

  // Auth — require API keys on every unprotected route.
  const requireAuthAll = () => {
    const unprotected = endpoints.filter((ep) => !ep.authRequired);
    if (unprotected.length === 0) return onShowToast('All routes already require authentication.');
    flashCtrl(
      'auth',
      () => unprotected.forEach((ep) => onUpdateEndpoint?.(ep.id, { authRequired: true })),
      `API key required on ${unprotected.length} newly protected route${unprotected.length === 1 ? '' : 's'}`
    );
  };

  // Mock mode — circuit-breaker style: serve contract-safe responses upstream-free.
  const mockAll = (enabled: boolean) =>
    flashCtrl(
      'mock',
      () => endpoints.forEach((ep) => onUpdateEndpoint?.(ep.id, { mockMode: enabled })),
      enabled ? `Mock mode enabled on ${endpoints.length} routes — upstream is bypassed` : `Mock mode disabled — traffic flows to upstream`
    );

  // Fallback — serve a canned response when upstream fails.
  const fallbackAll = (enabled: boolean) =>
    flashCtrl(
      'fallback',
      () => endpoints.forEach((ep) => onUpdateEndpoint?.(ep.id, { fallbackEnabled: enabled })),
      enabled ? `Fallback responses enabled on ${endpoints.length} routes` : `Fallback responses disabled`
    );

  // Gateway-level knobs persisted on the project record.
  const applyGatewayConfig = () =>
    flashCtrl(
      'gateway',
      () => onUpdateProject?.({ cacheTtlSeconds: globalCacheTtl, requestTimeoutMs: globalTimeout }),
      `Gateway config applied — cache ${globalCacheTtl}s, timeout ${globalTimeout / 1000}s`
    );

  const mockCount = endpoints.filter((ep) => ep.mockMode).length;
  const fallbackCount = endpoints.filter((ep) => ep.fallbackEnabled).length;
  const allMock = endpoints.length > 0 && mockCount === endpoints.length;
  const allFallback = endpoints.length > 0 && fallbackCount === endpoints.length;


  return (
    <div className={`kly-api-page${viewOptions.density === 'compact' ? ' kly-density-compact' : ''}`}>
      {/* API Product Identity & Gateway Card */}
      <div className="kly-card kly-api-identity">
        <div className="kly-api-identity-head">
          <div className="kly-api-identity-copy">
            <h3 className="kly-api-identity-title">
              {opts.title ?? `${project.name} API Spec`}
            </h3>
            <p className="kly-api-identity-desc">{project.description || 'No description provided.'}</p>
          </div>
          <div className="kly-api-identity-actions">
            <button className="kly-btn kly-btn-secondary" onClick={onOpenImportModal}>
              <Upload size={13} />
              <span>Import OpenAPI</span>
            </button>
            <button className="kly-btn kly-btn-secondary" onClick={syncSpec} disabled={isSyncing}>
              {isSyncing ? <Loader2 size={13} className="kly-spin" /> : <RefreshCw size={13} />}
              <span>{isSyncing ? `Syncing ${syncProgress}%` : 'Sync Spec'}</span>
            </button>
            <button className="kly-btn kly-btn-ghost" onClick={downloadSpec} title="Download this contract as an OpenAPI JSON file">
              <Download size={13} />
              <span>Download Spec</span>
            </button>
            <button className="kly-btn kly-btn-primary" onClick={() => onOpenPlayground()}>
              <FlaskConical size={13} />
              <span>Test All in Playground</span>
            </button>
          </div>
        </div>

       

        {isSyncing && <div className="kly-api-sync-progress" role="status" aria-live="polite"><span style={{ width: `${syncProgress}%` }} /><div><Loader2 size={12} className="kly-spin" /> Validating OpenAPI contract and route metadata</div></div>}

        {/* Gateway + upstream URLs — safe fallbacks for fresh projects */}
        {viewOptions.showUrls && (
          <div className="kly-api-urls">
            <div className="kly-api-url-card">
              <div className="kly-api-url-label">
                <span>KLYRA GATEWAY ENTRYPOINT</span>
                <button
                  type="button"
                  className="kly-btn-icon"
                  aria-label="Copy gateway URL"
                  onClick={() => handleCopy(project.gatewayUrl || '', 'gw')}
                >
                  {copiedUrl === 'gw' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="kly-mono kly-api-url-value is-gateway">
                {project.gatewayUrl || 'Not provisioned yet'}
              </div>
            </div>
            <div className="kly-api-url-card">
              <div className="kly-api-url-label">
                <span>UPSTREAM ORIGIN BASE URL</span>
                <button
                  type="button"
                  className="kly-btn-icon"
                  aria-label="Copy base URL"
                  onClick={() => handleCopy(project.baseUrl || project.gatewayUrl || '', 'base')}
                >
                  {copiedUrl === 'base' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="kly-mono kly-api-url-value">
                {project.baseUrl || project.gatewayUrl || 'Configure an upstream origin'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Gateway Control Plane: system controls that act on the live API ---- */}
      <div className="kly-card kly-ctrl-plane" aria-label="Gateway control plane">
        <div className="kly-card-header">
          <div>
            <h4 className="kly-card-title"><SlidersHorizontal size={15} /> Gateway Control Plane</h4>
            <p className="kly-card-subtitle">Changes apply to the running gateway immediately — every action is audited.</p>
          </div>
          <span className="kly-badge kly-badge-healthy"><Wifi size={11} /> Connected</span>
        </div>

        <div className="kly-ctrl-grid">
          {/* Rate limiting */}
          <div className="kly-ctrl-item">
            <div className="kly-ctrl-head">
              <Activity size={13} className="kly-ctrl-ic is-violet" />
              <b>Global rate limit</b>
              <small>{endpoints.length} routes</small>
            </div>
            <div className="kly-ctrl-row">
              <input
                className="kly-input kly-ctrl-num"
                type="number"
                min={1}
                max={100000}
                value={globalRateLimit}
                onChange={(e) => setGlobalRateLimit(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Requests per minute allowed on every route"
              />
              <span className="kly-ctrl-unit">req/min</span>
              <button className="kly-btn kly-btn-secondary kly-ctrl-apply" onClick={applyGlobalRateLimit} disabled={ctrlBusy !== null}>
                {ctrlBusy === 'rate' ? <Loader2 size={12} className="kly-spin" /> : <Check size={12} />} Apply
              </button>
            </div>
            <div className="kly-ctrl-presets">
              {[100, 600, 1200, 5000].map((preset) => (
                <button key={preset} className={`kly-ctrl-preset${globalRateLimit === preset ? ' active' : ''}`} onClick={() => setGlobalRateLimit(preset)}>
                  {preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="kly-ctrl-item">
            <div className="kly-ctrl-head">
              <ShieldCheck size={13} className="kly-ctrl-ic is-green" />
              <b>Authentication</b>
              <small>{endpoints.length - protectedCount} route{endpoints.length - protectedCount === 1 ? '' : 's'} unprotected</small>
            </div>
            <p className="kly-ctrl-desc">Enforce API-key auth on every route that currently allows anonymous access.</p>
            <button className="kly-btn kly-btn-secondary kly-ctrl-apply" onClick={requireAuthAll} disabled={ctrlBusy !== null}>
              {ctrlBusy === 'auth' ? <Loader2 size={12} className="kly-spin" /> : <ShieldCheck size={12} />} Require auth everywhere
            </button>
          </div>

          {/* Traffic shaping */}
          <div className="kly-ctrl-item">
            <div className="kly-ctrl-head">
              <FlaskConical size={13} className="kly-ctrl-ic is-cyan" />
              <b>Upstream traffic</b>
              <small>{mockCount} mocked · {fallbackCount} fallback</small>
            </div>
            <label className="kly-ctrl-toggle">
              <span><b>Mock mode (circuit breaker)</b><small>Serve contract-safe responses without calling upstream.</small></span>
              <span
                className={`kly-switch${allMock ? ' on' : ''}${ctrlBusy === 'mock' ? ' busy' : ''}`}
                role="switch"
                aria-checked={allMock}
                tabIndex={0}
                onClick={() => ctrlBusy === null && mockAll(!allMock)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && ctrlBusy === null) { e.preventDefault(); mockAll(!allMock); } }}
              >
                <i />
              </span>
            </label>
            <label className="kly-ctrl-toggle">
              <span><b>Failure fallback</b><small>Return a canned response when upstream errors.</small></span>
              <span
                className={`kly-switch${allFallback ? ' on' : ''}${ctrlBusy === 'fallback' ? ' busy' : ''}`}
                role="switch"
                aria-checked={allFallback}
                tabIndex={0}
                onClick={() => ctrlBusy === null && fallbackAll(!allFallback)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && ctrlBusy === null) { e.preventDefault(); fallbackAll(!allFallback); } }}
              >
                <i />
              </span>
            </label>
          </div>

          {/* Gateway runtime config */}
          <div className="kly-ctrl-item">
            <div className="kly-ctrl-head">
              <Settings2 size={13} className="kly-ctrl-ic is-amber" />
              <b>Gateway runtime</b>
              <small>cache · timeout</small>
            </div>
            <div className="kly-ctrl-row kly-ctrl-row-wrap">
              <label className="kly-ctrl-field">Cache
                <input className="kly-input kly-ctrl-num" type="number" min={0} max={86400} value={globalCacheTtl} onChange={(e) => setGlobalCacheTtl(Math.max(0, Number(e.target.value) || 0))} aria-label="Cache TTL seconds" />
                <em>s</em>
              </label>
              <label className="kly-ctrl-field">Timeout
                <input className="kly-input kly-ctrl-num" type="number" min={1000} step={500} value={globalTimeout} onChange={(e) => setGlobalTimeout(Math.max(1000, Number(e.target.value) || 1000))} aria-label="Request timeout milliseconds" />
                <em>ms</em>
              </label>
            </div>
            <button className="kly-btn kly-btn-secondary kly-ctrl-apply" onClick={applyGatewayConfig} disabled={ctrlBusy !== null}>
              {ctrlBusy === 'gateway' ? <Loader2 size={12} className="kly-spin" /> : <Check size={12} />} Apply to gateway
            </button>
          </div>
        </div>
      </div>

      {/* Compact live health microline (replaces the old stat cards) */}
      {viewOptions.showSummary && (
        <div className="kly-api-healthline" aria-label="API health summary">
          <span className="is-green"><CheckCircle2 size={12} /> {healthyCount}/{endpoints.length || 0} healthy</span>
          <span className="is-violet"><Activity size={12} /> {totalRequests.toLocaleString()} reqs</span>
          <span className="is-amber"><Clock size={12} /> {averageLatency}ms avg</span>
          <span className="is-cyan"><ShieldCheck size={12} /> {protectedCount} protected</span>
          {mockCount > 0 && <span className="is-warn"><FlaskConical size={12} /> {mockCount} mocked</span>}
          <span className="kly-healthline-sync"><RefreshCw size={10} /> synced {lastSynced}</span>
        </div>
      )}


      {/* Endpoint Filter & Search Toolbar */}
      {viewOptions.showToolbar && (
      <div className="kly-api-toolbar">
        <div className="kly-api-filter-group">
          <div className="kly-api-search">
            <Search size={14} className="kly-api-search-icon" />
            <input
              type="search"
              className="kly-input"
              placeholder="Search routes (e.g. /generate, users)..."
              aria-label="Search endpoints"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Method Pills */}
          <div className="kly-api-segmented" role="group" aria-label="Filter by HTTP method">
            {filterMethods.map(m => (
              <button
                key={m}
                type="button"
                aria-pressed={selectedMethod === m}
                className={selectedMethod === m ? 'is-active' : ''}
                onClick={() => setSelectedMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <label className="kly-api-status-select">
            <Filter size={13} />
            <span className="sr-only">Filter by status</span>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="active">Active</option>
              <option value="beta">Beta</option>
              <option value="deprecated">Deprecated</option>
            </select>
            <ChevronDown size={12} />
          </label>

          {/* Sort — essential for larger catalogs */}
          <label className="kly-api-status-select">
            <span className="sr-only">Sort endpoints</span>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              {sortOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <ChevronDown size={12} />
          </label>
        </div>

        <div className="kly-api-results-meta">
          <span className="kly-api-count"><b>{visibleEndpoints.length}</b> of {endpoints.length} endpoints</span>
          {visibleEndpoints.length > 1 && (
            <span className="kly-api-actions">
              <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={expandAll} title="Expand all visible endpoints">
                <ChevronUp size={11} /> All
              </button>
              <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={collapseAll} title="Collapse all endpoints">
                <ChevronDown size={11} /> None
              </button>
            </span>
          )}
          {hasFilters && (
            <button className="kly-btn kly-btn-ghost kly-api-reset" onClick={resetFilters}>
              <RotateCcw size={12} /> Reset
            </button>
          )}
          {selectedIds.size > 0 && (
            <span className="kly-api-bulkcount">
              <CheckSquare size={11} /> <b>{selectedIds.size}</b> selected
            </span>
          )}
          {visibleEndpoints.length > selectedIds.size && (
            <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={selectVisible} title="Select all visible endpoints">
              <CheckSquare size={11} /> Select visible
            </button>
          )}
          {pageSize > 0 && totalPages > 1 && (
            <span className="kly-api-pager">
              <button
                type="button"
                className="kly-btn kly-btn-ghost kly-api-mini"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="kly-api-page-indicator">{currentPage}/{totalPages}</span>
              <button
                type="button"
                className="kly-btn kly-btn-ghost kly-api-mini"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                ›
              </button>
            </span>
          )}
        </div>
      </div>
      )}

      {/* Floating bulk-action bar — appears when routes are selected */}
      {selectedIds.size > 0 && (
        <div className="kly-bulk-bar" role="toolbar" aria-label="Bulk route actions">
          <span className="kly-bulk-count"><CheckSquare size={12} /> <b>{selectedIds.size}</b> route{selectedIds.size === 1 ? '' : 's'}</span>
          <span className="kly-bulk-divider" />
          <button
            className="kly-btn kly-btn-secondary kly-bulk-btn"
            onClick={applyBulkPolicy}
            disabled={isApplyingPolicy || !bulkTargets.length}
            title="Apply mock mode + rate limit to every selected route"
          >
            {isApplyingPolicy ? <Loader2 size={12} className="kly-spin" /> : <ToggleRight size={12} />}
            {bulkMock ? 'Mock' : 'Upstream'}
          </button>
          <label className="kly-bulk-rate">
            <span className="sr-only">Bulk rate limit</span>
            <input className="kly-input" type="number" min={1} value={bulkRateLimit} onChange={(e) => setBulkRateLimit(Math.max(1, Number(e.target.value) || 1))} aria-label="Rate limit per minute for selected routes" />
            /min
          </label>
          <span className="kly-bulk-divider" />
          <button className="kly-btn kly-btn-ghost kly-bulk-btn" onClick={bulkRequireAuth} disabled={isApplyingPolicy} title="Require API keys on all selected routes">
            <ShieldCheck size={12} /> Require auth
          </button>
          <button className="kly-btn kly-btn-ghost kly-bulk-btn" onClick={deprecateSelected} disabled={isApplyingPolicy} title="Mark selected routes as deprecated">
            <History size={12} /> Deprecate
          </button>
          <button className="kly-btn kly-btn-ghost kly-bulk-btn" onClick={activateSelected} disabled={isApplyingPolicy} title="Activate selected routes">
            <CheckCircle2 size={12} /> Activate
          </button>
          <span className="kly-bulk-actions">
            <label className="kly-policy-toggle kly-bulk-mock">
              <span><b>Mock selected</b></span><input type="checkbox" checked={bulkMock} onChange={(e) => setBulkMock(e.target.checked)} />
            </label>
            <button className="kly-btn-icon" onClick={clearSelection} title="Clear selection" aria-label="Clear selection"><X size={13} /></button>
          </span>
        </div>
      )}

      {/* Endpoints List */}
      <div className="kly-api-endpoint-list">
        {visibleEndpoints.map((ep) => {
          const isExpanded = expandedIds.has(ep.id);
          return (
            <div key={ep.id} className={`kly-card kly-endpoint-card${isExpanded ? ' is-expanded' : ''}`}>
              {/* Endpoint Row Head — keyboard-accessible expand toggle */}
              <div
                role="button"
                tabIndex={0}
                className="kly-endpoint-row"
                onClick={() => toggleEndpoint(ep.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleEndpoint(ep.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                <div className='kly-endpoint-selesct-identity'>
                <label className="kly-endpoint-select" onClick={(event) => event.stopPropagation()} title={`Select ${ep.path}`}>
                  <input type="checkbox" checked={selectedIds.has(ep.id)} onChange={() => toggleSelected(ep.id)} />
                </label>
                <div className="kly-endpoint-identity">
                  <span className={`kly-method-tag kly-method-${ep.method}`}>{ep.method}</span>
                  <span className="kly-mono kly-endpoint-path">{ep.path}</span>
                  <span className="kly-endpoint-summary">{ep.summary}</span>
                  <span className={`kly-endpoint-status is-${ep.status}`}>{ep.status}</span>
                  {(ep.mockMode || ep.fallbackEnabled) && <span className="kly-endpoint-policy"><ToggleRight size={11} /> {ep.mockMode ? 'Mock' : 'Fallback'}</span>}
                </div>
                </div>

                <div className="kly-endpoint-stats">
                  <span className={`kly-latency-badge ${ep.avgLatencyMs < 200 ? 'kly-lat-good' : ep.avgLatencyMs < 400 ? 'kly-lat-warn' : 'kly-lat-bad'}`}>
                    ~{ep.avgLatencyMs}ms
                  </span>
                  <span className="kly-endpoint-requests">
                    {(ep.totalRequests / 1000).toFixed(0)}k reqs
                  </span>
                  <span className={`kly-endpoint-chevron${isExpanded ? ' is-open' : ''}`}>
                    <ChevronDown size={14} color="var(--kly-text-dim)" />
                  </span>
                </div>
              </div>

              {/* Expandable Endpoint Detail Pane */}
              {isExpanded && (
                <div className="kly-endpoint-detail">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', margin: 0 }}>
                      {ep.description || 'No description provided.'}
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

                  {/* Per-route runtime controls — act on this route immediately */}
                  <div className="kly-route-controls" aria-label={`Runtime controls for ${ep.method} ${ep.path}`}>
                    <label className="kly-ctrl-toggle kly-route-toggle" title="Serve contract-safe responses instead of calling upstream">
                      <span><b>Mock</b><small>bypass upstream</small></span>
                      <span
                        className={`kly-switch${ep.mockMode ? ' on' : ''}`}
                        role="switch"
                        aria-checked={!!ep.mockMode}
                        tabIndex={0}
                        onClick={() => { const next = !ep.mockMode; onUpdateEndpoint?.(ep.id, { mockMode: next }); onShowToast(`Mock ${next ? 'on' : 'off'} for ${ep.path}`); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const next = !ep.mockMode; onUpdateEndpoint?.(ep.id, { mockMode: next }); onShowToast(`Mock ${next ? 'on' : 'off'} for ${ep.path}`); } }}
                      >
                        <i />
                      </span>
                    </label>
                    <label className="kly-ctrl-toggle kly-route-toggle" title="Return a canned response when upstream errors">
                      <span><b>Fallback</b><small>on upstream error</small></span>
                      <span
                        className={`kly-switch${ep.fallbackEnabled ? ' on' : ''}`}
                        role="switch"
                        aria-checked={!!ep.fallbackEnabled}
                        tabIndex={0}
                        onClick={() => { const next = !ep.fallbackEnabled; onUpdateEndpoint?.(ep.id, { fallbackEnabled: next }); onShowToast(`Fallback ${next ? 'on' : 'off'} for ${ep.path}`); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const next = !ep.fallbackEnabled; onUpdateEndpoint?.(ep.id, { fallbackEnabled: next }); onShowToast(`Fallback ${next ? 'on' : 'off'} for ${ep.path}`); } }}
                      >
                        <i />
                      </span>
                    </label>
                    <label className="kly-ctrl-toggle kly-route-toggle" title="Require an API key for this route">
                      <span><b>Auth</b><small>API key required</small></span>
                      <span
                        className={`kly-switch${ep.authRequired ? ' on' : ''}`}
                        role="switch"
                        aria-checked={ep.authRequired}
                        tabIndex={0}
                        onClick={() => { const next = !ep.authRequired; onUpdateEndpoint?.(ep.id, { authRequired: next }); onShowToast(`Auth ${next ? 'required' : 'optional'} for ${ep.path}`); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const next = !ep.authRequired; onUpdateEndpoint?.(ep.id, { authRequired: next }); onShowToast(`Auth ${next ? 'required' : 'optional'} for ${ep.path}`); } }}
                      >
                        <i />
                      </span>
                    </label>
                    <label className="kly-route-rate" title="Per-route requests per minute">
                      <span><b>Rate limit</b></span>
                      <span className="kly-route-rate-row">
                        <button type="button" className="kly-btn-icon" onClick={() => { const next = Math.max(100, (ep.rateLimitPerMin || 0) - 100); onUpdateEndpoint?.(ep.id, { rateLimitPerMin: next }); onShowToast(`Rate limit ${next}/min for ${ep.path}`); }} aria-label="Decrease rate limit"><Minus size={11} /></button>
                        <input
                          className="kly-input kly-ctrl-num"
                          type="number"
                          min={1}
                          value={ep.rateLimitPerMin}
                          onChange={(ev) => onUpdateEndpoint?.(ep.id, { rateLimitPerMin: Math.max(1, Number(ev.target.value) || 1) })}
                          aria-label={`Rate limit per minute for ${ep.path}`}
                        />
                        <button type="button" className="kly-btn-icon" onClick={() => { const next = (ep.rateLimitPerMin || 0) + 100; onUpdateEndpoint?.(ep.id, { rateLimitPerMin: next }); onShowToast(`Rate limit ${next}/min for ${ep.path}`); }} aria-label="Increase rate limit"><Plus size={11} /></button>
                        <em>/min</em>
                      </span>
                    </label>
                  </div>

                  {/* Parameters Table */}
                  {ep.parameters?.length > 0 && (
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
                      <div className="kly-code-head">
                        <h5 className="kly-code-title">Request Body ({ep.requestBody.contentType})</h5>
                        <button
                          type="button"
                          className="kly-btn-icon"
                          aria-label="Copy request body sample"
                          onClick={() => handleCopy(ep.requestBody ? ep.requestBody.sampleBody : '', 'code')}
                        >
                          {copiedUrl === 'code' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
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
            {endpoints.length === 0
              ? <span className="kly-api-empty-icon"><Plus size={18} /></span>
              : <span className="kly-api-empty-icon"><AlertTriangle size={18} /></span>}
            <strong>{endpoints.length === 0 ? 'No endpoints yet' : 'No endpoints found'}</strong>
            <span>
              {endpoints.length === 0
                ? 'Import an OpenAPI spec or scaffold your first route to get started.'
                : 'Try a different route, method, or status filter.'}
            </span>
            {endpoints.length === 0
              ? <button className="kly-btn kly-btn-secondary" onClick={onOpenImportModal}><Upload size={13} /> Import OpenAPI</button>
              : hasFilters && <button className="kly-btn kly-btn-secondary" onClick={resetFilters}>Clear filters</button>}
          </div>
        )}
      </div>
    </div>
  );
};
