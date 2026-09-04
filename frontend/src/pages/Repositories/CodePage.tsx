import React from 'react';
import {
  Folder, FileCode2, FileText, GitBranch, Tag, History, ChevronDown, Copy,
  Search, BookOpen, Users, Cpu, Rocket, Settings, Shield, Store, Download,
} from 'lucide-react';
import { gitApi, apiDetectApi, reposApi, gitRemoteUrl } from '../../services/api/repos';
import { RepoDetail, TreeEntry, RepoTab, Detection, Overview, CommitInfo } from '../../types/repos';
import { Avatar, CloneBox, EmptyState, ErrorBox, HighlightedCode, Loading, MiniMarkdown, StatusPill, timeAgo } from './shared';

// ============================ CODE (GitHub-style workspace) ============================
// The repository IS the page: toolbar → latest commit → file list → README.
// API / deployment info lives in a compact secondary sidebar.

export const CodePage: React.FC<{ repo: RepoDetail; onNavigate: (t: RepoTab) => void }> = ({ repo, onNavigate }) => {
  const [ref, setRef] = React.useState(repo.default_branch);
  const [path, setPath] = React.useState('');
  const [tree, setTree] = React.useState<TreeEntry[]>([]);
  const [file, setFile] = React.useState<{ content: string; history: any[] } | null>(null);
  const [latest, setLatest] = React.useState<CommitInfo | null>(null);
  const [branches, setBranches] = React.useState<{ name: string; protected?: boolean }[]>([]);
  const [tagCount, setTagCount] = React.useState<number | null>(null);
  const [readme, setReadme] = React.useState<{ name: string; content: string } | null>(null);
  const [detection, setDetection] = React.useState<Detection | null>(null);
  const [ovw, setOvw] = React.useState<Overview | null>(null);
  const [latestRelease, setLatestRelease] = React.useState<{ tag_name: string; created_at: string } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const [showClone, setShowClone] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const loadTree = React.useCallback(async (r: string, p: string) => {
    setLoading(true); setError(''); setFile(null);
    try { const res = await gitApi.tree(repo.id, r, p); setTree(res.entries || []); if (!p && res.latest_commit) setLatest(res.latest_commit); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { loadTree(ref, path); }, [ref, path, loadTree]);

  // One-time context: branches, README, sidebar data. (tree() also returns latest_commit.)
  React.useEffect(() => {
    (async () => {
      const [br, rd, det, ov] = await Promise.allSettled([
        gitApi.branches(repo.id),
        gitApi.file(repo.id, repo.default_branch, 'README.md'),
        apiDetectApi.get(repo.id),
        reposApi.overview(repo.id),
      ]);
      if (br.status === 'fulfilled') setBranches(br.value.map(b => ({ name: b.name, protected: b.protected })));
      if (rd.status === 'fulfilled') {
        const content = (rd.value as any)?.content;
        if (content) setReadme({ name: 'README.md', content });
      } else {
        try {
          const alt = await gitApi.file(repo.id, repo.default_branch, 'readme.md');
          if (alt?.content) setReadme({ name: 'readme.md', content: alt.content });
        } catch { /* no README */ }
      }
      if (det.status === 'fulfilled') setDetection(det.value.detected);
      if (ov.status === 'fulfilled') {
        setOvw(ov.value);
        setTagCount(ov.value.tag_count);
        if (ov.value.latest_release) setLatestRelease({ tag_name: ov.value.latest_release.tag_name, created_at: ov.value.latest_release.created_at });
      }
    })();
  }, [repo.id, repo.default_branch]);

  const openFile = async (fp: string) => {
    setLoading(true); setError('');
    try { const f = await gitApi.file(repo.id, ref, fp); setFile({ content: f.content, history: f.history }); setPath(fp); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openPath = (p: string) => { setFilter(''); setPath(p ? `${path ? `${path}/` : ''}${p}` : path); };

  const crumbs = path.split('/').filter(Boolean);
  const shownTree = filter
    ? tree.filter(t => t.path.toLowerCase().includes(filter.toLowerCase()))
    : tree;
  const folders = shownTree.filter(t => t.type === 'tree');
  const files = shownTree.filter(t => t.type === 'blob');

  const moreItems: { id: RepoTab; label: string; icon: any }[] = [
    { id: 'branches', label: 'Branches', icon: GitBranch },
    { id: 'releases', label: 'Tags & releases', icon: Tag },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
    { id: 'collaborators', label: 'Collaborators', icon: Users },
    { id: 'marketplace', label: 'Marketplace', icon: Store },
  ];

  const endpointCount = detection?.endpoints?.length ?? ovw?.endpoint_count ?? null;

  return (
    <div className="codepage">
      {/* ---------- GitHub-style repository toolbar ---------- */}
      {!file && (
        <div className="gh-toolbar">
          <div className="gh-toolbar-left">
            <label className="gh-branch">
              <GitBranch size={13} />
              <select value={ref} onChange={e => setRef(e.target.value)}>
                {branches.length
                  ? branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)
                  : <option value={ref}>{ref}</option>}
              </select>
              <ChevronDown size={12} />
            </label>
            <button className="gh-toolbar-link" onClick={() => onNavigate('branches')}>
              <GitBranch size={13} /> <b>{branches.length || repo.branches?.length || 0}</b> branches
            </button>
            <button className="gh-toolbar-link" onClick={() => onNavigate('releases')}>
              <Tag size={13} /> <b>{tagCount ?? '—'}</b> tags
            </button>
          </div>
          <div className="gh-toolbar-right">
            <div className="gh-find">
              <Search size={12} />
              <input placeholder="Search files…" value={filter} onChange={e => setFilter(e.target.value)} />
            </div>
            <div className="ovw-popwrap">
              <button className="kr-btn" onClick={() => { setShowClone(v => !v); setShowMore(false); }}>
                <Copy size={13} /> Clone <ChevronDown size={12} />
              </button>
              {showClone && (
                <div className="ovw-pop">
                  <div className="ovw-pop-title">Clone this repository</div>
                  <div onClick={e => e.stopPropagation()}><CloneBox url={gitRemoteUrl(repo.id)} /></div>
                </div>
              )}
            </div>
            <div className="ovw-popwrap">
              <button className="kr-btn" onClick={() => { setShowMore(v => !v); setShowClone(false); }}>
                More <ChevronDown size={12} />
              </button>
              {showMore && (
                <div className="ovw-pop ovw-pop-menu">
                  {moreItems.map(m => (
                    <button key={m.id} onClick={() => { setShowMore(false); onNavigate(m.id); }}>
                      <m.icon size={13} /> {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- main + sidebar ---------- */}
      <div className="gh-layout">
        <div className="gh-main">
          {file ? (
            <>
              <div className="gh-file-head">
                <button className="kr-btn" onClick={() => { setFile(null); setPath(''); }}>Back to files</button>
                <span className="gh-file-path">
                  <span className="gh-crumb" onClick={() => { setFile(null); setPath(''); }}>{repo.name}</span>
                  {path.split('/').map((seg, i, arr) => (
                    <span key={i} className="gh-crumb-sep">/{i === arr.length - 1 ? <b>{seg}</b> : seg}</span>
                  ))}
                </span>
              </div>
              <div className="gh-blob">
                <div className="gh-blob-head">
                  <span className="gh-blob-meta">
                    {file.content.split('\n').length.toLocaleString()} lines
                    <span style={{ margin: '0 6px', color: 'var(--border-subtle)' }}>|</span>
                    {(new TextEncoder().encode(file.content).length / 1024).toFixed(1)} KB
                  </span>
                  <div className="gh-blob-actions">
                    <button
                      className="kr-btn"
                      onClick={() => { navigator.clipboard?.writeText(file.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    ><Copy size={12} /> {copied ? 'Copied!' : 'Copy'}</button>
                    <button
                      className="kr-btn"
                      onClick={() => {
                        const blob = new Blob([file.content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = path.split('/').pop() || 'file.txt'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    ><Download size={12} /> Raw</button>
                  </div>
                </div>
                <div className="gh-code-box"><HighlightedCode content={file.content} /></div>
              </div>
              <div className="gh-history">
                <h4><History size={13} /> History</h4>
                {file.history.map((h, i) => (
                  <div key={i} className="commit-item">
                    <span className="sha-chip">{h.sha.slice(0, 7)}</span>
                    <div><div className="ovw-commit-msg">{h.message}</div><div className="list-sub">{h.author} · {timeAgo(h.date)}</div></div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* breadcrumb + commit count */}
              <div className="gh-crumbs-row">
                <div className="gh-crumbs">
                  <button className="gh-crumb" onClick={() => setPath('')}>{repo.name}</button>
                  {crumbs.map((c, i) => (
                    <span key={i} className="gh-crumb-sep">/
                      <button className={`gh-crumb ${i === crumbs.length - 1 ? 'current' : ''}`} onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}>{c}</button>
                    </span>
                  ))}
                </div>
                <button className="gh-commit-count" onClick={() => onNavigate('commits')} title="View all commits">
                  <History size={14} /> <b>{ovw?.commit_count ?? '—'}</b> commits
                </button>
              </div>

              {/* latest commit row */}
              {latest && (
                <div className="gh-latest-commit">
                  <Avatar name={latest.author} size={22} />
                  <b>{latest.author}</b>
                  <span className="gh-latest-msg" onClick={() => onNavigate('commits')}>{latest.message}</span>
                  <span className="sha-chip" onClick={() => onNavigate('commits')}>{latest.sha.slice(0, 7)}</span>
                  <span className="gh-latest-time" onClick={() => onNavigate('commits')}>{timeAgo(latest.date)}</span>
                </div>
              )}

              {/* file table */}
              <div className="gh-file-table">
                {loading && <div className="gh-table-loading"><Loading label="Loading files…" /></div>}
                {error && <ErrorBox message={error} onRetry={() => loadTree(ref, path)} />}
                {!loading && !error && shownTree.length === 0 && (
                  <EmptyState title={filter ? 'No matching files' : 'Empty directory'} hint={filter ? 'Try a different search.' : 'Push your first commit to see files here.'} />
                )}
                {folders.map(t => (
                  <div key={t.path} className="gh-row" onClick={() => openPath(t.path)}>
                    <Folder size={15} style={{ color: 'var(--accent-purple)' }} />
                    <span className="gh-row-name">{t.path}</span>
                    <span className="gh-row-commit">{t.last_commit_message || 'Folder'}</span>
                    <span className="gh-row-time">{t.last_updated ? timeAgo(t.last_updated) : ''}</span>
                  </div>
                ))}
                {files.map(t => (
                  <div key={t.path} className="gh-row" onClick={() => openPath(path ? `${path}/${t.path}` : t.path)}>
                    <FileCode2 size={15} style={{ color: 'var(--text-muted)' }} />
                    <span className="gh-row-name">{t.path}</span>
                    <span className="gh-row-commit">{t.last_commit_message || (t.size ? `${t.size.toLocaleString()} B` : 'File')}</span>
                    <span className="gh-row-time">{t.last_updated ? timeAgo(t.last_updated) : ''}</span>
                  </div>
                ))}
              </div>

              {/* README preview */}
              {readme && (
                <div className="gh-readme">
                  <header><FileText size={13} /> {readme.name}</header>
                  <MiniMarkdown source={readme.content} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ---------- compact sidebar ---------- */}
        <aside className="gh-side">
          <section>
            <h5>About</h5>
            <p className="gh-about-desc">{repo.description || 'No description.'}</p>
            <div className="gh-side-row"><span className="lang-dot" />{repo.language || '—'}</div>
            {repo.framework && <div className="gh-side-row">{repo.framework}</div>}
            <div className="gh-side-row">{repo.license} license</div>
            <div className="gh-side-row">Updated {timeAgo(repo.updated_at)}</div>
          </section>

          <section>
            <h5><Cpu size={12} /> API</h5>
            {detection?.openapi?.version
              ? <div className="gh-side-row"><span className="gh-side-label">Version</span><b className="mono">{detection.openapi.version}</b></div>
              : null}
            {endpointCount !== null
              ? <div className="gh-side-row"><span className="gh-side-label">Endpoints</span><b>{endpointCount}</b></div>
              : null}
            {detection?.authRequirements?.[0]
              ? <div className="gh-side-row"><span className="gh-side-label">Auth</span><span>{detection.authRequirements[0]}</span></div>
              : null}
            {!detection && !ovw?.endpoint_count && <div className="gh-side-sub">No API detected.</div>}
            <button className="gh-side-link" onClick={() => onNavigate('api')}>
              <Cpu size={11} /> Open API Explorer
            </button>
          </section>

          <section>
            <h5><Rocket size={12} /> Releases</h5>
            {latestRelease ? (
              <div className="gh-side-row">
                <span className="branch-tag">{latestRelease.tag_name}</span>
                <span className="gh-side-sub">{timeAgo(latestRelease.created_at)}</span>
              </div>
            ) : <div className="gh-side-sub">No releases yet.</div>}
          </section>

          {ovw && ovw.contributors.length > 0 && (
            <section>
              <h5><Users size={12} /> Contributors</h5>
              <div className="gh-contribs">
                {ovw.contributors.map(c => (
                  <span key={c.id} title={`${c.display_name || c.username} · ${c.commits} commits`}>
                    <Avatar name={c.display_name || c.username} color={c.avatar_color} size={22} />
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h5>Repository status</h5>
            {ovw ? (
              <>
                <div className="gh-side-row"><span className="gh-side-label">Build</span><StatusPill status={ovw.build_status} /></div>
                <div className="gh-side-row"><span className="gh-side-label">Tests</span><StatusPill status={ovw.test_status} /></div>
                <div className="gh-side-row"><span className="gh-side-label">Deployment</span><StatusPill status={ovw.deploy_status} /></div>
              </>
            ) : <div className="gh-side-sub">Status unavailable.</div>}
          </section>

          <button className="gh-side-link gh-side-settings" onClick={() => onNavigate('settings')}>
            <Settings size={11} /> Settings
          </button>
        </aside>
      </div>
    </div>
  );
};
