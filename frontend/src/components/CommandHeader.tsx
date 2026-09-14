import React from 'react';
import { Search, Bell, Settings } from 'lucide-react';
import { MagneticWrapper } from './MagneticWrapper';
import { Tooltip } from './Tooltip';

export const CommandHeader: React.FC = () => {
  return (
    <div className="command-header">
      <div className="header-search">
        <div className="search-pill">
          <Search size={16} className="search-icon" />
          <span>Search or jump to...</span>
          <kbd className="shortcut-kbd">⌘K</kbd>
        </div>
      </div>

      <div className="header-actions">
        <Tooltip content="Notifications" direction="bottom">
          <MagneticWrapper magneticRadius={30} strength={0.4}>
            <button className="header-btn" aria-label="Notifications">
              <Bell size={18} />
              <div className="notification-dot" />
            </button>
          </MagneticWrapper>
        </Tooltip>

        <Tooltip content="Settings" direction="bottom">
          <MagneticWrapper magneticRadius={30} strength={0.4}>
            <button className="header-btn" aria-label="Settings">
              <Settings size={18} />
            </button>
          </MagneticWrapper>
        </Tooltip>

        <Tooltip content="Admin Profile" direction="bottom">
          <MagneticWrapper magneticRadius={40} strength={0.3}>
            <button className="profile-btn" aria-label="Profile">
              <div className="profile-avatar">
                <span className="avatar-text">A</span>
              </div>
            </button>
          </MagneticWrapper>
        </Tooltip>
      </div>

      <style>{`
        .command-header {
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          padding-left: 140px; /* Make room for floating sidebar */
          background-color: transparent;
          z-index: 40;
          position: sticky;
          top: 0;
        }

        .header-search {
          display: flex;
          align-items: center;
        }

        .search-pill {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(15, 15, 20, 0.4);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 16px;
          border-radius: 20px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .search-pill:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.8);
        }

        .shortcut-kbd {
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
          margin-left: 12px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-btn {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 15, 20, 0.4);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }

        .header-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          transform: translateY(-1px);
        }

        .notification-dot {
          position: absolute;
          top: 8px;
          right: 10px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
        }

        .profile-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          border-radius: 50%;
        }

        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }

        .profile-btn:hover .profile-avatar {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .avatar-text {
          color: white;
          font-weight: 600;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};
