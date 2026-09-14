import React, { useState, useEffect } from 'react';

import { AdminApis } from '../../pages/AdminPanel/AdminApis';
import { AdminBilling } from '../../pages/AdminPanel/AdminBilling';
import { AdminDatabase } from '../../pages/AdminPanel/AdminDatabase';
import { AdminDevOps } from '../../pages/AdminPanel/AdminDevOps';
import { AdminEngineRoom } from '../../pages/AdminPanel/AdminEngineRoom';
import { AdminForensics } from '../../pages/AdminPanel/AdminForensics';
import { AdminOverview } from '../../pages/AdminPanel/AdminOverview';
import { AdminSystem } from '../../pages/AdminPanel/AdminSystem';
import { AdminUsers } from '../../pages/AdminPanel/AdminUsers';
import { NavigationTab } from '../../types/api';

import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { AdminCommandPalette } from './components/AdminCommandPalette';
import { SoftDeleteProvider } from './context/SoftDeleteContext';
import './AdminLayout.css';

interface AdminLayoutProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ activeTab, setActiveTab }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleLogout = () => {
    setActiveTab('home');
    // Actual auth logout logic would hook in here via AuthContext
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'admin-overview':
        return <AdminOverview />;
      case 'admin-users':
        return <AdminUsers />;
      case 'admin-apis':
        return <AdminApis />;
      case 'admin-billing':
        return <AdminBilling />;
      case 'admin-activity':
        return <AdminSystem />;
      case 'admin-database':
        return <AdminDatabase />;
      case 'admin-engine':
        return <AdminEngineRoom />;
      case 'admin-devops':
        return <AdminDevOps />;
      case 'admin-forensics':
        return <AdminForensics />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <SoftDeleteProvider>
      <div className="noise-overlay admin-noise"></div>
      <div className="admin-layout-wrapper">
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

        <div className="admin-main">
          <AdminHeader />

          <div className="admin-page-content stagger-2">{renderContent()}</div>
        </div>
      </div>

      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
      />
    </SoftDeleteProvider>
  );
};
