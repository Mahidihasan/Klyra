import React, { useEffect, useState, useRef } from 'react';
import { Search, Command, ArrowRight, UserPlus, FilePlus, ShieldAlert, BarChart3, Users, Network, CreditCard } from 'lucide-react';
import { NavigationTab } from '../../../types/api';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: NavigationTab) => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({ isOpen, onClose, setActiveTab }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global Ctrl+K handler for Admin Layout specifically
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // The parent handles toggling state, but we can also manage it here if we pass open state down
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigateTo = (tab: NavigationTab) => {
    setActiveTab(tab);
    onClose();
  };

  const handleAction = (action: string) => {
    alert(`Triggered Admin Action: ${action}`);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '12vh'
    }} onClick={onClose}>
      
      <div 
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'rgba(20, 21, 36, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'paletteIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Search size={20} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search admin commands, users, or go to..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 16,
              outline: 'none',
              marginLeft: 12
            }}
          />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 6 }}>
            <Command size={12} /> K
          </div>
        </div>

        <div style={{ padding: 12, maxHeight: 400, overflowY: 'auto' }}>
          
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Navigation
          </div>
          
          <div className="cmd-item" onClick={() => navigateTo('admin-overview')}>
            <BarChart3 size={16} /> Platform Overview <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </div>
          <div className="cmd-item" onClick={() => navigateTo('admin-users')}>
            <Users size={16} /> User Management <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </div>
          <div className="cmd-item" onClick={() => navigateTo('admin-apis')}>
            <Network size={16} /> API & Marketplace <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </div>
          <div className="cmd-item" onClick={() => navigateTo('admin-billing')}>
            <CreditCard size={16} /> Billing & Payments <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </div>
          <div className="cmd-item" onClick={() => navigateTo('admin-activity')}>
            <ShieldAlert size={16} /> Reports & Security <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '16px 12px 8px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Actions
          </div>
          
          <div className="cmd-item" onClick={() => handleAction('Create New User')}>
            <UserPlus size={16} color="#3b82f6" /> Create New User
          </div>
          <div className="cmd-item" onClick={() => handleAction('Approve Pending APIs')}>
            <FilePlus size={16} color="#22c55e" /> Approve Pending APIs
          </div>
          <div className="cmd-item" onClick={() => handleAction('Trigger Maintenance Mode')}>
            <ShieldAlert size={16} color="#f59e0b" /> Toggle Maintenance Mode
          </div>
          
        </div>
      </div>
      <style>{`
        @keyframes paletteIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .cmd-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cmd-item:hover {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
        }
      `}</style>
    </div>
  );
};
