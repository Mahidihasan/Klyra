import React from 'react';
import {
  Folder, File, FileCode, FileCode2, FileText, GitBranch, Tag, History, ChevronDown, Copy,
  Search, BookOpen, Users, Cpu, Rocket, Settings, Store, Download, Braces, Database, Image,
  ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { gitApi, apiDetectApi, reposApi, gitRemoteUrl } from '../../services/api/repos';
import { RepoDetail, TreeEntry, RepoTab, Detection, Overview, CommitInfo } from '../../types/repos';
import { Avatar, CloneBox, EmptyState, ErrorBox, HighlightedCode, Loading, MiniMarkdown, StatusPill, timeAgo } from './shared';

// ============================ CODE (GitHub-style workspace) ============================
// The repository IS the page: toolbar → latest commit → file list → README.
// API / deployment info lives in a compact secondary sidebar.

export const CodePage: React.FC<{ repo: RepoDetail; onNavigate: (t: RepoTab) => void }> = ({ repo, onNavigate }) => {
  // Deep-link support: #/repo/<id>/tree/<path> | #/repo/<id>/blob/<path>
  const initialHash = React.useMemo(() => {
    const m = window.location.hash.match(new RegExp(`^#/repo/${repo.id}/(tree|blob)/?(.*)$`));
    return m ? { kind: m[1] as 'tree' | 'blob', path: decodeURIComponent(m[2] || '') } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ref, setRef] = React.useState(repo.default_branch);
  const [path, setPath] = React.useState(initialHash?.path ?? '');
  const [tree, setTree] = React.useState<TreeEntry[]>([]);
  const [file, setFile] = React.useState<{ content: string; history: any[] } | null>(null);
  const [blobPending, setBlobPending] = React.useState(initialHash?.kind === 'blob');
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

  // ---------- Branch directory slider (blob view) ----------
  const [flatTree, setFlatTree] = React.useState<TreeEntry[]>([]);
  const [flatRef, setFlatRef] = React.useState('');
  const [sliderOpen, setSliderOpen] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const loadTree = React.useCallback(async (r: string, p: string) => {
    setLoading(true); setError('');
    try { const res = await gitApi.tree(repo.id, r, p); setTree(res.entries || []); if (!p && res.latest_commit) setLatest(res.latest_commit); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  // The file table is the continuous code browser: it only fetches the tree for
  // the current directory while no blob is open. Entering folders, files and
  // breadcrumbs all mutate the same path/file state — never a separate page.
  React.useEffect(() => {
    if (file || blobPending) return;
    loadTree(ref, path);
  }, [ref, path, file, blobPending, loadTree]);

  // Switching branches exits any open blob view and returns to the repo root.
  React.useEffect(() => { setFile(null); setBlobPending(false); setPath(''); setFolder(''); setFilter(''); }, [ref]);

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

  const [folder, setFolder] = React.useState('');

  // ---------- URL state (deep links, browser back/forward) ----------
  // Routes: #/repo/<id>/tree/<path>  |  #/repo/<id>/blob/<path>
  // The whole app is a state-based SPA without a router, so hash-based URLs
  // via history.pushState keep navigation predictable without a new routing system.
  React.useEffect(() => {
    const inBlob = !!file || blobPending;
    const next = `#/repo/${repo.id}${inBlob ? `/blob/${encodeURIComponent(path)}` : path ? `/tree/${encodeURIComponent(path)}` : ''}`;
    if (window.location.hash !== next) window.history.pushState(null, '', next);
  }, [repo.id, file, blobPending, path]);

  const openFile = async (fp: string) => {
    setLoading(true); setError(''); setBlobPending(false);
    try { const f = await gitApi.file(repo.id, ref, fp); setFile({ content: f.content, history: f.history }); setPath(fp); }
    catch (e: any) { setError(e.message); setBlobPending(false); }
    finally { setLoading(false); }
  };

  // Deep link into a blob URL (refresh / shared link): fetch the file on mount.
  React.useEffect(() => {
    if (initialHash?.kind === 'blob' && initialHash.path) openFile(initialHash.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the full recursive branch tree when the blob view opens (per ref).
  React.useEffect(() => {
    if (!(file || blobPending) || flatRef === ref) return;
    setFlatRef(ref);
    gitApi.tree(repo.id, ref, '', true)
      .then(res => setFlatTree(res.entries || []))
      .catch(() => setFlatTree([]));
  }, [file, blobPending, ref, flatRef, repo.id]);

  // Auto-expand the ancestor folders of the file being viewed.
  React.useEffect(() => {
    if (!file || !path) return;
    const segs = path.split('/');
    setExpanded(prev => {
      const next = new Set(prev);
      for (let i = 1; i < segs.length; i++) next.add(segs.slice(0, i).join('/'));
      return next;
    });
  }, [file, path]);

  // React to browser back/forward: resolve the URL back into browsing state.
  React.useEffect(() => {
    const applyHash = () => {
      const m = window.location.hash.match(new RegExp(`^#/repo/${repo.id}/(tree|blob)/?(.*)$`));
      if (!m) return;
      const kind = m[1];
      const p = decodeURIComponent(m[2] || '');
      if (kind === 'tree') { setFile(null); setBlobPending(false); setFilter(''); setFolder(p); setPath(p); }
      else { setBlobPending(true); setPath(p); openFile(p); }
    };
    window.addEventListener('popstate', applyHash);
    window.addEventListener('hashchange', applyHash);
    return () => { window.removeEventListener('popstate', applyHash); window.removeEventListener('hashchange', applyHash); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id]);

  // Return to the folder the file lives in (or the repo root), like GitHub's blob view.
  const backToFolder = (target?: string) => {
    setFile(null); setError(''); setFilter('');
    setPath(target ?? folder);
  };

  const openPath = (p: string) => { setFilter(''); setFolder(path ? `${path}/${p}` : p); setPath(path ? `${path}/${p}` : p); };

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

  // GitHub-style file-type icons — shared with the tree slider (fileIconOf below).
  const fileIcon = (name: string) => fileIconOf(name);

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
            <div className="gh-blob-layout">
              {/* collapsible branch directory slider */}
              {sliderOpen ? (
                <aside className="gh-tree-slider">
                  <div className="gh-tree-head">
                    <button className="gh-tree-toggle" onClick={() => setSliderOpen(false)} title="Hide directory tree">
                      <PanelLeftClose size={13} />
                    </button>
                    <span className="gh-tree-title">Files</span>
                    <span className="branch-tag">{ref}</span>
                  </div>
                  <div className="gh-tree-body">
                    <TreePanel
                      entries={flatTree}
                      expanded={expanded}
                      activePath={path}
                      onToggle={p => setExpanded(prev => {
                        const next = new Set(prev);
                        if (next.has(p)) next.delete(p); else next.add(p);
                        return next;
                      })}
                      onOpen={fp => openFile(fp)}
                    />
                  </div>
                </aside>
              ) : (
                <button className="gh-tree-rail" onClick={() => setSliderOpen(true)} title="Show directory tree">
                  <PanelLeftOpen size={15} />
                </button>
              )}

              <div className="gh-blob-main">
              <div className="gh-file-head">
                <button className="kr-btn" onClick={() => backToFolder()}>Back to files</button>
                <span className="gh-file-path">
                  <span className="gh-crumb" onClick={() => backToFolder('')}>{repo.name}</span>
                  {path.split('/').map((seg, i, arr) => (
                    <span key={i} className="gh-crumb-sep">/
                      {i === arr.length - 1
                        ? <b>{seg}</b>
                        : <button className="gh-crumb" onClick={() => backToFolder(arr.slice(0, i + 1).join('/'))}>{seg}</button>}
                    </span>
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
              </div>
            </div>
          ) : (
            <>

              {/* latest commit row */}
              {latest && (
                <div className="gh-latest-commit">
                  <Avatar name={latest.author} size={22} />
                  <b>{latest.author}</b>
                  <span className="gh-latest-msg" onClick={() => onNavigate('commits')}>{latest.message}</span>
                  <span className="sha-chip" onClick={() => onNavigate('commits')}>{latest.sha.slice(0, 7)}</span>
                  <span className="gh-latest-time" onClick={() => onNavigate('commits')}>{timeAgo(latest.date)}</span>
                  <button className="gh-commit-count" onClick={() => onNavigate('commits')} title="View all commits">
                  <History size={14} /> <b>{ovw?.commit_count ?? '—'}</b> commits
                </button>
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
                    <Folder size={15} style={{ color: '#539bf5' }} />
                    <span className="gh-row-name">{t.path}</span>
                    <span className="gh-row-commit">{t.last_commit_message || 'Folder'}</span>
                    <span className="gh-row-time">{t.last_updated ? timeAgo(t.last_updated) : ''}</span>
                  </div>
                ))}
                {files.map(t => {
                  const { icon: Icon, color } = fileIcon(t.path);
                  const fullPath = path ? `${path}/${t.path}` : t.path;
                  return (
                    <div key={t.path} className="gh-row" onClick={() => openFile(fullPath)}>
                      <Icon size={15} style={{ color }} />
                      <span className="gh-row-name">{t.path}</span>
                      <span className="gh-row-commit">{t.last_commit_message || (t.size ? `${t.size.toLocaleString()} B` : 'File')}</span>
                      <span className="gh-row-time">{t.last_updated ? timeAgo(t.last_updated) : ''}</span>
                    </div>
                  );
                })}
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
            <div className='gh-about-settings'>
              <h3>About</h3>
              <button className="gh-side-link gh-side-settings" onClick={() => onNavigate('settings')}>
                <Settings size={16} />
              </button>

            </div>            
            <p className="gh-about-desc">{repo.description || 'No description.'}</p>
            <div className="gh-side-row">{repo.license} license</div>
          </section>

          <section>
            <h3><Cpu size={12} /> API</h3>
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
            <h3><Rocket size={12} /> Releases</h3>
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
          
        </aside>
      </div>
    </div>
  );
};

// ============================ BRANCH DIRECTORY SLIDER ============================
// Collapsible recursive tree of the entire branch, shown beside the code viewer.

interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children: TreeNode[];
}

function buildTreeModel(entries: TreeEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'tree', children: [] };
  for (const e of entries) {
    const segs = e.path.split('/');
    let node = root;
    for (let i = 0; i < segs.length; i++) {
      const p = segs.slice(0, i + 1).join('/');
      const isLeaf = i === segs.length - 1;
      let child = node.children.find(c => c.path === p);
      if (!child) {
        child = { name: segs[i], path: p, type: isLeaf ? e.type : 'tree', children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'tree' ? -1 : 1));
    nodes.forEach(n => sort(n.children));
    return nodes;
  };
  return sort(root.children);
}

const TreePanel: React.FC<{
  entries: TreeEntry[];
  expanded: Set<string>;
  activePath: string;
  onToggle: (p: string) => void;
  onOpen: (p: string) => void;
}> = ({ entries, expanded, activePath, onToggle, onOpen }) => {
  const model = React.useMemo(() => buildTreeModel(entries), [entries]);

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map(n => {
      if (n.type === 'tree') {
        const open = expanded.has(n.path);
        return (
          <React.Fragment key={n.path}>
            <button
              className="gh-tree-row"
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => onToggle(n.path)}
            >
              <ChevronRight size={12} className={`gh-tree-chev ${open ? 'open' : ''}`} />
              <Folder size={13} style={{ color: '#539bf5' }} />
              <span className="gh-tree-name">{n.name}</span>
            </button>
            {open && renderNodes(n.children, depth + 1)}
          </React.Fragment>
        );
      }
      const { icon: Icon, color } = fileIconOf(n.name);
      return (
        <button
          key={n.path}
          className={`gh-tree-row ${activePath === n.path ? 'active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onOpen(n.path)}
        >
          <span className="gh-tree-chev-spacer" />
          <Icon size={13} style={{ color }} />
          <span className="gh-tree-name">{n.name}</span>
        </button>
      );
    });

  if (entries.length === 0) return <div className="gh-tree-empty">No files on this branch.</div>;
  return <div className="gh-tree">{renderNodes(model, 0)}</div>;
};

// Shared with the file table icon helper (declared inside CodePage); tree needs
// its own copy since it renders outside the component.
function fileIconOf(name: string): { icon: any; color: string } {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (ext === '.md' || ext === '.txt') return { icon: FileText, color: '#539bf5' };
  if (ext === '.json' || ext === '.yaml' || ext === '.yml') return { icon: Braces, color: '#d4a72c' };
  if (ext === '.ts' || ext === '.tsx') return { icon: FileCode2, color: '#539bf5' };
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs') return { icon: FileCode2, color: '#d4a72c' };
  if (ext === '.css' || ext === '.scss') return { icon: FileCode, color: '#96d0ff' };
  if (ext === '.html') return { icon: FileCode, color: '#f47067' };
  if (ext === '.py') return { icon: FileCode2, color: '#57ab5a' };
  if (ext === '.sql') return { icon: Database, color: '#dcbdfb' };
  if (ext === '.png' || ext === '.jpg' || ext === '.svg' || ext === '.ico') return { icon: Image, color: '#6cb6ff' };
  return { icon: File, color: 'var(--text-muted)' };
}
