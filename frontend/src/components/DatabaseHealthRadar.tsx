import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Cpu, Database, AlertCircle } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

// --- Types & Mocks ---
interface ActiveQuery {
  id: string;
  query: string;
  durationMs: number;
  user: string;
}

const mockQueries: ActiveQuery[] = [
  {
    id: 'q_1293',
    query: 'SELECT * FROM users WHERE last_login < NOW() - INTERVAL 1 YEAR',
    durationMs: 1200,
    user: 'admin',
  },
  {
    id: 'q_8422',
    query: 'UPDATE analytics SET views = views + 1 WHERE path = "/dashboard"',
    durationMs: 6500,
    user: 'system',
  },
  {
    id: 'q_0021',
    query: 'REFRESH MATERIALIZED VIEW concurrently mv_daily_revenue',
    durationMs: 14500,
    user: 'system',
  },
];

// --- Glowing Radial Gauge Component ---
const RadialGauge = ({
  value,
  max,
  label,
  unit,
  isLatency = false,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  isLatency?: boolean;
}) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const strokeDashoffset = circumference - percentage * circumference;

  let color = '#34d399'; // emerald-400
  let glowColor = 'rgba(52, 211, 153, 0.5)';
  let isPulsing = false;

  if (isLatency) {
    if (value > max * 0.75) {
      color = '#ef4444'; // red-500
      glowColor = 'rgba(239, 68, 68, 0.8)';
      isPulsing = true;
    } else if (value > max * 0.4) {
      color = '#fbbf24'; // amber-400
      glowColor = 'rgba(251, 191, 36, 0.6)';
    }
  } else {
    if (percentage > 0.85) {
      color = '#ef4444';
      glowColor = 'rgba(239, 68, 68, 0.6)';
      isPulsing = true;
    } else if (percentage > 0.6) {
      color = '#fbbf24';
      glowColor = 'rgba(251, 191, 36, 0.5)';
    } else {
      color = '#8b5cf6'; // accent-purple
      glowColor = 'rgba(139, 92, 246, 0.5)';
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/[0.02] backdrop-blur-3xl rounded-[24px] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] relative group transition-all hover:bg-white/[0.04]">
      {/* Background Pulse if critical */}
      {isPulsing && (
        <div
          className="absolute inset-0 rounded-[24px] pointer-events-none opacity-20 mix-blend-screen animate-pulse"
          style={{ background: `radial-gradient(circle at center, ${color}, transparent 70%)` }}
        />
      )}

      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Background Track */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="8"
            fill="transparent"
          />
          {/* Animated Progress */}
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{
              strokeDashoffset,
              stroke: color,
              filter: `drop-shadow(0 0 8px ${glowColor})`,
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>

        {/* Value Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold font-mono tracking-tighter text-white drop-shadow-md"
            animate={{ color: color }}
          >
            {value.toFixed(0)}
          </motion.span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            {unit}
          </span>
        </div>
      </div>

      <div className="mt-4 text-[11px] font-semibold text-gray-400 tracking-widest uppercase">
        {label}
      </div>
    </div>
  );
};

// --- Tactile Click-and-Hold Kill Switch ---
const HoldToKillButton = ({ onKill }: { onKill: () => void }) => {
  const [isHolding, setIsHolding] = useState(false);
  const HOLD_DURATION = 2; // seconds

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsHolding(true);
  };

  const handlePointerUp = () => {
    setIsHolding(false);
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* The Button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="relative overflow-hidden px-4 py-2 rounded-lg bg-black/60 border border-white/10 select-none touch-none active:scale-95 transition-transform"
      >
        <span className="relative z-10 font-mono text-[11px] font-bold tracking-widest text-red-400 flex items-center gap-2">
          <AlertCircle size={14} /> HOLD TO KILL
        </span>

        {/* Glowing Red Fill Animation */}
        <motion.div
          className="absolute inset-0 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] z-0 mix-blend-screen"
          initial={{ width: '0%', opacity: 0 }}
          animate={isHolding ? { width: '100%', opacity: 1 } : { width: '0%', opacity: 0 }}
          transition={
            isHolding
              ? { duration: HOLD_DURATION, ease: 'linear' }
              : { duration: 0.3, ease: 'easeOut' }
          }
          onAnimationComplete={(definition) => {
            // framer-motion fires this with the animate object when complete
            if (isHolding && (definition as any).width === '100%') {
              setIsHolding(false);
              onKill();
            }
          }}
        />
      </button>
    </div>
  );
};

// --- Main Tactile Health Module ---
export default function DatabaseHealthRadar() {
  const [connections, setConnections] = useState(342);
  const [latency, setLatency] = useState(55);
  const [cacheHit, setCacheHit] = useState(92);
  const [queries, setQueries] = useState<ActiveQuery[]>(mockQueries);

  // Simulate Live Data Fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setConnections((prev) => Math.max(10, Math.min(1000, prev + (Math.random() * 60 - 30))));
      setLatency((prev) => {
        if (Math.random() > 0.85) {
          return Math.min(600, prev + 250);
        } // Spike
        return Math.max(10, Math.min(600, prev + (Math.random() * 30 - 15)));
      });
      setCacheHit((prev) => Math.max(50, Math.min(100, prev + (Math.random() * 6 - 3))));

      setQueries((prev) =>
        prev.map((q) => ({
          ...q,
          durationMs: q.durationMs + 1000,
        })),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-[1200px] mx-auto p-8 relative rounded-[32px] overflow-hidden isolate shadow-2xl">
      {/* Deep Glass Background */}
      <div className="absolute inset-0 -z-10 bg-[#0f111a]/80 backdrop-blur-3xl border border-white/5" />

      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center border border-accent-purple/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
          <Database size={20} className="text-accent-purple" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-100 tracking-wide">Database Telemetry</h2>
          <p className="text-[12px] text-gray-400 font-mono tracking-widest uppercase opacity-80">
            Primary Cluster • Online
          </p>
        </div>
      </div>

      {/* Asymmetrical Bento-Box Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Active Queries Tall Card (Left) */}
        <div className="lg:col-span-8 flex flex-col bg-white/[0.02] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_15px_35px_rgba(0,0,0,0.5)] rounded-[32px] p-6 relative overflow-hidden backdrop-blur-md">
          {/* Subtle glow behind queries */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent-purple/5 filter blur-[120px] rounded-full pointer-events-none" />

          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-widest">
                Active Processes
              </h3>
            </div>
            <span className="px-3 py-1 rounded-md bg-white/5 text-[11px] font-mono text-gray-300 border border-white/10 shadow-inner">
              {queries.length} queries running
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar relative z-10 pr-2 max-h-[450px]">
            <AnimatePresence mode="popLayout">
              {queries.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-48 text-gray-500 gap-3"
                >
                  <Activity size={32} className="opacity-30" />
                  <span className="text-xs font-mono uppercase tracking-widest">
                    System Nominal
                  </span>
                </motion.div>
              )}

              {queries.map((q) => {
                const seconds = (q.durationMs / 1000).toFixed(1);
                const isWarning = q.durationMs > 5000;
                const isDanger = q.durationMs > 10000;

                return (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -30, scale: 0.9, transition: { duration: 0.2 } }}
                    className={`
                      flex flex-col gap-3 p-4 rounded-2xl border bg-black/40 relative overflow-hidden transition-colors duration-300
                      ${
                        isDanger
                          ? 'border-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                          : isWarning
                          ? 'border-amber-500/20'
                          : 'border-white/5'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-gray-300 bg-white/10 px-2 py-0.5 rounded shadow-sm border border-white/5">
                          {q.id}
                        </span>
                        <span className="text-[11px] font-mono text-gray-500">@{q.user}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={`font-mono text-sm font-bold drop-shadow-md ${
                            isDanger
                              ? 'text-red-400'
                              : isWarning
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {seconds}s
                        </span>
                        {isWarning && (
                          <HoldToKillButton
                            onKill={() =>
                              setQueries((prev) => prev.filter((query) => query.id !== q.id))
                            }
                          />
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-black/50 rounded-xl border border-white/[0.02] overflow-x-auto custom-scrollbar">
                      <code className="text-[12px] text-gray-300 font-mono whitespace-nowrap leading-relaxed">
                        {q.query}
                      </code>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Small Glass Tiles (Right) */}
        <div className="lg:col-span-4 flex flex-col gap-6 relative">
          <RadialGauge value={latency} max={300} label="Query Latency" unit="ms" isLatency={true} />

          {/* Overlapping illusion via negative margin on large screens */}
          <div className="lg:-mt-4 lg:-ml-8 z-10">
            <RadialGauge value={cacheHit} max={100} label="Cache Hit Ratio" unit="%" />
          </div>

          <div className="lg:mt-auto">
            <RadialGauge value={connections} max={1000} label="Active Conns" unit="tcp" />
          </div>
        </div>
      </div>
    </div>
  );
}
