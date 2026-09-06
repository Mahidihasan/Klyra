import React from 'react';
import { RepoDetail } from '../../../types/repos';
import { SettingsNav, SettingsSection } from './SettingsNav';
import { GeneralSettings } from './GeneralSettings';
import { AccessSettings } from './AccessSettings';
import { BranchSettings } from './BranchSettings';
import { PullRequestSettings } from './PullRequestSettings';
import { ActionsSettings } from './ActionsSettings';
import { WebhooksSettings } from './WebhooksSettings';
import { DeploymentSettings } from './DeploymentSettings';
import { ApiSettings } from './ApiSettings';
import { MarketplaceSettings } from './MarketplaceSettings';
import { SecuritySettings } from './SecuritySettings';
import { AdvancedSettings } from './AdvancedSettings';

interface Props {
  repo: RepoDetail;
  isOwner: boolean;
  canWrite: boolean;
  onChanged: () => void;
  onBack: () => void;
}

export const SettingsLayout: React.FC<Props> = ({ repo, isOwner, canWrite, onChanged, onBack }) => {
  // Synchronize active section with URL location hash (e.g. #/repo/<id>/settings/access or #settings-access)
  const initialSection = React.useMemo<SettingsSection>(() => {
    const hash = window.location.hash;
    const match = hash.match(/settings[/-]([a-z-]+)/i);
    if (match && match[1]) {
      const sec = match[1].toLowerCase() as SettingsSection;
      const validSections: SettingsSection[] = [
        'general', 'access', 'branches', 'pull-requests', 'actions',
        'webhooks', 'deployments', 'api', 'marketplace', 'security', 'advanced',
      ];
      if (validSections.includes(sec)) return sec;
    }
    return 'general';
  }, []);

  const [activeSection, setActiveSection] = React.useState<SettingsSection>(initialSection);

  const handleSelectSection = (sec: SettingsSection) => {
    setActiveSection(sec);
    const newHash = `#/repo/${repo.id}/settings/${sec}`;
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash);
    }
  };

  // Browser hash change listener
  React.useEffect(() => {
    const handleHashChange = () => {
      const match = window.location.hash.match(/settings[/-]([a-z-]+)/i);
      if (match && match[1]) {
        const sec = match[1].toLowerCase() as SettingsSection;
        setActiveSection(sec);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="repo-settings-layout">
      {/* Left Sidebar Navigation */}
      <SettingsNav
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        role={repo.role}
      />

      {/* Right Main Content Area */}
      <main className="repo-settings-content">
        {activeSection === 'general' && (
          <GeneralSettings repo={repo} isOwner={isOwner} canWrite={canWrite} onChanged={onChanged} />
        )}
        {activeSection === 'access' && (
          <AccessSettings repo={repo} isOwner={isOwner} canManage={isOwner || repo.role === 'maintainer'} onChanged={onChanged} />
        )}
        {activeSection === 'branches' && (
          <BranchSettings repo={repo} isOwner={isOwner} canWrite={canWrite} onChanged={onChanged} />
        )}
        {activeSection === 'pull-requests' && (
          <PullRequestSettings repo={repo} canWrite={canWrite} />
        )}
        {activeSection === 'actions' && (
          <ActionsSettings repo={repo} canWrite={canWrite} />
        )}
        {activeSection === 'webhooks' && (
          <WebhooksSettings repo={repo} canWrite={canWrite} />
        )}
        {activeSection === 'deployments' && (
          <DeploymentSettings repo={repo} canWrite={canWrite} />
        )}
        {activeSection === 'api' && (
          <ApiSettings repo={repo} canWrite={canWrite} onChanged={onChanged} />
        )}
        {activeSection === 'marketplace' && (
          <MarketplaceSettings repo={repo} isOwner={isOwner} canWrite={canWrite} />
        )}
        {activeSection === 'security' && (
          <SecuritySettings repo={repo} canWrite={canWrite} />
        )}
        {activeSection === 'advanced' && (
          <AdvancedSettings repo={repo} isOwner={isOwner} onBack={onBack} />
        )}
      </main>
    </div>
  );
};
