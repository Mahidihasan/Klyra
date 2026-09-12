import React from 'react';
import {
  GitBranch, RefreshCw, FlaskConical, Settings, Lock, Globe, Cpu, FileCode2,
  History, Users, Tag, Scale, AlertTriangle, CheckCircle2, ChevronRight, Plug,
} from 'lucide-react';
import { apiDetectApi, gitApi, releasesApi, reposApi } from '../../services/api/repos';
import { RepoDetail, RepoTab, Detection, Overview, CommitInfo, Release } from '../../types/repos';
import { Avatar, EmptyState, ErrorBox, Loading, timeAgo } from './shared';
import { CodePage } from './CodePage';

export interface PlaygroundOpenDetail {
  repoId: string;
  repoName: string;
  endpoint?: { method: string; path: string };
}

export function openPlayground(detail: PlaygroundOpenDetail) {
  try {
    localStorage.setItem('klyra_playground_context', JSON.stringify({ ...detail, at: new Date().toISOString() }));
  } catch { /* non-fatal */ }
  window.dispatchEvent(new CustomEvent<PlaygroundOpenDetail>('klyra:open-playground', { detail }));
}

interface Snapshot { endpoints: string[]; at: string }
const snapshotKey = (repoId: string) => `klyra_repo_detect_${repoId}`;
const loadSnapshot = (repoId: string): Snapshot | null => {
  try {
    const raw = localStorage.getItem(snapshotKey(repoId));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch { return null; }
};
const saveSnapshot = (repoId: string, endpoints: string[]) => {
  try { localStorage.setItem(snapshotKey(repoId), JSON.stringify({ endpoints, at: new Date().toISOString() })); } catch { /* ignore */ }
};

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ade80', POST: '#c4b5fd', PUT: '#fbbf24', PATCH: '#f9a8d4',
  DELETE: '#f87171', HEAD: '#a5b4fc', OPTIONS: '#94a3b8',
};

interface Props { repo: RepoDetail; onNavigate: (t: RepoTab) => void; onChanged?: () => void; }
export const OverviewTab: React.FC<Props> = ({ repo, onNavigate, onChanged }) => {
  const [detection, setDetection] = React.useState<Detection | null>(null);
  const [ovw, setOvw] = React.useState<Overview | null>(null);
  const [commits, setCommits] = React.useState<CommitInfo[]>([]);
  const [releases, setReleases] = React.useState<Release[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [prevSnapshot, setPrevSnapshot] = React.useState<Snapshot | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(''); setSyncMsg(null);
    try {
      const [det, ov, cm, rel] = await Promise.allSettled([
        apiDetectApi.get(repo.id),
        reposApi.overview(repo.id),
        gitApi.commits(repo.id, repo.default_branch),
        releasesApi.list(repo.id),
      ]);
      if (det.status === 'fulfilled') {
        setDetection(det.value.detected);
        const keys = (det.value.detected?.endpoints || []).map(e => `${e.method} ${e.path}`);
        setPrevSnapshot(loadSnapshot(repo.id));
        saveSnapshot(repo.id, keys);
      }
      if (ov.status === 'fulfilled') setOvw(ov.value);
      if (cm.status === 'fulfilled') setCommits(cm.value.commits || []);
      if (rel.status === 'fulfilled') setReleases(rel.value.releases || []);
      if (det.status === 'rejected') throw det.reason;
    } catch (e: any) {
      setError(e?.message || 'Failed to load repository overview');
    } finally {
      setLoading(false);
    }
  }, [repo.id, repo.default_branch]);

  React.useEffect(() => { load(); }, [load]);

  const resync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const d = await apiDetectApi.run(repo.id);
      setDetection(d);
      setPrevSnapshot(loadSnapshot(repo.id));
      saveSnapshot(repo.id, d.endpoints.map(e => `${e.method} ${e.path}`));
      setSyncMsg({ kind: 'ok', text: `API source re-scanned — ${d.endpoints.length} endpoint${d.endpoints.length === 1 ? '' : 's'} detected.` });
      onChanged?.();
    } catch (e: any) {
      setSyncMsg({ kind: 'err', text: e?.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <Loading label="Loading API source overview…" />;
  if (error && !detection && !ovw) return <ErrorBox message={error} onRetry={load} />;

  const endpoints = detection?.endpoints || [];
  const endpointKeys = endpoints.map(e => `${e.method} ${e.path}`);
  const prevKeys = prevSnapshot?.endpoints || [];
  const added = endpointKeys.filter(k => !prevKeys.includes(k));
  const removed = prevKeys.filter(k => !endpointKeys.includes(k));
  const hasBaseline = prevSnapshot !== null && prevKeys.length > 0;
  const hasPendingDiff = hasBaseline && (added.length > 0 || removed.length > 0);
  const lastCommit: CommitInfo | null = commits[0] || ovw?.latest_commit || null;
  const scannedAt = detection?.detectedAt || null;
  const commitAfterScan = lastCommit && scannedAt
    ? new Date(lastCommit.date).getTime() > new Date(scannedAt).getTime()
    : false;
  const showPending = hasPendingDiff || commitAfterScan;
  const hasSpec = !!detection?.openapi;
  const hasApi = hasSpec || endpoints.length > 0;
  const latestRelease = ovw?.latest_release || null;
  const versionLabel = detection?.openapi?.version || latestRelease?.tag_name || '';
  const topicList = (repo.topics || '').split(',').map(t => t.trim()).filter(Boolean);
  const breaking = hasBaseline ? removed.filter(r => {
    const rPath = r.split(' ').slice(1).join(' ');
    const rSeg = rPath.split('/').filter(Boolean)[0] || '';
    return rSeg !== '' && !endpointKeys.some(k => k.includes(`/${rSeg}/`) || k.endsWith(`/${rSeg}`));
  }) : [];
  const metaLangs = [repo.language, detection?.language].filter((v, i, a) => v && a.indexOf(v) === i);
  return (
    <div className="ov-wrap">
      <section className="ov-source" aria-label="API source">
        <div className="ov-source-head">
          <div>
            <div className="ov-kicker">API source</div>
            <h3>This repository powers a Klyra API</h3>
            <p className="ov-sub">Klyra tracks the API definition found here and exposes it for testing in the Playground.</p>
          </div>
          <div className="ov-source-actions">
            <button type="button" className="kr-btn" disabled={syncing} onClick={resync}>
              <RefreshCw size={14} className={syncing ? 'kr-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync repository'}
            </button>
            <button type="button" className="kr-btn primary" onClick={() => openPlayground({ repoId: repo.id, repoName: repo.name })}>
              <FlaskConical size={14} /> Open Playground
            </button>
          </div>
        </div>
        {syncMsg && <div className={syncMsg.kind === 'ok' ? 'kr-success' : 'kr-error'} style={{ marginBottom: 12 }}>{syncMsg.text}</div>}
        {!hasApi ? (
          <div className="ov-nospec">
            <AlertTriangle size={16} />
            <div><b>API specification not detected</b><div className="ov-sub">Klyra could not find an OpenAPI/Swagger specification in this repository.</div></div>
            <button type="button" className="kr-btn" onClick={() => onNavigate('settings')}>Configure API source</button>
          </div>
        ) : (
          <>
            <dl className="ov-source-grid">
              <div><dt>Source</dt><dd>{repo.visibility === 'public' ? 'Public repository' : 'Private repository'}</dd></div>
              <div><dt>Branch</dt><dd className="mono"><GitBranch size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{repo.default_branch}</dd></div>
              <div><dt>Specification</dt><dd className="mono">{detection?.openapi?.file || 'Detected from source scan'}</dd></div>
              <div><dt>Format</dt><dd>{detection?.openapi?.version ? `OpenAPI ${detection.openapi.version}` : (detection?.framework || repo.framework || '—')}</dd></div>
              <div><dt>Last synced</dt><dd>{scannedAt ? timeAgo(scannedAt) : (ovw?.detect_updated_at ? timeAgo(ovw.detect_updated_at) : '—')}</dd></div>
              <div><dt>Status</dt><dd><span className={`ov-dot ${showPending ? 'pending' : 'ok'}`} />{showPending ? 'Changes pending' : 'Synced'}</dd></div>
            </dl>
            <div className="ov-detected">
              <span><b>{endpoints.length}</b> endpoints</span><span>·</span>
              <span><b>{detection?.authRequirements?.length || 0}</b> auth schemes</span>
              {detection?.authRequirements?.[0] && <span className="status-pill accent">{detection.authRequirements[0]}</span>}
              {detection?.framework && <span className="branch-tag">{detection.framework}</span>}
            </div>
          </>
        )}
      </section>
      {hasApi && (
        <section aria-label="API overview">
          <div className="ov-sec-head">
            <div>
              <div className="ov-kicker">API</div>
              <h3>{detection?.openapi?.title || repo.name}</h3>
              <div className="ov-sub">{endpoints.length} endpoints · {detection?.authRequirements?.[0] || 'No auth detected'} · {versionLabel || 'unversioned'}</div>
            </div>
            <button type="button" className="kr-btn" onClick={() => onNavigate('api')}>
              <Cpu size={14} /> Open API <ChevronRight size={13} />
            </button>
          </div>
          {endpoints.length === 0 ? (
            <EmptyState title="No endpoints detected yet" hint="Run a sync after pushing API routes or an OpenAPI file." />
          ) : (
            <div className="ov-endpoints">
              {endpoints.slice(0, 8).map((e, i) => (
                <button
                  key={`${e.method}-${e.path}-${i}`}
                  type="button"
                  className="ov-endpoint"
                  title={`Test ${e.method} ${e.path} in the Playground`}
                  onClick={() => openPlayground({ repoId: repo.id, repoName: repo.name, endpoint: { method: e.method, path: e.path } })}
                >
                  <span className="method-pill" style={{ color: METHOD_COLORS[e.method] || 'var(--text-primary)' }}>{e.method}</span>
                  <span className="endpoint-path">{e.path}</span>
                  <span className="endpoint-file">{e.sourceFile}</span>
                </button>
              ))}
            </div>
          )}
          {endpoints.length > 8 && (
            <button type="button" className="ov-more" onClick={() => onNavigate('api')}>View all {endpoints.length} endpoints <ChevronRight size={13} /></button>
          )}
        </section>
      )}
      <section aria-label="Sync status">
        <div className="ov-kicker">Sync</div>
        <h3>Synchronization</h3>
        <div className="ov-sync-grid">
          <div className="ov-sync-card">
            <span className="ov-label">Last sync</span>
            <b>{scannedAt ? timeAgo(scannedAt) : 'Never scanned'}</b>
            {lastCommit && <span className="ov-sub">Commit <span className="sha-chip">{lastCommit.sha.slice(0, 7)}</span> · {timeAgo(lastCommit.date)}</span>}
          </div>
          <div className="ov-sync-card">
            <span className="ov-label">Status</span>
            <b><span className={`ov-dot ${showPending ? 'pending' : 'ok'}`} />{showPending ? 'Changes pending review' : 'Up to date'}</b>
            <span className="ov-sub">{hasBaseline ? `Compared against previous scan (${prevKeys.length} endpoints)` : 'Baseline recorded — future scans diff against this state'}</span>
          </div>
        </div>
        {breaking.length > 0 && (
          <div className="ov-breaking" role="alert">
            <AlertTriangle size={15} />
            <div>
              <b>Breaking change detected</b>
              <div className="ov-sub">Removed: <span className="mono">{breaking.slice(0, 3).join(', ')}</span>{breaking.length > 3 ? ` +${breaking.length - 3} more` : ''}</div>
              {added.length > 0 && <div className="ov-sub">Added: <span className="mono">{added.slice(0, 3).join(', ')}</span>{added.length > 3 ? ` +${added.length - 3} more` : ''}</div>}
            </div>
            <button type="button" className="kr-btn" onClick={() => onNavigate('api')}>Review changes</button>
          </div>
        )}
        {showPending && breaking.length === 0 && (
          <div className="ov-changes">
            <CheckCircle2 size={15} color="#f59e0b" />
            <div>
              <b>Changes detected</b>
              <div className="ov-sub">
                {added.length > 0 && <span className="ov-delta add">+ {added.length} endpoint{added.length === 1 ? '' : 's'} </span>}
                {removed.length > 0 && <span className="ov-delta del">− {removed.length} endpoint{removed.length === 1 ? '' : 's'} </span>}
                {commitAfterScan && !hasPendingDiff && <span>New commits since last scan</span>}
              </div>
            </div>
            <div className="ov-changes-actions">
              <button type="button" className="kr-btn" onClick={() => onNavigate('api')}>Review changes</button>
              <button type="button" className="kr-btn primary" disabled={syncing} onClick={resync}>
                <RefreshCw size={13} className={syncing ? 'kr-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync API'}
              </button>
            </div>
          </div>
        )}
      </section>
      <section aria-label="Repository metadata">
        <div className="ov-kicker">Repository</div>
        <h3>Details</h3>
        <dl className="ov-meta-grid">
          <div><dt><Users size={12} /> Contributors</dt><dd>{ovw ? ovw.contributors.length : repo.collaborators.length}</dd></div>
          <div><dt><History size={12} /> Commits</dt><dd>{ovw?.commit_count ?? commits.length}</dd></div>
          <div><dt><GitBranch size={12} /> Branches</dt><dd>{ovw?.branch_count ?? repo.branches?.length ?? 0}</dd></div>
          <div><dt><Tag size={12} /> Releases</dt><dd>{releases.length || ovw?.releases_published || 0}</dd></div>
          <div><dt><FileCode2 size={12} /> Languages</dt><dd>{metaLangs.length ? metaLangs.join(' · ') : '—'}</dd></div>
          <div><dt><Scale size={12} /> License</dt><dd>{repo.license || '—'}</dd></div>
          <div><dt>Default branch</dt><dd className="mono">{repo.default_branch}</dd></div>
          <div><dt>Last updated</dt><dd>{timeAgo(repo.updated_at)}</dd></div>
        </dl>
        {ovw && ovw.contributors.length > 0 && (
          <div className="ov-contribs">
            {ovw.contributors.slice(0, 10).map(c => (
              <span key={c.id} title={`${c.display_name || c.username} · ${c.commits} commits`}>
                <Avatar name={c.display_name || c.username} color={c.avatar_color} size={24} />
              </span>
            ))}
          </div>
        )}
        {topicList.length > 0 && (
          <div className="gh-about-topics" style={{ marginTop: 10 }}>
            {topicList.map(t => <span key={t} className="topic-tag">{t}</span>)}
          </div>
        )}
        {repo.description && <p className="ov-sub" style={{ marginTop: 10 }}>{repo.description}</p>}
        <div className="ov-about-line">
          <span>API source <b className="mono">{detection?.openapi?.file || 'source scan'}</b></span>
          <span>·</span><span>Repository <b>{repo.visibility}</b></span>
          <span>·</span><span>License <b>{repo.license || '—'}</b></span>
          <button type="button" className="ov-more" onClick={() => onNavigate('settings')}>
            <Settings size={12} /> Repository settings
          </button>
        </div>
      </section>
      <section aria-label="Repository files">
        <div className="ov-kicker">Repository files</div>
        <h3>Source files behind the API</h3>
        <p className="ov-sub">The connected repository files — the source of truth the API above is derived from.</p>
        <div className="ov-files">
          <CodePage repo={repo} onNavigate={onNavigate} onChanged={onChanged} />
        </div>
      </section>
      <div className="ov-foot">
        <Plug size={13} /><span>Repository → API → Playground</span>
        <button type="button" className="kr-btn primary" onClick={() => openPlayground({ repoId: repo.id, repoName: repo.name })}>
          <FlaskConical size={13} /> Open Playground
        </button>
        <span className="ov-sub" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {repo.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />} {repo.visibility} · {repo.deploy_status || 'not deployed'}
        </span>
      </div>
    </div>
  );
};




