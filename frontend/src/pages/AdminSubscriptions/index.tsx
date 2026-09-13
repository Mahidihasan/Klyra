import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../config/adminAccess';

import { ActiveSubscriptionsTab } from './ActiveSubscriptionsTab';
import { TierTemplatesTab } from './TierTemplatesTab';

type TabView = 'active' | 'templates';

export const AdminSubscriptionsPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>('active');

  const header = (
    <div className="au-header">
      <div>
        <h1 className="au-title">Subscriptions Lifecycle</h1>
        <p className="au-subtitle">
          Manage API subscriptions, view active billing cycles, and configure global tier templates.
        </p>
      </div>
    </div>
  );

  if (getImpersonationSession() || !hasAdminAccess(authUser?.role)) {
    return (
      <div className="au-page">
        {header}
        <div className="au-notice card-base">
          <ShieldAlert size={20} aria-hidden="true" />
          <h3>Access Denied</h3>
          <p>
            You do not have permission to view this page or you are currently impersonating another user.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="au-page">
      {header}

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '8px' }}>
        <button
          className={`au-ghost-btn ${activeTab === 'active' ? 'active-tab-btn' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Subscriptions
        </button>
        <button
          className={`au-ghost-btn ${activeTab === 'templates' ? 'active-tab-btn' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Global Tier Templates
        </button>
      </div>

      <div className="au-tab-content">
        {activeTab === 'active' && <ActiveSubscriptionsTab />}
        {activeTab === 'templates' && <TierTemplatesTab />}
      </div>

      <AdminSubscriptionsStyles />
    </div>
  );
};

const AdminSubscriptionsStyles: React.FC = () => (
  <style>{`
    .active-tab-btn {
      background-color: rgba(139, 92, 246, 0.1) !important;
      color: var(--accent-purple) !important;
      border-color: rgba(139, 92, 246, 0.3) !important;
    }
  `}</style>
);
