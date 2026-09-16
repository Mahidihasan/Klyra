import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── SVG Velocity Graph ───────────────────────────────────────────────────────

const VelocityGraph = () => {
  // Mock data: each number represents transaction velocity for a time slice.
  // We'll intentionally inject "spikes" to simulate anomalies.
  const [dataPoints, setDataPoints] = useState<number[]>(Array(24).fill(10));

  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints((prev) => {
        const next = [...prev.slice(1)];
        // 10% chance to generate a massive anomaly spike
        const isAnomaly = Math.random() > 0.9;
        const newPoint = isAnomaly ? Math.floor(Math.random() * 50) + 70 : Math.floor(Math.random() * 15) + 5;
        next.push(newPoint);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const maxVal = 120; // Y-axis ceiling

  return (
    <div className="relative w-full h-32 flex items-end justify-between gap-1 mt-2">
      {dataPoints.map((val, i) => {
        const isSpike = val > 60;
        const heightPercent = Math.min((val / maxVal) * 100, 100);
        
        return (
          <div key={i} className="relative flex-1 flex flex-col justify-end items-center h-full group">
            {/* Tooltip on hover */}
            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-[9px] font-mono font-bold px-2 py-1 rounded text-white pointer-events-none z-10 whitespace-nowrap">
              {val} TX/m
            </div>
            
            {/* The SVG Bar */}
            <motion.div
              initial={false}
              animate={{ height: `${heightPercent}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`w-full rounded-t-sm transition-colors duration-500 ${
                isSpike 
                  ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]' 
                  : 'bg-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const FraudRadar = () => {
  return (
    <div className="flex flex-col gap-6">
      
      {/* ── Blocked Revenue Hero ── */}
      <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[12px] font-bold text-white/40 uppercase tracking-widest whitespace-normal break-words">
            <AlertTriangle size={14} className="text-rose-400" /> Total Blocked Revenue
          </div>
          
          <div className="flex items-end gap-3 mt-2 flex-wrap">
            <span className="text-5xl font-mono text-white tracking-tighter font-black">
              $142,509
            </span>
            <div className="mb-2 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-widest shadow-[0_0_10px_rgba(244,63,94,0.2)]">
              +12% in 1h
            </div>
          </div>
          
          <p className="text-[12px] text-white/30 mt-4 leading-relaxed whitespace-normal break-words font-mono">
            Cumulative funds frozen across all edge nodes due to high-risk anomaly detection triggers.
          </p>
        </div>
      </div>

      {/* ── Transaction Velocity Radar ── */}
      <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col min-w-0 pr-2">
            <h3 className="text-[14px] font-bold text-white flex items-center gap-2 tracking-tight whitespace-normal break-words">
              <Activity size={16} className="text-blue-400" /> Velocity Radar
            </h3>
            <p className="text-[11px] text-white/40 font-mono mt-1 whitespace-normal break-words">
              Global TX/m (Transactions per minute)
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
          </div>
        </div>

        <VelocityGraph />
        
        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
          <span>T-24m</span>
          <span>Now</span>
        </div>
      </div>

    </div>
  );
};
