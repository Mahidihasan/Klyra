import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface SoftDeleteContextProps {
  softDelete: (itemId: string, itemName: string, onUndo?: () => void) => void;
}

const SoftDeleteContext = createContext<SoftDeleteContextProps | undefined>(undefined);

export const useSoftDelete = () => {
  const context = useContext(SoftDeleteContext);
  if (!context) {
    throw new Error('useSoftDelete must be used within a SoftDeleteProvider');
  }
  return context;
};

interface NotificationData {
  id: string;
  itemName: string;
  onUndo?: () => void;
}

export const SoftDeleteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const softDelete = (itemId: string, itemName: string, onUndo?: () => void) => {
    // Clear any existing notification/timer
    if (timer) clearTimeout(timer);
    
    setNotification({ id: itemId, itemName, onUndo });

    // Auto-dismiss after 6 seconds
    const newTimer = setTimeout(() => {
      setNotification(null);
    }, 6000);
    setTimer(newTimer);
  };

  const handleUndo = () => {
    if (notification?.onUndo) {
      notification.onUndo();
    }
    if (timer) clearTimeout(timer);
    setNotification(null);
  };

  return (
    <SoftDeleteContext.Provider value={{ softDelete }}>
      {children}
      
      {/* Global Soft Delete Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'rgba(20, 21, 36, 0.95)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(16px)',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 9999,
          color: 'var(--text-primary)'
        }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 8 }}>
            <Trash2 size={18} color="#ef4444" />
          </div>
          
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Moved to trash</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              <span style={{ color: 'var(--text-primary)' }}>{notification.itemName}</span> will be permanently deleted in 30 days.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {notification.onUndo && (
              <button 
                onClick={handleUndo}
                style={{ 
                  background: 'none', border: '1px solid var(--border-subtle)', 
                  color: 'var(--text-primary)', padding: '6px 12px', 
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                Undo
              </button>
            )}
            <button 
              onClick={() => { if (timer) clearTimeout(timer); setNotification(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </SoftDeleteContext.Provider>
  );
};
