import React, { useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

interface MagneticWrapperProps {
  children: React.ReactNode;
  className?: string;
  magneticRadius?: number; // How far the effect reaches
  strength?: number; // How strong the pull is
}

export const MagneticWrapper: React.FC<MagneticWrapperProps> = ({ 
  children, 
  className = '',
  magneticRadius = 50,
  strength = 0.5 
}) => {
  const ref = useRef<HTMLDivElement>(null);
  
  // Motion values for tracking cursor position relative to center of element
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Apply spring physics for that smooth, native macOS feel
  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;
    
    // Check if mouse is within magnetic radius
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    if (distance < magneticRadius) {
      // Pull element towards cursor based on strength
      x.set(distanceX * strength);
      y.set(distanceY * strength);
    } else {
      // Reset if outside radius (though mouseleave usually catches this)
      x.set(0);
      y.set(0);
    }
  };

  const handleMouseLeave = () => {
    // Snap back to original position
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: smoothX, y: smoothY, display: 'inline-block' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
