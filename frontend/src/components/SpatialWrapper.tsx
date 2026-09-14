import React from 'react';

interface SpatialWrapperProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export const SpatialWrapper: React.FC<SpatialWrapperProps> = ({ 
  children, 
  className = '',
  glowColor = 'rgba(167, 139, 250, 0.15)' // Default brand purple glow
}) => {
  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* 
        Ambient Glow (Mica Effect)
        A highly blurred, fixed background that bleeds through the application
      */}
      <div 
        className="absolute inset-0 pointer-events-none z-[-1]"
        style={{
          background: `radial-gradient(100% 100% at 50% 0%, ${glowColor} 0%, transparent 80%)`,
          filter: 'blur(120px)',
          opacity: 0.8
        }}
      />
      {children}
    </div>
  );
};
