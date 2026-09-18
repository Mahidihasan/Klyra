import React, { useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, GitBranch, GitCompare, History, Plus, Rocket,
  ShieldCheck, Upload, X, Search, SlidersHorizontal, RotateCcw, LockKeyhole,
  Loader2, CheckCircle2, Play, Pause, Square, Activity, Zap, Users, Route,
  ChevronDown, ChevronRight, Info, RefreshCw, StopCircle, BarChart2,
} from 'lucide-react';
import { ExtendedVersion } from '../types';
import { ProviderProject } from '../../../types/apibuild';
import { releaseStatusLabel } from '../format';

interface TabVersionsProps {
  project: ProviderProject;
  versions: ExtendedVersion[];
  selectedVersion: string;
  onSelectVersion: (semver: string) => void;
  onOpenMigrationModal: () => void;
  onShowToast: (msg: string) => void;
}

const emptyChangelog = { added: [] as string[], modified: [] as string[], deprecated: [] as string[], breaking: [] as string[] };
type InspectorTab = 'promotion' | 'runtime' | 'changelog';
type RoutingPolicy = 'weighted' | 'round-robin' | 'sticky';

export const TabVersions: React.FC<TabVersionsProps> = ({ project, versions: initialVersions, selectedVersion, onSelectVersion, onOpenMigrationModal, onShowToast }) => {
  const [versions, setVersions] = useState<ExtendedVersion[]>(initialVersions);
  const [activeVerId, setActiveVerId] = useState(initialVersions[0]?.id || '');
  const [consumerVersionId, setConsumerVersionId] = useState(initialVersions.find(v => v.isDefault)?.id || initialVersions[0]?.id || '');
  const [showCreate, setShowCreate] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [newSemver, setNewSemver] = useState('v2.5.0');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [sourceMode, setSourceMode] = useState<'clone' | 'upload'>('clone');
  const [sunsetDate, setSunsetDate] = useState('2026-12-31');
  const [deprecationMessage, setDeprecationMessage] = useState('Please migrate to the latest stable API version.');
  const [promotionEnv, setPromotionEnv] = useState<'staging' | 'production'>('staging');
  const [versionQuery, setVersionQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExtendedVersion['status']>('ALL');
  const [rolloutPercent, setRolloutPercent] = useState(25);
  const [autoRollback, setAutoRollback] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [releaseLock, setReleaseLock] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionProgress, setPromotionProgress] = useState(0);
  const [auditNote, setAuditNote] = useState('');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('promotion');
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicy>('weighted');
  const [switchingVersionId, setSwitchingVersionId] = useState<string | null>(null);

  const activeVersion = versions.find((v) => v.id === activeVerId) || versions[0];
  const currentVersion = versions.find((v) => v.isDefault) || versions[0];
  const consumerVersion = versions.find((v) => v.id === consumerVersionId);
  const runningVersions = versions.filter((v) => v.runtimeState === 'running' || v.runtimeState === 'paused');

  const filteredVersions = versions.filter((v) => {
    const matchesQuery = !versionQuery || `${v.semver} ${v.status}`.toLowerCase().includes(versionQuery.toLowerCase());
    return matchesQuery && (statusFilter === 'ALL' || v.status === statusFilter);
  });

  /* ── Runtime actions ────────────────────────────────────────────── */
  const toggleRuntime = (id: string) => {
    setVersions((cur) => cur.map((v) => {
      if (v.id !== id) return v;
      const next = v.runtimeState === 'running' ? 'paused' : v.runtimeState === 'paused' ? 'running' : 'running';
      onShowToast(`${v.semver} runtime ${next === 'running' ? 'resumed' : 'paused'}`);
      return { ...v, runtimeState: next };
    }));
  };

  const stopVersion = (id: string) => {
    const v = versions.find((v) => v.id === id);
    if (!v) return;
    if (id === consumerVersionId) { onShowToast('Cannot stop the active consumer version — switch consumers first.'); return; }
    setVersions((cur) => cur.map((v) => v.id === id ? { ...v, runtimeState: 'stopped', canaryWeight: 0 } : v));
    onShowToast(`${v.semver} stopped and removed from runtime`);
  };

  const startVersion = (id: string) => {
    const v = versions.find((v) => v.id === id);
    if (!v) return;
    setVersions((cur) => cur.map((v) => v.id === id ? { ...v, runtimeState: 'running', canaryWeight: v.canaryWeight || 5 } : v));
    onShowToast(`${v.semver} started — routing ${v.canaryWeight || 5}% of traffic`);
  };

  const switchConsumerVersion = (id: string) => {
    const target = versions.find((v) => v.id === id);
    if (!target || target.runtimeState !== 'running') { onShowToast('Version must be running before switching consumers to it'); return; }
    setSwitchingVersionId(id);
    window.setTimeout(() => {
      setConsumerVersionId(id);
      onSelectVersion(target.semver);
      setSwitchingVersionId(null);
      onShowToast(`Consumer traffic switched to ${target.semver} — zero-downtime cutover complete`);
    }, 900);
  };

  const updateCanaryWeight = (id: string, weight: number) => {
    setVersions((cur) => cur.map((v) => v.id === id ? { ...v, canaryWeight: weight } : v));
  };

  /* ── Create / promote / deprecate ──────────────────────────────── */
  const createVersion = () => {
    if (!/^v\d+\.\d+\.\d+$/.test(newSemver) || versions.some((v) => v.semver === newSemver)) {
      onShowToast('Use a unique semantic version such as v2.5.0');
      return;
    }
    const created: ExtendedVersion = {
      id: `version-${Date.now()}`,
      semver: newSemver,
      status: 'Beta',
      isDefault: false,
      releasedAt: new Date().toISOString(),
      endpointsCount: currentVersion?.endpointsCount || project.endpointCount,
      consumersCount: 0,
      trafficPercentage: 0,
      successRate: 100,
      avgLatencyMs: 0,
      runtimeState: 'stopped',
      canaryWeight: 0,
      changelog: {
        ...emptyChangelog,
        added: sourceMode === 'clone' ? ['Inherited current route contract'] : ['Imported specification pending review'],
        modified: releaseNotes ? [releaseNotes] : [],
      },
    };
    setVersions((cur) => [created, ...cur]);
    setActiveVerId(created.id);
    setShowCreate(false);
    onShowToast(`${newSemver} created as a reviewable draft`);
  };

  const promote = () => {
    if (!activeVersion || isPromoting || releaseLock) return;
    if (requireApproval && !auditNote.trim()) { onShowToast('Add an approval note before promoting this release'); return; }
    setIsPromoting(true);
    setPromotionProgress(18);
    onShowToast(`${activeVersion.semver} release checks started`);
    window.setTimeout(() => setPromotionProgress(46), 500);
    window.setTimeout(() => setPromotionProgress(72), 950);
    window.setTimeout(() => {
      setVersions((cur) => cur.map((v) => v.id === activeVersion.id
        ? { ...v, status: promotionEnv === 'production' ? 'Current' : 'Beta', isDefault: promotionEnv === 'production', runtimeState: 'running', canaryWeight: rolloutPercent }
        : promotionEnv === 'production' ? { ...v, isDefault: false } : v));
      onSelectVersion(activeVersion.semver);
      setPromotionProgress(100);
      setIsPromoting(false);
      onShowToast(`${activeVersion.semver} promoted to ${promotionEnv} with ${rolloutPercent}% traffic`);
    }, 1450);
  };

  const deprecate = () => {
    if (!activeVersion) return;
    setVersions((cur) => cur.map((v) => v.id === activeVersion.id
      ? { ...v, status: 'Deprecated', changelog: { ...v.changelog, deprecated: [`Sunset ${sunsetDate}: ${deprecationMessage}`] } }
      : v));
    onShowToast(`Deprecation headers scheduled for ${activeVersion.semver} through ${sunsetDate}`);
  };

  /* ── Sub-components ─────────────────────────────────────────────── */
  const RuntimeDot = ({ state }: { state: ExtendedVersion['runtimeState'] }) => (
    <span className={`kly-runtime-dot kly-runtime-dot--${state}`} title={state}>
      <span />
    </span>
  );

  const InspectorPromotion = () => (
    <>
      <div className="kly-release-checks">
        <div><Check size={13} color="#34d399" /> Schema validation passed</div>
        <div><Check size={13} color="#34d399" /> No unresolved breaking changes</div>
        <div><AlertTriangle size={13} color="#fbbf24" /> Production approval required</div>
      </div>
      <div className="kly-release-control-panel">
        <div className="kly-section-heading">
          <div><h4>Promotion controls</h4><span>Progressive delivery with automated protection.</span></div>
          <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => setReleaseLock((l) => !l)}>
            <LockKeyhole size={12} /> {releaseLock ? 'Unlock changes' : 'Lock changes'}
          </button>
        </div>
        <label className="kly-range-control">
          <span><b>Canary traffic</b><strong>{rolloutPercent}%</strong></span>
          <input type="range" min={5} max={100} step={5} value={rolloutPercent} onChange={(e) => setRolloutPercent(Number(e.target.value))} />
          <small>Route this percentage to the selected release before full promotion.</small>
        </label>
        <label className="kly-policy-toggle">
          <span><b>Automatic rollback</b><small>Rollback when success rate drops below the release gate.</small></span>
          <input type="checkbox" checked={autoRollback} onChange={(e) => setAutoRollback(e.target.checked)} />
        </label>
        <label className="kly-policy-toggle">
          <span><b>Two-person approval</b><small>Require an audit note before a production promotion.</small></span>
          <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
        </label>
        <div className="kly-input-group">
          <label className="kly-label">Release audit note {requireApproval ? '(required)' : '(optional)'}</label>
          <textarea className="kly-textarea" rows={2} value={auditNote} onChange={(e) => setAuditNote(e.target.value)} placeholder="Link the change request, incident, or approval context." />
        </div>
        {isPromoting && (
          <div className="kly-promotion-progress" role="status">
            <span style={{ width: `${promotionProgress}%` }} />
            <small><Loader2 size={12} className="kly-spin" /> Running release gates and warming traffic...</small>
          </div>
        )}
      </div>
      <div className="kly-release-actions">
        <select className="kly-select" value={promotionEnv} onChange={(e) => setPromotionEnv(e.target.value as typeof promotionEnv)}>
          <option value="staging">Promote to Staging</option>
          <option value="production">Promote to Production</option>
        </select>
        <button className="kly-btn kly-btn-primary" onClick={promote} disabled={isPromoting || releaseLock}>
          {isPromoting ? <><Loader2 size={13} className="kly-spin" /> Promoting...</> : <><Rocket size={13} /> Promote release</>}
        </button>
      </div>
      <div className="kly-deprecation-panel">
        <div><strong>Deprecation and sunset</strong><span>Injects <code>Deprecation: true</code> and <code>Sunset</code> headers on this version.</span></div>
        <div className="kly-deprecation-fields">
          <input className="kly-input" type="date" value={sunsetDate} onChange={(e) => setSunsetDate(e.target.value)} />
          <input className="kly-input" value={deprecationMessage} onChange={(e) => setDeprecationMessage(e.target.value)} />
          <button className="kly-btn kly-btn-secondary" onClick={deprecate}>Set sunset</button>
        </div>
      </div>
      <div className="kly-release-footer">
        <span>Rollback creates a new history entry; it never deletes this version.</span>
        <button className="kly-btn kly-btn-ghost" onClick={() => { setRolloutPercent(100); onShowToast(`Rollback entry created for ${activeVersion?.semver}; traffic restored to stable`); }}>
          <RotateCcw size={12} /> One-click rollback
        </button>
      </div>
    </>
  );

  const InspectorRuntime = () => {
    if (!activeVersion) return null;
    const isStopped = activeVersion.runtimeState === 'stopped';
    return (
      <div className="kly-runtime-inspector-panel">
        {/* Runtime state control */}
        <div className="kly-runtime-state-card">
          <div className="kly-runtime-state-header">
            <RuntimeDot state={activeVersion.runtimeState} />
            <div>
              <strong>{activeVersion.semver}</strong>
              <small>{activeVersion.runtimeState === 'running' ? 'Serving live traffic' : activeVersion.runtimeState === 'paused' ? 'Traffic paused — no requests routed' : 'Not running — start to serve traffic'}</small>
            </div>
            <div className="kly-runtime-state-btns">
              {isStopped
                ? <button className="kly-btn kly-btn-secondary" onClick={() => startVersion(activeVersion.id)}><Play size={12} /> Start</button>
                : <>
                    <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={() => toggleRuntime(activeVersion.id)}>
                      {activeVersion.runtimeState === 'running' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                    </button>
                    <button className="kly-btn kly-btn-ghost kly-api-mini kly-btn-danger-ghost" onClick={() => stopVersion(activeVersion.id)}>
                      <StopCircle size={12} /> Stop
                    </button>
                  </>
              }
            </div>
          </div>
          {activeVersion.id === consumerVersionId && (
            <div className="kly-runtime-consumer-badge"><CheckCircle2 size={12} /> Active consumer-facing version</div>
          )}
          {activeVersion.id !== consumerVersionId && !isStopped && (
            <button className="kly-btn kly-btn-secondary kly-runtime-switch-btn"
              onClick={() => switchConsumerVersion(activeVersion.id)}
              disabled={switchingVersionId === activeVersion.id}>
              {switchingVersionId === activeVersion.id
                ? <><Loader2 size={12} className="kly-spin" /> Switching consumers...</>
                : <><Route size={12} /> Route consumers to this version</>}
            </button>
          )}
        </div>

        {/* Traffic weight */}
        {!isStopped && (
          <label className="kly-range-control">
            <span><b>Traffic weight</b><strong>{activeVersion.canaryWeight}%</strong></span>
            <input type="range" min={0} max={100} step={1}
              value={activeVersion.canaryWeight}
              onChange={(e) => updateCanaryWeight(activeVersion.id, Number(e.target.value))} />
            <small>Percentage of incoming requests routed to this runtime instance.</small>
          </label>
        )}

        {/* Routing policy */}
        <div className="kly-input-group">
          <label className="kly-label">Routing policy</label>
          <div className="kly-routing-policy">
            {(['weighted', 'round-robin', 'sticky'] as RoutingPolicy[]).map((p) => (
              <button key={p} className={routingPolicy === p ? 'is-active' : ''} onClick={() => setRoutingPolicy(p)}>
                {p === 'weighted' && <BarChart2 size={11} />}
                {p === 'round-robin' && <RefreshCw size={11} />}
                {p === 'sticky' && <Users size={11} />}
                {p}
              </button>
            ))}
          </div>
          <small className="kly-field-hint">
            {routingPolicy === 'weighted' && 'Distribute traffic by weight across all running versions.'}
            {routingPolicy === 'round-robin' && 'Cycle requests evenly across running versions regardless of weight.'}
            {routingPolicy === 'sticky' && 'Pin each consumer session to a single version for the session lifetime.'}
          </small>
        </div>

        {/* Runtime metrics */}
        {!isStopped && (
          <div className="kly-runtime-metrics">
            <div><span>Success rate</span><b style={{ color: activeVersion.successRate >= 99 ? '#34d399' : '#fbbf24' }}>{activeVersion.successRate}%</b></div>
            <div><span>Avg latency</span><b>{activeVersion.avgLatencyMs} ms</b></div>
            <div><span>Consumers</span><b>{activeVersion.consumersCount}</b></div>
            <div><span>Endpoints</span><b>{activeVersion.endpointsCount}</b></div>
          </div>
        )}
      </div>
    );
  };

  const InspectorChangelog = () => {
    if (!activeVersion) return null;
    const { added, modified, deprecated, breaking } = activeVersion.changelog;
    const empty = !added.length && !modified.length && !deprecated.length && !breaking.length;
    if (empty) return <div className="kly-version-empty"><Info size={14} /><span>No changelog entries recorded for this version.</span></div>;
    return (
      <div className="kly-changelog-panel">
        {added.length > 0 && <div className="kly-changelog-section kly-changelog-added"><strong>Added</strong><ul>{added.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
        {modified.length > 0 && <div className="kly-changelog-section kly-changelog-modified"><strong>Modified</strong><ul>{modified.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
        {deprecated.length > 0 && <div className="kly-changelog-section kly-changelog-deprecated"><strong>Deprecated</strong><ul>{deprecated.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
        {breaking.length > 0 && <div className="kly-changelog-section kly-changelog-breaking"><strong>Breaking</strong><ul>{breaking.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      </div>
    );
  };

  return <div className="kly-page-stack kly-versions-page">
    {/* ── Hero ─────────────────────────────────────────────────── */}
    <div className="kly-version-hero kly-card">
      <div>
        <span className="kly-eyebrow"><GitBranch size={12} /> Lifecycle control plane</span>
        <h2>Version governance for {project.name}</h2>
        <p>Multiple versions can run simultaneously. Route consumers to any live version and pause or resume individual runtimes without downtime.</p>
      </div>
      <div className="kly-version-hero-actions">
        <button className="kly-btn kly-btn-secondary" onClick={() => setShowDiff(true)} disabled={!activeVersion}><GitCompare size={13} /> Review diff</button>
        <button className="kly-btn kly-btn-primary" onClick={() => setShowCreate(true)}><Plus size={13} /> Create new version</button>
      </div>
    </div>

    {/* ── Pipeline stages ─────────────────────────────────────── */}
    <div className="kly-version-stage">
      <div className="kly-stage-step is-active"><ShieldCheck size={13} /><span>Staging</span><b>{versions.filter((v) => v.status === 'Beta').length} reviewable</b></div>
      <ArrowRight size={14} />
      <div className="kly-stage-step"><Rocket size={13} /><span>Production</span><b>{currentVersion?.semver || 'Not deployed'}</b></div>
    </div>

    {/* ── KPI strip ───────────────────────────────────────────── */}
    <div className="kly-version-kpis">
      <div><span>Active contract</span><b className="kly-mono">{consumerVersion?.semver || '---'}</b></div>
      <div><span>Running instances</span><b>{runningVersions.filter(v => v.runtimeState === 'running').length} <small style={{fontWeight:400,fontSize:11,color:'var(--kly-text-dim)'}}>of {versions.length}</small></b></div>
      <div><span>Deprecated versions</span><b className="is-warning">{versions.filter((v) => v.status === 'Deprecated').length}</b></div>
      <div><span>Routing policy</span><b style={{textTransform:'capitalize'}}>{routingPolicy}</b></div>
      <div><span>Release readiness</span><b><CheckCircle2 size={15} color="#34d399" /> {versions.filter((v) => v.status === 'Beta').length} reviewable</b></div>
      <div><span>Change control</span><b><LockKeyhole size={15} color={releaseLock ? '#fbbf24' : '#34d399'} /> {releaseLock ? 'Locked' : 'Open'}</b></div>
    </div>

    {/* ── Runtime matrix ──────────────────────────────────────── */}
    <div className="kly-runtime-matrix">
      <div className="kly-section-heading">
        <div>
          <h3><Activity size={14} style={{display:'inline',marginRight:6,verticalAlign:'middle'}} />Live runtime matrix</h3>
          <span>{runningVersions.length} version{runningVersions.length !== 1 ? 's' : ''} currently active — host controls below</span>
        </div>
        <button className="kly-btn kly-btn-ghost kly-api-mini" onClick={onOpenMigrationModal}><History size={13} /> Migrate consumers</button>
      </div>

      {/* Matrix header */}
      <div className="kly-runtime-table">
        <div className="kly-runtime-thead">
          <span>Version</span>
          <span>State</span>
          <span>Traffic weight</span>
          <span>Success rate</span>
          <span>Avg latency</span>
          <span>Consumers</span>
          <span>Host controls</span>
        </div>

        {versions.filter(v => v.runtimeState !== 'stopped').map((v) => {
          const isConsumer = v.id === consumerVersionId;
          const isSwitching = switchingVersionId === v.id;
          return (
            <div key={v.id} className={`kly-runtime-row ${isConsumer ? 'kly-runtime-row--consumer' : ''} ${v.runtimeState === 'paused' ? 'kly-runtime-row--paused' : ''}`}>
              <span className="kly-runtime-semver">
                <span className="kly-mono">{v.semver}</span>
                {isConsumer && <span className="kly-runtime-consumer-chip"><Zap size={9} /> consumer</span>}
              </span>
              <span><RuntimeDot state={v.runtimeState} />{v.runtimeState}</span>
              <span>
                <span className="kly-runtime-weight-bar">
                  <span style={{ width: `${v.canaryWeight}%` }} />
                </span>
                <span className="kly-runtime-weight-label">{v.canaryWeight}%</span>
              </span>
              <span style={{ color: v.successRate >= 99 ? '#34d399' : '#fbbf24' }}>{v.successRate}%</span>
              <span>{v.avgLatencyMs} ms</span>
              <span>{v.consumersCount}</span>
              <span className="kly-runtime-actions">
                {/* Pause / resume */}
                <button
                  className={`kly-btn kly-btn-ghost kly-api-mini ${v.runtimeState === 'paused' ? 'kly-btn-resume' : ''}`}
                  onClick={() => toggleRuntime(v.id)}
                  title={v.runtimeState === 'running' ? 'Pause this version' : 'Resume this version'}>
                  {v.runtimeState === 'running' ? <Pause size={11} /> : <Play size={11} />}
                  {v.runtimeState === 'running' ? 'Pause' : 'Resume'}
                </button>
                {/* Stop */}
                <button
                  className="kly-btn kly-btn-ghost kly-api-mini kly-btn-danger-ghost"
                  onClick={() => stopVersion(v.id)}
                  disabled={isConsumer}
                  title={isConsumer ? 'Cannot stop active consumer version' : 'Stop this runtime'}>
                  <StopCircle size={11} /> Stop
                </button>
                {/* Route consumers here */}
                {!isConsumer && (
                  <button
                    className="kly-btn kly-btn-secondary kly-api-mini"
                    onClick={() => switchConsumerVersion(v.id)}
                    disabled={isSwitching || v.runtimeState !== 'running'}
                    title="Route consumers to this version">
                    {isSwitching ? <><Loader2 size={11} className="kly-spin" /> Switching</> : <><Route size={11} /> Use</>}
                  </button>
                )}
              </span>
            </div>
          );
        })}

        {runningVersions.length === 0 && (
          <div className="kly-version-empty" style={{gridColumn:'1/-1'}}>
            <Activity size={16} /><span>No versions running. Start a version to serve traffic.</span>
          </div>
        )}

        {/* Stopped versions (collapsed row hint) */}
        {versions.filter(v => v.runtimeState === 'stopped').map((v) => (
          <div key={v.id} className="kly-runtime-row kly-runtime-row--stopped">
            <span className="kly-runtime-semver"><span className="kly-mono">{v.semver}</span></span>
            <span><RuntimeDot state="stopped" />stopped</span>
            <span>—</span><span>—</span><span>—</span><span>—</span>
            <span className="kly-runtime-actions">
              <button className="kly-btn kly-btn-secondary kly-api-mini" onClick={() => startVersion(v.id)}>
                <Play size={11} /> Start
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* ── Main workspace ──────────────────────────────────────── */}
    <div className="kly-version-workspace">
      {/* Left: release inventory */}
      <div className="kly-version-list">
        <div className="kly-section-heading">
          <div><h3>Release inventory</h3><span>{filteredVersions.length} of {versions.length} tracked contracts</span></div>
        </div>
        <div className="kly-version-filters">
          <label className="kly-version-search">
            <Search size={13} />
            <input placeholder="Search versions" value={versionQuery} onChange={(e) => setVersionQuery(e.target.value)} />
          </label>
          <label className="kly-api-status-select">
            <SlidersHorizontal size={12} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="ALL">All states</option>
              <option value="Current">Current</option>
              <option value="Beta">Reviewable</option>
              <option value="Deprecated">Deprecated</option>
              <option value="Legacy">Legacy</option>
            </select>
          </label>
        </div>

        {filteredVersions.map((v) => (
          <button key={v.id} className={`kly-version-row ${v.id === activeVerId ? 'is-active' : ''}`} onClick={() => setActiveVerId(v.id)}>
            <span className="kly-version-radio">{v.id === activeVerId && <span />}</span>
            <span className="kly-version-row-main">
              <strong className="kly-mono">{v.semver}</strong>
              <small>{v.endpointsCount} routes · {v.consumersCount} consumers · {releaseStatusLabel(v.releasedAt)}</small>
            </span>
            <RuntimeDot state={v.runtimeState} />
            <span className={`kly-badge ${v.status === 'Current' ? 'kly-badge-healthy' : v.status === 'Beta' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>{v.status}</span>
          </button>
        ))}

        {!filteredVersions.length && (
          <div className="kly-version-empty">
            <Search size={16} /><span>No release matches this filter.</span>
            <button className="kly-btn kly-btn-ghost" onClick={() => { setVersionQuery(''); setStatusFilter('ALL'); }}>Clear filters</button>
          </div>
        )}
      </div>

      {/* Right: inspector */}
      {activeVersion
        ? <div className="kly-version-inspector">
            <div className="kly-section-heading">
              <div>
                <span className="kly-eyebrow">Selected release</span>
                <h3 className="kly-mono">{activeVersion.semver}</h3>
              </div>
              <span className="kly-badge kly-badge-pill">{activeVersion.trafficPercentage}% traffic</span>
            </div>

            {/* Inspector tabs */}
            <div className="kly-version-inspector-tabs">
              <button className={inspectorTab === 'promotion' ? 'is-active' : ''} onClick={() => setInspectorTab('promotion')}>
                <Rocket size={11} /> Promotion
              </button>
              <button className={inspectorTab === 'runtime' ? 'is-active' : ''} onClick={() => setInspectorTab('runtime')}>
                <Activity size={11} /> Runtime
              </button>
              <button className={inspectorTab === 'changelog' ? 'is-active' : ''} onClick={() => setInspectorTab('changelog')}>
                <GitBranch size={11} /> Changelog
              </button>
            </div>

            {inspectorTab === 'promotion' && <InspectorPromotion />}
            {inspectorTab === 'runtime' && <InspectorRuntime />}
            {inspectorTab === 'changelog' && <InspectorChangelog />}
          </div>
        : <div className="kly-card kly-api-empty">No versions available. Create the first release contract.</div>
      }
    </div>

    {/* ── Create version modal ─────────────────────────────────── */}
    {showCreate && (
      <div className="kly-modal-overlay" onClick={() => setShowCreate(false)}>
        <div className="kly-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="kly-modal-header">
            <h3>Create new API version</h3>
            <button className="kly-btn-icon" onClick={() => setShowCreate(false)}><X size={14} /></button>
          </div>
          <div className="kly-modal-body">
            <div className="kly-input-group">
              <label className="kly-label">Semantic version</label>
              <input className="kly-input kly-mono" value={newSemver} onChange={(e) => setNewSemver(e.target.value)} placeholder="v2.5.0" />
            </div>
            <div className="kly-input-group">
              <label className="kly-label">Source contract</label>
              <div className="kly-choice-grid">
                <button className={sourceMode === 'clone' ? 'is-active' : ''} onClick={() => setSourceMode('clone')}>
                  <GitBranch size={14} /> Clone current spec<small>Start from {currentVersion?.semver || project.version}</small>
                </button>
                <button className={sourceMode === 'upload' ? 'is-active' : ''} onClick={() => setSourceMode('upload')}>
                  <Upload size={14} /> Upload new spec<small>Replace with OpenAPI or GraphQL</small>
                </button>
              </div>
            </div>
            <div className="kly-input-group">
              <label className="kly-label">Release note</label>
              <textarea className="kly-textarea" rows={4} value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="Describe added, changed, and breaking behavior." />
            </div>
          </div>
          <div className="kly-modal-footer">
            <button className="kly-btn kly-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="kly-btn kly-btn-primary" onClick={createVersion}><Plus size={13} /> Create draft</button>
          </div>
        </div>
      </div>
    )}

    {/* ── Diff modal ───────────────────────────────────────────── */}
    {showDiff && (
      <div className="kly-modal-overlay" onClick={() => setShowDiff(false)}>
        <div className="kly-modal-card kly-diff-modal" onClick={(e) => e.stopPropagation()}>
          <div className="kly-modal-header">
            <div>
              <h3>Contract diff review</h3>
              <span className="kly-modal-subtitle">{currentVersion?.semver || 'Current'} → {activeVersion?.semver || 'Selected'} — side-by-side impact analysis</span>
            </div>
            <button className="kly-btn-icon" onClick={() => setShowDiff(false)}><X size={14} /></button>
          </div>
          <div className="kly-diff-gates">
            <span><Check size={12} /> OpenAPI valid</span>
            <span><Check size={12} /> Auth unchanged</span>
            <span className="is-warning"><AlertTriangle size={12} /> 1 deprecated route</span>
          </div>
          <div className="kly-diff-grid">
            <pre><b>Current contract</b>{'\n'}GET /v2/products{'\n'}POST /v2/orders{'\n'}GET /v1/orders/{'{orderId}'}{'\n'}<span className="kly-diff-removed">- POST /v2/refunds</span></pre>
            <pre><b>Selected contract</b>{'\n'}GET /v2/products{'\n'}POST /v2/orders{'\n'}GET /v1/orders/{'{orderId}'}{'\n'}<span className="kly-diff-added">+ POST /v2/refunds</span>{'\n'}<span className="kly-diff-added">+ Idempotency-Key required</span></pre>
          </div>
          <div className="kly-modal-footer">
            <button className="kly-btn kly-btn-ghost" onClick={() => setShowDiff(false)}>Close review</button>
            <button className="kly-btn kly-btn-primary" onClick={() => { setShowDiff(false); onShowToast('Diff approved; release is ready for promotion'); }}>
              <Check size={13} /> Approve changes
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
};
