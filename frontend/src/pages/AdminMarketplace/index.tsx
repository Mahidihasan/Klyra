import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../config/adminAccess';

import { FeaturedApisTab } from './FeaturedApisTab';
import { CategoriesTab } from './CategoriesTab';
import { ReviewsTab } from './ReviewsTab';

type TabView = 'featured' | 'categories' | 'reviews';

export const AdminMarketplacePage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>('featured');

  const header = (
    <div className="au-header">
      <div>
        <h1 className="au-title">Marketplace Control Panel</h1>
        <p className="au-subtitle">
          Manage the public presentation of the Klyra API Marketplace.
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
        <AdminMarketplaceStyles />
      </div>
    );
  }

  return (
    <div className="au-page">
      {header}

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '8px' }}>
        <button
          className={`au-ghost-btn ${activeTab === 'featured' ? 'active-tab-btn' : ''}`}
          onClick={() => setActiveTab('featured')}
        >
          Featured APIs
        </button>
        <button
          className={`au-ghost-btn ${activeTab === 'categories' ? 'active-tab-btn' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={`au-ghost-btn ${activeTab === 'reviews' ? 'active-tab-btn' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews Moderation
        </button>
      </div>

      <div className="au-tab-content">
        {activeTab === 'featured' && <FeaturedApisTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'reviews' && <ReviewsTab />}
      </div>

      <AdminMarketplaceStyles />
    </div>
  );
};

const AdminMarketplaceStyles: React.FC = () => (
  <style>{`
    .active-tab-btn {
      background-color: rgba(139, 92, 246, 0.1) !important;
      color: var(--accent-purple) !important;
      border-color: rgba(139, 92, 246, 0.3) !important;
    }
  `}</style>
);
