import React from 'react';
import { RepoDetail, Issue } from '../../types/repos';
import { issuesApi } from '../../services/api/repos';
import { Loading, ErrorBox, Avatar } from './shared';
import { LayoutDashboard, CircleDot, CheckCircle2 } from 'lucide-react';

export const ProjectsTab: React.FC<{ repo: RepoDetail; isOwner: boolean }> = ({ repo, isOwner }) => {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setIssues(await issuesApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <Loading label="Loading projects board…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  const todo = issues.filter(i => i.status === 'open');
  const done = issues.filter(i => i.status === 'closed');

  const Column = ({ title, items, icon: Icon, color }: { title: string, items: Issue[], icon: any, color: string }) => (
    <div className="kanban-column" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)', minWidth: 300 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color }}><Icon size={14} /></span>
          {title} <span style={{ background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>{items.length}</span>
        </h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 100 }}>
        {items.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No items</div>
        ) : (
          items.map(i => (
            <div key={i.id} className="kr-card kanban-card" style={{ padding: 12, cursor: 'grab' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ color, marginTop: 2 }}><Icon size={14} /></span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{i.title}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>#{i.number}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Avatar name={i.author_username} size={16} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="gh-projects-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={16} color="var(--accent-purple)" /> Projects Kanban
          </h3>
          <div className="list-sub" style={{ marginTop: 2 }}>
            Track issues and pull requests across a Kanban board.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        <Column title="Todo" items={todo} icon={CircleDot} color="#22c55e" />
        <Column title="Done" items={done} icon={CheckCircle2} color="#8b5cf6" />
      </div>
    </div>
  );
};
