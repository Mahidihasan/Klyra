import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

import { CommandHeader } from '../../components/CommandHeader';
import { CommandSidebar } from '../../components/CommandSidebar';
import { AdminCommandPalette } from './components/AdminCommandPalette';
import { SoftDeleteProvider } from './context/SoftDeleteContext';
import { AdminUIProvider, useAdminUI } from './context/AdminUIContext';
import { SlideOverDrawer } from '../../components/SlideOverDrawer';
import './AdminLayout.css';

interface AdminLayoutProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
}

const AdminLayoutInner: React.FC<AdminLayoutProps> = ({ activeTab, setActiveTab }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { isDrawerOpen, drawerContent, drawerTitle, closeDrawer } = useAdminUI();

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
    <>
      <div className="aurora-bg">
        <div className="aurora-blob aurora-1"></div>
        <div className="aurora-blob aurora-2"></div>
        <div className="aurora-blob aurora-3"></div>
      </div>
      <div className="noise-overlay admin-noise"></div>
      
      <CommandSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      {/* Wrapping the main layout in motion.div for the scaling effect */}
      <motion.div 
        className="admin-layout-wrapper"
        animate={{ 
          scale: isDrawerOpen ? 0.98 : 1,
          opacity: isDrawerOpen ? 0.6 : 1,
          borderRadius: isDrawerOpen ? '24px' : '0px'
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        style={{ transformOrigin: 'center center' }}
      >
        <div className="admin-main ml-24">
          <CommandHeader />

          <div className="admin-page-content stagger-2">{renderContent()}</div>
        </div>
      </motion.div>

      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
      />

      <SlideOverDrawer 
        isOpen={isDrawerOpen} 
        onClose={closeDrawer} 
        title={drawerTitle}
      >
        {drawerContent}
      </SlideOverDrawer>
    </>
  );
};

export const AdminLayout: React.FC<AdminLayoutProps> = (props) => {
  return (
    <SoftDeleteProvider>
      <AdminUIProvider>
        <AdminLayoutInner {...props} />
      </AdminUIProvider>
    </SoftDeleteProvider>
  );
};
