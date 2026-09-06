import React from 'react';
import { RepoDetail, CommitInfo } from '../../types/repos';
import { reposApi, gitApi } from '../../services/api/repos';
import { Loading, ErrorBox, EmptyState, Avatar, timeAgo } from './shared';
import { Activity, Users, GitCommit } from 'lucide-react';

export const InsightsTab: React.FC<{ repo: RepoDetail }> = ({ repo }) => {
  const [commits, setCommits] = React.useState<CommitInfo[]>([]);
  const [activity, setActivity] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'pulse' | 'contributors' | 'commits'>('pulse');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [c, a] = await Promise.all([
        gitApi.commits(repo.id, repo.default_branch),
        reposApi.activity(repo.id)
      ]);
      setCommits(c.commits || []);
      setActivity(a || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [repo.id, repo.default_branch]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading repository insights…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="gh-insights-tab" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24, alignItems: 'start' }}>
      
      {/* Sidebar Navigation */}
      <div className="insights-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button 
          className={`kr-btn ${activeTab === 'pulse' ? 'active' : ''}`} 
          style={{ justifyContent: 'flex-start', border: 'none', background: activeTab === 'pulse' ? 'var(--bg-hover)' : 'transparent', fontWeight: activeTab === 'pulse' ? 600 : 400 }}
          onClick={() => setActiveTab('pulse')}
        >
          <Activity size={14} style={{ marginRight: 8 }} /> Pulse
        </button>
        <button 
          className={`kr-btn ${activeTab === 'contributors' ? 'active' : ''}`} 
          style={{ justifyContent: 'flex-start', border: 'none', background: activeTab === 'contributors' ? 'var(--bg-hover)' : 'transparent', fontWeight: activeTab === 'contributors' ? 600 : 400 }}
          onClick={() => setActiveTab('contributors')}
        >
          <Users size={14} style={{ marginRight: 8 }} /> Contributors
        </button>
        <button 
          className={`kr-btn ${activeTab === 'commits' ? 'active' : ''}`} 
          style={{ justifyContent: 'flex-start', border: 'none', background: activeTab === 'commits' ? 'var(--bg-hover)' : 'transparent', fontWeight: activeTab === 'commits' ? 600 : 400 }}
          onClick={() => setActiveTab('commits')}
        >
          <GitCommit size={14} style={{ marginRight: 8 }} /> Commits
        </button>
      </div>

      {/* Main Content Area */}
      <div className="insights-main">
        {activeTab === 'pulse' && (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Repository Activity Pulse</h3>
            <div className="kr-card">
              <h4 style={{ marginBottom: 16 }}>Recent Activity Overview</h4>
              {activity.length === 0 ? (
                <EmptyState title="No recent activity" hint="No activity has been recorded yet." />
              ) : (
                activity.slice(0, 10).map((a, i) => (
                  <div key={i} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Activity size={14} color="var(--text-muted)" />
                    <div>
                      <div><b>{a.actor_username || 'System'}</b> performed <b>{a.type}</b></div>
                      <div className="list-sub">{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'contributors' && (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Contributors Leaderboard</h3>
            <div className="kr-card">
              {repo.collaborators.length === 0 ? (
                <div className="list-sub">No collaborators configured.</div>
              ) : (
                repo.collaborators.map(c => (
                  <div key={c.user_id} className="list-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={c.username} color={c.avatar_color} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{c.username}</div>
                      <div className="list-sub">{c.role}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'commits' && (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Commit History (Recent)</h3>
            <div className="kr-card">
              {commits.length === 0 ? (
                <EmptyState title="No commits" hint="Push some code to see the history graph." />
              ) : (
                commits.slice(0, 15).map(c => (
                  <div key={c.sha} className="list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.message}</div>
                      <div className="list-sub">{c.author} · {timeAgo(c.date)}</div>
                    </div>
                    <span className="mono" style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                      {c.sha.slice(0, 7)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
