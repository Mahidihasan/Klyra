import React from 'react';
import { Plus, GitMerge, GitPullRequest, Trash2, GitBranch, CircleDot, CheckCircle2, MessageSquare, Search } from 'lucide-react';
import { pullsApi, issuesApi, collaboratorsApi } from '../../services/api/repos';
import { RepoDetail, PullRequest, PullRequestDetail, Issue, IssueComment, Collaborator } from '../../types/repos';
import { Avatar, DiffView, EmptyState, ErrorBox, Loading, MiniMarkdown, Modal, StatusPill, timeAgo } from './shared';

// ============================ PULL REQUESTS ============================
export const PullsTab: React.FC<{ repo: RepoDetail; canWrite: boolean; canMerge: boolean }> = ({ repo, canWrite, canMerge }) => {
  const [prs, setPrs] = React.useState<PullRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [open, setOpen] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setPrs(await pullsApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading pull requests…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="kr-btn primary" disabled={!canWrite} onClick={() => setShowCreate(true)}><Plus size={14} /> New pull request</button>
      </div>
      {open !== null && <PullRequestView repo={repo} number={open} canMerge={canMerge} onClose={() => { setOpen(null); load(); }} />}
      {open === null && (
        prs.length === 0
          ? <EmptyState title="No pull requests" hint="Feature branches are merged into the protected default branch through pull requests." />
          : prs.map(p => (
            <div key={p.id} className="list-row">
              <div className="list-main">
                <div className="list-title" onClick={() => setOpen(p.number)}>
                  <GitPullRequest size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {p.title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>#{p.number}</span>
                </div>
                <div className="list-sub">
                  {p.source_branch} → {p.target_branch} · opened by {p.author_username} · {timeAgo(p.created_at)}
                </div>
              </div>
              <StatusPill status={p.status} />
            </div>
          ))
      )}
      {showCreate && <CreatePullModal repo={repo} onClose={() => setShowCreate(false)} onCreate={() => { setShowCreate(false); load(); }} />}
    </div>
  );
};
const CreatePullModal: React.FC<{ repo: RepoDetail; onClose: () => void; onCreate: () => void }> = ({ repo, onClose, onCreate }) => {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [source, setSource] = React.useState('');
  const [target, setTarget] = React.useState(repo.default_branch);
  const [error, setError] = React.useState('');

  const submit = async () => {
    setError('');
    try { await pullsApi.create(repo.id, { title, body, source, target }); onCreate(); }
    catch (e: any) { setError(e.message); }
  };

  const branchOptions = (repo.branches || []).map(b => b.name);

  return (
    <Modal title="Open a pull request" subtitle="Changes from the source branch will be reviewed, then merged into the protected target." onClose={onClose}>
      <label className="kr-label">Target branch</label>
      <select className="kr-select" value={target} onChange={e => setTarget(e.target.value)}>
        <option value={repo.default_branch}>{repo.default_branch}</option>
        {branchOptions.filter(b => b !== repo.default_branch).map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <label className="kr-label">Source branch</label>
      <select className="kr-select" value={source} onChange={e => setSource(e.target.value)}>
        <option value="">Select source…</option>
        {branchOptions.filter(b => b !== target).map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <label className="kr-label">Title</label>
      <input className="kr-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Descriptive change summary" />
      <label className="kr-label">Description</label>
      <textarea className="kr-textarea" rows={3} value={body} onChange={e => setBody(e.target.value)} />
      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={!title || !source} onClick={submit}>Create pull request</button>
      </div>
    </Modal>
  );
};
const PullRequestView: React.FC<{ repo: RepoDetail; number: number; canMerge: boolean; onClose: () => void }> = ({ repo, number, canMerge, onClose }) => {
  const [pr, setPr] = React.useState<PullRequestDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [action, setAction] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setPr(await pullsApi.get(repo.id, number)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id, number]);

  React.useEffect(() => { load(); }, [load]);

  const review = async (state: any) => {
    setBusy(state);
    try { await pullsApi.review(repo.id, number, state); await load(); }
    catch (e: any) { setError(e.message); }
    setBusy('');
  };

  const merge = async () => {
    setBusy('merge');
    try {
      const r = await pullsApi.merge(repo.id, number);
      setAction(r.ok ? 'Merged successfully' + (r.merge_sha ? ' as ' + r.merge_sha.slice(0, 7) : '') : 'Merge blocked');
      await load();
    } catch (e: any) { setError(e.message); }
    setBusy('');
  };

  if (loading && !pr) return <Loading label="Loading pull request…" />;
  if (error && !pr) return <ErrorBox message={error} onRetry={load} />;
  if (!pr) return null;

  const approvals = pr.reviews.filter(r => r.state === 'approved').length;
  const changes = pr.reviews.filter(r => r.state === 'changes_requested').length;

  return (
    <div>
      <button className="kr-btn" style={{ marginBottom: 12 }} onClick={onClose}>← Back to pull requests</button>
      <div className="kr-card">
        <h4>{pr.title} <span style={{ color: 'var(--text-muted)' }}>#{pr.number}</span></h4>
        <div className="list-sub">
          {pr.source_branch} → {pr.target_branch} · by {pr.author_username} · {timeAgo(pr.created_at)}
        </div>
        {pr.body && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10 }}>{pr.body}</p>}
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '14px 0', flexWrap: 'wrap' }}>
        <StatusPill status={pr.status} />
        <span className="status-pill accent">{approvals} approval{approvals === 1 ? '' : 's'}</span>
        {changes > 0 && <span className="status-pill failure">{changes} changes requested</span>}
        {pr.status === 'merged' && pr.merged_by_username && <span className="status-pill success">merged by {pr.merged_by_username}</span>}
      </div>

      {pr.status === 'open' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="kr-btn" disabled={!!busy} onClick={() => review('approved')}>Approve</button>
          <button className="kr-btn danger" disabled={!!busy} onClick={() => review('changes_requested')}>Request changes</button>
          <button className="kr-btn" disabled={!!busy} onClick={() => review('commented')}>Comment</button>
          <button className="kr-btn primary" style={{ marginLeft: 'auto' }} disabled={!!busy || !canMerge} onClick={merge}>
            <GitMerge size={14} /> {busy === 'merge' ? 'Merging…' : 'Merge pull request'}
          </button>
        </div>
      )}
      {action && <div className="kr-success">{action}</div>}

      {pr.secret_findings.length > 0 && (
        <div className="secret-banner" style={{ marginBottom: 14 }}>
          <h4>Secret scanning detected potential credentials in this diff</h4>
          {pr.secret_findings.map((s, i) => (
            <div key={i} className="finding-row">
              <span className="finding-kind">{s.kind}</span>
              <span className="finding-file">{s.file}:{s.line}</span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.snippet}</span>
            </div>
          ))}
          <div className="list-sub mt8">These secrets block merging and are never shown in full.</div>
        </div>
      )}

      <div className="kr-card" style={{ marginBottom: 14 }}>
        <h4>Changes</h4>
        <DiffView patch={pr.diff} />
      </div>

      <div className="kr-card" style={{ marginBottom: 14 }}>
        <h4>Reviews ({pr.reviews.length})</h4>
        {pr.reviews.length === 0 && <EmptyState title="No reviews yet" hint="Request review and get an approval to merge." />}
        {pr.reviews.map((r, i) => (
          <div key={i} className="timeline-item">
            <Avatar name={r.reviewer_username} color={r.avatar_color} size={20} />
            <div>
              <span className="t-type">{r.state.replace('_', ' ')}</span> <span>{r.reviewer_username}</span>
              {r.body && <div className="list-sub">{r.body}</div>}
              <div className="t-time">{timeAgo(r.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
// ============================ ISSUES ============================
export const IssuesTab: React.FC<{ repo: RepoDetail; canWrite: boolean }> = ({ repo, canWrite }) => {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [open, setOpen] = React.useState<number | null>(null);
  const [issue, setIssue] = React.useState<(Issue & { comments: IssueComment[] }) | null>(null);
  const [comment, setComment] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const [filter, setFilter] = React.useState<'open' | 'closed'>('open');
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<'newest' | 'oldest' | 'comments'>('newest');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setIssues(await issuesApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const view = async (n: number) => {
    setOpen(n); setIssue(null); setActionError('');
    try { setIssue(await issuesApi.get(repo.id, n)); }
    catch (e: any) { setActionError(e.message); }
  };

  const close = async (n: number, status: string) => {
    setActionError('');
    try { await issuesApi.setStatus(repo.id, n, status === 'open' ? 'closed' : 'open'); await view(n); load(); }
    catch (e: any) { setActionError(e.message); }
  };

  const submitComment = async () => {
    if (!comment.trim() || !issue) return;
    setActionError('');
    try { await issuesApi.comment(repo.id, issue.number, comment); setComment(''); await view(issue.number); load(); }
    catch (e: any) { setActionError(e.message); }
  };

  if (loading) return <Loading label="Loading issues…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  // ---------------- issue detail view ----------------
  if (open !== null) {
    if (!issue) return <Loading label="Loading issue…" />;
    const isOpen = issue.status === 'open';
    return (
      <div>
        <button className="kr-btn" style={{ marginBottom: 12 }} onClick={() => { setOpen(null); setIssue(null); }}>← Back to issues</button>
        {actionError && <div className="kr-error">{actionError}</div>}
        <div className="kr-card">
          <h4>{issue.title} <span style={{ color: 'var(--text-muted)' }}>#{issue.number}</span></h4>
          <div className="issue-meta">
            <span className={'issue-state ' + (isOpen ? 'open' : 'closed')}>
              {isOpen ? <CircleDot size={13} /> : <CheckCircle2 size={13} />}
              {isOpen ? 'Open' : 'Closed'}
            </span>
            <span>
              <strong>{issue.author_username}</strong> opened this issue {timeAgo(issue.created_at)}
              {issue.comments.length > 0 && ' · ' + issue.comments.length + ' comment' + (issue.comments.length === 1 ? '' : 's')}
              {!isOpen && issue.closed_at && ' · closed ' + timeAgo(issue.closed_at)}
            </span>
          </div>
          {issue.body
            ? <div className="issue-body"><MiniMarkdown source={issue.body} /></div>
            : <p className="issue-body-empty">No description provided.</p>}
        </div>
        <div className="kr-card mt16">
          <h4>Comments</h4>
          {issue.comments.length === 0 && <p className="issue-body-empty">No comments yet — start the discussion below.</p>}
          {issue.comments.map((c, i) => (
            <div key={i} className="timeline-item">
              <Avatar name={c.author_username} color={c.avatar_color} size={20} />
              <div>
                <span className="t-type">{c.author_username}</span>
                <span className="t-time">{timeAgo(c.created_at)}</span>
                <div className="comment-body"><MiniMarkdown source={c.body} /></div>
              </div>
            </div>
          ))}
          <div className="mt8" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              className="kr-textarea"
              rows={3}
              placeholder="Leave a comment… (Markdown is supported)"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="kr-btn" onClick={() => close(issue.number, issue.status)}>
                {isOpen ? 'Close issue' : 'Reopen issue'}
              </button>
              <button className="kr-btn primary" disabled={!comment.trim()} onClick={submitComment}>Comment</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
// ---------------- list view ----------------
  const openCount = issues.filter(i => i.status === 'open').length;
  const closedCount = issues.length - openCount;
  const filtered = issues
    .filter(i => i.status === filter)
    .filter(i => !search.trim() || i.title.toLowerCase().includes(search.trim().toLowerCase()) || String(i.number) === search.trim())
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'comments') return (b.comment_count || 0) - (a.comment_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div>
      <div className="issues-toolbar">
        <div className="issue-filter-tabs">
          <button className={'issue-filter-tab' + (filter === 'open' ? ' active' : '')} onClick={() => setFilter('open')}>
            <CircleDot size={13} /> {openCount} Open
          </button>
          <button className={'issue-filter-tab' + (filter === 'closed' ? ' active' : '')} onClick={() => setFilter('closed')}>
            <CheckCircle2 size={13} /> {closedCount} Closed
          </button>
        </div>
        <div className="issue-search">
          <Search size={13} />
          <input
            className="kr-input"
            placeholder="Search issues by title or #number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="kr-select" style={{ width: 140 }} value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="comments">Most commented</option>
        </select>
        <button className="kr-btn primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New issue</button>
      </div>
      {filtered.length === 0 && (
        search.trim()
          ? <EmptyState title="No matching issues" hint={'No ' + filter + ' issues match “' + search + '”. Try a different search.'} />
          : <EmptyState title={'No ' + filter + ' issues'} hint={filter === 'open' ? 'Track bugs and feature requests here — file the first one.' : 'Nothing has been closed yet.'} />
      )}
      {filtered.map(i => (
        <div key={i.id} className="list-row">
          <div className="list-main">
            <div className="list-title" onClick={() => view(i.number)}>
              <span className={'issue-state-sm ' + (i.status === 'open' ? 'open' : 'closed')}>
                {i.status === 'open' ? <CircleDot size={13} /> : <CheckCircle2 size={13} />}
              </span>
              {i.title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>#{i.number}</span>
            </div>
            <div className="list-sub">
              #{i.number} {i.status === 'closed' && i.closed_at ? 'closed ' + timeAgo(i.closed_at) : 'opened ' + timeAgo(i.created_at)} by {i.author_username}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!!i.comment_count && (
              <span className="issue-comments" title={i.comment_count + ' comment' + (i.comment_count === 1 ? '' : 's')}>
                <MessageSquare size={13} /> {i.comment_count}
              </span>
            )}
            <StatusPill status={i.status} />
          </div>
        </div>
      ))}
      {showCreate && <CreateIssueModal repo={repo} onClose={() => setShowCreate(false)} onCreate={() => { setShowCreate(false); load(); }} />}
    </div>
  );
};
const CreateIssueModal: React.FC<{ repo: RepoDetail; onClose: () => void; onCreate: () => void }> = ({ repo, onClose, onCreate }) => {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true); setError('');
    try { await issuesApi.create(repo.id, title.trim(), body.trim()); onCreate(); }
    catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  return (
    <Modal title="New issue" subtitle="Describe the problem or request clearly. Markdown is supported in the description." onClose={onClose}>
      <label className="kr-label">Title</label>
      <input className="kr-input" placeholder="A short, descriptive summary" value={title} onChange={e => setTitle(e.target.value)} />
      <label className="kr-label">Description</label>
      <textarea className="kr-textarea" rows={6} placeholder="Steps to reproduce, expected behaviour, and actual behaviour for bugs — or the motivation and proposed behaviour for feature requests." value={body} onChange={e => setBody(e.target.value)} />
      {error && <div className="kr-error">{error}</div>}
      <div className="modal-actions">
        <button className="kr-btn" onClick={onClose}>Cancel</button>
        <button className="kr-btn primary" disabled={!title.trim() || submitting} onClick={submit}>{submitting ? 'Creating…' : 'Create issue'}</button>
      </div>
    </Modal>
  );
};

// ============================ COLLABORATORS ============================
export const CollaboratorsTab: React.FC<{ repo: RepoDetail; canManage: boolean; onChanged: () => void }> = ({ repo, canManage, onChanged }) => {
  const [rows, setRows] = React.useState<Collaborator[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [role, setRole] = React.useState('developer');
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await collaboratorsApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const add = async () => {
    setMessage(''); setError('');
    try { await collaboratorsApi.add(repo.id, username, role); setUsername(''); setMessage(`Added ${username} as ${role}`); load(); onChanged(); }
    catch (e: any) { setError(e.message); }
  };

  const remove = async (u: string) => {
    if (!window.confirm(`Remove ${u} from this repository?`)) return;
    try { await collaboratorsApi.remove(repo.id, u); setMessage(`Removed ${u}`); load(); onChanged(); }
    catch (e: any) { setError(e.message); }
  };

  if (loading) return <Loading label="Loading collaborators…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      {message && <div className="kr-success">{message}</div>}
      {error && <div className="kr-error">{error}</div>}
      {canManage && (
        <div className="kr-card" style={{ marginBottom: 14 }}>
          <h4>Add a collaborator</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="kr-input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <select className="kr-select" style={{ width: 150 }} value={role} onChange={e => setRole(e.target.value)}>
              <option value="maintainer">Maintainer</option>
              <option value="developer">Developer</option>
              <option value="reviewer">Reviewer</option>
            </select>
            <button className="kr-btn primary" disabled={!username} onClick={add}>Add</button>
          </div>
          <div className="list-sub mt8">The repository owner retains final merge and publish authority.</div>
        </div>
      )}
      {rows.map(r => (
        <div key={r.user_id} className="list-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={r.display_name || r.username} color={r.avatar_color} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.display_name || r.username}</div>
              <div className="list-sub">@{r.username}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={"role-badge " + r.role}>{r.role}</span>
            {r.role !== 'owner' && canManage && (
              <button className="kr-btn danger" onClick={() => remove(r.username)}><Trash2 size={13} /></button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
