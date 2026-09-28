import React from 'react';

type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card' | 'tableRow';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Reusable generic Skeleton component providing an instantaneous (Linear-inspired) feel.
 * Uses Tailwind's animate-pulse and deep dark mode aesthetic.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  variant = 'text', 
  width, 
  height, 
  className = '' 
}) => {
  const baseStyle = {
    width: width,
    height: height,
  };

  // Vercel/Linear inspired deep dark mode skeleton colors
  const baseClasses = 'animate-pulse bg-[#1a1b26] border border-[#2a2b36]';

  const variantClasses = {
    text: 'rounded-md h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-xl h-32 w-full p-4 flex flex-col gap-3',
    tableRow: 'rounded-md h-12 w-full',
  };

  if (variant === 'card') {
    return (
      <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} style={baseStyle}>
        <div className="h-4 w-1/3 bg-[#2a2b36] rounded-md" />
        <div className="h-3 w-1/2 bg-[#2a2b36] rounded-md mt-2" />
        <div className="h-8 w-full bg-[#2a2b36] rounded-md mt-auto" />
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`} 
      style={baseStyle} 
    />
  );
};
