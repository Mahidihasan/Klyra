import React, { useState } from 'react';
import { NavigationTab } from '../../types/api';
import { BarChart3, Users, Network, CreditCard, ShieldAlert, LogOut, Database, TerminalSquare, Cpu, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminSidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onLogout: () => void;
}

const ContextSwitcher = ({ onLogout }: { onLogout: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = () => {
    setIsExiting(true);
    setTimeout(() => {
      onLogout();
    }, 600); // 0.6s cinematic fade out before actual route change
  };

  return (
    <>
      {/* Cinematic Transition Overlay */}
      <AnimatePresence>
        {isExiting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 bg-zinc-950 z-[9999] flex flex-col items-center justify-center gap-6"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full"
            />
            <span className="text-amber-500 font-mono text-[14px] font-bold uppercase tracking-widest animate-pulse drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
              Deactivating God-Mode...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleExit}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center justify-center bg-white/5 border border-white/10 rounded-full h-[40px] px-3 cursor-pointer transition-all duration-300 overflow-hidden hover:bg-amber-500/10 hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] mx-auto"
      >
        <LogOut size={16} className={`shrink-0 transition-colors duration-300 ${isHovered ? 'text-amber-400' : 'text-white/60'}`} />
        
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: 'auto', opacity: 1, marginLeft: 8 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="whitespace-nowrap overflow-hidden pr-2"
            >
              <span className="text-amber-400 font-mono text-[11px] font-bold uppercase tracking-widest">
                Deactivate
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <aside className="admin-sidebar stagger-1 h-screen flex flex-col">
      <div className="admin-sidebar-header shrink-0">
        <span className="admin-brand">Klyra</span>
        <span className="admin-badge">Admin</span>
      </div>

      <nav className="admin-nav flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div 
          className={`admin-nav-item ${activeTab === 'admin-overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-overview')}
        >
          <BarChart3 size={18} />
          Platform Overview
        </div>
        
        <div 
          className={`admin-nav-item ${activeTab === 'admin-users' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-users')}
        >
          <Users size={18} />
          User Management
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-apis' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-apis')}
        >
          <Network size={18} />
          API & Marketplace
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-billing')}
        >
          <CreditCard size={18} />
          Billing & Payments
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-activity')}
        >
          <ShieldAlert size={18} />
          Reports & Security
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-database' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-database')}
        >
          <Database size={18} />
          Database & Logs
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-engine' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-engine')}
        >
          <TerminalSquare size={18} />
          Engine Room
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-devops' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-devops')}
        >
          <Cpu size={18} />
          DevOps & Auth
        </div>

        <div 
          className={`admin-nav-item ${activeTab === 'admin-forensics' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin-forensics')}
        >
          <FileSearch size={18} />
          Fin Forensics
        </div>
      </nav>

      <div className="admin-sidebar-footer shrink-0 pb-6 flex justify-center">
        <ContextSwitcher onLogout={onLogout} />
      </div>
    </aside>
  );
};
