import React, { useState, useEffect, useRef } from 'react';
import { Database, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

// ─── Anomaly Radar Visualization ──────────────────────────────────────────────

const CacheRadar = ({ missRate }: { missRate: number }) => {
  const isAnomalous = missRate > 30;
  
  const rings = [1, 2, 3];
  
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* SVG Radar */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full overflow-visible">
        {/* Core Ring */}
        <circle cx="100" cy="100" r="15" fill={isAnomalous ? '#ef4444' : '#3b82f6'} opacity="0.2" />
        
        {rings.map((ring, i) => (
          <motion.circle
            key={ring}
            cx="100" cy="100" r={ring * 30}
            fill="none"
            stroke={isAnomalous ? '#ef4444' : '#3b82f6'}
            strokeWidth="1.5"
            className="origin-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: isAnomalous ? [1, 1.1 + (i * 0.05), 1] : 1,
              opacity: isAnomalous ? [0.1, 0.6, 0.1] : (4 - ring) * 0.15,
            }}
            transition={{ 
              duration: isAnomalous ? 1 + (i * 0.2) : 2, 
              repeat: Infinity, 
              ease: isAnomalous ? "easeInOut" : "linear" 
            }}
            style={{ 
              filter: `drop-shadow(0 0 ${isAnomalous ? 15 : 5}px ${isAnomalous ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.5)'})`,
              strokeDasharray: isAnomalous ? '4 8' : 'none'
            }}
          />
        ))}
        
        {/* Radar Sweep Gradient */}
        <motion.path
          d="M 100 100 L 100 10 A 90 90 0 0 1 165 35 Z"
          fill={isAnomalous ? 'url(#radarGradRed)' : 'url(#radarGradBlue)'}
          className="origin-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        
        <defs>
          <linearGradient id="radarGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
          <linearGradient id="radarGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(239,68,68,0.4)" />
            <stop offset="100%" stopColor="rgba(239,68,68,0)" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Mathematically Centered Value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -space-y-1">
        <motion.span 
          animate={isAnomalous ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          className={`text-4xl font-black font-mono tracking-tighter ${
            isAnomalous ? 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,1)]' : 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,1)]'
          }`}
        >
          {100 - missRate}
        </motion.span>
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">% Hit</span>
      </div>
    </div>
  );
};

// ─── Hazard Hold-to-Purge Button ───────────────────────────────────────────────

const HazardPurgeButton = ({ onExecute }: { onExecute: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressInterval = useRef<ReturnType<typeof setInterval>>();
  const HOLD_DURATION = 2000;
  const controls = useAnimation();

  useEffect(() => {
    if (isHolding) {
      const startTime = Date.now();
      
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min((elapsed / HOLD_DURATION) * 100, 100));
      }, 30);

      holdTimer.current = setTimeout(() => {
        setProgress(100);
        onExecute();
        controls.start({ x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4 } });
        setIsHolding(false); // Force stop holding
        setTimeout(() => setProgress(0), 3000);
      }, HOLD_DURATION);
    } else {
      clearInterval(progressInterval.current);
      clearTimeout(holdTimer.current);
      setProgress(0);
    }

    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(holdTimer.current);
    };
  }, [isHolding, onExecute, controls]);

  return (
    <motion.div animate={controls} className="w-full shrink-0 z-10">
      <div 
        onPointerDown={() => setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerLeave={() => setIsHolding(false)}
        className="relative w-full overflow-hidden rounded-lg bg-red-950/80 border border-red-500/50 hover:bg-red-900/80 hover:border-red-400/80 text-red-500 hover:text-red-400 font-mono font-bold tracking-widest px-8 py-4 select-none cursor-pointer transition-all active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
      >
        {/* Fill Animation */}
        <div 
          className="absolute inset-y-0 left-0 bg-red-500/40 mix-blend-screen transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
        
        {/* Glow Overlay */}
        {isHolding && progress < 100 && (
          <div className="absolute inset-0 bg-red-500/20 animate-pulse pointer-events-none" />
        )}

        <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
          {progress >= 100 ? (
            <><CheckCircle2 size={18} /> PURGED</>
          ) : (
            'HOLD TO PURGE'
          )}
        </span>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CacheInvalidation = () => {
  const [missRate, setMissRate] = useState(12);

  useEffect(() => {
    const i = setInterval(() => {
      setMissRate(Math.random() > 0.85 ? Math.floor(Math.random() * 40) + 35 : Math.floor(Math.random() * 15) + 5);
    }, 3000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          style: { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } }
        }} 
      />
      
      <div className="flex items-center gap-3 shrink-0">
        <Database size={20} className="text-blue-400" />
        <div>
          <h2 className="text-[18px] font-bold text-white tracking-tight">Reactor Core</h2>
          <p className="text-[12px] text-white/40 mt-0.5">Edge cache monitoring & overrides.</p>
        </div>
      </div>

      {/* ── MODULE 3: THE "REACTOR CORE" ASYMMETRICAL GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
        
        {/* Left: The Radar (Col Span 1) */}
        <div className="col-span-1 bg-zinc-950/50 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[300px]">
          {missRate > 30 && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent animate-pulse" />
          )}
          <CacheRadar missRate={missRate} />
        </div>

        {/* Right: Hazard Purge Zone */}
        <div className="col-span-1 flex items-center h-full">
          {/* STRICT flex-col applied here so text and button stack naturally */}
          <div className="relative w-full p-6 rounded-xl border border-red-500/30 bg-[#2a0808]/50 shadow-[inset_0_0_30px_rgba(239,68,68,0.1)] flex flex-col items-start justify-between gap-6 overflow-hidden h-full">
            
            {/* Subtle Hazard Background Stripes */}
            <div 
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 15px, #ef4444 15px, #ef4444 30px)'
              }}
            />

            {/* Warning Typography (Takes full width now) */}
            <div className="flex flex-col z-10 w-full mt-2">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert size={22} className="text-red-400 shrink-0" />
                <h3 className="text-red-400 font-bold tracking-widest text-lg uppercase font-mono">
                  Global Flush Override
                </h3>
              </div>
              <p className="text-red-400/70 text-sm leading-relaxed mt-2">
                Purges the entire Redis cache across all edge nodes. Expect a temporary 500ms latency spike on DB hits.
              </p>
            </div>

            {/* Tactile Button (Takes full width at the bottom) */}
            <div className="w-full mt-auto z-10">
              <HazardPurgeButton onExecute={async () => {
                const purgePromise = (async () => {
                  const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
                  const res = await fetch('/api/v1/admin/engine/cache/global-purge', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ flushAll: true })
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Server rejected flush command');
                  }
                  return await res.json();
                })();

                toast.promise(purgePromise, {
                  loading: 'Executing nuclear flush...',
                  success: 'Reactor Core Purged',
                  error: (err) => `Purge Failed: ${err.message}`
                });
              }} />
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
};