import React, { useState, useEffect, useRef } from 'react';
import { Database, Activity, Zap, ServerCrash, Cpu, AlertTriangle, Play, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// ─── Radial Progress Ring ─────────────────────────────────────────────────────

interface RadialRingProps {
  value: number; // 0 to 100
  label: string;
  subLabel: string;
  isAnomalous?: boolean;
}

const RadialRing = ({ value, label, subLabel, isAnomalous = false }: RadialRingProps) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg viewBox="-20 -20 140 140" className="w-32 h-32 transform -rotate-90 overflow-visible">
        {/* Background Ring */}
        <circle
          cx="50" cy="50" r={radius}
          stroke="currentColor" strokeWidth="8" fill="none"
          className="text-white/5"
        />
        {/* Progress Ring */}
        <motion.circle
          cx="50" cy="50" r={radius}
          stroke="currentColor" strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ type: 'spring', stiffness: 50, damping: 15 }}
          className={`transition-colors duration-500 ${isAnomalous ? 'text-rose-500' : 'text-emerald-400'}`}
          style={{ filter: `drop-shadow(0 0 12px ${isAnomalous ? 'rgba(244,63,94,0.6)' : 'rgba(52,211,153,0.6)'})` }}
        />
        
        {/* Anomaly Pulse Effect */}
        {isAnomalous && (
          <motion.circle
            cx="50" cy="50" r={radius}
            stroke="currentColor" strokeWidth="8" fill="none"
            className="text-rose-500 origin-center"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -space-y-1">
        <motion.span 
          key={value}
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`text-2xl font-bold tracking-tighter ${isAnomalous ? 'text-rose-400' : 'text-white'}`}
        >
          {value}
        </motion.span>
        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-3 text-[11px] font-mono text-white/60">{subLabel}</div>
    </div>
  );
};

// ─── Tactile Kill-Switch ──────────────────────────────────────────────────────

const HoldToKillButton = ({ onKill, queryId }: { onKill: () => void; queryId: string }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [killed, setKilled] = useState(false);
  
  const holdInterval = useRef<ReturnType<typeof setInterval>>();
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const HOLD_MS = 2000;

  const controls = useAnimation();

  useEffect(() => {
    if (isHolding && !killed) {
      const startTime = Date.now();
      
      holdInterval.current = setInterval(() => {
        const p = Math.min(((Date.now() - startTime) / HOLD_MS) * 100, 100);
        setProgress(p);
      }, 30);

      holdTimer.current = setTimeout(() => {
        setKilled(true);
        setProgress(100);
        onKill();
        // Snappy Screen shake
        controls.start({ x: [0, -5, 5, -5, 5, 0], transition: { duration: 0.3 } });
      }, HOLD_MS);

    } else {
      clearInterval(holdInterval.current);
      clearTimeout(holdTimer.current);
      if (!killed) setProgress(0); // Snap back
    }

    return () => {
      clearInterval(holdInterval.current);
      clearTimeout(holdTimer.current);
    };
  }, [isHolding, killed, onKill, controls]);

  if (killed) {
    return (
      <div className="h-9 px-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[11px] font-bold text-rose-400 tracking-widest uppercase">
        <ServerCrash size={14} className="mr-2" /> Terminated
      </div>
    );
  }

  return (
    <motion.div animate={controls} className="relative w-full">
      <button
        onPointerDown={() => setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerLeave={() => setIsHolding(false)}
        className="relative w-full h-9 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden transition-colors active:scale-[0.98] group"
      >
        {/* Progress Fill */}
        <div 
          className="absolute left-0 top-0 bottom-0 bg-rose-500/20 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
        {/* Glowing Red Border Fill */}
        {progress > 0 && (
          <div 
            className="absolute inset-0 border-2 border-rose-500 shadow-[inset_0_0_15px_rgba(244,63,94,0.5)] transition-all duration-75 ease-linear"
            style={{ clipPath: `polygon(0 0, ${progress}% 0, ${progress}% 100%, 0 100%)` }}
          />
        )}
        
        <div className="relative z-10 flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-white/50 group-hover:text-rose-400 transition-colors">
          <ShieldAlert size={14} />
          {isHolding ? 'Hold to Kill' : 'Kill Query'}
        </div>
      </button>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const MOCK_QUERIES = [
  { id: 'q_9821a', sql: 'SELECT * FROM events WHERE time > NOW() - INTERVAL 1 DAY', time: '12.4s', user: 'system_cron', anomalous: true },
  { id: 'q_112b4', sql: 'UPDATE users SET status = "active" WHERE last_login IS NULL', time: '0.4s', user: 'admin_panel', anomalous: false },
  { id: 'q_55c91', sql: 'SELECT COUNT(*) FROM logs JOIN metrics ON logs.id = metrics.log_id', time: '45.1s', user: 'bi_tool', anomalous: true },
];

export const SystemHealth = () => {
  const [latency, setLatency] = useState(24);
  const [queries, setQueries] = useState(MOCK_QUERIES);

  // Simulate latency spikes
  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(prev => {
        const spike = Math.random() > 0.8;
        return spike ? Math.floor(Math.random() * 200) + 100 : Math.floor(Math.random() * 15) + 20;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleKill = (id: string) => {
    setTimeout(() => {
      setQueries(prev => prev.filter(q => q.id !== id));
    }, 1500);
  };

  const isLatencySpike = latency > 100;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Database size={16} className="text-indigo-400" />
          <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-white tracking-tight">Database Health & Telemetry</h2>
          <p className="text-[13px] text-white/40">Real-time performance metrics and active query termination.</p>
        </div>
      </div>

      {/* ── Asymmetrical Bento Box Layout ── */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Metrics (Overlap Glass Tiles) */}
        <div className="col-span-4 flex flex-col gap-6 relative">
          
          {/* Query Latency Tile */}
          <div className="relative z-10 bg-black/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-[12px] font-bold text-white/60 tracking-widest uppercase">
                <Activity size={14} className={isLatencySpike ? 'text-rose-400' : 'text-emerald-400'} />
                Query Latency
              </div>
            </div>
            
            <div className="flex justify-center">
              <RadialRing 
                value={latency} 
                label="ms" 
                subLabel="p95 Global Average"
                isAnomalous={isLatencySpike}
              />
            </div>
          </div>

          {/* Cache Hit Ratio Tile */}
          <div className="relative z-0 bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6 pt-4">
              <div className="flex items-center gap-2 text-[12px] font-bold text-white/60 tracking-widest uppercase">
                <Zap size={14} className="text-amber-400" />
                Cache Hit Ratio
              </div>
            </div>
            <div className="flex justify-center pb-2">
              <RadialRing 
                value={94} 
                label="%" 
                subLabel="Redis Edge Nodes"
                isAnomalous={false}
              />
            </div>
          </div>
          
        </div>

        {/* Right Column: Active Queries (Tall Card) */}
        <div className="col-span-8 bg-black/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-[14px] font-bold text-white">
              <Cpu size={18} className="text-indigo-400" />
              Active Connections
            </div>
            <div className="text-[11px] font-mono text-white/40 uppercase tracking-widest">
              {queries.length} Running
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {queries.map((q) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  className={`flex flex-col gap-3 p-4 rounded-xl border bg-white/[0.02] transition-colors ${
                    q.anomalous ? 'border-rose-500/30 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]' : 'border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[11px] font-mono font-bold text-indigo-400">{q.id}</span>
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                          {q.user}
                        </span>
                        {q.anomalous && (
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 animate-pulse">
                            <AlertTriangle size={10} /> Slow Query
                          </span>
                        )}
                      </div>
                      
                      {/* SQL Code Block */}
                      <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-[12px] text-emerald-300/80 leading-relaxed overflow-x-auto custom-scrollbar shadow-inner">
                        <span className="text-pink-400 mr-1.5">{q.sql.split(' ')[0]}</span>
                        {q.sql.substring(q.sql.indexOf(' ') + 1)}
                      </div>
                    </div>
                    
                    {/* Metrics & Controls */}
                    <div className="flex flex-col items-end gap-3 w-32 shrink-0">
                      <div className="text-right">
                        <div className={`text-[18px] font-black font-mono tracking-tighter ${q.anomalous ? 'text-rose-400' : 'text-white'}`}>
                          {q.time}
                        </div>
                        <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Duration</div>
                      </div>
                      
                      {q.anomalous && (
                        <HoldToKillButton queryId={q.id} onKill={() => handleKill(q.id)} />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {queries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-white/30">
                <Database size={32} className="mb-3 opacity-20" />
                <div className="text-[13px] font-bold tracking-widest uppercase">System Idle</div>
                <div className="text-[11px] font-mono mt-1">No active queries found.</div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
