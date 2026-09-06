import React from 'react';
import {
  Plus, GitMerge, GitPullRequest, Trash2, GitBranch, CircleDot, CheckCircle2,
  MessageSquare, Search, FileDiff, Check, AlertTriangle, ShieldCheck, Clock,
} from 'lucide-react';
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
  const [filter, setFilter] = React.useState<'open' | 'closed' | 'all'>('open');
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<'newest' | 'oldest'>('newest');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setPrs(await pullsApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading pull requests…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  if (open !== null) {
    return <PullRequestView repo={repo} number={open} canMerge={canMerge} onClose={() => { setOpen(null); load(); }} />;
  }

  const openCount = prs.filter(p => p.status === 'open').length;
  const closedCount = prs.filter(p => p.status === 'closed' || p.status === 'merged').length;
  const allCount = prs.length;

  const filteredPrs = prs
    .filter(p => filter === 'all' ? true : filter === 'open' ? p.status === 'open' : (p.status === 'closed' || p.status === 'merged'))
    .filter(p => !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()) || String(p.number) === search.trim())
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="gh-pr-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Pull requests</h3>
        <button type="button" className="kr-btn primary" disabled={!canWrite} onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New pull request
        </button>
      </div>

      <div className="issues-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="issue-filter-tabs">
          <button type="button" className={'issue-filter-tab' + (filter === 'open' ? ' active' : '')} onClick={() => setFilter('open')}>
            <GitPullRequest size={13} /> {openCount} Open
          </button>
          <button type="button" className={'issue-filter-tab' + (filter === 'closed' ? ' active' : '')} onClick={() => setFilter('closed')}>
            <CheckCircle2 size={13} /> {closedCount} Closed
          </button>
          <button type="button" className={'issue-filter-tab' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>
            {allCount} All
          </button>
        </div>

        <div className="issue-search" style={{ flex: 1, minWidth: 200 }}>
          <Search size={13} />
          <input className="kr-input" placeholder="Search pull requests..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        
        <select className="kr-select kr-select-sm" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>

      <div className="repo-dir-table-container mt16">
        {filteredPrs.length === 0 ? (
          <EmptyState title="No pull requests found" hint="Try adjusting your filters or search." />
        ) : (
          filteredPrs.map(p => (
            <div key={p.id} className="list-row gh-pr-row" onClick={() => setOpen(p.number)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'flex-start' }}>
              <div className="list-main">
                <div className="list-title" style={{ fontSize: 15, marginBottom: 4 }}>
                  <GitPullRequest size={16} style={{ verticalAlign: -3, marginRight: 8, color: p.status === 'open' ? '#22c55e' : p.status === 'merged' ? '#8b5cf6' : '#f87171' }} />
                  <span className="pr-num" style={{ marginRight: 6 }}>#{p.number}</span>
                  <span style={{ fontWeight: 600 }}>{p.title}</span>
                </div>
                <div className="list-sub" style={{ marginLeft: 24 }}>
                  <div style={{ marginBottom: 4 }}>
                    <span className="branch-tag">{p.source_branch}</span>
                    <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
                    <span className="branch-tag">{p.target_branch}</span>
                  </div>
                  <div>
                    <b>{p.author_username}</b> opened {timeAgo(p.created_at)}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <StatusPill status={p.status} />
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreatePullModal repo={repo} onClose={() => setShowCreate(false)} onCreate={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
};

const CreatePullModal: React.FC<{ repo: RepoDetail; onClose: () => void; onCreate: () => void }> = ({ repo, onClose, onCreate }) => {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [source, setSource] = React.useState('');
  const [target, setTarget] = React.useState(repo.default_branch);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    if (!title || !source || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await pullsApi.create(repo.id, { title, body, source, target });
      onCreate();
    }
    catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const branchOptions = (repo.branches || []).map(b => b.name);

  return (
    <Modal
      title="Open a pull request"
      subtitle="Compare changes across branches and request review before merging."
      onClose={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="kr-label">Base branch (target)</label>
          <select className="kr-select" value={target} onChange={e => setTarget(e.target.value)}>
            <option value={repo.default_branch}>{repo.default_branch}</option>
            {branchOptions.filter(b => b !== repo.default_branch).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="kr-label">Compare branch (source)</label>
          <select className="kr-select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">Select source branch…</option>
            {branchOptions.filter(b => b !== target).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <label className="kr-label">Title</label>
      <input
        className="kr-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Short summary of proposed changes"
      />

      <label className="kr-label">Description</label>
      <textarea
        className="kr-textarea"
        rows={4}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Provide context, implementation details, or linked issues..."
      />

      {error && <div className="kr-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="kr-btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="kr-btn primary"
          disabled={!title || !source || submitting}
          onClick={submit}
        >
          {submitting ? 'Creating…' : 'Create pull request'}
        </button>
      </div>
    </Modal>
  );
};

const PullRequestView: React.FC<{ repo: RepoDetail; number: number; canMerge: boolean; onClose: () => void }> = ({ repo, number, canMerge, onClose }) => {
  const [pr, setPr] = React.useState<PullRequestDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'conversation' | 'files'>('conversation');
  const [actionMessage, setActionMessage] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setPr(await pullsApi.get(repo.id, number)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id, number]);

  React.useEffect(() => { load(); }, [load]);

  const review = async (state: 'approved' | 'changes_requested' | 'commented') => {
    setBusy(state);
    try {
      await pullsApi.review(repo.id, number, state);
      await load();
    }
    catch (e: any) { setError(e.message); }
    setBusy('');
  };

  const merge = async () => {
    setBusy('merge');
    try {
      const r = await pullsApi.merge(repo.id, number);
      setActionMessage(r.ok ? `Successfully merged into ${pr?.target_branch}` + (r.merge_sha ? ` as ${r.merge_sha.slice(0, 7)}` : '') : 'Merge blocked by policy');
      await load();
    } catch (e: any) { setError(e.message); }
    setBusy('');
  };

  if (loading && !pr) return <Loading label="Loading pull request details…" />;
  if (error && !pr) return <ErrorBox message={error} onRetry={load} />;
  if (!pr) return null;

  const approvals = pr.reviews.filter(r => r.state === 'approved').length;
  const changes = pr.reviews.filter(r => r.state === 'changes_requested').length;

  return (
    <div className="gh-pr-detail">
      <button type="button" className="kr-btn" style={{ marginBottom: 14 }} onClick={onClose}>
        ← Back to pull requests
      </button>

      {/* PR Header Banner */}
      <div className="gh-pr-header-card">
        <h2 className="gh-pr-title">
          {pr.title} <span className="pr-number-lg">#{pr.number}</span>
        </h2>

        <div className="gh-pr-status-bar">
          <StatusPill status={pr.status} />
          <span className="gh-pr-branch-summary">
            <strong>{pr.author_username}</strong> wants to merge into{' '}
            <span className="branch-tag">{pr.target_branch}</span> from{' '}
            <span className="branch-tag">{pr.source_branch}</span>
          </span>
          <span className="gh-pr-time">{timeAgo(pr.created_at)}</span>
        </div>
      </div>

      {/* Tab Switcher: Conversation vs Files Changed */}
      <div className="tab-switch pr-tab-switch">
        <button
          type="button"
          className={activeTab === 'conversation' ? 'active' : ''}
          onClick={() => setActiveTab('conversation')}
        >
          <MessageSquare size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
          Conversation ({pr.comments?.length || 0})
        </button>
        <button
          type="button"
          className={activeTab === 'files' ? 'active' : ''}
          onClick={() => setActiveTab('files')}
        >
          <FileDiff size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
          Files Changed
        </button>
      </div>

      {activeTab === 'files' ? (
        <div className="kr-card mt16">
          <div className="gh-diff-head">
            <h4>Changes ({pr.diff ? pr.diff.split('\n').length : 0} lines)</h4>
          </div>
          <DiffView patch={pr.diff} />
        </div>
      ) : (
        <div className="gh-pr-conversation">
          {/* Main Description Box */}
          <div className="gh-discussion-box">
            <div className="gh-discussion-head">
              <Avatar name={pr.author_username} size={22} />
              <b>{pr.author_username}</b> commented {timeAgo(pr.created_at)}
            </div>
            <div className="gh-discussion-body">
              {pr.body ? <MiniMarkdown source={pr.body} /> : <p className="text-muted">No description provided.</p>}
            </div>
          </div>

          {/* Secret Findings Warning */}
          {pr.secret_findings && pr.secret_findings.length > 0 && (
            <div className="secret-banner mt16">
              <h4>
                <AlertTriangle size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                Secret Scanning: Credentials detected in diff
              </h4>
              {pr.secret_findings.map((s, i) => (
                <div key={i} className="finding-row">
                  <span className="finding-kind">{s.kind}</span>
                  <span className="finding-file">{s.file}:{s.line}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.snippet}</span>
                </div>
              ))}
              <div className="list-sub mt8">Secret detections must be resolved before merging into protected branches.</div>
            </div>
          )}

          {/* Reviews List */}
          <div className="kr-card mt16">
            <h4>Reviewers & Approvals</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              <span className="status-pill accent">{approvals} Approval{approvals === 1 ? '' : 's'}</span>
              {changes > 0 && <span className="status-pill failure">{changes} Changes requested</span>}
              {pr.status === 'merged' && pr.merged_by_username && (
                <span className="status-pill success">Merged by {pr.merged_by_username}</span>
              )}
            </div>

            {pr.reviews.length === 0 ? (
              <EmptyState title="No reviews yet" hint="Team members can review diffs and leave feedback." />
            ) : (
              pr.reviews.map((r, i) => (
                <div key={i} className="timeline-item">
                  <Avatar name={r.reviewer_username} color={r.avatar_color} size={22} />
                  <div>
                    <span className="t-type">{r.reviewer_username}</span>
                    <span style={{ margin: '0 6px' }}>•</span>
                    <span className={`status-pill ${r.state === 'approved' ? 'success' : r.state === 'changes_requested' ? 'failure' : 'neutral'}`}>
                      {r.state.replace('_', ' ')}
                    </span>
                    {r.body && <div className="comment-body mt8">{r.body}</div>}
                    <div className="t-time">{timeAgo(r.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* GitHub Merge / Action Box */}
          {pr.status === 'open' && (
            <div className="kr-card mt16 gh-merge-box">
              <h4>Review & Merge Strategy</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" className="kr-btn" disabled={!!busy} onClick={() => review('approved')}>
                  <Check size={13} /> Approve
                </button>
                <button type="button" className="kr-btn danger" disabled={!!busy} onClick={() => review('changes_requested')}>
                  Request changes
                </button>
                <button
                  type="button"
                  className="kr-btn primary"
                  style={{ marginLeft: 'auto' }}
                  disabled={!!busy || !canMerge}
                  onClick={merge}
                >
                  <GitMerge size={14} /> {busy === 'merge' ? 'Merging…' : 'Merge pull request'}
                </button>
              </div>
            </div>
          )}

          {actionMessage && <div className="kr-success mt16">{actionMessage}</div>}
        </div>
      )}
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
    try {
      await issuesApi.setStatus(repo.id, n, status === 'open' ? 'closed' : 'open');
      await view(n);
      load();
    }
    catch (e: any) { setActionError(e.message); }
  };

  const submitComment = async () => {
    if (!comment.trim() || !issue) return;
    setActionError('');
    try {
      await issuesApi.comment(repo.id, issue.number, comment);
      setComment('');
      await view(issue.number);
      load();
    }
    catch (e: any) { setActionError(e.message); }
  };

  if (loading) return <Loading label="Loading issues…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  // Detailed Issue Discussion View
  if (open !== null) {
    if (!issue) return <Loading label="Loading issue details…" />;
    const isOpen = issue.status === 'open';

    return (
      <div className="gh-issue-detail">
        <button type="button" className="kr-btn" style={{ marginBottom: 14 }} onClick={() => { setOpen(null); setIssue(null); }}>
          ← Back to issues
        </button>

        {actionError && <div className="kr-error">{actionError}</div>}

        <div className="gh-issue-header">
          <h2>
            {issue.title} <span className="pr-number-lg">#{issue.number}</span>
          </h2>
          <div className="issue-meta" style={{ marginTop: 8 }}>
            <span className={'issue-state ' + (isOpen ? 'open' : 'closed')}>
              {isOpen ? <CircleDot size={13} /> : <CheckCircle2 size={13} />}
              {isOpen ? 'Open' : 'Closed'}
            </span>
            <span>
              <strong>{issue.author_username}</strong> opened this issue {timeAgo(issue.created_at)} • {issue.comments.length} comment{issue.comments.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Issue Original Post */}
        <div className="gh-discussion-box mt16">
          <div className="gh-discussion-head">
            <Avatar name={issue.author_username} size={22} />
            <b>{issue.author_username}</b> commented {timeAgo(issue.created_at)}
          </div>
          <div className="gh-discussion-body">
            {issue.body ? <MiniMarkdown source={issue.body} /> : <p className="issue-body-empty">No description provided.</p>}
          </div>
        </div>

        {/* Comments Timeline */}
        {issue.comments.map((c, i) => (
          <div key={i} className="gh-discussion-box mt16">
            <div className="gh-discussion-head">
              <Avatar name={c.author_username} color={c.avatar_color} size={22} />
              <b>{c.author_username}</b> commented {timeAgo(c.created_at)}
            </div>
            <div className="gh-discussion-body">
              <MiniMarkdown source={c.body} />
            </div>
          </div>
        ))}

        {/* New Comment Box */}
        <div className="kr-card mt16">
          <h4>Leave a comment</h4>
          <textarea
            className="kr-textarea mt8"
            rows={4}
            placeholder="Leave a comment (Markdown is supported)..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="kr-btn" onClick={() => close(issue.number, issue.status)}>
              {isOpen ? 'Close issue' : 'Reopen issue'}
            </button>
            <button
              type="button"
              className="kr-btn primary"
              disabled={!comment.trim()}
              onClick={submitComment}
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Issue List View
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
    <div className="gh-issues-container">
      <div className="issues-toolbar">
        <div className="issue-filter-tabs">
          <button
            type="button"
            className={'issue-filter-tab' + (filter === 'open' ? ' active' : '')}
            onClick={() => setFilter('open')}
          >
            <CircleDot size={13} /> {openCount} Open
          </button>
          <button
            type="button"
            className={'issue-filter-tab' + (filter === 'closed' ? ' active' : '')}
            onClick={() => setFilter('closed')}
          >
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

        <select
          className="kr-select"
          style={{ width: 140 }}
          value={sort}
          onChange={e => setSort(e.target.value as any)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="comments">Most commented</option>
        </select>

        <button
          type="button"
          className="kr-btn primary"
          disabled={!canWrite}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} /> New issue
        </button>
      </div>

      <div className="repo-dir-table-container">
        {filtered.length === 0 ? (
          <EmptyState
            title={filter === 'open' ? 'No open issues' : 'No closed issues'}
            hint={search.trim() ? `No ${filter} issues match "${search}".` : 'Track bugs, tasks, and feature requests.'}
          />
        ) : (
          filtered.map(i => (
            <div key={i.id} className="list-row gh-issue-row" onClick={() => view(i.number)}>
              <div className="list-main">
                <div className="list-title">
                  <span className={'issue-state-sm ' + (i.status === 'open' ? 'open' : 'closed')}>
                    {i.status === 'open' ? <CircleDot size={14} /> : <CheckCircle2 size={14} />}
                  </span>
                  <span>{i.title}</span>
                  <span className="pr-num">#{i.number}</span>
                </div>
                <div className="list-sub">
                  <span>#{i.number} {i.status === 'closed' && i.closed_at ? 'closed ' + timeAgo(i.closed_at) : 'opened ' + timeAgo(i.created_at)} by <b>{i.author_username}</b></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {Boolean(i.comment_count) && (
                  <span className="issue-comments" title={`${i.comment_count} comments`}>
                    <MessageSquare size={13} /> {i.comment_count}
                  </span>
                )}
                <StatusPill status={i.status} />
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreateIssueModal
          repo={repo}
          onClose={() => setShowCreate(false)}
          onCreate={() => { setShowCreate(false); load(); }}
        />
      )}
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
    setSubmitting(true);
    setError('');
    try {
      await issuesApi.create(repo.id, title.trim(), body.trim());
      onCreate();
    }
    catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create new issue"
      subtitle="Report a bug, request a feature, or track tasks. Markdown is supported."
      onClose={onClose}
    >
      <label className="kr-label">Title</label>
      <input
        className="kr-input"
        placeholder="Summary of the issue"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <label className="kr-label">Description</label>
      <textarea
        className="kr-textarea"
        rows={5}
        placeholder="Steps to reproduce, expected behavior, or context..."
        value={body}
        onChange={e => setBody(e.target.value)}
      />

      {error && <div className="kr-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="kr-btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="kr-btn primary"
          disabled={!title.trim() || submitting}
          onClick={submit}
        >
          {submitting ? 'Creating…' : 'Submit new issue'}
        </button>
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
    try {
      await collaboratorsApi.add(repo.id, username, role);
      setUsername('');
      setMessage(`Added @${username} as ${role}`);
      load();
      onChanged();
    }
    catch (e: any) { setError(e.message); }
  };

  const remove = async (u: string) => {
    if (!window.confirm(`Remove @${u} from this repository?`)) return;
    try {
      await collaboratorsApi.remove(repo.id, u);
      setMessage(`Removed @${u}`);
      load();
      onChanged();
    }
    catch (e: any) { setError(e.message); }
  };

  if (loading) return <Loading label="Loading collaborators…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="gh-collaborators-container">
      {message && <div className="kr-success">{message}</div>}
      {error && <div className="kr-error">{error}</div>}

      {canManage && (
        <div className="kr-card" style={{ marginBottom: 16 }}>
          <h4>Invite a collaborator</h4>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              className="kr-input"
              placeholder="Username or email"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            <select
              className="kr-select"
              style={{ width: 160 }}
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              <option value="maintainer">Maintainer</option>
              <option value="developer">Developer</option>
              <option value="reviewer">Reviewer</option>
            </select>
            <button
              type="button"
              className="kr-btn primary"
              disabled={!username.trim()}
              onClick={add}
            >
              Add collaborator
            </button>
          </div>
        </div>
      )}

      <div className="repo-dir-table-container">
        {rows.map(r => (
          <div key={r.user_id} className="list-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={r.display_name || r.username} color={r.avatar_color} size={28} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.display_name || r.username}</div>
                <div className="list-sub">@{r.username}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`role-badge ${r.role}`}>{r.role}</span>
              {r.role !== 'owner' && canManage && (
                <button
                  type="button"
                  className="kr-btn danger"
                  onClick={() => remove(r.username)}
                  title="Remove collaborator"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
