import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, GitBranch, GitCompare, History, Plus, Rocket, ShieldCheck, Upload, X, Search, SlidersHorizontal, RotateCcw, LockKeyhole, Loader2, CheckCircle2 } from 'lucide-react';
import { ExtendedVersion } from '../types';
import { ProviderProject } from '../../../types/apibuild';

interface TabVersionsProps {
  project: ProviderProject;
  versions: ExtendedVersion[];
  selectedVersion: string;
  onSelectVersion: (semver: string) => void;
  onOpenMigrationModal: () => void;
  onShowToast: (msg: string) => void;
}

const emptyChangelog = { added: [] as string[], modified: [] as string[], deprecated: [] as string[], breaking: [] as string[] };

export const TabVersions: React.FC<TabVersionsProps> = ({ project, versions: initialVersions, selectedVersion, onSelectVersion, onOpenMigrationModal, onShowToast }) => {
  const [versions, setVersions] = useState<ExtendedVersion[]>(initialVersions);
  const [activeVerId, setActiveVerId] = useState(initialVersions[0]?.id || '');
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

  const activeVersion = versions.find((version) => version.id === activeVerId) || versions[0];
  const currentVersion = versions.find((version) => version.isDefault) || versions[0];
  const filteredVersions = versions.filter((version) => {
    const matchesQuery = !versionQuery || `${version.semver} ${version.status}`.toLowerCase().includes(versionQuery.toLowerCase());
    return matchesQuery && (statusFilter === 'ALL' || version.status === statusFilter);
  });

  const createVersion = () => {
    if (!/^v\d+\.\d+\.\d+$/.test(newSemver) || versions.some((version) => version.semver === newSemver)) {
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
      changelog: {
        ...emptyChangelog,
        added: sourceMode === 'clone' ? ['Inherited current route contract'] : ['Imported specification pending review'],
        modified: releaseNotes ? [releaseNotes] : [],
      },
    };
    setVersions((current) => [created, ...current]);
    setActiveVerId(created.id);
    setShowCreate(false);
    onShowToast(`${newSemver} created as a reviewable draft`);
  };

  const promote = () => {
    if (!activeVersion || isPromoting || releaseLock) return;
    if (requireApproval && !auditNote.trim()) {
      onShowToast('Add an approval note before promoting this release');
      return;
    }
    setIsPromoting(true);
    setPromotionProgress(18);
    onShowToast(`${activeVersion.semver} release checks started`);
    window.setTimeout(() => setPromotionProgress(46), 500);
    window.setTimeout(() => setPromotionProgress(72), 950);
    window.setTimeout(() => {
    setVersions((current) => current.map((version) => version.id === activeVersion.id
      ? { ...version, status: promotionEnv === 'production' ? 'Current' : 'Beta', isDefault: promotionEnv === 'production' }
      : promotionEnv === 'production' ? { ...version, isDefault: false } : version));
    onSelectVersion(activeVersion.semver);
      setPromotionProgress(100);
      setIsPromoting(false);
      onShowToast(`${activeVersion.semver} promoted to ${promotionEnv} with ${rolloutPercent}% traffic`);
    }, 1450);
  };

  const deprecate = () => {
    if (!activeVersion) return;
    setVersions((current) => current.map((version) => version.id === activeVersion.id
      ? { ...version, status: 'Deprecated', changelog: { ...version.changelog, deprecated: [`Sunset ${sunsetDate}: ${deprecationMessage}`] } }
      : version));
    onShowToast(`Deprecation headers scheduled for ${activeVersion.semver} through ${sunsetDate}`);
  };

  return <div className="kly-page-stack kly-versions-page">
    <div className="kly-version-hero kly-card">
      <div><span className="kly-eyebrow"><GitBranch size={12} /> Lifecycle control plane</span><h2>Version governance for {project.name}</h2><p>Review contract changes, promote through environments, and retire old versions without losing deployment history.</p></div>
      <div className="kly-version-hero-actions"><button className="kly-btn kly-btn-secondary" onClick={() => setShowDiff(true)} disabled={!activeVersion}><GitCompare size={13} /> Review diff</button><button className="kly-btn kly-btn-primary" onClick={() => setShowCreate(true)}><Plus size={13} /> Create new version</button></div>
    </div>

    <div className="kly-version-stage"><div className="kly-stage-step is-complete"><Check size={13} /><span>Development</span><b>Contract ready</b></div><ArrowRight size={14} /><div className="kly-stage-step is-active"><ShieldCheck size={13} /><span>Staging</span><b>{versions.filter((version) => version.status === 'Beta').length} reviewable</b></div><ArrowRight size={14} /><div className="kly-stage-step"><Rocket size={13} /><span>Production</span><b>{currentVersion?.semver || 'Not deployed'}</b></div></div>

    <div className="kly-version-kpis"><div><span>Active contract</span><b className="kly-mono">{currentVersion?.semver || '---'}</b></div><div><span>Traffic on stable</span><b>{currentVersion?.trafficPercentage || 0}%</b></div><div><span>Deprecated versions</span><b className="is-warning">{versions.filter((version) => version.status === 'Deprecated').length}</b></div><div><span>Promotion policy</span><b>2-person approval</b></div><div><span>Release readiness</span><b><CheckCircle2 size={15} color="#34d399" /> {versions.filter((version) => version.status === 'Beta').length} reviewable</b></div><div><span>Change control</span><b><LockKeyhole size={15} color={releaseLock ? '#fbbf24' : '#34d399'} /> {releaseLock ? 'Locked' : 'Open'}</b></div></div>

    <div className="kly-version-workspace">
      <div className="kly-version-list"><div className="kly-section-heading"><div><h3>Release inventory</h3><span>{filteredVersions.length} of {versions.length} tracked contracts</span></div><button className="kly-btn kly-btn-ghost" onClick={onOpenMigrationModal}><History size={13} /> Migrate consumers</button></div><div className="kly-version-filters"><label className="kly-version-search"><Search size={13} /><input placeholder="Search versions" value={versionQuery} onChange={(event) => setVersionQuery(event.target.value)} /></label><label className="kly-api-status-select"><SlidersHorizontal size={12} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">All states</option><option value="Current">Current</option><option value="Beta">Reviewable</option><option value="Deprecated">Deprecated</option><option value="Legacy">Legacy</option></select></label></div>{filteredVersions.map((version) => <button key={version.id} className={`kly-version-row ${version.id === activeVerId ? 'is-active' : ''}`} onClick={() => setActiveVerId(version.id)}><span className="kly-version-radio">{version.id === activeVerId && <span />}</span><span className="kly-version-row-main"><strong className="kly-mono">{version.semver}</strong><small>{version.endpointsCount} routes · {version.consumersCount} consumers · released {version.releasedAt.slice(0, 10)}</small></span><span className={`kly-badge ${version.status === 'Current' ? 'kly-badge-healthy' : version.status === 'Beta' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>{version.status}</span></button>)}{!filteredVersions.length && <div className="kly-version-empty"><Search size={16} /><span>No release matches this filter.</span><button className="kly-btn kly-btn-ghost" onClick={() => { setVersionQuery(''); setStatusFilter('ALL'); }}>Clear filters</button></div>}</div>

      {activeVersion ? <div className="kly-version-inspector"><div className="kly-section-heading"><div><span className="kly-eyebrow">Selected release</span><h3 className="kly-mono">{activeVersion.semver}</h3></div><span className="kly-badge kly-badge-pill">{activeVersion.trafficPercentage}% traffic</span></div><div className="kly-release-checks"><div><Check size={13} color="#34d399" /> Schema validation passed</div><div><Check size={13} color="#34d399" /> No unresolved breaking changes</div><div><AlertTriangle size={13} color="#fbbf24" /> Production approval required</div></div><div className="kly-release-control-panel"><div className="kly-section-heading"><div><h4>Promotion controls</h4><span>Progressive delivery with automated protection.</span></div><button className={`kly-btn kly-btn-ghost kly-api-mini`} onClick={() => setReleaseLock((locked) => !locked)}><LockKeyhole size={12} /> {releaseLock ? 'Unlock changes' : 'Lock changes'}</button></div><label className="kly-range-control"><span><b>Canary traffic</b><strong>{rolloutPercent}%</strong></span><input type="range" min={5} max={100} step={5} value={rolloutPercent} onChange={(event) => setRolloutPercent(Number(event.target.value))} /><small>Route this percentage to the selected release before full promotion.</small></label><label className="kly-policy-toggle"><span><b>Automatic rollback</b><small>Rollback when success rate drops below the release gate.</small></span><input type="checkbox" checked={autoRollback} onChange={(event) => setAutoRollback(event.target.checked)} /></label><label className="kly-policy-toggle"><span><b>Two-person approval</b><small>Require an audit note before a production promotion.</small></span><input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} /></label><div className="kly-input-group"><label className="kly-label">Release audit note {requireApproval ? '(required)' : '(optional)'}</label><textarea className="kly-textarea" rows={2} value={auditNote} onChange={(event) => setAuditNote(event.target.value)} placeholder="Link the change request, incident, or approval context." /></div>{isPromoting && <div className="kly-promotion-progress" role="status"><span style={{ width: `${promotionProgress}%` }} /><small><Loader2 size={12} className="kly-spin" /> Running release gates and warming traffic...</small></div>}</div><div className="kly-release-actions"><select className="kly-select" value={promotionEnv} onChange={(event) => setPromotionEnv(event.target.value as typeof promotionEnv)}><option value="staging">Promote to Staging</option><option value="production">Promote to Production</option></select><button className="kly-btn kly-btn-primary" onClick={promote} disabled={isPromoting || releaseLock}>{isPromoting ? <><Loader2 size={13} className="kly-spin" /> Promoting...</> : <><Rocket size={13} /> Promote release</>}</button></div><div className="kly-deprecation-panel"><div><strong>Deprecation and sunset</strong><span>Injects <code>Deprecation: true</code> and <code>Sunset</code> headers on this version.</span></div><div className="kly-deprecation-fields"><input className="kly-input" type="date" value={sunsetDate} onChange={(event) => setSunsetDate(event.target.value)} /><input className="kly-input" value={deprecationMessage} onChange={(event) => setDeprecationMessage(event.target.value)} /><button className="kly-btn kly-btn-secondary" onClick={deprecate}>Set sunset</button></div></div><div className="kly-release-footer"><span>Rollback creates a new history entry; it never deletes this version.</span><button className="kly-btn kly-btn-ghost" onClick={() => { setRolloutPercent(100); onShowToast(`Rollback entry created for ${activeVersion.semver}; traffic restored to stable`); }}><RotateCcw size={12} /> One-click rollback</button></div></div> : <div className="kly-card kly-api-empty">No versions available. Create the first release contract.</div>}
    </div>

    {showCreate && <div className="kly-modal-overlay" onClick={() => setShowCreate(false)}><div className="kly-modal-card" onClick={(event) => event.stopPropagation()}><div className="kly-modal-header"><h3>Create new API version</h3><button className="kly-btn-icon" onClick={() => setShowCreate(false)}><X size={14} /></button></div><div className="kly-modal-body"><div className="kly-input-group"><label className="kly-label">Semantic version</label><input className="kly-input kly-mono" value={newSemver} onChange={(event) => setNewSemver(event.target.value)} placeholder="v2.5.0" /></div><div className="kly-input-group"><label className="kly-label">Source contract</label><div className="kly-choice-grid"><button className={sourceMode === 'clone' ? 'is-active' : ''} onClick={() => setSourceMode('clone')}><GitBranch size={14} /> Clone current spec<small>Start from {currentVersion?.semver || project.version}</small></button><button className={sourceMode === 'upload' ? 'is-active' : ''} onClick={() => setSourceMode('upload')}><Upload size={14} /> Upload new spec<small>Replace with OpenAPI or GraphQL</small></button></div></div><div className="kly-input-group"><label className="kly-label">Release note</label><textarea className="kly-textarea" rows={4} value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder="Describe added, changed, and breaking behavior." /></div></div><div className="kly-modal-footer"><button className="kly-btn kly-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button><button className="kly-btn kly-btn-primary" onClick={createVersion}><Plus size={13} /> Create draft</button></div></div></div>}
+    {showDiff && <div className="kly-modal-overlay" onClick={() => setShowDiff(false)}><div className="kly-modal-card kly-diff-modal" onClick={(event) => event.stopPropagation()}><div className="kly-modal-header"><div><h3>Contract diff review</h3><span className="kly-modal-subtitle">{currentVersion?.semver || 'Current'} -&gt; {activeVersion?.semver || 'Selected'} - side-by-side impact analysis</span></div><button className="kly-btn-icon" onClick={() => setShowDiff(false)}><X size={14} /></button></div><div className="kly-diff-gates"><span><Check size={12} /> OpenAPI valid</span><span><Check size={12} /> Auth unchanged</span><span className="is-warning"><AlertTriangle size={12} /> 1 deprecated route</span></div><div className="kly-diff-grid"><pre><b>Current contract</b>{'\n'}GET /v2/products{ '\n' }POST /v2/orders{ '\n' }GET /v1/orders/{'{orderId}'}{ '\n'}<span className="kly-diff-removed">- POST /v2/refunds</span></pre><pre><b>Selected contract</b>{'\n'}GET /v2/products{ '\n' }POST /v2/orders{ '\n' }GET /v1/orders/{'{orderId}'}{ '\n'}<span className="kly-diff-added">+ POST /v2/refunds</span>{'\n'}<span className="kly-diff-added">+ Idempotency-Key required</span></pre></div><div className="kly-modal-footer"><button className="kly-btn kly-btn-ghost" onClick={() => setShowDiff(false)}>Close review</button><button className="kly-btn kly-btn-primary" onClick={() => { setShowDiff(false); onShowToast('Diff approved; release is ready for promotion'); }}><Check size={13} /> Approve changes</button></div></div></div>}
+  </div>;
};
