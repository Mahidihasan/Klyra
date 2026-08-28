import React, { useState, useRef, useEffect } from 'react';
import { Search, Moon, Bell, ChevronDown, Menu, User, Key, LogOut, CheckCircle, Sliders, Shield } from 'lucide-react';
import { MOCK_NOTIFICATIONS } from '../data/mockData';
import klyraLogo from '../assets/images/klyra_logo.png';

interface TopbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenCommandPalette: () => void;
  onToggleMobileSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  searchQuery,
  setSearchQuery,
  onOpenCommandPalette,
  onToggleMobileSidebar,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <header className="topbar-container">
      {/* Left: Logo + Title */}
      <div className="topbar-left">
        {/* Mobile Toggle Button */}
        <button className="mobile-menu-btn" onClick={onToggleMobileSidebar}>
          <Menu size={20} />
        </button>

        <div className="topbar-logo">
          <img src={klyraLogo} alt="Klyra Logo" className="logo-image" />
          <span className="logo-title">KLYRA</span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="search-field-container" onClick={onOpenCommandPalette}>
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search for APIs, collections, or providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Right: Notification Bell + Profile Avatar */}
      <div className="topbar-right">
        {/* Notifications Popover Container */}
        <div className="popover-wrapper" ref={notifRef}>
          <button
            className="topbar-btn relative"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown-panel notif-panel animate-fade-in">
              <div className="panel-header">
                <span className="panel-title">Notifications</span>
                {unreadCount > 0 && (
                  <button className="mark-read-btn" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="panel-body">
                {notifications.map(n => (
                  <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                    <div className="notif-title-row">
                      <span className="notif-item-title">{n.title}</span>
                      <span className="notif-time">{n.time}</span>
                    </div>
                    <p className="notif-msg">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="popover-wrapper" ref={userRef}>
          <button
            className="user-profile-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">AD</div>
          </button>

          {showUserMenu && (
            <div className="dropdown-panel user-panel animate-fade-in">
              <div className="user-menu-header">
                <div className="user-avatar-large">AD</div>
                <div>
                  <div className="user-full-name">Alex Dev</div>
                  <div className="user-email">developer@apimarket.io</div>
                </div>
              </div>
              <div className="user-menu-divider" />
              <button className="user-menu-item" onClick={() => setShowUserMenu(false)}>
                <User size={16} />
                <span>My Profile</span>
              </button>
              <button className="user-menu-item" onClick={() => setShowUserMenu(false)}>
                <Key size={16} />
                <span>API Keys & Credentials</span>
              </button>
              <button className="user-menu-item" onClick={() => setShowUserMenu(false)}>
                <Sliders size={16} />
                <span>Organization Settings</span>
              </button>
              <button className="user-menu-item" onClick={() => setShowUserMenu(false)}>
                <Shield size={16} />
                <span>Audit Logs</span>
              </button>
              <div className="user-menu-divider" />
              <button className="user-menu-item logout" onClick={() => setShowUserMenu(false)}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
  /* =========================================================
     TOPBAR
     ========================================================= */

  .topbar-container {
    height: var(--topbar-height);
    background: var(--bg-topbar);

    border-bottom: 1px solid rgba(255, 255, 255, 0.055);

    display: flex;
    align-items: center;

    padding: 0 28px;

    position: sticky;
    top: 0;
    z-index: 90;

    gap: 28px;

    width: 100%;
    box-sizing: border-box;
  }


  /* =========================================================
     LEFT SIDE
     ========================================================= */

  .topbar-left {
    display: flex;
    align-items: center;

    gap: 8px;

    flex: 0 0 auto;
    min-width: 210px;
  }


  .mobile-menu-btn {
    display: none;

    width: 34px;
    height: 34px;

    align-items: center;
    justify-content: center;

    color: var(--text-secondary);

    border-radius: 8px;

    transition:
      background-color 0.18s ease,
      color 0.18s ease;
  }


  .mobile-menu-btn:hover {
    background: rgba(255, 255, 255, 0.045);
    color: var(--text-primary);
  }


  @media (max-width: 1024px) {
    .mobile-menu-btn {
      display: flex;
    }

    .topbar-left {
      min-width: auto;
    }
  }


  /* =========================================================
     LOGO
     ========================================================= */

  .topbar-logo {
    display: flex;
    align-items: center;
    gap: 11px;

    text-decoration: none;
    white-space: nowrap;
  }


  .logo-image {
    width: 43px;
    height: 43px;

    flex-shrink: 0;

    object-fit: contain;

    border-radius: 9px;
  }


  .logo-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: #ffffff;
}


  /* =========================================================
     SEARCH
     ========================================================= */

  .search-field-container {
    position: relative;
    width: 480px;
    max-width: 480px;
    flex: 0 1 480px;
    margin: 0 auto;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 15px;
    width: 17px;
    height: 17px;
    color: var(--text-muted);
    pointer-events: none;
    z-index: 2;
  }

  .search-input {
    width: 100%;
    height: 42px;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 20px;

    padding:
      0 72px
      0 43px;

    color: var(--text-primary);

    font-family: var(--font-sans, 'Inter', sans-serif);

    font-size: 13px;

    outline: none;

    transition:
      border-color 0.18s ease,
      background-color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .search-input::placeholder {
    color: var(--text-muted);
    opacity: 0.8;
  }

  .search-input:hover {
    border-color: rgba(255, 255, 255, 0.11);
    background: rgba(255, 255, 255, 0.035);
  }

  .search-input:focus {
    border-color: rgba(139, 92, 246, 0.45);

    background: rgba(255, 255, 255, 0.035);

    box-shadow:
      0 0 0 3px rgba(139, 92, 246, 0.08);
  }

  .kbd-badge {
    position: absolute;

    right: 11px;

    height: 22px;

    padding: 0 7px;

    display: flex;
    align-items: center;
    justify-content: center;

    background: rgba(255, 255, 255, 0.035);

    border: 1px solid rgba(255, 255, 255, 0.08);

    border-radius: 5px;

    font-size: 10px;

    color: var(--text-muted);

    font-family: var(--font-mono, monospace);

    user-select: none;
  }


  /* =========================================================
     RIGHT SIDE
     ========================================================= */

  .topbar-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;

    gap: 10px;

    flex: 0 0 auto;

    min-width: 210px;
  }


  /* =========================================================
     ICON BUTTONS
     ========================================================= */

  .topbar-btn {
    width: 36px;
    height: 36px;

    flex-shrink: 0;

    border-radius: 9px;

    background: transparent;

    border: 1px solid transparent;

    color: var(--text-secondary);

    display: flex;
    align-items: center;
    justify-content: center;

    position: relative;

    transition:
      color 0.18s ease,
      background-color 0.18s ease,
      border-color 0.18s ease;
  }


  .topbar-btn:hover {
    color: var(--text-primary);

    background: rgba(255, 255, 255, 0.045);

    border-color: rgba(255, 255, 255, 0.065);
  }


  .topbar-btn:active {
    background: rgba(255, 255, 255, 0.07);
  }


  /* =========================================================
     NOTIFICATION
     ========================================================= */

  .notif-badge {
    position: absolute;

    top: 1px;
    right: 1px;

    min-width: 15px;
    height: 15px;

    padding: 0 3px;

    box-sizing: border-box;

    background-color: #f90000;

    color: #fff;

    font-size: 9px;
    font-weight: 700;

    border-radius: 999px;

    display: flex;
    align-items: center;
    justify-content: center;

    border: 2px solid var(--bg-topbar);
  }


  /* =========================================================
     POPOVER
     ========================================================= */

  .popover-wrapper {
    position: relative;
  }


  /* =========================================================
     USER PROFILE
     ========================================================= */

  .user-profile-btn {
    display: flex;
    align-items: center;

    gap: 9px;

    height: 38px;

    padding: 3px 9px 3px 4px;

    border-radius: 9px;

    background: transparent;

    border: 1px solid transparent;

    transition:
      background-color 0.18s ease,
      border-color 0.18s ease;
  }


  .user-profile-btn:hover {
    background: rgba(255, 255, 255, 0.045);

    border-color: rgba(255, 255, 255, 0.065);
  }


  .user-avatar {
    width: 30px;
    height: 30px;

    flex-shrink: 0;

    border-radius: 50%;

    background: var(--accent-gradient);

    color: #fff;

    font-weight: 700;
    font-size: 10px;

    display: flex;
    align-items: center;
    justify-content: center;
  }


  .user-name {
    font-size: 13px;

    font-weight: 550;

    color: var(--text-primary);

    white-space: nowrap;
  }


  .chevron-icon {
    color: var(--text-muted);

    transition: transform 0.18s ease;
  }


  .user-profile-btn:hover .chevron-icon {
    color: var(--text-secondary);
  }


  @media (max-width: 640px) {
    .user-name {
      display: none;
    }

    .topbar-container {
      padding: 0 16px;
      gap: 12px;
    }

    .topbar-right {
      min-width: auto;
    }

    .topbar-left {
      min-width: auto;
    }

    .logo-title {
      display: none;
    }

    .search-field-container {
      margin: 0;
    }
  }


  @media (max-width: 768px) {
    .search-field-container {
      max-width: none;
    }

    .kbd-badge {
      display: none;
    }

    .search-input {
      padding-right: 15px;
    }
  }


  /* =========================================================
     DROPDOWN PANELS
     ========================================================= */

  .dropdown-panel {
    position: absolute;

    top: calc(100% + 10px);
    right: 0;

    background: var(--bg-modal);

    border: 1px solid rgba(255, 255, 255, 0.075);

    border-radius: 12px;

    box-shadow:
      0 18px 45px rgba(0, 0, 0, 0.35),
      0 4px 12px rgba(0, 0, 0, 0.15);

    z-index: 120;

    overflow: hidden;

    animation: dropdown-enter 0.16s ease-out;
  }


  @keyframes dropdown-enter {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }


  /* =========================================================
     NOTIFICATION PANEL
     ========================================================= */

  .notif-panel {
    width: 340px;
  }


  .panel-header {
    min-height: 48px;

    padding: 0 16px;

    border-bottom: 1px solid rgba(255, 255, 255, 0.06);

    display: flex;
    align-items: center;
    justify-content: space-between;
  }


  .panel-title {
    font-size: 13px;

    font-weight: 600;

    color: var(--text-primary);
  }


  .mark-read-btn {
    font-size: 11px;

    color: var(--text-accent);

    transition: opacity 0.15s ease;
  }


  .mark-read-btn:hover {
    opacity: 0.75;
  }


  .panel-body {
    max-height: 320px;

    overflow-y: auto;

    scrollbar-width: thin;
  }


  /* =========================================================
     NOTIFICATION ITEM
     ========================================================= */

  .notif-item {
    padding: 14px 16px;

    border-bottom: 1px solid rgba(255, 255, 255, 0.045);

    transition:
      background-color 0.15s ease;
  }


  .notif-item:last-child {
    border-bottom: none;
  }


  .notif-item:hover {
    background: rgba(255, 255, 255, 0.025);
  }


  .notif-item.unread {
    background: rgba(139, 92, 246, 0.055);
  }


  .notif-title-row {
    display: flex;
    align-items: center;

    gap: 12px;

    margin-bottom: 5px;
  }


  .notif-item-title {
    flex: 1;

    font-size: 12px;

    font-weight: 600;

    color: var(--text-primary);
  }


  .notif-time {
    flex-shrink: 0;

    font-size: 10px;

    color: var(--text-muted);
  }


  .notif-msg {
    font-size: 11px;

    line-height: 1.55;

    color: var(--text-secondary);
  }


  /* =========================================================
     USER DROPDOWN
     ========================================================= */

  .user-panel {
    width: 250px;

    padding: 7px 0;
  }


  .user-menu-header {
    padding: 13px 16px 14px;

    display: flex;
    align-items: center;

    gap: 11px;
  }


  .user-avatar-large {
    width: 36px;
    height: 36px;

    flex-shrink: 0;

    border-radius: 50%;

    background: var(--accent-gradient);

    color: #fff;

    font-weight: 700;
    font-size: 12px;

    display: flex;
    align-items: center;
    justify-content: center;
  }


  .user-full-name {
    font-size: 13px;

    font-weight: 600;

    color: var(--text-primary);

    line-height: 1.3;
  }


  .user-email {
    margin-top: 2px;

    font-size: 11px;

    color: var(--text-muted);

    line-height: 1.3;
  }


  .user-menu-divider {
    height: 1px;

    background: rgba(255, 255, 255, 0.06);

    margin: 5px 0;
  }


  /* =========================================================
     USER MENU ITEMS
     ========================================================= */

  .user-menu-item {
    width: 100%;

    min-height: 36px;

    box-sizing: border-box;

    padding: 0 16px;

    display: flex;
    align-items: center;

    gap: 10px;

    font-size: 12px;

    color: var(--text-secondary);

    transition:
      color 0.15s ease,
      background-color 0.15s ease;
  }


  .user-menu-item svg {
    color: var(--text-muted);

    transition: color 0.15s ease;
  }


  .user-menu-item:hover {
    background: rgba(255, 255, 255, 0.04);

    color: var(--text-primary);
  }


  .user-menu-item:hover svg {
    color: var(--text-secondary);
  }


  .user-menu-item.logout:hover {
    color: #ef4444;

    background: rgba(239, 68, 68, 0.07);
  }


  .user-menu-item.logout:hover svg {
    color: #ef4444;
  }


  /* =========================================================
     LARGE SCREEN REFINEMENT
     ========================================================= */

  @media (min-width: 1440px) {
    .topbar-container {
      padding-left: 32px;
      padding-right: 32px;
    }
  }


  /* =========================================================
     REDUCED MOTION
     ========================================================= */

  @media (prefers-reduced-motion: reduce) {
    .dropdown-panel,
    .topbar-btn,
    .user-profile-btn,
    .search-input,
    .user-menu-item {
      animation: none;
      transition: none;
    }
  }
`}</style>
    </header>
  );
};