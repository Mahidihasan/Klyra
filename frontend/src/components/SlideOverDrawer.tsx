import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Optional: Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay (just blocks clicks, layout scaling handles the visual dimming) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'transparent',
              cursor: 'pointer'
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', boxShadow: '0 0 0 rgba(0,0,0,0)' }}
            animate={{ 
              x: 0,
              boxShadow: '-20px 0 60px rgba(0,0,0,0.5)'
            }}
            exit={{ 
              x: '100%', 
              boxShadow: '0 0 0 rgba(0,0,0,0)',
              transition: { duration: 0.25, ease: 'easeIn' } 
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="slide-over-drawer"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '800px', // Massive drawer as requested
              background: 'var(--bg-app, #0f0f14)', // Matches app background usually
              zIndex: 9999,
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            {/* Sticky Header */}
            <div className="drawer-header" style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'rgba(15, 15, 20, 0.8)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#fff' }}>
                {title}
              </h2>
              <button 
                onClick={onClose}
                className="close-drawer-btn"
                aria-label="Close drawer"
              >
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="drawer-content" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '32px',
              scrollBehavior: 'smooth'
            }}>
              {children}
            </div>

            <style>{`
              .close-drawer-btn {
                width: 40px;
                height: 40px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid transparent;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .close-drawer-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                transform: scale(1.05);
              }
              
              /* Custom scrollbar for drawer content */
              .drawer-content::-webkit-scrollbar {
                width: 8px;
              }
              .drawer-content::-webkit-scrollbar-track {
                background: transparent;
              }
              .drawer-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
              }
              .drawer-content::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.2);
              }
            `}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
