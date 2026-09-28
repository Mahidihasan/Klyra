import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Code2,
  GitBranch,
  Shield,
  Globe,
  Zap,
  Cpu,
  Key,
  Layers,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

interface OrbitIconItem {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string;
  glow: string;
  radius: number;
  initialAngle: number;
  speed: number; // radians per second
  direction: 1 | -1;
}

export const HeroOrbitAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });

  // 1. Mouse Interaction (subtle tilt reaction to cursor)
  useEffect(() => {
    let animId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      targetX = Math.max(-1, Math.min(1, (e.clientX - centerX) / 250));
      targetY = Math.max(-1, Math.min(1, (e.clientY - centerY) / 250));
    };

    const animateTilt = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      setMouseTilt({ x: currentX, y: currentY });
      animId = requestAnimationFrame(animateTilt);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animId = requestAnimationFrame(animateTilt);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  // 2. Central Dotted & Glowing 3D Sphere Orb
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 72;
    const numPoints = 200;

    // Fibonacci distribution of points on sphere surface
    const points: Array<{ x: number; y: number; z: number }> = [];
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < numPoints; i++) {
      const y = 1 - (i / (numPoints - 1)) * 2;
      const rAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      points.push({
        x: Math.cos(theta) * rAtY * radius,
        y: y * radius,
        z: Math.sin(theta) * rAtY * radius,
      });
    }

    let rotY = 0;
    let rotX = 0.2;
    let animId: number;
    let startTime = performance.now();

    const render = (time: number) => {
      const elapsed = (time - startTime) * 0.001;
      ctx.clearRect(0, 0, size, size);

      rotY += 0.006 + mouseTilt.x * 0.004;
      rotX = 0.25 + Math.sin(elapsed * 0.6) * 0.1 - mouseTilt.y * 0.12;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const fov = 260;
      interface Projected {
        px: number;
        py: number;
        pz: number;
        alpha: number;
        dotSize: number;
        color: string;
      }

      const projected: Projected[] = [];

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const x1 = pt.x * cosY + pt.z * sinY;
        const z1 = -pt.x * sinY + pt.z * cosY;

        const y2 = pt.y * cosX - z1 * sinX;
        const z2 = pt.y * sinX + z1 * cosX;

        const scale = fov / (fov + z2);
        const px = cx + x1 * scale;
        const py = cy + y2 * scale;

        const normZ = (z2 + radius) / (radius * 2);
        const alpha = Math.max(0.12, Math.min(1, Math.pow(normZ, 1.5)));
        const dotSize = Math.max(1.2, 1.2 + normZ * 2.2);

        let color = `rgba(99, 102, 241, ${alpha * 0.5})`;
        if (normZ > 0.65) {
          color = `rgba(56, 189, 248, ${alpha})`;
        } else if (normZ > 0.38) {
          color = `rgba(168, 85, 247, ${alpha * 0.85})`;
        }

        projected.push({ px, py, pz: z2, alpha, dotSize, color });
      }

      // Sort points back to front
      projected.sort((a, b) => a.pz - b.pz);

      // Faint constellation threads on front points
      ctx.lineWidth = 0.7;
      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        if (p1.pz < -5) continue;

        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          if (p2.pz < -5) continue;

          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const distSq = dx * dx + dy * dy;

          if (distSq < 480) {
            const lineAlpha = (1 - distSq / 480) * p1.alpha * 0.24;
            ctx.strokeStyle = `rgba(147, 197, 253, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.stroke();
          }
        }
      }

      // Rotating Latitude rings
      const drawLatitude = (tilt: number, strokeColor: string) => {
        ctx.beginPath();
        const steps = 48;
        for (let k = 0; k <= steps; k++) {
          const angle = (k / steps) * Math.PI * 2;
          const gx = Math.cos(angle) * (radius + 2);
          const gy = Math.sin(angle) * Math.cos(tilt) * (radius + 2);
          const gz = Math.sin(angle) * Math.sin(tilt) * (radius + 2);

          const gx1 = gx * cosY + gz * sinY;
          const gz1 = -gx * sinY + gz * cosY;
          const gy2 = gy * cosX - gz1 * sinX;
          const gz2 = gy * sinX + gz1 * cosX;

          const scale = fov / (fov + gz2);
          const gpx = cx + gx1 * scale;
          const gpy = cy + gy2 * scale;

          if (k === 0) ctx.moveTo(gpx, gpy);
          else ctx.lineTo(gpx, gpy);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.9;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      drawLatitude(0, 'rgba(56, 189, 248, 0.28)');
      drawLatitude(Math.PI / 3, 'rgba(168, 85, 247, 0.24)');

      // Draw dots
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.dotSize, 0, Math.PI * 2);
        ctx.fill();

        if (p.pz > 30 && p.alpha > 0.7) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.dotSize * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Central glowing core pulse
      const corePulse = Math.sin(elapsed * 2.8) * 0.12 + 1;
      const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28 * corePulse);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coreGrad.addColorStop(0.3, 'rgba(168, 85, 247, 0.7)');
      coreGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.35)');
      coreGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 28 * corePulse, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric outer haze
      const hazeGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.3);
      hazeGrad.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
      hazeGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.06)');
      hazeGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');

      ctx.fillStyle = hazeGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [mouseTilt]);

  // 3. Orbiting Icons Configuration
  const ORBIT_ITEMS: OrbitIconItem[] = useMemo(
    () => [
      // Inner Orbit (Radius 120px)
      {
        id: 'icon-zap',
        icon: Zap,
        label: 'Edge Sandbox',
        color: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.55)',
        radius: 120,
        initialAngle: 0,
        speed: 0.42,
        direction: 1,
      },
      {
        id: 'icon-code',
        icon: Code2,
        label: 'API Designer',
        color: '#c084fc',
        glow: 'rgba(192, 132, 252, 0.55)',
        radius: 120,
        initialAngle: (Math.PI * 2) / 3,
        speed: 0.42,
        direction: 1,
      },
      {
        id: 'icon-terminal',
        icon: Terminal,
        label: 'CLI & SDKs',
        color: '#10b981',
        glow: 'rgba(16, 185, 129, 0.55)',
        radius: 120,
        initialAngle: (Math.PI * 4) / 3,
        speed: 0.42,
        direction: 1,
      },

      // Middle Orbit (Radius 165px, Counter-rotation)
      {
        id: 'icon-git',
        icon: GitBranch,
        label: 'Git Sync',
        color: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.55)',
        radius: 165,
        initialAngle: 0.8,
        speed: 0.28,
        direction: -1,
      },
      {
        id: 'icon-shield',
        icon: Shield,
        label: 'Zero-Trust',
        color: '#34d399',
        glow: 'rgba(52, 211, 153, 0.55)',
        radius: 165,
        initialAngle: 0.8 + (Math.PI * 2) / 3,
        speed: 0.28,
        direction: -1,
      },
      {
        id: 'icon-key',
        icon: Key,
        label: 'API Vault',
        color: '#fbbf24',
        glow: 'rgba(251, 191, 36, 0.55)',
        radius: 165,
        initialAngle: 0.8 + (Math.PI * 4) / 3,
        speed: 0.28,
        direction: -1,
      },

      // Outer Orbit (Radius 210px)
      {
        id: 'icon-globe',
        icon: Globe,
        label: 'Global Mesh',
        color: '#60a5fa',
        glow: 'rgba(96, 165, 250, 0.55)',
        radius: 210,
        initialAngle: 1.5,
        speed: 0.18,
        direction: 1,
      },
      {
        id: 'icon-cpu',
        icon: Cpu,
        label: 'AI Inference',
        color: '#ec4899',
        glow: 'rgba(236, 72, 153, 0.55)',
        radius: 210,
        initialAngle: 1.5 + (Math.PI * 2) / 3,
        speed: 0.18,
        direction: 1,
      },
      {
        id: 'icon-layers',
        icon: Layers,
        label: 'OpenAPI 3.1',
        color: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.55)',
        radius: 210,
        initialAngle: 1.5 + (Math.PI * 4) / 3,
        speed: 0.18,
        direction: 1,
      },
    ],
    [],
  );

  // Dynamic positions of orbiting icons
  const [iconPositions, setIconPositions] = useState<
    Record<string, { x: number; y: number; z: number }>
  >({});

  useEffect(() => {
    let animId: number;
    const startTime = performance.now();
    const centerX = 240;
    const centerY = 240;

    const update = (time: number) => {
      const elapsed = (time - startTime) * 0.001;
      const positions: Record<string, { x: number; y: number; z: number }> = {};

      ORBIT_ITEMS.forEach((item) => {
        const currentAngle = item.initialAngle + elapsed * item.speed * item.direction;

        // Circular orbit path
        const x = centerX + Math.cos(currentAngle) * item.radius;
        const y = centerY + Math.sin(currentAngle) * item.radius;
        const z = Math.sin(currentAngle); // pseudo depth for subtle scaling

        positions[item.id] = {
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          z,
        };
      });

      setIconPositions(positions);
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [ORBIT_ITEMS]);

  return (
    <div
      ref={containerRef}
      className="klyra-hero-orb-animation"
      style={{
        transform: `translateX(80px) perspective(1000px) rotateX(${mouseTilt.y * -8}deg) rotateY(${
          mouseTilt.x * 10
        }deg)`,
      }}
      aria-hidden="true"
    >
      {/* Background ambient radial glow behind orb */}
      <div className="klyra-orb-ambient-glow" />

      {/* SVG Layer: Concentric Circular Orbit Paths & Living Connection Lines */}
      <svg
        className="klyra-orb-svg-layer"
        viewBox="0 0 480 480"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="orbitCircleGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="orbitCircleGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="orbitCircleGrad3" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* 3 Circular Orbit Tracks */}
        <circle
          cx={240}
          cy={240}
          r={120}
          fill="none"
          stroke="url(#orbitCircleGrad1)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          className="klyra-orbit-track-inner"
        />
        <circle
          cx={240}
          cy={240}
          r={165}
          fill="none"
          stroke="url(#orbitCircleGrad2)"
          strokeWidth="1.2"
          strokeDasharray="5 7"
          className="klyra-orbit-track-mid"
        />
        <circle
          cx={240}
          cy={240}
          r={210}
          fill="none"
          stroke="url(#orbitCircleGrad3)"
          strokeWidth="1.2"
          strokeDasharray="6 8"
          className="klyra-orbit-track-outer"
        />

        {/* Connection rays from center orb to orbiting icons */}
        {ORBIT_ITEMS.map((item) => {
          const pos = iconPositions[item.id];
          if (!pos) return null;
          return (
            <line
              key={`line-${item.id}`}
              x1={240}
              y1={240}
              x2={pos.x}
              y2={pos.y}
              stroke={item.color}
              strokeOpacity={0.16}
              strokeWidth="0.8"
              strokeDasharray="3 4"
            />
          );
        })}
      </svg>

      {/* Central Rotating Dotted Sphere Orb Canvas */}
      <div className="klyra-central-orb-wrapper">
        <canvas ref={canvasRef} className="klyra-central-orb-canvas" />
        <div className="klyra-orb-core-emblem">
          <div className="klyra-orb-emblem-ring" />
          <div className="klyra-orb-emblem-dot" />
        </div>
      </div>

      {/* Orbiting Icons Layer */}
      <div className="klyra-orbiting-icons-layer">
        {ORBIT_ITEMS.map((item) => {
          const pos = iconPositions[item.id];
          if (!pos) return null;

          const scale = 0.95 + pos.z * 0.08;

          return (
            <div
              key={item.id}
              className="klyra-orbiting-icon-disc"
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale})`,
                boxShadow: `0 0 14px ${item.glow}`,
                borderColor: item.color,
              }}
              title={item.label}
            >
              <item.icon size={15} color={item.color} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
