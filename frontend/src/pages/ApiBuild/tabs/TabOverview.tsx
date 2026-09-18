import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Clock, ShieldCheck, Server,
  Sparkles, ArrowRight, CheckCircle2, AlertTriangle, Key, Users,
  DollarSign, RefreshCw, ExternalLink, Play, FlaskConical, Terminal,
  Plus, Check, Eye, ChevronDown, History, X, Globe, RotateCcw
} from 'lucide-react';
import { ProviderProject, ProjectTab, ApiConsumer } from '../../../types/apibuild';
import { DetailedEndpoint, ExtendedVersion, KlyraInsightItem } from '../types';
import { OperationRecord } from '../../../types/operations';

// Bar chart track height in px — must stay in sync with `.kly-chart-track { height }` in styles-professional.css.
// Bars use a definite px height instead of a CSS percentage so the flex column
// resolves to a real size (percentage-of-auto causes micro-height bars).
const CHART_TRACK_PX = 200;

interface TabOverviewProps {
  project: ProviderProject;
  endpoints: DetailedEndpoint[];
  insights: KlyraInsightItem[];
  selectedVersion: string;
  onSelectTab: (tab: ProjectTab) => void;
  onSelectEndpoint: (ep: DetailedEndpoint) => void;
  onOpenConsumer: (name: string) => void;
  onTriggerRedeploy: (strategy?: string) => void;
  onOpenPlayground: () => void;
  onOpenMigration: () => void;
  onShowToast: (msg: string) => void;
  /** In-flight deploy/rollback operation, when one is running. */
  activeOperation?: OperationRecord | null;
  /** Available versions for rollback target selection. */
  versions?: ExtendedVersion[];
  /** Queue a durable rollback operation to the given version. */
  onRollback?: (targetVersion: string) => void;
  /** Open the operation drawer for the in-flight operation. */
  onOpenOperation?: (op: OperationRecord) => void;
}

const DEPLOY_STRATEGIES = [
  { id: 'rolling', label: 'Rolling', desc: 'Replace instances in batches — zero downtime, default.' },
  { id: 'blue-green', label: 'Blue-Green', desc: 'Stand up a parallel fleet, then switch traffic atomically.' },
  { id: 'canary', label: 'Canary 10%', desc: 'Shift 10% of traffic first, auto-promote when healthy.' },
] as const;

export const TabOverview: React.FC<TabOverviewProps> = ({
  project,
  endpoints,
  insights,
  selectedVersion,
  onSelectTab,
  onSelectEndpoint,
  onOpenConsumer,
  onTriggerRedeploy,
  onOpenPlayground,
  onOpenMigration,
  onShowToast,
  activeOperation,
  versions,
  onRollback,
  onOpenOperation
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [isSimulatingLive, setIsSimulatingLive] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Deployment card modal — Redeploy / Rollback open a centered overlay with a
  // staged flow: select → syncing (spinner) → queued (checkmark) → close.
  const [deployModal, setDeployModal] = useState<null | 'redeploy' | 'rollback'>(null);
  const [pendingStrategy, setPendingStrategy] = useState<string | null>(null);
  const [pendingRollback, setPendingRollback] = useState<string | null>(null);
  const [confirmPhase, setConfirmPhase] = useState<'select' | 'sync' | 'done'>('select');

  const closeDeployModal = () => {
    setDeployModal(null);
    setPendingStrategy(null);
    setPendingRollback(null);
    setConfirmPhase('select');
  };

  useEffect(() => {
    if (!deployModal) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmPhase === 'select') closeDeployModal();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployModal, confirmPhase]);

  const activeOp = activeOperation ?? null;
  const opRunning = !!activeOp && ['queued', 'validating', 'running'].includes(activeOp.state);
  const rollbackTargets = (versions ?? []).filter((v) => v.semver !== project.version && v.semver !== 'all');

  // Confirm runs a short "sync" animation so the queueing feels deliberate,
  // then dispatches the real operation and closes the modal.
  const confirmDeploy = () => {
    if (!pendingStrategy) return;
    setConfirmPhase('sync');
    window.setTimeout(() => {
      setConfirmPhase('done');
      onTriggerRedeploy(pendingStrategy);
      onShowToast(`${pendingStrategy} deploy queued for ${project.version}`);
      window.setTimeout(closeDeployModal, 900);
    }, 1100);
  };
  const confirmRollback = () => {
    if (!pendingRollback) return;
    setConfirmPhase('sync');
    window.setTimeout(() => {
      setConfirmPhase('done');
      onRollback?.(pendingRollback);
      onShowToast(`Rollback to ${pendingRollback} queued`);
      window.setTimeout(closeDeployModal, 900);
    }, 1100);
  };

  // Advances the trailing bar while "Live Stream" is on, so the chart feels real-time.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isSimulatingLive) return;
    const t = setInterval(() => setTick((v) => v + 1), 2500);
    return () => clearInterval(t);
  }, [isSimulatingLive]);

  // Simulated traffic distribution points.
  // History stays stable; the trailing point wobbles with `tick` while streaming.
  const trafficPoints = useMemo(() => {
    const pointsCount = timeRange === '24h' ? 24 : timeRange === '7d' ? 14 : 30;
    const pts = Array.from({ length: pointsCount }, (_, i) => {
      const baseReqs = 22000 + Math.sin(i / 2) * 12000 + ((i * 7919) % 4000);
      const success = Math.floor(baseReqs * 0.985);
      const clientErr = Math.floor(baseReqs * 0.012);
      const serverErr = Math.floor(baseReqs * 0.002);
      const rateLim = Math.floor(baseReqs * 0.001);
      return {
        label: timeRange === '24h' ? `${i}:00` : `Day ${i + 1}`,
        total: Math.floor(baseReqs),
        success,
        clientErr,
        serverErr,
        rateLim,
        p95: 140 + ((i * 37) % 80),
      };
    });
    if (isSimulatingLive && pts.length > 1) {
      const last = pts[pts.length - 1];
      const wobble = Math.sin(tick / 2) * last.total * 0.12;
      const total = Math.max(Math.round(last.total + wobble), 1);
      const success = Math.floor(total * 0.984);
      const clientErr = Math.floor(total * 0.012);
      const rateLim = Math.floor(total * 0.001);
      pts[pts.length - 1] = {
        ...last,
        total,
        success,
        clientErr,
        rateLim,
        serverErr: Math.max(total - success - clientErr - rateLim, 0),
        p95: 140 + ((tick * 37) % 80),
      };
    }
    return pts;
  }, [timeRange, tick, isSimulatingLive]);

  const maxTraffic = Math.max(...trafficPoints.map(p => p.total), 1);
  const xLabelEvery = timeRange === '24h' ? 4 : timeRange === '7d' ? 2 : 5;

  const kfmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

  // Aggregates for a legend that reflects real chart data (not hardcoded labels).
  const counts = trafficPoints.reduce(
    (a, p) => ({
      success: a.success + p.success,
      clientErr: a.clientErr + p.clientErr,
      serverErr: a.serverErr + p.serverErr,
      rateLim: a.rateLim + p.rateLim,
      total: a.total + p.total,
    }),
    { success: 0, clientErr: 0, serverErr: 0, rateLim: 0, total: 0 },
  );
  const pctOf = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);
  const isOperational = ['healthy', 'published'].includes(project.status);
  const healthLabel = project.status === 'deploying' ? 'Deployment in progress' : isOperational ? 'All systems operational' : `Gateway ${project.status}`;
  const isDeploymentHealthy = project.deployment.status === 'healthy' || project.deployment.status === 'healthy-external';
  const deploymentLabel = project.deployment.status === 'queued' ? 'Queued' : project.deployment.status === 'building' ? 'Building' : isDeploymentHealthy ? 'Healthy' : project.deployment.status;

  return (
    <div className="kly-overview-page">

      {/* 1. Live Health Strip */}
      <div className="kly-metric-strip">
        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Uptime SLA</span>
          </div>
          <div className="kly-metric-val">99.97%</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 0.02% 30d</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Success Rate</span>
          </div>
          <div className="kly-metric-val">{project.successRate}%</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 0.4%</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>P95 Latency</span>
          </div>
          <div className="kly-metric-val">{project.latencyMs || 142}ms</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingDown size={11} /> <span>↓ 12.1% faster</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Error Rate</span>
          </div>
          <div className="kly-metric-val">0.21%</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingDown size={11} /> <span>↓ 0.08%</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Total Requests</span>
          </div>
          <div className="kly-metric-val">{project.requestsLabel.split(' ')[0]}</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 18.4%</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Active MRR</span>
          </div>
          <div className="kly-metric-val">${project.revenue.toLocaleString()}</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 8.7% MoM</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Traffic Chart */}
      <div className="kly-card kly-traffic-card">
        <div className="kly-card-header">
          <div>
            <h3 className="kly-card-title">
              <span>Request volume</span>
            </h3>
            <p className="kly-card-subtitle">
              Live gateway throughput by response class. Hover a bar for its complete operational breakdown.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live stream toggle */}
            <button
              type="button"
              className={`kly-live-pill${isSimulatingLive ? ' is-live' : ''}`}
              aria-pressed={isSimulatingLive}
              onClick={() => setIsSimulatingLive(!isSimulatingLive)}
              title={isSimulatingLive ? 'Pause live updates' : 'Resume live updates'}
            >
              <span className="kly-live-pill-dot" />
              <span className="kly-live-pill-text">{isSimulatingLive ? 'Live' : 'Paused'}</span>
            </button>

            {/* Time filters */}
            <div className="kly-seg-ctrl" role="group" aria-label="Traffic time range">
              {(['24h', '7d', '30d'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`kly-seg-btn${timeRange === t ? ' active' : ''}`}
                  aria-pressed={timeRange === t}
                  onClick={() => setTimeRange(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        

        {/* Chart Visualization */}
        <div className="kly-chart">
          <div
            className="kly-chart-area"
            role="img"
            aria-label={`API request volume stacked by response class over the last ${timeRange}`}
          >
            {/* Y axis labels */}
            <div className="kly-chart-y">
              <span>{kfmt(maxTraffic)}</span>
              <span>{kfmt(Math.round((maxTraffic * 2) / 3))}</span>
              <span>{kfmt(Math.round(maxTraffic / 3))}</span>
              <span>0</span>
            </div>

            {/* Responsive stacked bar chart */}
            <div className="kly-chart-track">
              {/* Horizontal gridlines */}
              <div className="kly-chart-grid"><i /><i /><i /><i /></div>

              {/* Stacked traffic bars */}
              <div className="kly-chart-bars">
                {trafficPoints.map((pt, idx) => {
                  const isHovered = hoveredBar === idx;
                  const isLive = isSimulatingLive && idx === trafficPoints.length - 1;
                  const barHeightPx = Math.max(Math.round((pt.total / maxTraffic) * CHART_TRACK_PX), 16);
                  const segs = [
                    { key: 'ok', v: pt.success, cls: 'kly-seg-ok' },
                    { key: 'c4', v: pt.clientErr, cls: 'kly-seg-4xx' },
                    { key: 's5', v: pt.serverErr, cls: 'kly-seg-5xx' },
                    { key: 'rl', v: pt.rateLim, cls: 'kly-seg-429' },
                  ];
                  const tipEdge = idx === 0 ? ' start' : idx === trafficPoints.length - 1 ? ' end' : '';
                  const tipRows = [
                    { key: 'ok', v: pt.success, dot: 'kly-dot-ok', label: 'Success' },
                    { key: 'c4', v: pt.clientErr, dot: 'kly-dot-4xx', label: 'Client err' },
                    { key: 's5', v: pt.serverErr, dot: 'kly-dot-5xx', label: 'Server err' },
                    { key: 'rl', v: pt.rateLim, dot: 'kly-dot-429', label: 'Throttled' },
                  ].filter((r) => r.v > 0);
                  return (
                    <div
                      key={idx}
                      className={`kly-chart-bar-col${isHovered ? ' is-hovered' : ''}`}
                      style={{ opacity: hoveredBar !== null && !isHovered ? 0.4 : 1 }}
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {isHovered && (
                        <div className={`kly-chart-tip${tipEdge}`} role="status" aria-label={`Traffic breakdown for ${pt.label}`}>
                          <div className="kly-tip-head">
                            <span className="kly-tip-title">{pt.label}</span>
                            <span className="kly-tip-total"><b>{kfmt(pt.total)}</b> reqs</span>
                          </div>
                          <div className="kly-tip-body">
                            {tipRows.map((r) => {
                              const share = pt.total > 0 ? (r.v / pt.total) * 100 : 0;
                              return (
                                <div className="kly-tip-row" key={r.key}>
                                  <span className={`kly-legend-dot ${r.dot}`} />
                                  <span className="kly-tip-label">{r.label}</span>
                                  <i className="kly-tip-bar"><i className={`kly-tip-fill ${r.dot}`} style={{ width: `${Math.max(share, 4)}%` }} /></i>
                                  <span className="kly-tip-val"><b>{r.v.toLocaleString()}</b><small>{share >= 1 ? `${share.toFixed(0)}%` : '<1%'}</small></span>
                                </div>
                              );
                            })}
                            {tipRows.length === 0 && <div className="kly-tip-empty">No traffic in this interval</div>}
                          </div>
                          <div className="kly-tip-foot"><span>P95 latency</span><b>{pt.p95}ms</b></div>
                        </div>
                      )}

                      <div
                        className={`kly-bar-stack${isLive ? ' live' : ''}`}
                        style={{ height: `${barHeightPx}px` }}
                      >
                        {segs.filter((s) => s.v > 0).map((s) => (
                          <div key={s.key} className={`kly-bar-seg ${s.cls}`} style={{ height: `${(s.v / pt.total) * 100}%` }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* X axis labels — grid-aligned under the track column; first and last always shown for consistency */}
            <div className="kly-chart-x">
              {trafficPoints.map((pt, idx) => (
                <span
                  key={idx}
                  style={{ visibility: idx % xLabelEvery === 0 || idx === trafficPoints.length - 1 ? 'visible' : 'hidden' }}
                >
                  {pt.label}
                </span>
              ))}
            </div>
          </div>

          <div className="kly-chart-legend" role="list" aria-label="Traffic breakdown by response class">
            {[
              { key: 'ok', v: counts.success, dot: 'kly-dot-ok', label: 'Success', hint: '2xx Successful requests' },
              { key: 'c4', v: counts.clientErr, dot: 'kly-dot-4xx', label: 'Client err', hint: '4xx Client errors' },
              { key: 's5', v: counts.serverErr, dot: 'kly-dot-5xx', label: 'Server err', hint: '5xx Server errors' },
              { key: 'rl', v: counts.rateLim, dot: 'kly-dot-429', label: 'Throttled', hint: '429 Rate-limited requests' },
            ].map((it) => {
              const share = pctOf(it.v);
              return (
                <div
                  key={it.key}
                  role="listitem"
                  className={`kly-legend-item${share < 0.005 ? ' kly-legend-muted' : ''}`}
                  title={it.hint}
                >
                  <span className={`kly-legend-dot ${it.dot}`} />
                  <span className="kly-legend-label">{it.label}</span>
                  <b className="kly-legend-count">{it.v.toLocaleString()}</b>
                  <span className="kly-legend-pct">{share >= 1 ? `${share.toFixed(0)}%` : share > 0 ? '<1%' : '0%'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Two-Column Operations Command Grid */}
      <div className="kly-grid-2col">
        {/* Left Col: Endpoint Health & Active Deployment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Live Endpoint Health */}
          <div className="kly-card">
            <div className="kly-card-header">
              <div>
                <h4 className="kly-card-title">Live Endpoint Status & Health</h4>
                <p className="kly-card-subtitle">Real-time p95 latency and request count</p>
              </div>
              <button className="kly-btn-ghost" onClick={() => onSelectTab('api')} style={{ fontSize: 12 }}>
                View all ({endpoints.length}) →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {endpoints.slice(0, 5).map((ep) => (
                <div
                  key={ep.id}
                  className="kly-ep-row"
                  onClick={() => onSelectEndpoint(ep)}
                  title="Click to inspect endpoint details"
                >
                  <div className="kly-ep-info">
                    <span className={`kly-method-tag kly-method-${ep.method}`}>{ep.method}</span>
                    <span className="kly-ep-path">{ep.path}</span>
                  </div>
                  <div className="kly-ep-stats">
                    <span className={`kly-latency-badge ${ep.avgLatencyMs < 200 ? 'kly-lat-good' : ep.avgLatencyMs < 400 ? 'kly-lat-warn' : 'kly-lat-bad'}`}>
                      {ep.avgLatencyMs < 200 ? '✓' : '⚠'} {ep.avgLatencyMs}ms
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--kly-text-dim)', minWidth: 60, textAlign: 'right' }}>
                      {(ep.totalRequests / 1000).toFixed(0)}k reqs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Deployment */}
          <div className="kly-card kly-deploy-card">
            <div className="kly-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <h4 className="kly-card-title">Production Deployment</h4>
                  <p className="kly-card-subtitle"><Globe size={10} style={{ marginRight: 4, verticalAlign: -1 }} />Active Edge Cluster: Singapore (ap-southeast-1)</p>
                </div>
              </div>
            </div>

            {/* In-flight operation — live progress with details link */}
            {opRunning && activeOp && (
              <div className="kly-deploy-active" role="status">
                <div className="kly-deploy-active-top">
                  <span className="kly-deploy-active-label">
                    <RefreshCw size={12} className="kly-spin" />
                    {activeOp.type === 'rollback'
                      ? <>Rolling back to <b className="kly-mono">{String(activeOp.payload?.targetVersion ?? '')}</b></>
                      : <>Deploying <b className="kly-mono">{String(activeOp.payload?.version ?? project.version)}</b></>}
                    <span className="kly-deploy-active-state">{activeOp.state} · {activeOp.type}</span>
                  </span>
                  <button className="kly-btn kly-btn-ghost kly-deploy-details-btn" onClick={() => onOpenOperation?.(activeOp)}>
                    <Eye size={12} /><span>Details</span>
                  </button>
                </div>
                <div className="kly-deploy-progress" aria-label={`Operation progress ${activeOp.progress}%`}>
                  <div className="kly-deploy-progress-fill" style={{ width: `${activeOp.progress}%` }} />
                </div>
                <div className="kly-deploy-progress-meta">
                  <b className="kly-mono">{activeOp.progress}%</b>
                  <span>{activeOp.reason}</span>
                </div>
              </div>
            )}

            {/* Deployment facts */}
            <div className="kly-deploy-meta">
              <div className="kly-deploy-meta-item">
                <span>Target Version</span>
                <b className="kly-mono">{project.version}</b>
              </div>
              <div className="kly-deploy-meta-item">
                <span>Strategy</span>
                <b>{activeOp?.payload?.strategy ? String(activeOp.payload.strategy) : 'rolling'}</b>
              </div>
              <div className="kly-deploy-meta-item kly-deploy-origin">
                <span>Upstream Origin</span>
                <b className="kly-mono" title={project.deployment.providerUrl || project.baseUrl || undefined}>
                  {project.deployment.providerUrl || project.baseUrl || 'Not configured'}
                </b>
              </div>
              <div className="kly-deploy-meta-item">
                <span>Last Deployment</span>
                <b>{project.deployment.lastHealthCheck}</b>
              </div>
            </div>

            {/* 30-day uptime strip — staggered entrance animation */}
            <div className="kly-deploy-uptime" title="30-day gateway availability — green = healthy, amber = degraded">
              {Array.from({ length: 30 }, (_, i) => (
                <i
                  key={i}
                  className={`kly-uptime-bar${i === 17 ? ' warn' : ''}`}
                  style={{ '--i': i } as React.CSSProperties}
                />
              ))}
              <span className="kly-uptime-val">99.97% · 30d</span>
            </div>

            {/* Actions — open the deploy / rollback overlay */}
            <div className="kly-deploy-actions">
              <button
                className="kly-btn kly-btn-primary"
                onClick={() => { setDeployModal('redeploy'); setPendingStrategy(null); setConfirmPhase('select'); }}
                disabled={opRunning}
                title={opRunning ? 'A deployment operation is already in progress' : 'Queue a new deployment'}
              >
                <RefreshCw size={12} className={opRunning ? 'kly-spin' : ''} />
                <span>Redeploy</span>
              </button>

              <button
                className="kly-btn kly-btn-secondary"
                onClick={() => { setDeployModal('rollback'); setPendingRollback(null); setConfirmPhase('select'); }}
                disabled={opRunning}
                title={opRunning ? 'A deployment operation is already in progress' : 'Roll back to a previous version'}
              >
                <History size={12} />
                <span>Rollback</span>
              </button>

              <button className="kly-btn kly-btn-secondary" onClick={() => onSelectTab('deployments')}>
                <Terminal size={12} />
                <span>View Logs</span>
              </button>
              {activeOp && !opRunning && (
                <button className="kly-btn kly-btn-ghost" onClick={() => onOpenOperation?.(activeOp)}>
                  <Eye size={12} />
                  <span>Last Operation</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Deploy / Rollback overlay — staged sync-style flow */}
        {deployModal && (() => {
          const isRedeploy = deployModal === 'redeploy';
          const syncing = confirmPhase === 'sync';
          const done = confirmPhase === 'done';
          const ready = isRedeploy ? !!pendingStrategy : !!pendingRollback;
          return (
            <div className="kly-deploy-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && confirmPhase === 'select') closeDeployModal(); }}>
              <div className={`kly-deploy-modal${done ? ' is-done' : ''}`} role="dialog" aria-modal="true" aria-label={isRedeploy ? 'Redeploy confirmation' : 'Rollback confirmation'}>
                <div className="kly-deploy-modal-head">
                  <div>
                    <h4>{isRedeploy ? 'Redeploy production' : 'Rollback production'}</h4>
                    <p>{isRedeploy ? 'Choose how the new build should take over traffic.' : 'Traffic will shift back to the selected version.'}</p>
                  </div>
                  {confirmPhase === 'select' && (
                    <button className="kly-btn-icon" onClick={closeDeployModal} aria-label="Close" title="Close (Esc)"><X size={15} /></button>
                  )}
                </div>

                {/* Step 1 — selection (slides away during sync) */}
                <div className={`kly-deploy-modal-body${syncing || done ? ' leaving' : ''}${done ? ' hidden' : ''}`}>
                  {isRedeploy ? (
                    <>
                      <div className="kly-deploy-modal-sec">Deployment strategy</div>
                      {DEPLOY_STRATEGIES.map((s) => (
                        <button
                          key={s.id}
                          className={`kly-deploy-pop-row${pendingStrategy === s.id ? ' selected' : ''}`}
                          onClick={() => setPendingStrategy(s.id)}
                          disabled={syncing}
                        >
                          <span className="kly-deploy-pop-radio">{pendingStrategy === s.id && <Check size={10} />}</span>
                          <span className="kly-deploy-pop-row-text"><b>{s.label}</b><small>{s.desc}</small></span>
                        </button>
                      ))}
                      <div className="kly-deploy-modal-hint">
                        Target <b className="kly-mono">{project.version}</b> on <b>{project.environment}</b> · <b className="kly-mono">{project.deployment.providerUrl || project.baseUrl || 'origin not configured'}</b>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="kly-deploy-modal-sec">Roll back to version</div>
                      {rollbackTargets.length === 0 && (
                        <div className="kly-deploy-pop-empty">No previous versions available.</div>
                      )}
                      {rollbackTargets.map((v) => (
                        <button
                          key={v.id}
                          className={`kly-deploy-pop-row${pendingRollback === v.semver ? ' selected' : ''}`}
                          onClick={() => setPendingRollback(v.semver)}
                          disabled={syncing}
                        >
                          <span className="kly-deploy-pop-radio">{pendingRollback === v.semver && <Check size={10} />}</span>
                          <span className="kly-deploy-pop-row-text">
                            <b className="kly-mono">{v.semver}</b>
                            <small>{v.status}{v.isDefault ? ' · previous default' : ''}</small>
                          </span>
                        </button>
                      ))}
                      <div className="kly-deploy-modal-hint">
                        Current <b className="kly-mono">{project.version}</b> · <b>{project.environment}</b> — gateway traffic shifts back after confirmation.
                      </div>
                    </>
                  )}
                </div>

                {/* Step 2 — syncing / queued (slides in) */}
                <div className={`kly-deploy-sync${syncing || done ? ' entering' : ''}${done ? ' is-done' : ''}`} aria-live="polite">
                  {!done ? (
                    <>
                      <span className="kly-sync-orbit"><i /><i /><i /></span>
                      <div className="kly-sync-title">
                        {isRedeploy ? 'Syncing deploy plan to gateway…' : 'Syncing rollback plan to gateway…'}
                      </div>
                      <div className="kly-sync-steps">
                        <span className="ok"><Check size={10} /> Strategy validated</span>
                        <span className="ok"><Check size={10} /> Environment checked</span>
                        <span className="wait">Queueing operation…</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="kly-sync-check"><Check size={16} /></span>
                      <div className="kly-sync-title">{isRedeploy ? 'Deploy queued' : 'Rollback queued'}</div>
                      <div className="kly-sync-sub">Track live progress in the operation banner below.</div>
                    </>
                  )}
                </div>

                {confirmPhase === 'select' && (
                  <div className="kly-deploy-modal-foot">
                    <button className="kly-btn kly-btn-ghost" onClick={closeDeployModal}>Cancel</button>
                    <button
                      className="kly-btn kly-btn-primary"
                      disabled={!ready}
                      onClick={() => (isRedeploy ? confirmDeploy() : confirmRollback())}
                    >
                      {isRedeploy ? <><RefreshCw size={12} /> Confirm Redeploy</> : <><RotateCcw size={12} /> Confirm Rollback</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Right Col: Klyra AI Insights & Top Consumers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Klyra AI Proactive Insights */}
          <div className="kly-card">
            <div className="kly-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div>
                  <h4 className="kly-card-title">Klyra Intelligent Insights</h4>
                  <p className="kly-card-subtitle">Autonomous diagnostics & recommendations</p>
                </div>
              </div>
              <span className="kly-badge">{insights.length} Insights</span>
            </div>

            <div className="kly-insights-list">
              {insights.slice(0, 4).map((ins) => (
                <div
                  key={ins.id}
                  className={`kly-insight-card ${ins.severity === 'warning' ? 'kly-ins-warning' : ins.severity === 'critical' ? 'kly-ins-critical' : ins.severity === 'success' ? 'kly-ins-success' : ''}`}
                >
                  <div className="kly-insight-content">
                    <div className="kly-insight-cat">{ins.category}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kly-text-main)' }}>{ins.title}</div>
                    <div className="kly-insight-text">{ins.description}</div>
                  </div>

                  <button
                    className="kly-btn kly-btn-secondary"
                    style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0,border:'0px',background:'transparent',}}
                    onClick={() => {
                      if (ins.actionType === 'open_modal') onOpenMigration();
                      else if (ins.targetTab) onSelectTab(ins.targetTab);
                      else onShowToast(`Triggered ${ins.actionText}`);
                    }}
                  >
                    <span>{ins.actionText}</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Top Consumers */}
          <div className="kly-card">
            <div className="kly-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div>
                  <h4 className="kly-card-title">Top Consumers & Quotas</h4>
                  <p className="kly-card-subtitle">Highest volume subscribers this cycle</p>
                </div>
              </div>
              <button className="kly-btn-ghost" onClick={() => onSelectTab('consumers')} style={{ fontSize: 12 }}>
                View all ({project.consumersList.length || 3}) →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {project.consumersList.map((c: ApiConsumer) => {
                const limit = c.plan === 'Business' ? 500000 : c.plan === 'Pro' ? 50000 : 1000;
                const pct = Math.min(Math.round((c.requests / limit) * 100), 100);
                return (
                  <div
                    key={c.id}
                    onClick={() => onOpenConsumer(c.name)}
                    style={{
                      padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6,
                      border: '1px solid var(--kly-border-subtle)', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                        <span className="kly-badge kly-badge-pill">{c.plan}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', marginTop: 2 }}>
                        {c.requests.toLocaleString()} / {limit.toLocaleString()} reqs ({pct}% quota)
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="kly-badge kly-badge-healthy">Active</span>
                      <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', marginTop: 2 }}>
                        ${c.plan === 'Business' ? '79' : '19'}/mo
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
