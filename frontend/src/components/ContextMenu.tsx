import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  isOpen, 
  position, 
  actions, 
  onClose 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 9999,
            minWidth: '200px',
            background: 'rgba(25, 25, 30, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside from immediately closing via document handler
        >
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                action.onClick();
                onClose();
              }}
              className={`context-menu-item ${action.variant === 'danger' ? 'danger' : ''}`}
            >
              {action.icon && <span className="item-icon">{action.icon}</span>}
              <span className="item-label">{action.label}</span>
            </button>
          ))}
          <style>{`
            .context-menu-item {
              display: flex;
              align-items: center;
              gap: 12px;
              width: 100%;
              padding: 8px 12px;
              background: transparent;
              border: none;
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.85);
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.15s ease;
              text-align: left;
            }
            .context-menu-item:hover {
              background: rgba(255, 255, 255, 0.1);
              color: #fff;
            }
            .context-menu-item.danger {
              color: #ef4444;
            }
            .context-menu-item.danger:hover {
              background: rgba(239, 68, 68, 0.15);
            }
            .item-icon {
              display: flex;
              align-items: center;
              justify-content: center;
              color: inherit;
              opacity: 0.8;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
