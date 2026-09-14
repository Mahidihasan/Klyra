import React from 'react';
import { NavigationTab } from '../../types/api';
import { BarChart3, Users, Network, CreditCard, ShieldAlert, LogOut, Database, TerminalSquare, Cpu, FileSearch } from 'lucide-react';

interface AdminSidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <aside className="admin-sidebar stagger-1">
      <div className="admin-sidebar-header">
        <span className="admin-brand">Klyra</span>
        <span className="admin-badge">Admin</span>
      </div>

      <nav className="admin-nav">
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

      <div className="admin-sidebar-footer">
        <button 
          className="btn-ghost-action stagger-2" 
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
          onClick={onLogout}
        >
          <LogOut size={14} /> Exit Admin Panel
        </button>
      </div>
    </aside>
  );
};
