import React, { useState, useMemo } from 'react';
import {
  GitBranch, GitCommit, GitMerge, GitPullRequest, Check, AlertTriangle,
  ArrowRight, Play, Pause, Rocket, RefreshCw, ExternalLink, Code2,
  Shield, CheckCircle2, XCircle, Clock, Zap, Server, Globe,
  Activity, Users, Package, ChevronRight, Eye, RotateCcw,
  Loader2, Terminal, StopCircle, Route, BarChart2, FlaskConical,
  Info, AlertCircle, Cpu, Signal, Lock,
} from 'lucide-react';
import { ProviderProject, ProjectTab, DeploymentInfo } from '../../../types/apibuild';
import { ExtendedVersion, DeploymentRecord } from '../types';
import { releaseStatusLabel } from '../format';

interface TabDevelopmentProps {
  project: ProviderProject;
  versions: ExtendedVersion[];
  deployments: DeploymentRecord[];
  selectedVersion: string;
  onSelectVersion: (semver: string) => void;
  onSelectTab: (tab: ProjectTab) => void;
  onTriggerRedeploy: () => void;
  onShowToast: (msg: string) => void;
}

/* ── Helpers ──────────────────────────────────────────────────────── */
const RuntimeDot = ({ state }: { state: ExtendedVersion['runtimeState'] }) => (
  <span className={`kly-runtime-dot kly-runtime-dot--${state}`}><span /></span>
);

const EnvStatusDot = ({ status }: { status: string }) => {
  const color = status === 'healthy' ? '#34d399' : status === 'building' ? '#fbbf24' : status === 'paused' ? '#f59e0b' : '#fb7185';
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 5, flexShrink: 0 }} />;
};

const LIFECYCLE_STAGES = [
  { key: 'dev',     label: 'Development',  icon: Code2,          desc: 'Active branches & drafts' },
  { key: 'review',  label: 'Code Review',  icon: GitPullRequest, desc: 'Diff approval gates' },
  { key: 'staging', label: 'Staging',      icon: FlaskConical,   desc: 'Reviewable & canary' },
  { key: 'canary',  label: 'Canary',       icon: Signal,         desc: 'Progressive traffic split' },
  { key: 'prod',    label: 'Production',   icon: Rocket,         desc: 'Live consumer-facing' },
];

const QUALITY_GATES = [
  { id: 'schema',   label: 'OpenAPI schema validation',     icon: Shield },
  { id: 'breaking', label: 'No unresolved breaking changes', icon: AlertCircle },
  { id: 'auth',     label: 'Auth scheme unchanged',          icon: Lock },
  { id: 'coverage', label: 'Test coverage ≥ 80%',           icon: CheckCircle2 },
  { id: 'approval', label: 'Two-person approval obtained',   icon: Users },
];

export const TabDevelopment: React.FC<TabDevelopmentProps> = ({
  project,
  versions,
  deployments,
  selectedVersion,
  onSelectVersion,
  onSelectTab,
  onTriggerRedeploy,
  onShowToast,
}) => {
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [pausingId, setPausingId]     = useState<string | null>(null);
  const [gateOverrides, setGateOverrides] = useState<Record<string, boolean>>({
    schema: true, breaking: true, auth: true, coverage: false, approval: false,
  });

  /* ── Derived from versions (shared live state from WorkspaceRedesign) */
  const devVersions     = useMemo(() => versions.filter(v => v.runtimeState === 'stopped'), [versions]);
  const stagingVersions = useMemo(() => versions.filter(v => v.status === 'Beta' && v.runtimeState !== 'stopped'), [versions]);
  const prodVersions    = useMemo(() => versions.filter(v => v.status === 'Current' && v.runtimeState === 'running'), [versions]);
  const pausedVersions  = useMemo(() => versions.filter(v => v.runtimeState === 'paused'), [versions]);

  const currentProd   = prodVersions[0] || versions.find(v => v.isDefault);
  const totalRunning  = versions.filter(v => v.runtimeState === 'running').length;
  const gatesPassedCount = Object.values(gateOverrides).filter(Boolean).length;
  const allGatesPassed   = gatesPassedCount === QUALITY_GATES.length;

  const deployment    = deployments[0] || null;
  const dep           = project.deployment;

  /* ── Lifecycle stage helper ────────────────────────────────────── */
  const stageStatus = (key: string) => {
    if (key === 'dev')     return devVersions.length > 0 ? 'active' : 'idle';
    if (key === 'review')  return allGatesPassed ? 'complete' : 'pending';
    if (key === 'staging') return stagingVersions.length > 0 ? 'active' : 'idle';
    if (key === 'canary')  return versions.some(v => v.canaryWeight > 0 && v.canaryWeight < 100 && v.runtimeState === 'running') ? 'active' : 'idle';
    if (key === 'prod')    return currentProd ? 'complete' : 'idle';
    return 'idle';
  };

  const stageColor = (s: string) => s === 'complete' ? '#34d399' : s === 'active' ? '#c4b5fd' : 'var(--kly-text-dim)';
  const stageBg    = (s: string) => s === 'complete' ? 'rgba(16,185,129,.1)' : s === 'active' ? 'rgba(139,92,246,.1)' : 'transparent';

  /* ── Simulate promote / pause ─────────────────────────────────── */
  const handlePromote = (v: ExtendedVersion) => {
    setPromotingId(v.id);
    setTimeout(() => {
      setPromotingId(null);
      onShowToast(`${v.semver} promotion triggered — check Deployments for progress`);
      onTriggerRedeploy();
    }, 1200);
  };

  const handlePause = (v: ExtendedVersion) => {
    setPausingId(v.id);
    setTimeout(() => {
      setPausingId(null);
      onShowToast(`${v.semver} runtime paused`);
    }, 700);
  };

  /* ── Version card ─────────────────────────────────────────────── */
  const VersionCard = ({ v, showPromote = false }: { v: ExtendedVersion; showPromote?: boolean }) => (
    <div className={`kly-dev-version-card ${v.runtimeState === 'running' ? 'kly-dev-version-card--running' : v.runtimeState === 'paused' ? 'kly-dev-version-card--paused' : ''}`}>
      <div className="kly-dev-version-card-head">
        <span className="kly-dev-version-semver">
          <RuntimeDot state={v.runtimeState} />
          <strong className="kly-mono">{v.semver}</strong>
        </span>
        <span className={`kly-badge ${v.status === 'Current' ? 'kly-badge-healthy' : v.status === 'Beta' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>{v.status}</span>
      </div>

      {/* Traffic weight bar */}
      {v.canaryWeight > 0 && (
        <div className="kly-dev-traffic-bar">
          <div className="kly-runtime-weight-bar" style={{ width: '100%' }}>
            <span style={{ width: `${v.canaryWeight}%` }} />
          </div>
          <span className="kly-runtime-weight-label">{v.canaryWeight}% traffic</span>
        </div>
      )}

      {/* Metrics row */}
      <div className="kly-dev-version-metrics">
        <span title="Success rate" style={{ color: v.successRate >= 99 ? '#34d399' : '#fbbf24' }}>
          <CheckCircle2 size={10} /> {v.successRate}%
        </span>
        <span title="Avg latency"><Zap size={10} /> {v.avgLatencyMs} ms</span>
        <span title="Consumers"><Users size={10} /> {v.consumersCount}</span>
        <span title="Endpoints"><Package size={10} /> {v.endpointsCount} routes</span>
      </div>

      {/* Released at */}
      <div className="kly-dev-version-meta">
        <Clock size={10} /> {releaseStatusLabel(v.releasedAt)}
      </div>

      {/* Actions */}
      <div className="kly-dev-version-actions">
        <button className="kly-btn kly-btn-ghost kly-api-mini"
          onClick={() => { onSelectVersion(v.semver); onSelectTab('versions'); }}>
          <Eye size={11} /> Inspect
        </button>
        {showPromote && (
          <button className="kly-btn kly-btn-primary kly-api-mini"
            onClick={() => handlePromote(v)}
            disabled={promotingId === v.id}>
            {promotingId === v.id
              ? <><Loader2 size={11} className="kly-spin" /> Promoting</>
              : <><Rocket size={11} /> Promote</>}
          </button>
        )}
        {v.runtimeState === 'running' && (
          <button className="kly-btn kly-btn-ghost kly-api-mini"
            onClick={() => handlePause(v)}
            disabled={pausingId === v.id}>
            {pausingId === v.id ? <><Loader2 size={11} className="kly-spin" /></> : <><Pause size={11} /> Pause</>}
          </button>
        )}
        {v.runtimeState === 'paused' && (
          <button className="kly-btn kly-btn-ghost kly-api-mini kly-btn-resume"
            onClick={() => onShowToast(`${v.semver} resumed`)}>
            <Play size={11} /> Resume
          </button>
        )}
      </div>
    </div>
  );

  /* ── Environment health card ─────────────────────────────────── */
  const EnvCard = ({
    label, color, url, status, latency, lastCheck, versionLabel,
  }: { label: string; color: string; url: string; status: string; latency: string; lastCheck: string; versionLabel: string }) => (
    <div className="kly-dev-env-card" style={{ borderColor: `${color}26` }}>
      <div className="kly-dev-env-card-header">
        <span className="kly-dev-env-label" style={{ color }}><Globe size={12} /> {label}</span>
        <span className={`kly-badge ${status === 'healthy' ? 'kly-badge-healthy' : status === 'building' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>{status}</span>
      </div>
      <div className="kly-dev-env-version"><strong className="kly-mono">{versionLabel}</strong></div>
      <div className="kly-dev-env-meta">
        <span><Zap size={10} /> {latency}</span>
        <span><Clock size={10} /> {lastCheck}</span>
      </div>
      <div className="kly-dev-env-url">
        <a href={url} target="_blank" rel="noreferrer">{url.replace('https://', '')} <ExternalLink size={9} /></a>
      </div>
    </div>
  );

  return (
    <div className="kly-page-stack kly-dev-page">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="kly-version-hero kly-card kly-dev-hero">
        <div>
          <span className="kly-eyebrow"><Code2 size={12} /> Development lifecycle</span>
          <h2>{project.name} — Development Control Center</h2>
          <p>
            Full lifecycle visibility from local branches to production. Monitor runtime states, promote versions, and enforce quality gates — all synced live with the Versions tab.
          </p>
        </div>
        <div className="kly-version-hero-actions">
          <button className="kly-btn kly-btn-secondary" onClick={() => onSelectTab('versions')}>
            <GitBranch size={13} /> Version control
          </button>
          <button className="kly-btn kly-btn-primary" onClick={onTriggerRedeploy}>
            <Rocket size={13} /> Trigger deploy
          </button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────── */}
      <div className="kly-version-kpis">
        <div>
          <span>Active contract</span>
          <b className="kly-mono">{currentProd?.semver || project.version}</b>
        </div>
        <div>
          <span>Running instances</span>
          <b>{totalRunning} <small style={{ fontWeight: 400, fontSize: 11, color: 'var(--kly-text-dim)' }}>/ {versions.length}</small></b>
        </div>
        <div>
          <span>Quality gates</span>
          <b style={{ color: allGatesPassed ? '#34d399' : '#fbbf24' }}>
            {gatesPassedCount}/{QUALITY_GATES.length} passing
          </b>
        </div>
        <div>
          <span>In staging</span>
          <b>{stagingVersions.length}</b>
        </div>
        <div>
          <span>Paused runtimes</span>
          <b className={pausedVersions.length > 0 ? 'is-warning' : ''}>{pausedVersions.length}</b>
        </div>
        <div>
          <span>Source branch</span>
          <b className="kly-mono">{dep.branch || 'main'}</b>
        </div>
      </div>

      {/* ── Lifecycle pipeline strip ─────────────────────────────── */}
      <div className="kly-dev-pipeline">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const status = stageStatus(stage.key);
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.key}>
              <div className="kly-dev-pipeline-stage" style={{ background: stageBg(status), borderColor: `${stageColor(status)}33` }}>
                <div className="kly-dev-pipeline-stage-icon" style={{ color: stageColor(status) }}>
                  {status === 'complete' ? <CheckCircle2 size={15} /> : status === 'active' ? <Icon size={15} /> : <Icon size={15} />}
                </div>
                <div className="kly-dev-pipeline-stage-body">
                  <strong style={{ color: stageColor(status) }}>{stage.label}</strong>
                  <small>{stage.desc}</small>
                </div>
                <span className="kly-dev-pipeline-stage-badge" style={{
                  background: status === 'complete' ? 'rgba(16,185,129,.12)' : status === 'active' ? 'rgba(139,92,246,.12)' : 'rgba(255,255,255,.04)',
                  color: stageColor(status),
                }}>
                  {status}
                </span>
              </div>
              {i < LIFECYCLE_STAGES.length - 1 && (
                <ArrowRight size={14} className="kly-dev-pipeline-arrow" style={{ color: stageColor(status) }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Source / branch panel ────────────────────────────────── */}
      <div className="kly-dev-source-panel kly-card">
        <div className="kly-dev-source-header">
          <div>
            <span className="kly-eyebrow"><GitBranch size={11} /> Source control</span>
            <h3>Branch &amp; commit context</h3>
          </div>
          <div className="kly-dev-source-actions">
            <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => onShowToast('Force-synced from origin')}>
              <RefreshCw size={11} /> Force sync
            </button>
            <button className="kly-btn kly-btn-secondary kly-api-mini" onClick={() => onSelectTab('api')}>
              <Code2 size={11} /> Review API spec
            </button>
          </div>
        </div>
        <div className="kly-dev-source-grid">
          <div className="kly-dev-source-field">
            <span><GitBranch size={11} /> Branch</span>
            <strong className="kly-mono">{dep.branch || 'main'}</strong>
          </div>
          <div className="kly-dev-source-field">
            <span><GitCommit size={11} /> Last commit</span>
            <strong className="kly-mono">{deployment?.commitHash || '8f31c2a'}</strong>
          </div>
          <div className="kly-dev-source-field">
            <span><Terminal size={11} /> Message</span>
            <strong>{deployment?.commitMessage || 'Harden refund idempotency'}</strong>
          </div>
          <div className="kly-dev-source-field">
            <span><Users size={11} /> Author</span>
            <strong>{deployment?.author || 'Priya Nair'}</strong>
          </div>
          <div className="kly-dev-source-field">
            <span><Server size={11} /> Source</span>
            <strong>{dep.source || 'GitHub'}</strong>
          </div>
          <div className="kly-dev-source-field">
            <span><Clock size={11} /> Last health check</span>
            <strong>{dep.lastHealthCheck || '12 seconds ago'}</strong>
          </div>
        </div>
      </div>

      {/* ── Main workspace: Lifecycle Board + Quality Gates ──────── */}
      <div className="kly-dev-main-grid">

        {/* ── Lifecycle Kanban board ───────────────────────────── */}
        <div className="kly-dev-lifecycle-board">
          <div className="kly-section-heading">
            <div>
              <h3><GitMerge size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Version lifecycle board</h3>
              <span>Live-synced with Version control tab — changes reflect instantly</span>
            </div>
            <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => onSelectTab('versions')}>
              <ChevronRight size={12} /> Open versions
            </button>
          </div>

          <div className="kly-dev-kanban">
            {/* Column 1: In Development */}
            <div className="kly-dev-kanban-col">
              <div className="kly-dev-kanban-col-header kly-dev-kanban-col-header--dev">
                <Code2 size={12} /> In Development
                <span className="kly-dev-kanban-count">{devVersions.length}</span>
              </div>
              <div className="kly-dev-kanban-body">
                {devVersions.map(v => <VersionCard key={v.id} v={v} showPromote />)}
                {!devVersions.length && (
                  <div className="kly-dev-kanban-empty">
                    <Code2 size={16} /><span>No draft versions. Create one in Version Control.</span>
                    <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => onSelectTab('versions')}>Create version</button>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Staging / Reviewable */}
            <div className="kly-dev-kanban-col">
              <div className="kly-dev-kanban-col-header kly-dev-kanban-col-header--staging">
                <FlaskConical size={12} /> Staging
                <span className="kly-dev-kanban-count">{stagingVersions.length}</span>
              </div>
              <div className="kly-dev-kanban-body">
                {stagingVersions.map(v => <VersionCard key={v.id} v={v} showPromote />)}
                {pausedVersions.filter(v => v.status === 'Current').map(v => <VersionCard key={v.id} v={v} />)}
                {!stagingVersions.length && !pausedVersions.filter(v => v.status === 'Current').length && (
                  <div className="kly-dev-kanban-empty">
                    <FlaskConical size={16} /><span>No versions in staging. Promote a draft to begin.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Live Production */}
            <div className="kly-dev-kanban-col">
              <div className="kly-dev-kanban-col-header kly-dev-kanban-col-header--prod">
                <Rocket size={12} /> Live Production
                <span className="kly-dev-kanban-count">{prodVersions.length}</span>
              </div>
              <div className="kly-dev-kanban-body">
                {prodVersions.map(v => <VersionCard key={v.id} v={v} />)}
                {!prodVersions.length && (
                  <div className="kly-dev-kanban-empty">
                    <Rocket size={16} /><span>No versions currently live. Promote from staging.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column: Quality Gates + Activity ────────────── */}
        <div className="kly-dev-right-col">

          {/* Quality gates */}
          <div className="kly-dev-quality-gates kly-card">
            <div className="kly-section-heading">
              <div>
                <h3><Shield size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Quality gates</h3>
                <span>{gatesPassedCount}/{QUALITY_GATES.length} passing</span>
              </div>
              {allGatesPassed
                ? <span className="kly-badge kly-badge-healthy"><Check size={10} /> All clear</span>
                : <span className="kly-badge kly-badge-paused"><AlertTriangle size={10} /> Action needed</span>}
            </div>

            <div className="kly-dev-gates-list">
              {QUALITY_GATES.map(gate => {
                const passed = gateOverrides[gate.id];
                const Icon = gate.icon;
                return (
                  <label key={gate.id} className={`kly-dev-gate-row ${passed ? 'kly-dev-gate-row--pass' : 'kly-dev-gate-row--fail'}`}>
                    <span className="kly-dev-gate-icon" style={{ color: passed ? '#34d399' : '#fb7185' }}>
                      {passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    </span>
                    <span className="kly-dev-gate-label">{gate.label}</span>
                    <input type="checkbox" className="kly-dev-gate-check"
                      checked={passed}
                      onChange={e => setGateOverrides(g => ({ ...g, [gate.id]: e.target.checked }))} />
                  </label>
                );
              })}
            </div>

            {allGatesPassed && (
              <button className="kly-btn kly-btn-primary kly-dev-gate-promote"
                onClick={onTriggerRedeploy}>
                <Rocket size={13} /> Ready to promote to production
              </button>
            )}
          </div>

          {/* Environment health strip */}
          <div className="kly-dev-env-health">
            <div className="kly-section-heading" style={{ marginBottom: 10 }}>
              <h3><Globe size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Environment health</h3>
            </div>
            <div className="kly-dev-env-strip">
              <EnvCard
                label="Development"
                color="#38bdf8"
                url={dep.providerUrl?.replace('klyra.dev', 'dev.klyra.dev') || 'https://dev.atlas-commerce.klyra.dev'}
                status="healthy"
                latency="48 ms"
                lastCheck="Just now"
                versionLabel={devVersions[0]?.semver || versions[0]?.semver || project.version}
              />
              <EnvCard
                label="Staging"
                color="#f59e0b"
                url={dep.providerUrl?.replace('klyra.dev', 'staging.klyra.dev') || 'https://staging.atlas-commerce.klyra.dev'}
                status={stagingVersions.length ? 'healthy' : 'paused'}
                latency="61 ms"
                lastCheck="2m ago"
                versionLabel={stagingVersions[0]?.semver || '—'}
              />
              <EnvCard
                label="Production"
                color="#a855f7"
                url={dep.providerUrl || project.gatewayUrl}
                status={dep.status === 'healthy' ? 'healthy' : dep.status === 'deploying' ? 'building' : 'paused'}
                latency={`${project.latencyMs} ms`}
                lastCheck={dep.lastHealthCheck || '12s ago'}
                versionLabel={currentProd?.semver || project.version}
              />
            </div>
          </div>

          {/* Recent activity feed */}
          <div className="kly-dev-activity kly-card">
            <div className="kly-section-heading">
              <h3><Activity size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Recent activity</h3>
              <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => onSelectTab('audit')}>
                Full audit <ChevronRight size={11} />
              </button>
            </div>
            <div className="kly-dev-activity-feed">
              {project.activity.slice(0, 5).map(item => (
                <div key={item.id} className="kly-dev-activity-item">
                  <span className={`kly-dev-activity-dot kly-dev-activity-dot--${item.kind}`} />
                  <div className="kly-dev-activity-body">
                    <span>{item.label}</span>
                    <small>{new Date(item.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                </div>
              ))}
              {!project.activity.length && (
                <div className="kly-dev-activity-empty"><Info size={14} /> No recent activity recorded.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Deployment pipeline log ──────────────────────────────── */}
      {deployment && (
        <div className="kly-dev-deploy-log kly-card">
          <div className="kly-section-heading">
            <div>
              <span className="kly-eyebrow"><Terminal size={11} /> Latest deployment</span>
              <h3>{deployment.version} → {deployment.environment} <span className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>#{deployment.commitHash}</span></h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className={`kly-badge ${deployment.status === 'healthy' ? 'kly-badge-healthy' : deployment.status === 'building' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>
                {deployment.status}
              </span>
              <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => onSelectTab('deployments')}>
                All deployments <ChevronRight size={11} />
              </button>
            </div>
          </div>
          <div className="kly-dev-log-entries">
            {deployment.logs.map((log, i) => (
              <div key={i} className="kly-dev-log-entry">
                <CheckCircle2 size={11} color="#34d399" />
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
