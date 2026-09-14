import React from 'react';
import { motion, useInView } from 'framer-motion';

interface GlowingRadialRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  glowColor?: string;
  label?: string;
  value?: string;
}

export const GlowingRadialRing: React.FC<GlowingRadialRingProps> = ({
  percentage,
  size = 120,
  strokeWidth = 8,
  color = '#a78bfa',
  glowColor = 'rgba(167, 139, 250, 0.6)',
  label,
  value
}) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div ref={ref} className="radial-ring-container" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id={`glow-${color.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={glowColor} floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />

        {/* Animated Progress Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: isInView ? strokeDashoffset : circumference }}
          transition={{ type: "spring", stiffness: 45, damping: 15, delay: 0.2 }}
          style={{ filter: `url(#glow-${color.replace('#', '')})` }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {/* Center Label/Value */}
      {(label || value) && (
        <div className="radial-ring-content" style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {value && (
            <span style={{ fontSize: size * 0.22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {value}
            </span>
          )}
          {label && (
            <span style={{ fontSize: size * 0.1, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
