import React from 'react';
import {
  Code2, GitPullRequest, CircleDot, Play, LayoutDashboard, ShieldCheck, BarChart3,
  Settings, ChevronLeft, Lock, Globe, BookOpen, Users, Store,
} from 'lucide-react';
import { reposApi } from '../../services/api/repos';
import { RepoDetail as RepoDetailData, RepoTab } from '../../types/repos';
import { ErrorBox, Loading, timeAgo } from './shared';
import { CodePage } from './CodePage';
import { BranchesTab, CommitsTab } from './GitTabs';
import { PullsTab, IssuesTab, CollaboratorsTab } from './CollabTabs';
import { ApiTab, DocsTab, TestsTab, ReleasesTab, MarketplaceTab, SettingsTab } from './OpsTabs';
import { ProjectsTab } from './ProjectsTab';
import { InsightsTab } from './InsightsTab';
import { useRepoLiveRefresh } from './useRepoLiveRefresh';

interface Props {
  repoId: string;
  onBack: () => void;
}

export const RepoDetail: React.FC<Props> = ({ repoId, onBack }) => {
  const [repo, setRepo] = React.useState<RepoDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [tab, setTab] = React.useState<RepoTab>('code');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setRepo(await reposApi.get(repoId)); }
    catch (e: any) { setError(e.message || 'Failed to load repository'); }
    finally { setLoading(false); }
  }, [repoId]);

  // Background refresh for realtime — updates the repo without a full-screen
  // spinner, so live events don't make the page flash.
  const refreshRepo = React.useCallback(async () => {
    try { setRepo(await reposApi.get(repoId)); }
    catch (e: any) { /* keep last good data on a transient failure */ }
  }, [repoId]);

  React.useEffect(() => { load(); }, [load]);

  // Push-driven realtime via SSE (/api/repos/:id/events) + a safety-net poll.
  const live = useRepoLiveRefresh(repoId);

  // Whenever a repo event lands (CI finished, deployment, activity, meta
  // change), refresh the header/deploy status in the background.
  React.useEffect(() => {
    if (live.refreshKey > 0) refreshRepo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.refreshKey]);

  // GitHub-style primary navigation. Secondary destinations (branches, tags,
  // docs, collaborators, marketplace) are reachable from the code toolbar and sidebar.
  const tabs: { id: RepoTab; label: string; icon: any }[] = [
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'issues', label: 'Issues', icon: CircleDot },
    { id: 'pulls', label: 'Pull requests', icon: GitPullRequest },
    { id: 'tests', label: 'Actions', icon: Play },
    { id: 'deployments', label: 'Projects', icon: LayoutDashboard },
    { id: 'api', label: 'Security & quality', icon: ShieldCheck },
    { id: 'commits', label: 'Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) return <div className="repos-page"><Loading label="Loading repository…" /></div>;
  if (error || !repo) return <div className="repos-page"><ErrorBox message={error || 'Repository not found'} onRetry={load} /></div>;

  const isOwner = repo.role === 'owner';
  const canWrite = ['owner', 'maintainer', 'developer'].includes(repo.role || '');

  return (
    <div className="repos-page">
      <div className="repo-shell-header">
        <div className="repo-crumb" onClick={onBack}><ChevronLeft size={14} /> All repositories</div>
        <div className="repo-header-main">
          <div className="repo-header-info">
            <div className="repo-name-row">
              <h2>{repo.owner_username}/{repo.name}</h2>
              <span className={`vis-badge ${repo.visibility}`}>
                {repo.visibility === 'public' ? <Globe size={11} style={{ marginRight: 4 }} /> : <Lock size={11} style={{ marginRight: 4 }} />}
                {repo.visibility}
              </span>
              {repo.role && <span className={`role-badge ${repo.role}`}>{repo.role === 'owner' ? 'Owner' : repo.role}</span>}
              {live.status !== 'disabled' && (
                <span
                  className="live-badge"
                  title={`Realtime updates ${live.status === 'connected' ? 'connected' : live.status === 'reconnecting' ? 'reconnecting' : 'connecting…'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: live.status === 'connected' ? '#4ade80' : '#f59e0b', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 999, padding: '2px 8px' }}
                >
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: live.status === 'connected' ? '#4ade80' : live.status === 'reconnecting' ? '#f59e0b' : '#94a3b8' }} />
                  Live
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="repo-tabs">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`repo-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="repo-tab-content">
        {tab === 'code' && <CodePage repo={repo} onNavigate={setTab} />}
        {tab === 'branches' && <BranchesTab repo={repo} canWrite={canWrite} isOwner={isOwner} onChanged={load} />}
        {tab === 'pulls' && <PullsTab repo={repo} canWrite={canWrite} canMerge={isOwner || repo.role === 'maintainer'} />}
        {tab === 'issues' && <IssuesTab repo={repo} canWrite={canWrite} />}
        {tab === 'collaborators' && <CollaboratorsTab repo={repo} canManage={isOwner || repo.role === 'maintainer'} onChanged={load} />}
        {tab === 'commits' && <InsightsTab repo={repo} />}
        {tab === 'releases' && <ReleasesTab repo={repo} isOwner={isOwner} canWrite={canWrite} />}
        {tab === 'api' && <ApiTab repo={repo} />}
        {tab === 'docs' && <DocsTab repo={repo} />}
        {tab === 'tests' && <TestsTab repo={repo} canWrite={canWrite} refreshKey={live.refreshKey} />}
        {tab === 'deployments' && <ProjectsTab repo={repo} isOwner={isOwner} />}
        {tab === 'marketplace' && <MarketplaceTab repo={repo} isOwner={isOwner} canWrite={canWrite} />}
        {tab === 'settings' && <SettingsTab repo={repo} isOwner={isOwner} onChanged={load} onBack={onBack} />}
      </div>
    </div>
  );
};
