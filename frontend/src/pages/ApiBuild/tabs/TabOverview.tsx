import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Clock, ShieldCheck, Server,
  Sparkles, ArrowRight, CheckCircle2, AlertTriangle, Key, Users,
  DollarSign, RefreshCw, ExternalLink, Play, FlaskConical, Terminal,
  Plus, Check, Eye
} from 'lucide-react';
import { ProviderProject, ProjectTab, ApiConsumer } from '../../../types/apibuild';
import { DetailedEndpoint, ExtendedVersion, KlyraInsightItem } from '../types';

interface TabOverviewProps {
  project: ProviderProject;
  endpoints: DetailedEndpoint[];
  insights: KlyraInsightItem[];
  selectedVersion: string;
  onSelectTab: (tab: ProjectTab) => void;
  onSelectEndpoint: (ep: DetailedEndpoint) => void;
  onOpenConsumer: (name: string) => void;
  onTriggerRedeploy: () => void;
  onOpenPlayground: () => void;
  onOpenMigration: () => void;
  onShowToast: (msg: string) => void;
}

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
  onShowToast
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [isSimulatingLive, setIsSimulatingLive] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

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
            <Activity size={12} color="#10b981" />
          </div>
          <div className="kly-metric-val">99.97%</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 0.02% 30d</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Success Rate</span>
            <CheckCircle2 size={12} color="#10b981" />
          </div>
          <div className="kly-metric-val">{project.successRate}%</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 0.4%</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>P95 Latency</span>
            <Clock size={12} color="#f59e0b" />
          </div>
          <div className="kly-metric-val">{project.latencyMs || 142}ms</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingDown size={11} /> <span>↓ 12.1% faster</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Error Rate</span>
            <AlertTriangle size={12} color="#f43f5e" />
          </div>
          <div className="kly-metric-val">0.21%</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingDown size={11} /> <span>↓ 0.08%</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Total Requests</span>
            <TrendingUp size={12} color="#8b5cf6" />
          </div>
          <div className="kly-metric-val">{project.requestsLabel.split(' ')[0]}</div>
          <div className="kly-metric-trend kly-trend-up">
            <TrendingUp size={11} /> <span>↑ 18.4%</span>
          </div>
        </div>

        <div className="kly-metric-box">
          <div className="kly-metric-label">
            <span>Active MRR</span>
            <DollarSign size={12} color="#10b981" />
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
              <Activity size={15} color="var(--kly-primary)" />
              <span>Request volume</span>
            </h3>
            <p className="kly-card-subtitle">
              Live gateway throughput by response class. Hover a bar for its complete operational breakdown.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live stream toggle */}
            {/* Time filters */}
            <div className="kly-seg-ctrl">
              {(['24h', '7d', '30d'] as const).map(t => (
                <button
                  key={t}
                  className={`kly-seg-btn${timeRange === t ? ' active' : ''}`}
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
          <div className="kly-chart-area">
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
                  const segs = [
                    { key: 'ok', v: pt.success, cls: 'kly-seg-ok' },
                    { key: 'c4', v: pt.clientErr, cls: 'kly-seg-4xx' },
                    { key: 's5', v: pt.serverErr, cls: 'kly-seg-5xx' },
                    { key: 'rl', v: pt.rateLim, cls: 'kly-seg-429' },
                  ];
                  const tipEdge = idx === 0 ? ' start' : idx === trafficPoints.length - 1 ? ' end' : '';
                  return (
                    <div
                      key={idx}
                      className={`kly-chart-bar-col${isHovered ? ' is-hovered' : ''}`}
                      style={{ opacity: hoveredBar !== null && !isHovered ? 0.4 : 1 }}
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {isHovered && (
                        <div className={`kly-chart-tip${tipEdge}`}>
                          <div className="kly-tip-title">{pt.label}</div>
                          <div className="kly-tip-total">Total <b>{pt.total.toLocaleString()}</b></div>
                          <div className="kly-tip-row"><span className="kly-legend-dot kly-dot-ok" />2xx <b>{pt.success.toLocaleString()}</b></div>
                          <div className="kly-tip-row"><span className="kly-legend-dot kly-dot-4xx" />4xx <b>{pt.clientErr.toLocaleString()}</b></div>
                          <div className="kly-tip-row"><span className="kly-legend-dot kly-dot-5xx" />5xx <b>{pt.serverErr.toLocaleString()}</b></div>
                          <div className="kly-tip-row"><span className="kly-legend-dot kly-dot-429" />429 <b>{pt.rateLim.toLocaleString()}</b></div>
                          <div className="kly-tip-latency">P95 <b>{pt.p95}ms</b></div>
                        </div>
                      )}

                      <div
                        className={`kly-bar-stack${isLive ? ' live' : ''}`}
                        style={{ height: `${Math.max(Math.round((pt.total / maxTraffic) * 100), 8)}%` }}
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

          <div className="kly-chart-legend">
            <div className="kly-legend-item">
              <span className="kly-legend-dot kly-dot-ok" />
              <span>2xx Successful</span>
              <b>{pctOf(counts.success).toFixed(2)}%</b>
            </div>
            <div className="kly-legend-item">
              <span className="kly-legend-dot kly-dot-4xx" />
              <span>4xx Client Errors</span>
              <b>{pctOf(counts.clientErr).toFixed(2)}%</b>
            </div>
            <div className="kly-legend-item">
              <span className="kly-legend-dot kly-dot-5xx" />
              <span>5xx Server Errors</span>
              <b>{pctOf(counts.serverErr).toFixed(2)}%</b>
            </div>
            <div className="kly-legend-item">
              <span className="kly-legend-dot kly-dot-429" />
              <span>429 Throttled</span>
              <b>{pctOf(counts.rateLim).toFixed(2)}%</b>
            </div>
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
          <div className="kly-card">
            <div className="kly-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={15} color="#10b981" />
                <div>
                  <h4 className="kly-card-title">Production Deployment</h4>
                  <p className="kly-card-subtitle">Active Edge Cluster: Singapore (ap-southeast-1)</p>
                </div>
              </div>
              <span className={`kly-badge ${isDeploymentHealthy ? 'kly-badge-healthy' : 'kly-badge-deploying'}`}>● {deploymentLabel}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--kly-text-dim)' }}>Target Version</span>
                <b className="kly-mono">{project.version}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--kly-text-dim)' }}>Upstream Origin</span>
                <b className="kly-mono">{project.deployment.providerUrl || project.baseUrl || 'Not configured'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--kly-text-dim)' }}>Last Deployment</span>
                <b>{project.deployment.lastHealthCheck}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="kly-btn kly-btn-primary" onClick={onTriggerRedeploy}>
                <RefreshCw size={12} />
                <span>Redeploy</span>
              </button>
              <button className="kly-btn kly-btn-secondary" onClick={() => onSelectTab('deployments')}>
                <Terminal size={12} />
                <span>View Logs</span>
              </button>
              <button className="kly-btn kly-btn-ghost" onClick={() => onSelectTab('deployments')}>
                <span>Rollback...</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Klyra AI Insights & Top Consumers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Klyra AI Proactive Insights */}
          <div className="kly-card">
            <div className="kly-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={15} color="#c084fc" />
                <div>
                  <h4 className="kly-card-title">Klyra Intelligent Insights</h4>
                  <p className="kly-card-subtitle">Autonomous diagnostics & recommendations</p>
                </div>
              </div>
              <span className="kly-badge kly-badge-pill">{insights.length} Insights</span>
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
                    style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
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
                <Users size={15} color="#38bdf8" />
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

      {/* 4. Recent Real-Time Activity & Quick Command Shortcuts */}
      <div className="kly-card kly-activity-card">
        <div className="kly-card-header">
          <div>
            <h4 className="kly-card-title">Live Activity Timeline</h4>
            <p className="kly-card-subtitle">Real-time edge events, health checks, and subscriber transitions</p>
          </div>
          <button className="kly-btn-ghost" onClick={() => onSelectTab('logs')} style={{ fontSize: 12 }}>
            Inspect full trace logs →
          </button>
        </div>

        <div className="kly-timeline">
          <div className="kly-timeline-item">
            <CheckCircle2 size={14} className="kly-tl-icon-ok" />
            <span style={{ flex: 1 }}>Synthetic health check passed (GET /health returned HTTP 200 in 14ms)</span>
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>12s ago</span>
          </div>
          <div className="kly-timeline-item">
            <DollarSign size={14} className="kly-tl-icon-ok" />
            <span style={{ flex: 1 }}>New subscription: <b>Pixel & Co</b> upgraded to Pro Plan ($19/mo)</span>
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>4m ago</span>
          </div>
          <div className="kly-timeline-item">
            <Server size={14} className="kly-tl-icon-info" />
            <span style={{ flex: 1 }}>Deployment successful: <b>v2.4.1</b> live on Singapore Edge cluster</span>
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>22m ago</span>
          </div>
          <div className="kly-timeline-item">
            <AlertTriangle size={14} className="kly-tl-icon-warn" />
            <span style={{ flex: 1 }}>Transient GPU inference latency spike detected on POST /generate</span>
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>3h ago</span>
          </div>
        </div>

        {/* Quick Actions Footer Bar */}
        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--kly-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
        }}>
          <span style={{ fontSize: 12, color: 'var(--kly-text-dim)', fontWeight: 600 }}>Quick Operational Actions:</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="kly-btn kly-btn-secondary" onClick={() => onSelectTab('keys')}>
              <Key size={12} />
              <span>Create API Key</span>
            </button>
            <button className="kly-btn kly-btn-secondary" onClick={() => onSelectTab('plans')}>
              <DollarSign size={12} />
              <span>Create Plan</span>
            </button>
            <button className="kly-btn kly-btn-secondary" onClick={onOpenPlayground}>
              <FlaskConical size={12} color="#a855f7" />
              <span>Open Playground</span>
            </button>
            <button className="kly-btn kly-btn-secondary" onClick={() => onSelectTab('monitoring')}>
              <Activity size={12} color="#10b981" />
              <span>Run Health Probe</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
