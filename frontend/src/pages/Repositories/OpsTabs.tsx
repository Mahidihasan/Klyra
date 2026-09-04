import React from 'react';
import { Zap, RefreshCw, Beaker, Rocket, Tag, Store, Settings as SettingsIcon, GitBranch, ArrowLeftRight } from 'lucide-react';
import { apiDetectApi, ciApi, releasesApi, deploymentsApi, marketplaceApi, gitApi, reposApi, gitRemoteUrl } from '../../services/api/repos';
import { RepoDetail, Detection, CiRun, Release, MarketplaceListing } from '../../types/repos';
import { CloneBox, DiffView, EmptyState, ErrorBox, HighlightedCode, Loading, MiniMarkdown, Modal, StatusPill, timeAgo } from './shared';

// ============================ API ============================
export const ApiTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [detected, setDetected] = React.useState<Detection | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await apiDetectApi.get(repo.id); setDetected(r.detected); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true); setMessage(''); setError('');
    try { const d = await apiDetectApi.run(repo.id); setDetected(d); setMessage(`Detection complete — ${d.endpoints.length} endpoints, ${d.secrets.length} secrets found`); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading label="Loading API metadata…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>API Awareness</div>
          <div className="list-sub">Automatically detected from the repository — distinct from manually configured metadata.</div>
        </div>
        <button className="kr-btn primary" disabled={busy} onClick={run}>
          <RefreshCw size={14} className={busy ? 'kr-spin' : ''} /> {busy ? 'Inspecting…' : 'Inspect repository'}
        </button>
      </div>
      {message && <div className="kr-success">{message}</div>}

      {!detected ? (
        <EmptyState title="No detection yet" hint="Run an inspection to detect the framework, endpoints, OpenAPI spec, env variables and dependencies." />
      ) : (
        <div className="grid-2">
          <div className="kr-card">
            <h4>Detected Framework & Language</h4>
            <div className="list-row"><span>Manual framework</span><span style={{ color: 'var(--text-accent)' }}>{repo.framework || '—'}</span></div>
            <div className="list-row"><span>Detected framework</span><span className="status-pill accent">{detected.framework || 'Unknown'}</span></div>
            <div className="list-row"><span>Language</span><span>{detected.language || '—'}</span></div>
            <div className="list-row"><span>Files scanned</span><span>{detected.scannedFiles}</span></div>
            <div className="list-row"><span>Last scanned</span><span>{timeAgo(detected.detectedAt)}</span></div>
            {detected.openapi && <div className="list-row"><span>OpenAPI</span><span className="branch-tag">{detected.openapi.file}</span></div>}
          </div>
          <div className="kr-card">
            <h4>Authentication</h4>
            {detected.authRequirements.length === 0 && <div className="list-sub">No auth patterns detected.</div>}
            {detected.authRequirements.map((a, i) => <span key={i} className="status-pill accent" style={{ marginRight: 6 }}>{a}</span>)}
            <h4 className="mt16">Dependencies ({Object.keys(detected.dependencies).length})</h4>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {Object.entries(detected.dependencies).slice(0, 50).map(([k, v]) => (
                <div key={k} className="list-sub" style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>{k}</span><span style={{ color: 'var(--text-accent)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {detected && (
        <>
          <div className="kr-card mt16">
            <h4>Endpoints ({detected.endpoints.length})</h4>
            {detected.endpoints.length === 0 && <div className="list-sub">No endpoints detected in source files.</div>}
            {detected.endpoints.map((e, i) => (
              <div key={i} className="endpoint-row">
                <span className={"method-pill " + e.method}>{e.method}</span>
                <span className="endpoint-path">{e.path}</span>
                <span className="endpoint-file">{e.sourceFile}:{e.line}</span>
              </div>
            ))}
          </div>

          <div className="kr-card mt16">
            <h4>Environment variables (.env.example)</h4>
            {detected.envVariables.length === 0 && (
              <div className="list-sub">No .env.example found. Add one with placeholder values — never commit real .env files.</div>
            )}
            {detected.envVariables.map((v, i) => (
              <div key={i} className="finding-row">
                <span className="branch-tag">{v.name}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.example || '(empty)'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>placeholder</span>
              </div>
            ))}
          </div>

          <div className="secret-banner mt16" style={{ marginTop: 16 }}>
            <h4>Secret scan: {detected.secrets.length} finding{detected.secrets.length === 1 ? '' : 's'}</h4>
            {detected.secrets.length === 0 && <div className="list-sub">No credentials detected in the current tree (~/.env files are never read).</div>}
            {detected.secrets.map((s, i) => (
              <div key={i} className="finding-row">
                <span className="finding-kind">{s.kind}</span>
                <span className="finding-file">{s.file}:{s.line}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================ DOCS ============================
export const DocsTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [docs, setDocs] = React.useState<any[]>([]);
  const [content, setContent] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const t = await gitApi.tree(repo.id, repo.default_branch, 'docs');
        setDocs((t.entries || []).filter(e => e.type === 'blob' && /\.(md|markdown|txt)$/i.test(e.path)));
      } catch { setDocs([]); }
    })();
  }, [repo.id, repo.default_branch]);

  const open = (p: string) => gitApi.file(repo.id, repo.default_branch, p).then(f => setContent(f.content)).catch(() => setContent(''));

  return (
    <div>
      <div className="kr-card">
        <h4>Documentation</h4>
        <div className="list-sub">Docs are served from the docs/ directory or README.md in the default branch.</div>
        {docs.length === 0 && (
          <EmptyState title="No docs/ folder yet" hint="Add Markdown files under docs/ to maintain API documentation in-repo." />
        )}
        {docs.map((d, i) => (
          <div key={i} className="list-row">
            <span className="list-title" onClick={() => open(d.path)}>{d.path}</span>
            <button className="kr-btn" onClick={() => open(d.path)}>View</button>
          </div>
        ))}
      </div>
      {content !== null && (
        <div className="kr-card mt16">
          <MiniMarkdown source={content} />
        </div>
      )}
    </div>
  );
};
// ============================ TESTS / CI ============================
export const TestsTab: React.FC<{ repo: RepoDetail; canWrite: boolean }> = ({ repo, canWrite }) => {
  const [runs, setRuns] = React.useState<CiRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [openLog, setOpenLog] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setRuns(await ciApi.runs(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const run = async (type: 'build' | 'test') => {
    setBusy(type); setError('');
    try {
      await ciApi.run(repo.id, type);
      // poll until finish
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 3000));
        await load();
        const latest = runs[0];
        if (latest && ['success', 'failure', 'skipped'].includes(latest.status)) break;
      }
    } catch (e: any) { setError(e.message); }
    setBusy('');
  };

  if (loading) return <Loading label="Loading CI runs…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  const latest = runs[0];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Build & Tests</div>
          <div className="list-sub">Runs a real build/test of the default-branch working copy; status reflects the actual exit code.</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="kr-btn" disabled={!!busy || !canWrite} onClick={() => run('test')}><Beaker size={14} /> {busy === 'test' ? 'Running…' : 'Run tests'}</button>
          <button className="kr-btn primary" disabled={!!busy || !canWrite} onClick={() => run('build')}><Zap size={14} /> {busy === 'build' ? 'Running…' : 'Run build'}</button>
        </div>
      </div>
      {latest && (
        <div className="kr-card" style={{ marginBottom: 14 }}>
          <h4>Latest run</h4>
          <div className="list-row"><span>{latest.summary || latest.type}</span><StatusPill status={latest.status} /></div>
          <div className="list-row"><span>Triggered</span><span>{timeAgo(latest.started_at)}</span></div>
          {latest.finished_at && <div className="list-row"><span>Finished</span><span>{timeAgo(latest.finished_at)}</span></div>}
          <button className="kr-btn mt8" onClick={() => setOpenLog(latest.id)}>View log</button>
        </div>
      )}
      {runs.length === 0 && <EmptyState title="No CI runs yet" hint="Trigger a build or run the test suite to see real results and logs here." />}
      {runs.slice(1, 10).map(r => (
        <div key={r.id} className="list-row">
          <div className="list-main">
            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.type}</span>
            <div className="list-sub">{r.summary || ''} · {timeAgo(r.started_at)} {r.commit_sha ? '· ' + r.commit_sha.slice(0, 7) : ''}</div>
          </div>
          <StatusPill status={r.status} />
        </div>
      ))}
      {openLog && <CiLogModal repoId={repo.id} runId={openLog} onClose={() => setOpenLog(null)} />}
    </div>
  );
};

const CiLogModal: React.FC<{ repoId: string; runId: string; onClose: () => void }> = ({ repoId, runId, onClose }) => {
  const [run, setRun] = React.useState<CiRun | null>(null);
  React.useEffect(() => {
    ciApi.getRun(repoId, runId).then(setRun).catch(() => undefined);
  }, [repoId, runId]);
  return (
    <Modal title="Build / test log" subtitle="Live output from the actual toolchain execution." onClose={onClose}>
      {!run ? <Loading label="Loading log…" /> : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span className={`status-pill ${run.status === 'success' ? 'success' : run.status === 'failure' ? 'failure' : 'running'}`}>{run.status}</span>
            <span className="list-sub">{run.summary}</span>
          </div>
          <div className="log-viewer">{run.log || 'No output captured.'}</div>
        </>
      )}
    </Modal>
  );
};

// ============================ DEPLOYMENTS ============================
export const DeploymentsTab: React.FC<{ repo: RepoDetail; isOwner: boolean }> = ({ repo, isOwner }) => {
  const [rows, setRows] = React.useState<any[]>([]);
  const [releases, setReleases] = React.useState<Release[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [selRelease, setSelRelease] = React.useState('');
  const [env, setEnv] = React.useState('production');
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [d, r] = await Promise.all([deploymentsApi.list(repo.id), releasesApi.list(repo.id)]);
      setRows(d); setReleases(r.releases.filter(x => x.status === 'published'));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const deploy = async () => {
    setMessage(''); setError('');
    try { const r = await deploymentsApi.create(repo.id, selRelease, env); setMessage(`Deployment ${r.status}: ${r.log}`); load(); }
    catch (e: any) { setError(e.message); }
  };

  if (loading) return <Loading label="Loading deployments…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div className="kr-card" style={{ marginBottom: 14 }}>
        <h4>Deploy a release</h4>
        {releases.length === 0 ? (
          <div className="list-sub">Publish a release first — deployments can only target published releases.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="kr-select" style={{ width: 200 }} value={selRelease} onChange={e => setSelRelease(e.target.value)}>
              <option value="">Select release…</option>
              {releases.map(r => <option key={r.id} value={r.id}>{r.tag_name}</option>)}
            </select>
            <input className="kr-input" style={{ width: 130 }} value={env} onChange={e => setEnv(e.target.value)} />
            <button className="kr-btn primary" disabled={!selRelease || !isOwner} onClick={deploy}><Rocket size={14} /> Deploy</button>
          </div>
        )}
        {!isOwner && <div className="list-sub mt8">Only the repository owner can trigger deployments.</div>}
      </div>
      {message && <div className="kr-success">{message}</div>}
      {error && <div className="kr-error">{error}</div>}
      {rows.length === 0 && <EmptyState title="No deployments yet" hint="Deployments appear here after you deploy a published release." />}
      {rows.map(d => (
        <div key={d.id} className="list-row">
          <div className="list-main">
            <span style={{ fontWeight: 600 }}>{d.release_tag || '—'}</span>
            <div className="list-sub">{d.environment} · {timeAgo(d.created_at)}</div>
          </div>
          <StatusPill status={d.status} />
        </div>
      ))}
    </div>
  );
};
// ============================ TAGS & RELEASES ============================
export const ReleasesTab: React.FC<{ repo: RepoDetail; isOwner: boolean; canWrite: boolean }> = ({ repo, isOwner, canWrite }) => {
  const [data, setData] = React.useState<{ releases: Release[]; tags: any[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showRelease, setShowRelease] = React.useState(false);
  const [showTag, setShowTag] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [compare, setCompare] = React.useState<null | { patch: string }>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await releasesApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const publish = async (id: string, tag: string) => {
    if (!isOwner) return;
    setError('');
    try { await releasesApi.publish(repo.id, id); setMessage(`Released ${tag}`); load(); }
    catch (e: any) { setError(e.message); }
  };

  if (loading) return <Loading label="Loading releases…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="kr-btn" disabled={!canWrite} onClick={() => setShowTag(true)}><Tag size={14} /> New tag</button>
        <button className="kr-btn primary" disabled={!canWrite} onClick={() => setShowRelease(true)}>Draft release</button>
      </div>
      {message && <div className="kr-success">{message}</div>}
      {error && <div className="kr-error">{error}</div>}
      {compare && (
        <Modal title="Version comparison" onClose={() => setCompare(null)}>
          <DiffView patch={compare.patch} />
        </Modal>
      )}

      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Releases ({data.releases.length})</h4>
      {data.releases.length === 0 && <EmptyState title="No releases yet" hint="Create a semver tag, draft a release from it, and publish (owner only)." />}
      {data.releases.map(r => (
        <div key={r.id} className="list-row">
          <div className="list-main">
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span className="branch-tag" style={{ marginLeft: 8 }}>{r.tag_name}</span>
            {r.latest && <span className="status-pill success" style={{ marginLeft: 8 }}>latest</span>}
            {r.prerelease && <span className="status-pill running" style={{ marginLeft: 8 }}>pre-release</span>}
            <div className="list-sub">{r.notes ? r.notes.slice(0, 120) : 'No notes'} · created by {r.created_by_username} · {timeAgo(r.created_at)}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <StatusPill status={r.status} />
            {r.status !== 'published' && isOwner && (
              <button className="kr-btn primary" onClick={() => publish(r.id, r.tag_name)}>Publish</button>
            )}
            {r.marketplace_listing_id && <span className="status-pill accent">on Marketplace</span>}
          </div>
        </div>
      ))}

      <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8 }}>Tags ({data.tags.length})</h4>
      {data.tags.length === 0 && <div className="list-sub">No tags yet. Tags are created against a branch and used for releases.</div>}
      {data.tags.map(t => (
        <div key={t.name} className="list-row">
          <span className="branch-tag">{t.name}</span>
          <span className="list-sub">{t.sha.slice(0, 7)} · {timeAgo(t.date)}</span>
        </div>
      ))}

      {showTag && <CreateTagModal repo={repo} onClose={() => setShowTag(false)} onCreate={() => { setShowTag(false); load(); }} />}
      {showRelease && <CreateReleaseModal repo={repo} tags={data.tags} onClose={() => setShowRelease(false)} onCreate={() => { setShowRelease(false); load(); }} />}
    </div>
  );
};

const CreateTagModal: React.FC<{ repo: RepoDetail; onClose: () => void; onCreate: () => void }> = ({ repo, onClose, onCreate }) => {
  const [name, setName] = React.useState('');
  const [ref, setRef] = React.useState(repo.default_branch);
  const [error, setError] = React.useState('');
  return (
    <Modal title="Create a tag" onClose={onClose}>
      <label className="kr-label">Tag (semantic version)</label>
      <input className="kr-input" placeholder="1.0.0" value={name} onChange={e => setName(e.target.value)} />
      <label className="kr-label">From branch</label>
      <select className="kr-select" value={ref} onChange={e => setRef(e.target.value)}>
        {(repo.branches || []).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
      </select>
      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={!name} onClick={async () => { try { await gitApi.createTag(repo.id, name, ref); onCreate(); } catch (e: any) { setError(e.message); } }}>Create tag</button>
      </div>
    </Modal>
  );
};

const CreateReleaseModal: React.FC<{ repo: RepoDetail; tags: any[]; onClose: () => void; onCreate: () => void }> = ({ repo, tags, onClose, onCreate }) => {
  const [tagName, setTagName] = React.useState('');
  const [name, setName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [prerelease, setPrerelease] = React.useState(false);
  const [error, setError] = React.useState('');
  return (
    <Modal title="Draft a release" subtitle="Semver tags only; you can publish the draft when ready (owner)." onClose={onClose}>
      <label className="kr-label">Tag</label>
      <select className="kr-select" value={tagName} onChange={e => setTagName(e.target.value)}>
        <option value="">Select a tag…</option>
        {tags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>
      <label className="kr-label">Release title</label>
      <input className="kr-input" value={name} onChange={e => setName(e.target.value)} />
      <label className="kr-label">Release notes</label>
      <textarea className="kr-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5 }}>
        <input type="checkbox" checked={prerelease} onChange={e => setPrerelease(e.target.checked)} /> Pre-release
      </label>
      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={!tagName || !name} onClick={async () => { try { await releasesApi.create(repo.id, { tag_name: tagName, name, notes, prerelease }); onCreate(); } catch (e: any) { setError(e.message); } }}>Create draft</button>
      </div>
    </Modal>
  );
};
// ============================ MARKETPLACE ============================
export const MarketplaceTab: React.FC<{ repo: RepoDetail; isOwner: boolean; canWrite: boolean }> = ({ repo, isOwner, canWrite }) => {
  const [listings, setListings] = React.useState<MarketplaceListing[]>([]);
  const [releases, setReleases] = React.useState<Release[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [l, r] = await Promise.all([marketplaceApi.list(repo.id), releasesApi.list(repo.id)]);
      setListings(l); setReleases(r.releases.filter(x => x.status === 'published'));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setError(''); setMessage('');
    try { await marketplaceApi.setStatus(repo.id, id, status); setMessage(`Listing -> ${status} (owner action)`); load(); }
    catch (e: any) { setError(e.message); }
  };

  if (loading) return <Loading label="Loading marketplace…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}><Store size={14} style={{ verticalAlign: -2 }} /> Marketplace</div>
          <div className="list-sub">Publish an approved release to the Klyra Marketplace. Ownership is kept separate from marketplace permissions.</div>
        </div>
        <button className="kr-btn primary" disabled={!canWrite} onClick={() => setShowCreate(true)}>Publish to Marketplace</button>
      </div>
      {message && <div className="kr-success">{message}</div>}
      {error && <div className="kr-error">{error}</div>}
      {listings.length === 0 && <EmptyState title="Not listed yet" hint="Create a listing from a published release, submit for review, then publish (owner)." />}
      {listings.map(l => (
        <div key={l.id} className="list-row">
          <div className="list-main">
            <span style={{ fontWeight: 600 }}>{l.name}</span>
            {l.release_tag && <span className="branch-tag" style={{ marginLeft: 8 }}>{l.release_tag}</span>}
            <span className={"status-pill " + (l.pricing_type === 'paid' ? 'running' : 'success')} style={{ marginLeft: 8 }}>{l.pricing_type}{l.pricing_type === 'paid' ? ' · $' + (l.price_cents / 100).toFixed(2) : ''}</span>
            <div className="list-sub">{l.tagline} · {l.category}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <StatusPill status={l.status} />
            {isOwner && l.status !== 'published' && (
              <>
                {l.status === 'draft' && <button className="kr-btn" onClick={() => setStatus(l.id, 'in_review')}>Submit for review</button>}
                {l.status === 'in_review' && <button className="kr-btn primary" onClick={() => setStatus(l.id, 'published')}>Publish</button>}
              </>
            )}
          </div>
        </div>
      ))}
      {showCreate && (
        <CreateListingModal repo={repo} releases={releases} onClose={() => setShowCreate(false)} onCreate={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
};

const CreateListingModal: React.FC<{ repo: RepoDetail; releases: Release[]; onClose: () => void; onCreate: () => void }> = ({ repo, releases, onClose, onCreate }) => {
  const [releaseId, setReleaseId] = React.useState('');
  const [name, setName] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('other');
  const [pricing, setPricing] = React.useState('free');
  const [price, setPrice] = React.useState('0');
  const [error, setError] = React.useState('');
  return (
    <Modal title="Publish to Marketplace" subtitle="Only approved (published) releases can be listed." onClose={onClose}>
      <label className="kr-label">Release</label>
      <select className="kr-select" value={releaseId} onChange={e => setReleaseId(e.target.value)}>
        <option value="">Select published release…</option>
        {releases.map(r => <option key={r.id} value={r.id}>{r.tag_name} — {r.name}</option>)}
      </select>
      {releases.length === 0 && <div className="list-sub">You need a published release first.</div>}
      <label className="kr-label">Listing name</label>
      <input className="kr-input" value={name} onChange={e => setName(e.target.value)} />
      <label className="kr-label">Tagline</label>
      <input className="kr-input" value={tagline} onChange={e => setTagline(e.target.value)} />
      <label className="kr-label">Description</label>
      <textarea className="kr-textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
      <div className="grid-2">
        <div>
          <label className="kr-label">Category</label>
          <select className="kr-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="payments">Payments</option><option value="data">Data</option><option value="ai">AI / ML</option><option value="auth">Auth</option><option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="kr-label">Pricing</label>
          <select className="kr-select" value={pricing} onChange={e => setPricing(e.target.value)}>
            <option value="free">Free / open-source</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
      {pricing === 'paid' && (
        <>
          <label className="kr-label">Price (USD)</label>
          <input className="kr-input" type="number" value={price} onChange={e => setPrice(e.target.value)} />
        </>
      )}
      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={!releaseId || !name} onClick={async () => {
          try { await marketplaceApi.create(repo.id, { release_id: releaseId, name, tagline, description, category, pricing_type: pricing, price_cents: Math.round(parseFloat(price || '0') * 100) }); onCreate(); }
          catch (e: any) { setError(e.message); }
        }}>Create draft listing</button>
      </div>
    </Modal>
  );
};

// ============================ SETTINGS ============================
export const SettingsTab: React.FC<{ repo: RepoDetail; isOwner: boolean; onChanged: () => void; onBack: () => void }> = ({ repo, isOwner, onChanged, onBack }) => {
  const [description, setDescription] = React.useState(repo.description);
  const [license, setLicense] = React.useState(repo.license);
  const [language, setLanguage] = React.useState(repo.language);
  const [framework, setFramework] = React.useState(repo.framework);
  const [visibility, setVisibility] = React.useState(repo.visibility);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const save = async () => {
    setError(''); setMessage('');
    try { await reposApi.update(repo.id, { description, license, language, framework, visibility }); setMessage('Settings saved'); onChanged(); }
    catch (e: any) { setError(e.message); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this repository permanently? This cannot be undone.')) return;
    try { await reposApi.remove(repo.id); onBack(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <div className="kr-card">
        <h4>Repository settings</h4>
        <label className="kr-label">Description</label>
        <input className="kr-input" value={description} onChange={e => setDescription(e.target.value)} />
        <div className="grid-2">
          <div>
            <label className="kr-label">License</label>
            <input className="kr-input" value={license} onChange={e => setLicense(e.target.value)} />
          </div>
          <div>
            <label className="kr-label">Visibility {!isOwner && '(owner only)'}</label>
            <select className="kr-select" value={visibility} onChange={e => setVisibility(e.target.value)} disabled={!isOwner}>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div>
            <label className="kr-label">Language</label>
            <input className="kr-input" value={language} onChange={e => setLanguage(e.target.value)} />
          </div>
          <div>
            <label className="kr-label">Framework (manual metadata)</label>
            <input className="kr-input" value={framework} onChange={e => setFramework(e.target.value)} />
          </div>
        </div>
        {error && <div className="kr-error">{error}</div>}
        {message && <div className="kr-success">{message}</div>}
        <div className="modal-actions">
          <button className="kr-btn primary" onClick={save}>Save changes</button>
        </div>
      </div>

      <div className="kr-card mt16">
        <h4><SettingsIcon size={14} /> Clone & push</h4>
        <div className="list-sub">Authenticate with any username and your Klyra token (or use the browser token). Protected main + feature-branch PRs.</div>
        <div className="mt8"><CloneBox url={gitRemoteUrl(repo.id)} /></div>
        <div className="list-sub mt8">git push is enforced by a pre-receive hook — direct writes to the protected default branch are rejected for non-owner collaborators.</div>
      </div>

      <div className="kr-card mt16" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
        <h4>Danger zone</h4>
        <div className="list-sub">Delete this repository and all of its Git history, releases and listings. Owner only.</div>
        <div className="mt8">
          <button className="kr-btn danger" disabled={!isOwner} onClick={remove}>Delete repository</button>
        </div>
      </div>
    </div>
  );
};

// re-export gitRemoteUrl for Settings (clone box)
