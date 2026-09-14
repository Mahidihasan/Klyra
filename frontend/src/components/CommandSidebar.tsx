import React from 'react';
import { motion } from 'framer-motion';
import { NavigationTab } from '../types/api';
import { 
  BarChart3, 
  Users, 
  Network, 
  CreditCard, 
  ShieldAlert, 
  LogOut, 
  Database, 
  TerminalSquare, 
  Cpu, 
  FileSearch,
  Command
} from 'lucide-react';
import { MagneticWrapper } from './MagneticWrapper';
import { Tooltip } from './Tooltip';

interface CommandSidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onLogout: () => void;
}

export const CommandSidebar: React.FC<CommandSidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onLogout 
}) => {
  const adminNav = [
    { id: 'admin-overview', label: 'Platform Overview', icon: BarChart3 },
    { id: 'admin-users', label: 'User Management', icon: Users },
    { id: 'admin-apis', label: 'API & Marketplace', icon: Network },
    { id: 'admin-billing', label: 'Billing & Payments', icon: CreditCard },
    { id: 'admin-activity', label: 'Reports & Security', icon: ShieldAlert },
    { id: 'admin-database', label: 'Database & Logs', icon: Database },
    { id: 'admin-engine', label: 'Engine Room', icon: TerminalSquare },
    { id: 'admin-devops', label: 'DevOps & Auth', icon: Cpu },
    { id: 'admin-forensics', label: 'Fin Forensics', icon: FileSearch },
  ];

  return (
    <div className="floating-sidebar">
      <div className="floating-sidebar-inner">
        {/* Logo / Brand */}
        <div className="floating-sidebar-header">
          <MagneticWrapper magneticRadius={30} strength={0.3}>
            <div className="brand-icon">
              <Command size={22} color="#fff" />
            </div>
          </MagneticWrapper>
        </div>

        {/* Navigation Items */}
        <nav className="floating-sidebar-nav">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <Tooltip key={item.id} content={item.label} direction="right">
                <MagneticWrapper magneticRadius={40} strength={0.4}>
                  <button
                    onClick={() => setActiveTab(item.id as NavigationTab)}
                    className={`floating-nav-item ${isActive ? 'active' : ''}`}
                    aria-label={item.label}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="active-pill"
                        initial={false}
                        transition={{ 
                          type: "spring", 
                          stiffness: 400, 
                          damping: 30,
                          mass: 0.8
                        }}
                      />
                    )}
                    <Icon 
                      size={20} 
                      className="nav-icon"
                      style={{ 
                        position: 'relative', 
                        zIndex: 10,
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                        transition: 'color 0.2s ease'
                      }} 
                    />
                  </button>
                </MagneticWrapper>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer / Actions */}
        <div className="floating-sidebar-footer">
          <Tooltip content="Exit Admin Panel" direction="right">
            <MagneticWrapper magneticRadius={30} strength={0.5}>
              <button 
                onClick={onLogout}
                className="floating-nav-item logout-btn"
                aria-label="Logout"
              >
                <LogOut size={20} color="#ef4444" />
              </button>
            </MagneticWrapper>
          </Tooltip>
        </div>
      </div>

      <style>{`
        .floating-sidebar {
          position: fixed;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .floating-sidebar-inner {
          background: rgba(15, 15, 20, 0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 32px;
          padding: 16px 8px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: 
            0 20px 40px rgba(0,0,0,0.4), 
            0 0 0 1px rgba(255,255,255,0.05) inset,
            0 10px 20px rgba(0,0,0,0.2) inset;
        }

        .floating-sidebar-header {
          display: flex;
          justify-content: center;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a78bfa, #f472b6);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(167, 139, 250, 0.4);
          cursor: pointer;
        }

        .floating-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
        }

        .floating-nav-item {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          position: relative;
          outline: none;
        }

        .floating-nav-item:hover .nav-icon {
          color: rgba(255,255,255,0.8) !important;
        }

        .floating-nav-item.active .nav-icon {
          color: #fff !important;
        }

        .active-pill {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          z-index: 1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .floating-sidebar-footer {
          display: flex;
          justify-content: center;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .logout-btn {
          background: rgba(239, 68, 68, 0.1);
          transition: background 0.2s;
        }
        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }
      `}</style>
    </div>
  );
};
