import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { X } from 'lucide-react';

import { AdminApis } from '../../pages/AdminPanel/AdminApis';
import { AdminBilling } from '../../pages/AdminPanel/AdminBilling';
import { AdminDatabase } from '../../pages/AdminPanel/AdminDatabase';
import { AdminDevOps } from '../../pages/AdminPanel/AdminDevOps';
import { AdminEngineRoom } from '../../pages/AdminPanel/AdminEngineRoom';
import { AdminForensics } from '../../pages/AdminPanel/AdminForensics';
import { AdminOverview } from '../../pages/AdminPanel/AdminOverview';
import { AdminSystem } from '../../pages/AdminPanel/AdminSystem';
import { AdminUsers } from '../../pages/AdminPanel/AdminUsers';
import { AdminDenied } from '../../pages/AdminPanel/AdminDenied';
import { NavigationTab } from '../../types/api';

import { CommandHeader } from '../../components/CommandHeader';
import { CommandSidebar } from '../../components/CommandSidebar';
import { AdminCommandPalette } from './components/AdminCommandPalette';
import { SoftDeleteProvider } from './context/SoftDeleteContext';
import { AdminUIProvider, useAdminUI } from './context/AdminUIContext';
import './AdminLayout.css';

// Custom glowing resize handle
const ResizeHandle = () => (
  <PanelResizeHandle className="relative flex w-2 items-center justify-center bg-transparent group outline-none cursor-col-resize z-50">
    <div className="z-10 flex h-full w-[1px] bg-white/5 transition-all duration-300 group-hover:w-[2px] group-hover:bg-[#a78bfa] group-hover:shadow-[0_0_12px_rgba(167,139,250,0.8)] group-active:bg-[#f472b6] group-active:shadow-[0_0_12px_rgba(244,114,182,0.8)]" />
  </PanelResizeHandle>
);

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
      case 'admin-overview': return <AdminOverview />;
      case 'admin-users': return <AdminUsers />;
      case 'admin-apis': return <AdminApis />;
      case 'admin-billing': return <AdminBilling />;
      case 'admin-activity': return <AdminSystem />;
      case 'admin-database': return <AdminDatabase />;
      case 'admin-engine': return <AdminEngineRoom />;
      case 'admin-devops': return <AdminDevOps />;
      case 'admin-forensics': return <AdminForensics />;
      case 'admin-denied': return <AdminDenied />;
      default: return <AdminOverview />;
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
      
      <motion.div 
        className="admin-layout-wrapper"
        initial={false}
        animate={{ opacity: 1 }}
      >
        {/* Sidebar is now structurally fixed outside the resizable layout */}
        <CommandSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

        {/* The main workspace requires ml-20 to accommodate the fixed w-20 sidebar */}
        <div className="ml-20 flex-1 min-w-0 h-full w-full">
          <PanelGroup orientation="horizontal" className="h-full w-full min-w-0">
            
            {/* Panel 2: Main Content */}
            <Panel defaultSize={isDrawerOpen ? 60 : 100}>
              <div className="admin-main h-full flex flex-col min-w-0">
                <CommandHeader />
                <main className="admin-page-content stagger-2 flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                  {renderContent()}
                </main>
              </div>
            </Panel>

          {/* Panel 3: Inspector Panel */}
          {isDrawerOpen && (
            <>
              <ResizeHandle />
              <Panel 
                defaultSize={34} 
                minSize={20} 
                maxSize={50}
                className="bg-[#0f0f14]/80 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ x: 20, opacity: 0 }} 
                  animate={{ x: 0, opacity: 1 }} 
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="h-full flex flex-col"
                >
                  <div className="sticky top-0 z-10 bg-transparent border-b border-white/5 p-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white m-0">{drawerTitle}</h2>
                    <button 
                      onClick={closeDrawer} 
                      className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full outline-none"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                    {drawerContent}
                  </div>
                </motion.div>
              </Panel>
            </>
          )}

        </PanelGroup>
        </div>
      </motion.div>

      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
      />
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
