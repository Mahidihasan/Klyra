import React from 'react';
import { motion, useInView } from 'framer-motion';

interface AnimatedSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export const AnimatedSparkline: React.FC<AnimatedSparklineProps> = ({
  data,
  width = 200,
  height = 60,
  color = '#3b82f6',
  strokeWidth = 3
}) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10px" });

  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path 'd' string
  const pathData = data.reduce((acc, val, i) => {
    const x = (i / (data.length - 1)) * width;
    // Invert y because SVG y goes down
    const y = height - ((val - min) / range) * height;
    
    // Add padding for stroke width
    const paddedY = Math.max(strokeWidth / 2, Math.min(height - strokeWidth / 2, y));

    return i === 0 ? `M ${x} ${paddedY}` : `${acc} L ${x} ${paddedY}`;
  }, '');

  return (
    <div ref={ref} style={{ width, height, position: 'relative' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Fill Area (fades in) */}
        <motion.path
          d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
          fill={`url(#gradient-${color.replace('#', '')})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isInView ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        />

        {/* The Animated Line (draws left to right) */}
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: isInView ? 1 : 0, 
            opacity: isInView ? 1 : 0 
          }}
          transition={{ 
            pathLength: { type: "spring", duration: 1.5, bounce: 0 },
            opacity: { duration: 0.1 }
          }}
        />
      </svg>
    </div>
  );
};
