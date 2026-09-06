import React from 'react';
import {
  Sliders, Users, GitBranch, GitPullRequest, Play, Radio, Server,
  Cpu, Store, ShieldCheck, AlertTriangle,
} from 'lucide-react';

export type SettingsSection =
  | 'general'
  | 'access'
  | 'branches'
  | 'pull-requests'
  | 'actions'
  | 'webhooks'
  | 'deployments'
  | 'api'
  | 'marketplace'
  | 'security'
  | 'advanced';

interface Props {
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
  role?: string | null;
}

export const SettingsNav: React.FC<Props> = ({ activeSection, onSelectSection }) => {
  const items: { id: SettingsSection; label: string; icon: any; isSpecial?: boolean; badge?: string }[] = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'access', label: 'Access & Permissions', icon: Users },
    { id: 'branches', label: 'Branches', icon: GitBranch },
    { id: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest },
    { id: 'actions', label: 'Actions & CI', icon: Play },
    { id: 'webhooks', label: 'Webhooks', icon: Radio },
    { id: 'deployments', label: 'Deployments', icon: Server },
    { id: 'api', label: 'API Configuration', icon: Cpu, badge: 'API' },
    { id: 'marketplace', label: 'Marketplace Listing', icon: Store },
    { id: 'security', label: 'Security & Quality', icon: ShieldCheck },
    { id: 'advanced', label: 'Advanced', icon: AlertTriangle, isSpecial: true },
  ];

  return (
    <nav className="repo-settings-nav">
      <div className="repo-settings-nav-head">Repository Settings</div>
      <ul className="repo-settings-nav-list">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`settings-nav-btn ${isActive ? 'active' : ''} ${item.isSpecial ? 'danger-nav' : ''}`}
                onClick={() => onSelectSection(item.id)}
              >
                <Icon size={15} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
                {item.badge && <span className="settings-nav-badge">{item.badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
