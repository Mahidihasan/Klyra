import React from 'react';
import {
  GitBranch, Tag, History, ChevronDown, Copy, Search, BookOpen, Users, Store, Settings, Cpu, Rocket,
} from 'lucide-react';
import { gitApi, apiDetectApi, reposApi, gitRemoteUrl } from '../../services/api/repos';
import { RepoDetail, TreeEntry, RepoTab, Detection, Overview, CommitInfo } from '../../types/repos';
import { Avatar, CloneBox, ErrorBox, Loading, MiniMarkdown, timeAgo } from './shared';
import { RepoFileTree } from './components/RepoFileTree';
import { RepoBreadcrumb } from './components/RepoBreadcrumb';
import { RepoDirectoryList } from './components/RepoDirectoryList';
import { RepoFileHeader } from './components/RepoFileHeader';
import { RepoCodeViewer } from './components/RepoCodeViewer';

// ============================ CODE (GitHub-style repository workspace) ============================
// Root View: Main root file table + README.md + Right About sidebar
// Code / Directory View: Left persistent file tree + Right main content (Breadcrumbs → Code viewer / Subfolder table)

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
  const [flatTree, setFlatTree] = React.useState<TreeEntry[]>([]);
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

  // Responsive / collapsible left directory panel
  const [treeCollapsed, setTreeCollapsed] = React.useState(false);

  // Fetch single folder tree (for directory list)
  const loadTree = React.useCallback(async (r: string, p: string) => {
    setLoading(true); setError('');
    try {
      const res = await gitApi.tree(repo.id, r, p);
      setTree(res.entries || []);
      if (!p && res.latest_commit) setLatest(res.latest_commit);
    }
    catch (e: any) { setError(e.message || 'Failed to load directory'); }
    finally { setLoading(false); }
  }, [repo.id]);

  // Fetch full recursive branch tree (for persistent left tree panel)
  const loadFlatTree = React.useCallback(async (r: string) => {
    try {
      const res = await gitApi.tree(repo.id, r, '', true);
      setFlatTree(res.entries || []);
    } catch {
      setFlatTree([]);
    }
  }, [repo.id]);

  // Load recursive tree on branch change
  React.useEffect(() => {
    loadFlatTree(ref);
  }, [ref, loadFlatTree]);

  // Fetch tree for directory when not viewing a file
  React.useEffect(() => {
    if (file || blobPending) return;
    loadTree(ref, path);
  }, [ref, path, file, blobPending, loadTree]);

  // Switching branch exits file view and resets path to root
  React.useEffect(() => {
    setFile(null);
    setBlobPending(false);
    setPath('');
    setFilter('');
  }, [ref]);

  // One-time context: branches, README, overview, detection
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

  // URL state synchronization (deep links & browser history)
  React.useEffect(() => {
    const inBlob = !!file || blobPending;
    const next = `#/repo/${repo.id}${inBlob ? `/blob/${encodeURIComponent(path)}` : path ? `/tree/${encodeURIComponent(path)}` : ''}`;
    if (window.location.hash !== next) window.history.pushState(null, '', next);
  }, [repo.id, file, blobPending, path]);

  const openFile = async (fp: string) => {
    setLoading(true);
    setError('');
    setBlobPending(false);
    try {
      const f = await gitApi.file(repo.id, ref, fp);
      setFile({ content: f.content, history: f.history || [] });
      setPath(fp);
    }
    catch (e: any) {
      setError(e.message || 'Failed to load file');
      setBlobPending(false);
    }
    finally {
      setLoading(false);
    }
  };

  // Deep link into a blob URL on initial mount
  React.useEffect(() => {
    if (initialHash?.kind === 'blob' && initialHash.path) {
      openFile(initialHash.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser back/forward button popstate handler
  React.useEffect(() => {
    const applyHash = () => {
      const m = window.location.hash.match(new RegExp(`^#/repo/${repo.id}/(tree|blob)/?(.*)$`));
      if (!m) return;
      const kind = m[1];
      const p = decodeURIComponent(m[2] || '');
      if (kind === 'tree') {
        setFile(null);
        setBlobPending(false);
        setFilter('');
        setPath(p);
      } else {
        setBlobPending(true);
        setPath(p);
        openFile(p);
      }
    };
    window.addEventListener('popstate', applyHash);
    window.addEventListener('hashchange', applyHash);
    return () => {
      window.removeEventListener('popstate', applyHash);
      window.removeEventListener('hashchange', applyHash);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id]);

  const openFolder = (folderPath: string) => {
    setFile(null);
    setBlobPending(false);
    setError('');
    setFilter('');
    setPath(folderPath);
  };

  const backToParentFolder = () => {
    if (!path) return;
    const segs = path.split('/').filter(Boolean);
    if (segs.length <= 1) {
      openFolder('');
    } else {
      openFolder(segs.slice(0, segs.length - 1).join('/'));
    }
  };

  const moreItems: { id: RepoTab; label: string; icon: any }[] = [
    { id: 'branches', label: 'Branches', icon: GitBranch },
    { id: 'releases', label: 'Tags & releases', icon: Tag },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
    { id: 'collaborators', label: 'Collaborators', icon: Users },
    { id: 'marketplace', label: 'Marketplace', icon: Store },
  ];

  const endpointCount = detection?.endpoints?.length ?? ovw?.endpoint_count ?? null;
  const isRootView = !path && !file;

  return (
    <div className="codepage repo-code-page">
      {/* ---------- Repository Toolbar ---------- */}
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
          <button type="button" className="gh-toolbar-link" onClick={() => onNavigate('branches')}>
            <GitBranch size={13} /> <b>{branches.length || repo.branches?.length || 0}</b> branches
          </button>
          <button type="button" className="gh-toolbar-link" onClick={() => onNavigate('releases')}>
            <Tag size={13} /> <b>{tagCount ?? '—'}</b> tags
          </button>
        </div>

        <div className="gh-toolbar-right">
          <div className="gh-find">
            <Search size={12} />
            <input
              placeholder="Filter files…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          <div className="ovw-popwrap">
            <button type="button" className="kr-btn" onClick={() => { setShowClone(v => !v); setShowMore(false); }}>
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
            <button type="button" className="kr-btn" onClick={() => { setShowMore(v => !v); setShowClone(false); }}>
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

      {/* ---------- Main Layout ---------- */}
      {isRootView ? (
        /* ---------- ROOT VIEW: Root Files Table + README on Left | About Sidebar on Right ---------- */
        <div className="gh-layout">
          <div className="gh-main">
            {/* Latest Commit Bar */}
            {latest && (
              <div className="gh-latest-commit">
                <Avatar name={latest.author} size={22} />
                <b>{latest.author}</b>
                <span className="gh-latest-msg" onClick={() => onNavigate('commits')}>
                  {latest.message}
                </span>
                <span className="sha-chip" onClick={() => onNavigate('commits')}>
                  {latest.sha.slice(0, 7)}
                </span>
                <span className="gh-latest-time" onClick={() => onNavigate('commits')}>
                  {timeAgo(latest.date)}
                </span>
                <button
                  type="button"
                  className="gh-commit-count"
                  onClick={() => onNavigate('commits')}
                  title="View all commits"
                >
                  <History size={14} /> <b>{ovw?.commit_count ?? '—'}</b> commits
                </button>
              </div>
            )}

            {/* Root Files Table */}
            <RepoDirectoryList
              entries={tree}
              currentPath=""
              onOpenFolder={openFolder}
              onOpenFile={openFile}
              loading={loading}
              error={error}
              filter={filter}
              onRetry={() => loadTree(ref, '')}
            />

            {/* README Preview at bottom of Root View */}
            {readme && (
              <div className="gh-readme">
                <header>
                  <BookOpen size={13} /> {readme.name}
                </header>
                <MiniMarkdown source={readme.content} />
              </div>
            )}
          </div>

          {/* Right About Sidebar (Visible on Root View) */}
          <aside className="gh-side">
            <section>
              <div className="gh-about-settings">
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
      ) : (
        /* ---------- DEEP FOLDER / CODE VIEW: Persistent Left Tree + Main Code/Folder Content ---------- */
        <div className={`repo-code-layout ${treeCollapsed ? 'tree-collapsed' : ''}`}>
          {/* Persistent Left File Tree */}
          <RepoFileTree
            entries={flatTree}
            activePath={path}
            currentRef={ref}
            onSelectFile={openFile}
            onSelectFolder={openFolder}
            onSelectRoot={() => openFolder('')}
            filter={filter}
            onFilterChange={setFilter}
            isCollapsed={treeCollapsed}
            onToggleCollapse={() => setTreeCollapsed(v => !v)}
          />

          {/* Main Content Area (Breadcrumb + Code Viewer / Directory Listing) */}
          <main className="repo-code-main">
            {/* Breadcrumb Navigation Bar */}
            <RepoBreadcrumb
              repoName={repo.name}
              path={path}
              isFile={Boolean(file)}
              onNavigateFolder={openFolder}
              onBackToFiles={backToParentFolder}
            />

            {file ? (
              /* File Viewer Experience */
              <div className="repo-blob-container">
                <RepoFileHeader
                  filePath={path}
                  content={file.content}
                  onCopy={() => {
                    navigator.clipboard?.writeText(file.content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  onRaw={() => {
                    const blob = new Blob([file.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = path.split('/').pop() || 'file.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  copied={copied}
                />
                <RepoCodeViewer content={file.content} history={file.history} />
              </div>
            ) : (
              /* Subfolder Directory Listing Experience */
              <div className="repo-folder-container">
                <RepoDirectoryList
                  entries={tree}
                  currentPath={path}
                  onOpenFolder={openFolder}
                  onOpenFile={openFile}
                  loading={loading}
                  error={error}
                  filter={filter}
                  onRetry={() => loadTree(ref, path)}
                />

                {/* Subfolder README Preview (if available) */}
                {readme && tree.some(t => t.path.toLowerCase() === 'readme.md') && (
                  <div className="gh-readme">
                    <header>
                      <BookOpen size={13} /> {readme.name}
                    </header>
                    <MiniMarkdown source={readme.content} />
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};
