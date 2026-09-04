import React from 'react';
import { Folder, FileCode2, Plus, Shield, ShieldOff, Trash2, ArrowLeft, History } from 'lucide-react';
import { gitApi } from '../../services/api/repos';
import { RepoDetail, BranchInfo, TreeEntry } from '../../types/repos';
import { DiffView, EmptyState, ErrorBox, HighlightedCode, Loading, Modal, timeAgo } from './shared';

export const CodeTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [ref, setRef] = React.useState(repo.default_branch);
  const [path, setPath] = React.useState('');
  const [tree, setTree] = React.useState<TreeEntry[]>([]);
  const [file, setFile] = React.useState<{ content: string; history: any[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async (r: string, p: string) => {
    setLoading(true); setError(''); setFile(null);
    try { setTree((await gitApi.tree(repo.id, r, p)).entries || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(ref, path); }, [ref, path, load]);

  const openFile = async (fp: string) => {
    setLoading(true); setError('');
    try { const f = await gitApi.file(repo.id, ref, fp); setFile({ content: f.content, history: f.history }); setPath(fp); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading && !file) return <Loading label="Loading files…" />;
  if (error && !file) return <ErrorBox message={error} onRetry={() => load(ref, path)} />;

  const crumbs = path.split('/').filter(Boolean);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="kr-select" style={{ width: 180 }} value={ref} onChange={e => { setRef(e.target.value); }}>
          {([{ name: repo.default_branch }, ...(repo.branches || [])] as any[])
            .filter((v, i, a) => a.findIndex((x: any) => x.name === v.name) === i)
            .map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
        {file ? (
          <button className="kr-btn" onClick={() => { setFile(null); setPath(''); }}><ArrowLeft size={13} /> Back to files</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span>/</span>
                <button className="kr-btn" style={{ padding: '4px 8px' }} onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}>{c}</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {!file && (
        <div className="kr-card">
          {tree.length === 0 && <EmptyState title="Empty repository" hint="Push your first commit to see files here." />}
          {tree.map((t, i) => (
            <div key={i} className="tree-row" onClick={() => t.type === 'tree' ? setPath(path ? `${path}/${t.path}` : t.path) : openFile(path ? `${path}/${t.path}` : t.path)}>
              {t.type === 'tree' ? <Folder size={15} color="#8b5cf6" /> : <FileCode2 size={15} color="#64748b" />}
              <span style={{ flex: 1 }}>{t.path}</span>
              {t.type === 'blob' && t.size ? <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.size.toLocaleString()} B</span> : null}
            </div>
          ))}
        </div>
      )}

      {file && (
        <div>
          <div className="kr-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCode2 size={15} color="#64748b" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{path}</span>
              {file.history[0] && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  {file.history[0].sha.slice(0, 7)} · {file.history[0].message} · {file.history[0].author}
                </span>
              )}
            </div>
          </div>
          <HighlightedCode content={file.content} />
          <div className="mt16">
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={14} /> History
            </h4>
            {file.history.map((h, i) => (
              <div key={i} className="commit-item">
                <span className="sha-chip">{h.sha.slice(0, 7)}</span>
                <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{h.message}</div><div className="list-sub">{h.author} · {timeAgo(h.date)}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// ============================ BRANCHES ============================
export const BranchesTab: React.FC<{ repo: RepoDetail; canWrite: boolean; isOwner: boolean; onChanged: () => void }> = ({ repo, canWrite, isOwner, onChanged }) => {
  const [branches, setBranches] = React.useState<BranchInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setBranches(await gitApi.branches(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const protect = async (b: string) => {
    if (!isOwner) return;
    try { await gitApi.toggleProtection(repo.id, b); setMessage(`Protection updated for ${b}`); load(); }
    catch (e: any) { setError(e.message); }
  };

  const del = async (b: string) => {
    if (!canWrite) return;
    if (!window.confirm(`Delete branch "${b}"?`)) return;
    try { await gitApi.deleteBranch(repo.id, b); setMessage(`Branch ${b} deleted`); onChanged(); load(); }
    catch (e: any) { setError(e.message); }
  };

  if (loading) return <Loading label="Loading branches…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="kr-btn primary" disabled={!canWrite} onClick={() => setShowCreate(true)}><Plus size={14} /> New branch</button>
      </div>
      {message && <div className="kr-success">{message}</div>}
      {branches.length === 0 && <EmptyState title="No branches" hint="Branches appear after the first push." />}
      {branches.map(b => (
        <div key={b.name} className="list-row">
          <div className="list-main">
            <span className="branch-tag">
              {(b.protected || b.name === repo.default_branch) && <Shield size={11} color="#4ade80" />}
              {b.name}
            </span>
            {b.name !== repo.default_branch && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ color: '#4ade80' }}>↑ {b.ahead}</span> <span style={{ color: '#f87171' }}>↓ {b.behind}</span> vs {repo.default_branch}
              </span>
            )}
            <div className="list-sub">{b.latest_commit ? `${b.latest_commit.sha.slice(0, 7)} · ${b.latest_commit.message} · ${timeAgo(b.latest_commit.date)}` : 'No commits yet'}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {b.name !== repo.default_branch && isOwner && (
              <button className="kr-btn" onClick={() => protect(b.name)}>
                {b.protected ? <ShieldOff size={13} /> : <Shield size={13} />} {b.protected ? 'Unprotect' : 'Protect'}
              </button>
            )}
            {b.name !== repo.default_branch && (
              <button className="kr-btn danger" disabled={!canWrite} onClick={() => del(b.name)}><Trash2 size={13} /></button>
            )}
          </div>
        </div>
      ))}
      {showCreate && (
        <CreateBranchModal repo={repo} onClose={() => setShowCreate(false)} onCreate={(name, from) => { setShowCreate(false); gitApi.createBranch(repo.id, name, from).then(() => { load(); onChanged(); }).catch(e => setError(e.message)); }} />
      )}
    </div>
  );
};

const CreateBranchModal: React.FC<{ repo: RepoDetail; onClose: () => void; onCreate: (name: string, from: string) => void }> = ({ repo, onClose, onCreate }) => {
  const [name, setName] = React.useState('');
  const [from, setFrom] = React.useState(repo.default_branch);
  return (
    <Modal title="Create a branch" subtitle="Feature branches are the standard way to contribute. The default branch stays protected." onClose={onClose}>
      <label className="kr-label">Branch name</label>
      <input className="kr-input" placeholder="feature/thing" value={name} onChange={e => setName(e.target.value)} />
      <label className="kr-label">From</label>
      <select className="kr-select" value={from} onChange={e => setFrom(e.target.value)}>
        <option value={repo.default_branch}>{repo.default_branch}</option>
        {(repo.branches || []).filter(b => b.name !== repo.default_branch).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
      </select>
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={!name} onClick={() => onCreate(name, from)}>Create branch</button>
      </div>
    </Modal>
  );
};
// ============================ COMMITS ============================
export const CommitsTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [ref, setRef] = React.useState(repo.default_branch);
  const [commits, setCommits] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [selected, setSelected] = React.useState<null | { sha: string; patch: string }>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await gitApi.commits(repo.id, ref);
      setCommits(r.commits); setTotal(r.total);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id, ref]);

  React.useEffect(() => { load(); }, [load]);

  const viewCommit = async (sha: string) => {
    try { const c = await gitApi.commit(repo.id, sha); setSelected(c); } catch { /* ignore */ }
  };

  if (loading) return <Loading label="Loading commits…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <select className="kr-select" style={{ width: 180 }} value={ref} onChange={e => setRef(e.target.value)}>
          {([{ name: repo.default_branch }, ...(repo.branches || [])] as any[])
            .filter((v, i, a) => a.findIndex((x: any) => x.name === v.name) === i)
            .map((b: any) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} commits</span>
      </div>
      {commits.length === 0 && <EmptyState title="No commits yet" hint="Push to this repository to get started." />}
      {commits.map((c, i) => (
        <div key={i} className="commit-item">
          <span className="sha-chip" onClick={() => viewCommit(c.sha)}>{c.sha.slice(0, 7)}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.message}</div>
            <div className="list-sub">{c.author} committed {timeAgo(c.date)}</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{new Date(c.date).toLocaleString()}</span>
        </div>
      ))}
      {selected && (
        <Modal title={`Commit ${selected.sha.slice(0, 7)}`} subtitle="Changes introduced by this commit." onClose={() => setSelected(null)}>
          <DiffView patch={selected.patch} />
        </Modal>
      )}
    </div>
  );
};
