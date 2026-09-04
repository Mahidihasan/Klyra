import React from 'react';
import { 
  Home, 
  Cpu, 
  Layers, 
  Repeat, 
  Terminal, 
  FolderOpen, 
  Sliders, 
  Key, 
  Clock, 
  BarChart3, 
  Wallet, 
  CreditCard, 
  Settings, 
  LogOut, 
  Zap, 
  ChevronRight,
  Crown,
  X,
  Plug
} from 'lucide-react';
import { NavigationTab } from '../types/api';

interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenNewRequest: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewRequest,
  isMobileOpen,
  onCloseMobile
}) => {

  const discoverNav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'apis', label: 'APIs', icon: Cpu },
  ];

  const workspaceNav = [
    { id: 'my-apis', label: 'My APIs', icon: Layers },
    { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
    { id: 'playground', label: 'Playground', icon: Terminal },
    
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'collections', label: 'Collections', icon: FolderOpen },
    { id: 'environments', label: 'Environments', icon: Sliders },
    { id: 'history', label: 'History', icon: Clock },
  ];

  // Billing owns a group of screens, so it expands instead of navigating flat.
  const billingChildren = [
    { id: 'billing', label: 'Overview' },
    { id: 'billing-invoices', label: 'Invoices' },
    { id: 'billing-payments', label: 'Payment history' },
    { id: 'billing-methods', label: 'Payment methods' },
    { id: 'billing-info', label: 'Billing information' },
  ];

  const accountNav = [
    { id: 'usage', label: 'Usage', icon: BarChart3, children: undefined as typeof billingChildren | undefined },
    { id: 'wallet', label: 'Wallet', icon: Wallet, children: undefined },
    { id: 'billing', label: 'Billing', icon: CreditCard, children: billingChildren },
    { id: 'settings', label: 'Settings', icon: Settings, children: undefined },
    { id: 'logout', label: 'Logout', icon: LogOut, children: undefined },
  ];

  const isBillingSection = activeTab.startsWith('billing');
  const [isBillingOpen, setIsBillingOpen] = React.useState<boolean>(isBillingSection);

  // Keep the group open when navigation lands on a billing screen elsewhere.
  React.useEffect(() => {
    if (isBillingSection) setIsBillingOpen(true);
  }, [isBillingSection]);

  const handleNavClick = (tabId: string) => {
    if (tabId === 'logout') {
      alert('Logging out of Klyra API lifecycle platform.');
      return;
    }
    setActiveTab(tabId as NavigationTab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile overlay background */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 99,
          }}
        />
      )}

      <aside className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Mobile Close Button */}
        <button className="mobile-close-btn" onClick={onCloseMobile}>
          <X size={20} />
        </button>
        {/* Action Button */}
        <div className="sidebar-action-container">
          <button className="new-request-btn" onClick={onOpenNewRequest}>
            < Plug size={16} />
            <span>API Build</span>
          </button>
        </div>

        {/* Nav Sections */}
        <div className="sidebar-nav-scroll">
          
          {/* DISCOVER */}
          <div className="nav-section">
            <div className="nav-section-title">DISCOVER</div>
            {discoverNav.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <IconComponent size={18} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* MY WORKSPACE */}
          <div className="nav-section">
            <div className="nav-section-title">MY WORKSPACE</div>
            {workspaceNav.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <IconComponent size={18} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* ACCOUNT */}
          <div className="nav-section">
            <div className="nav-section-title">ACCOUNT</div>
            {accountNav.map((item) => {
              const IconComponent = item.icon;

              if (item.children) {
                const isGroupActive = activeTab.startsWith(item.id);
                return (
                  <div key={item.id} className="nav-group">
                    <button
                      className={`nav-item ${isGroupActive && !isBillingOpen ? 'active' : ''}`}
                      onClick={() => {
                        setIsBillingOpen((prev) => !prev);
                        if (!isGroupActive) handleNavClick(item.id);
                      }}
                      aria-expanded={isBillingOpen}
                    >
                      <IconComponent size={18} className="nav-icon" />
                      <span className="nav-label">{item.label}</span>
                      <ChevronRight
                        size={14}
                        className={`nav-chevron ${isBillingOpen ? 'open' : ''}`}
                      />
                    </button>

                    {isBillingOpen && (
                      <div className="nav-children">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            className={`nav-child ${activeTab === child.id ? 'active' : ''}`}
                            onClick={() => handleNavClick(child.id)}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <IconComponent size={18} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>

        </div>

        {/* Upgrade Card at Bottom */}
        <div className="sidebar-footer">
          <div className="upgrade-card" onClick={() => handleNavClick('billing')}>
            <div className="upgrade-card-left">
              <div className="crown-icon-badge">
                <Crown size={16} color="#f59e0b" />
              </div>
              <div className="upgrade-info">
                <div className="upgrade-title">Upgrade to Pro</div>
                <div className="upgrade-sub">Unlock advanced features</div>
              </div>
            </div>
            <ChevronRight size={16} className="upgrade-arrow" />
          </div>
        </div>

        <style>{`
          .sidebar-container {
            width: var(--sidebar-width);
            background-color: var(--bg-sidebar);
            border-right: 1px solid var(--border-card);
            position: fixed;
            top: var(--topbar-height);
            bottom: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            z-index: 100;
            overflow: hidden;
          }

          @media (max-width: 1024px) {
            .sidebar-container {
              transform: translateX(-100%);
            }
            .sidebar-container.mobile-open {
              transform: translateX(0);
            }
          }

          .mobile-close-btn {
            display: none;
            position: absolute;
            top: 16px;
            right: 16px;
            color: var(--text-secondary);
          }

          @media (max-width: 1024px) {
            .mobile-close-btn {
              display: flex;
            }
          }

          .sidebar-action-container {
            padding: 16px 20px 12px 20px;
          }

          .new-request-btn {
            width: 100%;
            height: 40px;
            border-radius: var(--radius-md);
            background: var(--accent-gradient);
            color: #ffffff;
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
            transition: all 0.2s ease;
          }

          .new-request-btn:hover {
            background: var(--accent-gradient-hover);
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
          }

          .sidebar-nav-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 5px 12px;
            display: flex;
            flex-direction: column;
            gap: 18px;
            height:10px;
            scrollbar-width: thin;
            scrollbar-color: rgba(139, 92, 246, 0.15) transparent;
          }
            


          .nav-section-title {
            font-size: 10px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.08em;
            padding: 6px 12px 4px 12px;
          }

          .nav-item {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 9px 12px;
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 500;
            transition: all 0.15s ease;
            position: relative;
          }

          .nav-item:hover {
            color: var(--text-primary);
            background-color: rgba(255, 255, 255, 0.04);
          }

          .nav-item.active {
            color: var(--text-accent);
            background: linear-gradient(90deg, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.08) 100%);
            font-weight: 600;
          }

          .nav-item.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 6px;
            bottom: 6px;
            width: 3px;
            background: var(--accent-purple);
            border-radius: 0 4px 4px 0;
          }

          .nav-icon {
            color: inherit;
            flex-shrink: 0;
          }

          .nav-label {
            flex: 1;
            text-align: left;
          }

          .nav-group {
            display: flex;
            flex-direction: column;
          }

          .nav-chevron {
            color: var(--text-muted);
            transition: transform 0.15s ease;
            flex-shrink: 0;
          }

          .nav-chevron.open {
            transform: rotate(90deg);
          }

          .nav-children {
            display: flex;
            flex-direction: column;
            margin: 2px 0 4px 0;
            padding-left: 21px;
            border-left: 1px solid var(--border-subtle);
            margin-left: 21px;
          }

          .nav-child {
            width: 100%;
            text-align: left;
            padding: 7px 10px;
            border-radius: var(--radius-sm);
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
          }

          .nav-child:hover {
            color: var(--text-secondary);
            background-color: rgba(255, 255, 255, 0.04);
          }

          .nav-child.active {
            color: var(--text-accent);
            background-color: var(--accent-subtle);
            font-weight: 600;
          }

          .nav-badge {
            font-size: 10px;
            background: rgba(139, 92, 246, 0.2);
            color: var(--accent-purple);
            padding: 1px 6px;
            border-radius: 10px;
            font-weight: 600;
          }

          .sidebar-footer {
            padding: 16px;
            border-top: 1px solid var(--border-subtle);
          }

          .upgrade-card {
            background-color: var(--bg-card);
            border: 1px solid rgba(139, 92, 246, 0.25);
            border-radius: var(--radius-md);
            padding: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .upgrade-card:hover {
            border-color: var(--accent-purple);
            background-color: var(--bg-card-hover);
            transform: translateY(-1px);
          }

          .upgrade-card-left {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .crown-icon-badge {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            background: rgba(245, 158, 11, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .upgrade-info {
            display: flex;
            flex-direction: column;
          }

          .upgrade-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-primary);
          }

          .upgrade-sub {
            font-size: 10px;
            color: var(--text-muted);
          }

          .upgrade-arrow {
            color: var(--text-muted);
          }
        `}</style>
      </aside>
    </>
  );
};
