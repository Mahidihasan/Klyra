import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
  };

  const handleMouseEnter = () => {
    updateCoords();
    const id = setTimeout(() => setIsVisible(true), delay * 1000);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  // Re-calculate on window resize or scroll
  useEffect(() => {
    if (isVisible) {
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isVisible]);

  let top = 0;
  let left = 0;
  let xHidden: string | number = 0;
  let yHidden: string | number = 0;
  let xVisible: string | number = 0;
  let yVisible: string | number = 0;

  if (direction === 'right') {
    top = coords.top + coords.height / 2;
    left = coords.left + coords.width + 8;
    xHidden = -10;
    yHidden = '-50%';
    xVisible = 0;
    yVisible = '-50%';
  } else if (direction === 'left') {
    top = coords.top + coords.height / 2;
    left = coords.left - 8;
    xHidden = 'calc(-100% + 10px)';
    yHidden = '-50%';
    xVisible = '-100%';
    yVisible = '-50%';
  } else if (direction === 'top') {
    top = coords.top - 8;
    left = coords.left + coords.width / 2;
    xHidden = '-50%';
    yHidden = 'calc(-100% + 10px)';
    xVisible = '-50%';
    yVisible = '-100%';
  } else if (direction === 'bottom') {
    top = coords.top + coords.height + 8;
    left = coords.left + coords.width / 2;
    xHidden = '-50%';
    yHidden = -10;
    xVisible = '-50%';
    yVisible = 0;
  }

  const motionVariants: Variants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      x: xHidden,
      y: yHidden,
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      x: xVisible,
      y: yVisible,
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

  const portalContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={motionVariants}
          style={{ 
            position: 'fixed',
            top,
            left,
            zIndex: 9999,
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
  );

  return (
    <>
      <div 
        ref={anchorRef}
        className="relative flex items-center justify-center" 
        style={{ display: 'inline-flex' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {typeof document !== 'undefined' ? createPortal(portalContent, document.body) : null}
    </>
  );
};
