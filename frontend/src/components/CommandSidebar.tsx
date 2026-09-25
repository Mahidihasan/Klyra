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
import { usePermissions } from '../context/PermissionsContext';

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
  const { hasPermission } = usePermissions();

  const adminNav = [
    { id: 'admin-overview', label: 'Platform Overview', icon: BarChart3, req: 'VIEW_ANALYTICS_DASHBOARD' },
    { id: 'admin-users', label: 'User Management', icon: Users, req: 'VIEW_USERS' },
    { id: 'admin-apis', label: 'API & Marketplace', icon: Network, req: 'VIEW_APIS' },
    { id: 'admin-billing', label: 'Billing & Payments', icon: CreditCard, req: 'VIEW_BILLING_INVOICES' },
    { id: 'admin-activity', label: 'Reports & Security', icon: ShieldAlert, req: 'VIEW_SECURITY_LOGS' },
    { id: 'admin-database', label: 'Database & Logs', icon: Database, req: 'VIEW_DATABASE_METRICS' },
    { id: 'admin-engine', label: 'Engine Room', icon: TerminalSquare, req: 'ACCESS_ENGINE_ROOM' },
    { id: 'admin-devops', label: 'DevOps & Auth', icon: Cpu, req: 'VIEW_SERVER_HEALTH' },
    { id: 'admin-forensics', label: 'Fin Forensics', icon: FileSearch, req: 'VIEW_TACTICAL_BOARD' },
  ].filter(item => hasPermission(item.req));

  return (
      <aside className="fixed top-0 left-0 h-screen w-20 flex flex-col items-center justify-between border-r border-white/5 bg-[#0a0a0f] py-6 z-[9999]">
      
      {/* Logo / Brand */}
      <div className="flex-shrink-0 flex justify-center w-full pb-6 border-b border-white/5">
        <MagneticWrapper magneticRadius={30} strength={0.3}>
          <div className="brand-icon">
            <Command size={22} className="text-white" />
          </div>
        </MagneticWrapper>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto w-full [&::-webkit-scrollbar]:hidden [scrollbar-width:none] flex flex-col gap-4 items-center pt-6 pb-6">
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
      <div className="flex-shrink-0 mt-auto flex justify-center w-full pt-6 border-t border-white/5">
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

      <style>{`
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
    </aside>
  );
};
