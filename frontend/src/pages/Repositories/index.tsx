import React from 'react';
import {
  Plus, Lock, Globe, GitBranch, BookOpen, Download, ArrowLeft, Search, Pin, Cpu, Filter,
} from 'lucide-react';
import { authApi, reposApi } from '../../services/api/repos';
import { KlyraUser, RepoSummary } from '../../types/repos';
import { Avatar, EmptyState, ErrorBox, Loading, Modal, timeAgo } from './shared';
import { RepoDetail } from './RepoDetail';
import './repos.css';

const developmentUser: KlyraUser = {
  id: 0,
  username: 'development',
  email: null,
  display_name: 'Development Access',
  avatar_color: '#8b5cf6',
};

type RepoFilter = 'all' | 'owned' | 'collaborating' | 'public' | 'private';

const isOwned = (r: RepoSummary, u: KlyraUser | null) => !!u && r.owner_username === u.username;

const withinPeriod = (iso: string, period: string) => {
  if (period === 'any') return true;
  const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
  return Date.now() - new Date(iso).getTime() <= days * 86400000;
};

const loadPinned = (): string[] => {
  try { return JSON.parse(localStorage.getItem('klyra_pinned_repos') || '[]'); } catch { return []; }
};

export const RepositoriesPage: React.FC<{ onBackToKlyra?: () => void }> = ({ onBackToKlyra }) => {
  const [user, setUser] = React.useState<KlyraUser | null>(() => {
    if (import.meta.env.DEV) return developmentUser;
    try { return JSON.parse(localStorage.getItem('klyra_user') || 'null'); } catch { return null; }
  });
  const [repos, setRepos] = React.useState<RepoSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // hub state
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<RepoFilter>('all');
  const [lang, setLang] = React.useState('any');
  const [status, setStatus] = React.useState('any');
  const [updated, setUpdated] = React.useState('any');
  const [sort, setSort] = React.useState('updated');
  const [pinned, setPinned] = React.useState<string[]>(loadPinned);
  const [showFilters, setShowFilters] = React.useState(false);
  const [heatMetric, setHeatMetric] = React.useState<'commits' | 'prs' | 'deployments'>('commits');
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = React.useState('personal');

  // "/" focuses the search bar, like GitHub
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadRepos = React.useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      setRepos(await reposApi.list());
    }
    catch (e: any) { setError(e.message || 'Failed to load repositories'); }
    finally { setLoading(false); }
  }, [user]);

  React.useEffect(() => { if (user) loadRepos(); }, [user, loadRepos]);

  const handleAuthed = (u: KlyraUser, token: string) => {
    localStorage.setItem('klyra_token', token);
    localStorage.setItem('klyra_user', JSON.stringify(u));
    setUser(u);
  };

  const togglePin = (id: string) => {
    setPinned(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem('klyra_pinned_repos', JSON.stringify(next));
      return next;
    });
  };

  // derived filter pipeline
  const languages = React.useMemo(() => Array.from(new Set(repos.map(r => r.language).filter(Boolean))).sort(), [repos]);
  const statuses = React.useMemo(() => Array.from(new Set(repos.map(r => r.deploy_status).filter(Boolean))), [repos]);

  const visible = React.useMemo(() => {
    let list = repos.filter(r => {
      if (query && !(`${r.owner_username}/${r.name} ${r.description}`.toLowerCase().includes(query.toLowerCase()))) return false;
      if (filter === 'owned' && !isOwned(r, user)) return false;
      if (filter === 'collaborating' && isOwned(r, user)) return false;
      if (filter === 'public' && r.visibility !== 'public') return false;
      if (filter === 'private' && r.visibility !== 'private') return false;
      if (lang !== 'any' && r.language !== lang) return false;
      if (status !== 'any' && r.deploy_status !== status) return false;
      if (!withinPeriod(r.updated_at, updated)) return false;
      return true;
    });
    list = [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'members' ? b.member_count - a.member_count
      : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [repos, query, filter, lang, status, updated, sort, user]);

  const pinnedRepos = pinned
    .map(id => repos.find(r => r.id === id))
    .filter((r): r is RepoSummary => !!r);

  const activeFilterCount =
    (filter !== 'all' ? 1 : 0) + (lang !== 'any' ? 1 : 0) + (status !== 'any' ? 1 : 0) + (updated !== 'any' ? 1 : 0) + (sort !== 'updated' ? 1 : 0);
  const filtersActive = activeFilterCount > 0;

  if (selectedId) {
    return <RepoDetail repoId={selectedId} onBack={() => { setSelectedId(null); loadRepos(); }} />;
  }

  return (
    <div className="repos-page">
      <div className="repos-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onBackToKlyra && (
            <button className="repos-back-btn" onClick={onBackToKlyra} title="Back to Klyra">
              <ArrowLeft size={15} />
            </button>
          )}
          <div className="repos-title"><BookOpen size={20} /> API Repositories</div>
        </div>
        <div className="hub-search">
          <Search size={15} />
          <input
            ref={searchRef}
            placeholder="Search repositories…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="auth-bar">
          {user ? (
            <>
              <span className="auth-chip"><Avatar name={user.display_name || user.username} color={user.avatar_color} />{user.username}</span>
              <button className="kr-btn primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Repository</button>
            </>
          ) : (
            <AuthPanel onAuthed={handleAuthed} />
          )}
        </div>
      </div>

      {!user && (
        <EmptyState title="Sign in to manage repositories" hint="Create a Klyra developer account or log in to host your API projects." />
      )}

      {user && (
        <>
          {loading && <Loading label="Loading repositories…" />}
          {error && <ErrorBox message={error} onRetry={loadRepos} />}

          {!loading && !error && repos.length === 0 && (
            <EmptyState title="No repositories yet" hint="Create your first API repository or import an existing Git project.">
              <button className="kr-btn primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New Repository</button>
            </EmptyState>
          )}
        </>
      )}

      {user && !loading && !error && repos.length > 0 && (
        <>
          {/* Pinned */}
          {pinnedRepos.length > 0 && (
            <section className="hub-section">
              <div className="repo-grid">
                {pinnedRepos.map(r => (
                  <div key={r.id} className="repo-card pinned" onClick={() => setSelectedId(r.id)}>
                    <button
                      className="repo-pin-btn on"
                      title="Unpin"
                      onClick={(e) => { e.stopPropagation(); togglePin(r.id); }}
                    ><Pin size={12} /></button>
                    <RepoCardBody r={r} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Controls + all repositories */}
          <section className="hub-section">
            <div className="hub-controls">
              <h3 className="hub-h3" style={{ margin: 0 }}>{visible.length} repositor{visible.length === 1 ? 'y' : 'ies'}</h3>
              <div className="ovw-popwrap">
                <button
                  className={`filter_btn hub-filter-btn ${filtersActive ? 'active' : ''}`}
                  onClick={() => setShowFilters(v => !v)}
                  title="Filter repositories"
                ><Filter size={13} /> Filters {filtersActive ? `(${activeFilterCount})` : ''}</button>
                {showFilters && (
                  <div className="ovw-pop hub-filter-pop" onClick={e => e.stopPropagation()}>
                    <div className="ovw-pop-title">Filter repositories</div>
                    <div className="hub-filters" style={{ marginBottom: 10 }}>
                      {(['all', 'owned', 'collaborating', 'public', 'private'] as RepoFilter[]).map(f => (
                        <button
                          key={f}
                          className={`hub-filter-chip ${filter === f ? 'active' : ''}`}
                          onClick={() => setFilter(f)}
                        >{f[0].toUpperCase() + f.slice(1)}</button>
                      ))}
                    </div>
                    <label className="hub-pop-label">Language</label>
                    <select className="kr-select" value={lang} onChange={e => setLang(e.target.value)}>
                      <option value="any">Any language</option>
                      {languages.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <label className="hub-pop-label">Status</label>
                    <select className="kr-select" value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="any">Any status</option>
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <label className="hub-pop-label">Last updated</label>
                    <select className="kr-select" value={updated} onChange={e => setUpdated(e.target.value)}>
                      <option value="any">Any time</option>
                      <option value="24h">Last 24 hours</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                    </select>
                    <label className="hub-pop-label">Sort by</label>
                    <select className="kr-select" value={sort} onChange={e => setSort(e.target.value)}>
                      <option value="updated">Last updated</option>
                      <option value="name">Name</option>
                      <option value="members">Members</option>
                    </select>
                    {filtersActive && (
                      <button
                        className="hub-clear-btn"
                        onClick={() => { setFilter('all'); setLang('any'); setStatus('any'); setUpdated('any'); setSort('updated'); }}
                      >Clear all filters</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState title="No repositories match your filters" hint="Try clearing the search or filters." />
            ) : (
              <div className="repo-grid">
                {visible.map(r => (
                  <div key={r.id} className="repo-card" onClick={() => setSelectedId(r.id)}>
                    <button
                      className={`repo-pin-btn ${pinned.includes(r.id) ? 'on' : ''}`}
                      title={pinned.includes(r.id) ? 'Unpin' : 'Pin'}
                      onClick={(e) => { e.stopPropagation(); togglePin(r.id); }}
                    ><Pin size={12} /></button>
                    <RepoCardBody r={r} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {user && !loading && !error && repos.length > 0 && (
        <section className="hub-section">
          <div className="hub-heatmap">
            <div className="hub-heatmap-head">
              <h3 className="hub-h3"><Cpu size={13} /> Repository activity · 12 months</h3>
              <div className="hub-heat-switch">
                {(['commits', 'prs', 'deployments'] as const).map(m => (
                  <button key={m} className={heatMetric === m ? 'active' : ''} onClick={() => setHeatMetric(m)}>{m}</button>
                ))}
              </div>
            </div>
            <ActivityHeatmap metric={heatMetric} />
          </div>
        </section>
      )}

      {showCreate && user && (
        <CreateRepoModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); setSelectedId(id); }}
        />
      )}
    </div>
  );
};

// ---------- shared repo card body ----------
const RepoCardBody: React.FC<{ r: RepoSummary }> = ({ r }) => (
  <>
    <div className="repo-card-name">
      {r.name}
      <span className={`vis-badge ${r.visibility}`}>
        {r.visibility === 'public' ? <Globe size={11} style={{ marginRight: 4 }} /> : <Lock size={11} style={{ marginRight: 4 }} />}
        {r.visibility}
      </span>
    </div>
    <div className="repo-card-desc">{r.description || 'No description'}</div>
    <div className="repo-card-meta">
      <span><span className="lang-dot" />{r.language || '—'}</span>
      {r.framework && <span>{r.framework}</span>}
      <span><GitBranch size={11} style={{ marginRight: 3 }} />{r.member_count} member{r.member_count === 1 ? '' : 's'}</span>
      <span style={{ marginLeft: 'auto' }}>Updated {timeAgo(r.updated_at)}</span>
    </div>
  </>
);

// ---------- 12-month activity heatmap (GitHub-style 53 weeks x 7 days) ----------
const ActivityHeatmap: React.FC<{ metric: 'commits' | 'prs' | 'deployments' }> = ({ metric }) => {
  const counts = React.useMemo(() => {
    const grid: Record<string, number> = {};
    const now = new Date();
    for (let d = 0; d < 365; d++) {
      const day = new Date(now.getTime() - d * 86400000);
      // deterministic pseudo-activity per day: busier weekdays, decays into the past
      const seed = (day.getFullYear() * 372 + day.getMonth() * 31 + day.getDate()) % 97;
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const base = weekend ? 0.3 : 1;
      const recency = d < 90 ? 1 : d < 180 ? 0.6 : 0.35;
      const n = Math.floor(seed * base * recency / 12);
      grid[day.toISOString().slice(0, 10)] =
        metric === 'commits' ? n : metric === 'prs' ? Math.floor(n / 4) : Math.floor(n / 10);
    }
    return grid;
  }, [metric]);

  const weeks = React.useMemo(() => {
    const cols: (string | null)[][] = [];
    const today = new Date();
    const start = new Date(today.getTime() - 364 * 86400000);
    for (let w = 0; w < 53; w++) {
      const col: (string | null)[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const day = new Date(start.getTime() + (w * 7 + dow) * 86400000);
        col.push(day > today ? null : day.toISOString().slice(0, 10));
      }
      cols.push(col);
    }
    return cols;
  }, []);

  const max = Math.max(1, ...Object.values(counts));
  const level = (n: number) => n === 0 ? 0 : n < max * 0.25 ? 1 : n < max * 0.5 ? 2 : n < max * 0.75 ? 3 : 4;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(counts).filter(n => n > 0).length;

  // month labels: shown on the week column where a new month starts
  const monthLabels = React.useMemo(() => {
    const labels: { week: number; name: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((col, w) => {
      const first = col.find(Boolean);
      if (!first) return;
      const m = new Date(`${first}T00:00:00`).getMonth();
      if (m !== lastMonth) { labels.push({ week: w, name: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m] }); lastMonth = m; }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="hub-heatmap-wrap">
      <div className="hub-heatmap-stats">
        <b>{total.toLocaleString()}</b> {metric} in the last year
        <span className="hub-heat-dot">·</span>
        active on <b>{activeDays}</b> of 365 days
      </div>
      <div className="hub-heatmap-scroll">
        <div className="hub-heatmap-inner">
          <div className="hub-heatmap-months">
            {weeks.map((_, w) => {
              const lbl = monthLabels.find(l => l.week === w);
              return <span key={w}>{lbl ? lbl.name : ''}</span>;
            })}
          </div>
          <div className="hub-heatmap-body">
            <div className="hub-heatmap-days">
              <span>Mon</span><span>Wed</span><span>Fri</span>
            </div>
            <div className="hub-heatmap-grid">
              {weeks.map((col, wi) => (
                <div key={wi} className="hub-heatmap-col">
                  {col.map((day, di) => (
                    <span
                      key={di}
                      className={`hub-heat-cell l${day ? level(counts[day] || 0) : 'x'}`}
                      title={day ? `${counts[day] || 0} ${metric} on ${new Date(`${day}T00:00:00`).toDateString()}` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="hub-heatmap-legend">
        <span>Less</span>
        <span className="hub-heat-cell l0" /><span className="hub-heat-cell l1" />
        <span className="hub-heat-cell l2" /><span className="hub-heat-cell l3" />
        <span className="hub-heat-cell l4" />
        <span>More</span>
      </div>
    </div>
  );
};


// ---------- inline auth ----------
const AuthPanel: React.FC<{ onAuthed: (u: KlyraUser, token: string) => void }> = ({ onAuthed }) => {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = mode === 'login'
        ? await authApi.login(username, password)
        : await authApi.register(username, password);
      onAuthed(res.user, res.token);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="kr-input" style={{ width: 140 }} placeholder="Username" value={username}
        onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      <input className="kr-input" style={{ width: 160 }} type="password" placeholder="Password (6+ chars)" value={password}
        onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      <button className="kr-btn primary" disabled={busy || !username || !password} onClick={submit}>
        {busy ? '…' : mode === 'login' ? 'Sign in' : 'Register'}
      </button>
      <button className="kr-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Create account' : 'Have an account?'}
      </button>
      {error && <span style={{ color: '#f87171', fontSize: 11 }}>{error}</span>}
    </div>
  );
};

// ---------- create / import modal ----------
const CreateRepoModal: React.FC<{ onClose: () => void; onCreated: (id: string) => void }> = ({ onClose, onCreated }) => {
  const [mode, setMode] = React.useState<'create' | 'import'>('create');
  const [name, setName] = React.useState('');
  const [cloneUrl, setCloneUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState('private');
  const [license, setLicense] = React.useState('MIT');
  const [language, setLanguage] = React.useState('TypeScript');
  const [framework, setFramework] = React.useState('');
  const [branch, setBranch] = React.useState('main');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = mode === 'create'
        ? await reposApi.create({ name, description, visibility, license, language, framework, default_branch: branch })
        : await reposApi.import({ name, clone_url: cloneUrl, description, visibility, default_branch: branch });
      onCreated(res.id);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={mode === 'create' ? 'Create a new repository' : 'Import a Git repository'}
      subtitle={mode === 'create'
        ? 'A real bare Git repository will be provisioned with a protected default branch.'
        : 'All branches and tags will be mirrored from the source repository.'}
      onClose={onClose}
    >
      <div className="tab-switch">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create new</button>
        <button className={mode === 'import' ? 'active' : ''} onClick={() => setMode('import')}>
          <Download size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Import from Git
        </button>
      </div>

      {mode === 'import' && (
        <>
          <label className="kr-label">Clone URL (https:// or ssh://)</label>
          <input className="kr-input" placeholder="https://github.com/user/repo.git" value={cloneUrl} onChange={e => setCloneUrl(e.target.value)} />
        </>
      )}

      <label className="kr-label">Repository name</label>
      <input className="kr-input" placeholder="my-api" value={name} onChange={e => setName(e.target.value)} />

      <label className="kr-label">Description</label>
      <input className="kr-input" placeholder="What does this API do?" value={description} onChange={e => setDescription(e.target.value)} />

      <div className="grid-2">
        <div>
          <label className="kr-label">Visibility</label>
          <select className="kr-select" value={visibility} onChange={e => setVisibility(e.target.value)}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div>
          <label className="kr-label">Default branch</label>
          <input className="kr-input" value={branch} onChange={e => setBranch(e.target.value)} />
        </div>
        {mode === 'create' && (
          <>
            <div>
              <label className="kr-label">License</label>
              <select className="kr-select" value={license} onChange={e => setLicense(e.target.value)}>
                <option>MIT</option><option>Apache-2.0</option><option>GPL-3.0</option><option>BSD-3-Clause</option><option>Proprietary</option>
              </select>
            </div>
            <div>
              <label className="kr-label">Language</label>
              <input className="kr-input" value={language} onChange={e => setLanguage(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="kr-label">Framework (optional)</label>
              <input className="kr-input" placeholder="Express, FastAPI…" value={framework} onChange={e => setFramework(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={busy || !name || (mode === 'import' && !cloneUrl)} onClick={submit}>
          {busy ? 'Working…' : mode === 'create' ? 'Create repository' : 'Import repository'}
        </button>
      </div>
    </Modal>
  );
};
