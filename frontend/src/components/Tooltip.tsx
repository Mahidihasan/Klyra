import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  direction = 'right',
  delay = 0.2 // Small delay prevents flashing when moving fast across icons
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay * 1000);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const directionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' },
  };

  const motionVariants: Variants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      x: direction === 'right' ? -10 : direction === 'left' ? 10 : 0,
      y: direction === 'bottom' ? -10 : direction === 'top' ? 10 : 0,
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      x: 0,
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: 400, 
        damping: 20, 
        mass: 0.5 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ display: 'inline-flex' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={motionVariants}
            style={{ 
              position: 'absolute',
              ...directionStyles[direction],
              zIndex: 100,
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
            className="tooltip-container"
          >
            <div style={{
              background: 'rgba(15, 15, 20, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#fff',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset'
            }}>
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
