import React, { useMemo, useState } from 'react';
import {
  Server, Rocket, Terminal, Activity, CheckCircle2, Clock3, AlertTriangle, Filter,
  Globe, GitBranch, RotateCcw, Play, Pause, Eye, ChevronDown, ChevronRight,
  Cpu, Shield, Zap, ArrowUpRight, Layers, RefreshCw, Info, XCircle
} from 'lucide-react';
import { DeploymentRecord } from '../types';
import { deployedDateLabel, deployedRelativeLabel, deployedTooltipLabel } from '../format';
import { ProviderProject } from '../../../types/apibuild';

interface TabDeploymentsProps {
  project: ProviderProject;
  deployments: DeploymentRecord[];
  onSelectDeployment: (dep: DeploymentRecord) => void;
  onTriggerRedeploy: () => void;
  onShowToast: (msg: string) => void;
}

const ENV_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  production: { dot: '#10b981', badge: 'rgba(16,185,129,.12)', text: '#34d399' },
  staging: { dot: '#f59e0b', badge: 'rgba(245,158,11,.12)', text: '#fbbf24' },
  development: { dot: '#38bdf8', badge: 'rgba(56,189,248,.12)', text: '#7dd3fc' },
};

const STATUS_META: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  healthy: { icon: <CheckCircle2 size={11} />, color: '#34d399', bg: 'rgba(16,185,129,.12)', label: 'Healthy' },
  building: { icon: <RefreshCw size={11} className="kly-spin" />, color: '#fbbf24', bg: 'rgba(245,158,11,.12)', label: 'Building' },
  failed: { icon: <XCircle size={11} />, color: '#fb7185', bg: 'rgba(244,63,94,.12)', label: 'Failed' },
  paused: { icon: <Pause size={11} />, color: '#94a3b8', bg: 'rgba(148,163,184,.1)', label: 'Paused' },
};

const ENV_DEFS = [
  { id: 'production', label: 'Production', icon: <Shield size={13} />, color: '#34d399' },
  { id: 'staging', label: 'Staging', icon: <Zap size={13} />, color: '#fbbf24' },
  { id: 'development', label: 'Development', icon: <Cpu size={13} />, color: '#7dd3fc' },
];

export const TabDeployments: React.FC<TabDeploymentsProps> = ({
  project,
  deployments,
  onSelectDeployment,
  onTriggerRedeploy,
  onShowToast
}) => {
  const [envFilter, setEnvFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [strategyMode, setStrategyMode] = useState<'rolling' | 'canary' | 'blue-green'>('rolling');

  const filtered = useMemo(() => deployments.filter((d) =>
    (envFilter === 'ALL' || d.environment === envFilter) &&
    (statusFilter === 'ALL' || d.status === statusFilter) &&
    (!searchQuery || d.id.toLowerCase().includes(searchQuery.toLowerCase()) || (d.commitMessage || '').toLowerCase().includes(searchQuery.toLowerCase()))
  ), [deployments, envFilter, statusFilter, searchQuery]);

  const healthyCount = deployments.filter(d => d.status === 'healthy').length;
  const buildingCount = deployments.filter(d => d.status === 'building').length;
  const failedCount = deployments.filter(d => d.status === 'failed').length;

  const envStats = ENV_DEFS.map(env => {
    const envDeps = deployments.filter(d => d.environment === env.id);
    const live = envDeps.find(d => d.status === 'healthy');
    return { ...env, count: envDeps.length, live, hasIssue: envDeps.some(d => d.status === 'failed') };
  });

  return (
    <div className="kly-dep-root">

      {/* ── Hero: pipeline strategy + primary CTA ── */}
      <div className="kly-card kly-dep-hero">
        <div className="kly-dep-hero-inner">
          <div>
            <span className="kly-eyebrow"><Rocket size={11} /> Deployment Pipeline</span>
            <h3 className="kly-dep-hero-title">Edge Deployments &amp; Release Control</h3>
            <p className="kly-dep-hero-sub">
              Zero-downtime routing across global Klyra edge clusters with advanced canary and blue-green strategies.
            </p>
          </div>
          <div className="kly-dep-hero-actions">
            <div className="kly-dep-strategy-selector">
              <span className="kly-dep-strategy-label"><Layers size={11} /> Strategy</span>
              <div className="kly-dep-strategy-pills">
                {(['rolling', 'canary', 'blue-green'] as const).map(s => (
                  <button
                    key={s}
                    id={`dep-strategy-${s}`}
                    className={`kly-dep-strategy-pill ${strategyMode === s ? 'is-active' : ''}`}
                    onClick={() => setStrategyMode(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button className="kly-btn kly-btn-primary kly-dep-deploy-btn" id="dep-trigger-btn" onClick={onTriggerRedeploy}>
              <Rocket size={13} />
              <span>Deploy Now</span>
              <span className="kly-dep-strategy-tag">{strategyMode}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Environment Health Strip ── */}
      <div className="kly-dep-env-strip">
        {envStats.map(env => (
          <div
            key={env.id}
            id={`dep-env-card-${env.id}`}
            className={`kly-dep-env-card ${envFilter === env.id ? 'is-active' : ''}`}
            onClick={() => setEnvFilter(f => f === env.id ? 'ALL' : env.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setEnvFilter(f => f === env.id ? 'ALL' : env.id)}
          >
            <div className="kly-dep-env-header">
              <span className="kly-dep-env-name">{env.label}</span>
              {env.hasIssue && <AlertTriangle size={11} color="#fb7185" />}
            </div>
            <div className="kly-dep-env-version">
              {env.live
                ? <span className="kly-mono" style={{ color: env.color, fontSize: 12, fontWeight: 700 }}>{env.live.version}</span>
                : <span style={{ color: 'var(--kly-text-dim)', fontSize: 11 }}>No live release</span>}
            </div>
            <div className="kly-dep-env-meta">
              <span>{env.count} release{env.count !== 1 ? 's' : ''}</span>
              {env.live && <span style={{ color: '#34d399' }}>● Live</span>}
            </div>
          </div>
        ))}

        {/* Global KPI stats */}
        <div className="kly-dep-global-stats">
          <div className='kly-dep-sub-stats1'>
            <div className="kly-dep-stat">
              <div><strong style={{ color: '#34d399' }}>{healthyCount}</strong><small>Healthy</small></div>
            </div>
            <div className="kly-dep-stat">
              <div><strong style={{ color: '#fbbf24' }}>{buildingCount}</strong><small>Building</small></div>
            </div>
            <div className="kly-dep-stat">
              <div><strong style={{ color: '#fb7185' }}>{failedCount}</strong><small>Failed</small></div>
            </div>
          </div>
          <div className='kly-dep-sub-stats2'>

            <div className="kly-dep-stat">
              <div><strong style={{ color: '#a78bfa' }}>42</strong><small>Edges</small></div>
            </div>
            <div className="kly-dep-stat">
              <div><strong>2m ago</strong><small>Health check</small></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Release History ── */}
      <div className="kly-table-wrapper">
        <div className="kly-table-toolbar">
          <div className="kly-table-toolbar-title">
            <Filter size={13} />
            <strong>Release History</strong>
            <span>{filtered.length} of {deployments.length}</span>
          </div>
          <div className="kly-dep-toolbar-controls">
            <div className="kly-dep-search">
              <Terminal size={12} />
              <input
                id="dep-search-input"
                type="text"
                placeholder="Search releases…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="kly-select kly-select-compact" value={envFilter} onChange={e => setEnvFilter(e.target.value)} id="dep-env-filter">
              <option value="ALL">All environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
            <select className="kly-select kly-select-compact" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} id="dep-status-filter">
              <option value="ALL">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="building">Building</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
            </select>
            {(envFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
              <button className="kly-btn kly-btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEnvFilter('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>

        <table className="kly-table kly-dep-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Deployment</th>
              <th>Version</th>
              <th>Environment</th>
              <th>Source / Branch</th>
              <th>Region</th>
              <th>Status</th>
              <th>Deployed</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const sm = STATUS_META[d.status] || STATUS_META.paused;
              const ec = ENV_COLORS[d.environment] || ENV_COLORS.development;
              const expanded = expandedRow === d.id;
              const deployedRel = deployedRelativeLabel(d.deployedAt);
              const deployedDate = deployedDateLabel(d.deployedAt);
              return (
                <React.Fragment key={d.id}>
                  <tr className={`kly-dep-row ${expanded ? 'is-expanded' : ''}`} onClick={() => setExpandedRow(expanded ? null : d.id)}>
                    <td>
                      <span className="kly-dep-expand-btn">
                        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </span>
                    </td>
                    <td>
                      <div className="kly-dep-id-cell">
                        <div className="kly-dep-id-icon"><Server size={13} color="#8b5cf6" /></div>
                        <div>
                          <div className="kly-mono kly-dep-id-label">{d.id}</div>
                          {d.commitHash && (
                            <div className="kly-dep-commit-hash">
                              <GitBranch size={10} />
                              <span>{d.commitHash.slice(0, 7)}</span>
                              {d.commitMessage && <span className="kly-dep-commit-msg">{d.commitMessage}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><span className="kly-mono kly-dep-version-cell">{d.version}</span></td>
                    <td>
                      <span className="kly-badge kly-badge-pill kly-dep-env-badge" style={{ background: ec.badge, color: ec.text, borderColor: 'transparent' }}>
                        <span className="kly-dep-env-dot" style={{ background: ec.dot }} />
                        {d.environment}
                      </span>
                    </td>
                    <td>
                      <div className="kly-dep-source-cell">
                        <GitBranch size={11} color="var(--kly-text-dim)" />
                        <span>{d.source}</span>
                        {d.branch && <span className="kly-mono" style={{ color: 'var(--kly-text-dim)', fontSize: 10 }}>({d.branch})</span>}
                      </div>
                    </td>
                    <td>
                      <div className="kly-dep-region-cell">
                        <Globe size={11} color="var(--kly-text-dim)" />
                        <span>{d.region}</span>
                      </div>
                    </td>
                    <td>
                      <span className="kly-badge " style={{color: sm.color}}>
                        {sm.label}
                        {(d.status === 'healthy' || d.status === 'building')}
                      </span>
                    </td>
                    <td>
                      <div className="kly-dep-time-cell" title={deployedTooltipLabel(d.deployedAt)}>
                        <Clock3 size={11} color="var(--kly-text-dim)" />
                        <span className="kly-dep-time-rel">{deployedRel}</span>
                        <span className="kly-dep-time-sep" aria-hidden="true">·</span>
                        <span className="kly-dep-time-date">{deployedDate}</span>
                      </div>
                    </td>
                    <td>
                      <div className="kly-dep-action-cell" onClick={e => e.stopPropagation()}>
                        <button className="kly-btn kly-btn-ghost" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => onSelectDeployment(d)} id={`dep-inspect-${d.id}`} title="Inspect">
                          <Eye size={11} /><span>Inspect</span>
                        </button>
                        <button className="kly-btn kly-btn-ghost" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => onShowToast(`Rollback to ${d.version} queued`)} id={`dep-rollback-${d.id}`} title="Rollback">
                          <RotateCcw size={11} />
                        </button>
                        {d.status === 'paused'
                          ? <button className="kly-btn kly-btn-ghost" style={{ fontSize: 10, padding: '4px 8px', color: '#34d399' }} onClick={() => onShowToast(`Resuming ${d.id}`)} id={`dep-resume-${d.id}`}><Play size={11} /></button>
                          : d.status === 'healthy'
                            ? <button className="kly-btn kly-btn-ghost" style={{ fontSize: 10, padding: '4px 8px', color: '#fb7185' }} onClick={() => onShowToast(`Paused ${d.id}`)} id={`dep-pause-${d.id}`}><Pause size={11} /></button>
                            : null}
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="kly-dep-expanded-row">
                      <td colSpan={9}>
                        <div className="kly-dep-detail-panel">
                          <div className="kly-dep-detail-grid">
                            <div className="kly-dep-detail-section">
                              <h5><Info size={11} /> Build Details</h5>
                              <div className="kly-dep-detail-fields">
                                <div><span>Author</span><strong>{d.author}</strong></div>
                                <div><span>Duration</span><strong>{d.durationSec}s</strong></div>
                                <div><span>URL</span><a href={d.url} target="_blank" rel="noopener noreferrer" className="kly-dep-url-link">{d.url} <ArrowUpRight size={10} /></a></div>
                              </div>
                            </div>
                            <div className="kly-dep-detail-section">
                              <h5><Terminal size={11} /> Deploy Log</h5>
                              <div className="kly-dep-mini-log">
                                {d.logs.map((line, i) => (
                                  <div key={i} className="kly-dep-log-line">
                                    <CheckCircle2 size={10} color="#34d399" />
                                    <span>{line}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="kly-dep-detail-section">
                              <h5><Zap size={11} /> Quick Actions</h5>
                              <div className="kly-dep-quick-actions">
                                <button className="kly-btn kly-btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => onSelectDeployment(d)}>
                                  <Eye size={12} /> Full Inspection
                                </button>
                                <button className="kly-btn kly-btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => onShowToast(`Rollback to ${d.version} queued`)}>
                                  <RotateCcw size={12} /> Rollback Here
                                </button>
                                <button className="kly-btn kly-btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => onShowToast('Promotion queued to next environment')}>
                                  <ArrowUpRight size={12} /> Promote
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {!filtered.length && (
              <tr>
                <td colSpan={9} className="kly-empty-state">
                  <AlertTriangle size={18} />
                  <span>No deployments match these filters.</span>
                  <button className="kly-btn kly-btn-ghost" onClick={() => { setEnvFilter('ALL'); setStatusFilter('ALL'); setSearchQuery(''); }}>Clear filters</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
