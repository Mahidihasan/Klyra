import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FloatingActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: { label: string; onClick: () => void; variant?: 'danger' | 'default' }[];
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  selectedCount,
  onClearSelection,
  actions
}) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          style={{
            position: 'fixed',
            bottom: '32px',
            left: '50%',
            x: '-50%',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            background: 'rgba(25, 25, 30, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '12px 24px',
            borderRadius: '100px', // Pill shape
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              color: '#fff', 
              padding: '2px 10px', 
              borderRadius: '20px', 
              fontSize: '14px', 
              fontWeight: 600 
            }}>
              {selectedCount}
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
              selected
            </span>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', gap: '8px' }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`action-btn ${action.variant === 'danger' ? 'danger' : ''}`}
              >
                {action.label}
              </button>
            ))}
            <button onClick={onClearSelection} className="action-btn ghost">
              Cancel
            </button>
          </div>

          <style>{`
            .action-btn {
              padding: 6px 16px;
              border-radius: 100px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              background: rgba(255, 255, 255, 0.05);
              color: #fff;
              border: 1px solid transparent;
            }
            .action-btn:hover {
              background: rgba(255, 255, 255, 0.1);
            }
            .action-btn.danger {
              color: #ef4444;
              background: rgba(239, 68, 68, 0.1);
            }
            .action-btn.danger:hover {
              background: rgba(239, 68, 68, 0.2);
            }
            .action-btn.ghost {
              background: transparent;
              color: rgba(255, 255, 255, 0.5);
            }
            .action-btn.ghost:hover {
              color: #fff;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
