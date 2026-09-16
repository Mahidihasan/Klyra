import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, ServerCrash, Save, Activity, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';

const HoldToActivateButton = ({ onActivate }: { onActivate: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (isHolding) {
      const startTime = Date.now() - (progress * 30); // 3 seconds = 3000ms
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / 3000) * 100, 100);
        setProgress(newProgress);
        if (newProgress >= 100) {
          onActivate();
          setIsHolding(false);
        } else {
          frameRef.current = requestAnimationFrame(animate);
        }
      };
      frameRef.current = requestAnimationFrame(animate);
    } else {
      setProgress(0);
    }
    return () => cancelAnimationFrame(frameRef.current!);
  }, [isHolding, progress, onActivate]);

  return (
    <div 
      className="relative flex items-center justify-center cursor-pointer select-none"
      onPointerDown={() => setIsHolding(true)}
      onPointerUp={() => setIsHolding(false)}
      onPointerLeave={() => setIsHolding(false)}
    >
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#ef4444_10px,#ef4444_20px)] opacity-20 rounded-xl pointer-events-none" />
      <div className="relative z-10 flex items-center justify-center w-full px-6 py-4 rounded-xl bg-black/80 border border-rose-500/30 shadow-[inset_0_4px_24px_rgba(225,29,72,0.4)] overflow-hidden transition-all hover:border-rose-500/50">
        <div 
          className="absolute left-0 top-0 bottom-0 bg-rose-600/40 transition-none"
          style={{ width: `${progress}%` }}
        />
        <div className="relative flex items-center gap-3 z-10">
          <ServerCrash size={20} className="text-rose-500" />
          <span className="font-bold text-rose-500 uppercase tracking-widest text-sm">
            {isHolding ? 'Hold to Kill...' : 'Block IP / Kill API'}
          </span>
        </div>
      </div>
    </div>
  );
};

const getSliderColor = (val: number, max: number) => {
  const p = val / max;
  if (p < 0.4) return { color: '#34d399', glow: 'rgba(52,211,153,0.5)' }; // Emerald
  if (p < 0.75) return { color: '#fbbf24', glow: 'rgba(251,191,36,0.5)' }; // Amber
  return { color: '#f97316', glow: 'rgba(249,115,22,0.7)' }; // Orange
};

const Gauge = ({ value, max }: { value: number, max: number }) => {
  const radius = 30;
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (value / max) * circumference;
  const { color } = getSliderColor(value, max);

  return (
    <div className="relative w-20 h-10 overflow-hidden flex flex-col items-center justify-end">
      <svg className="absolute top-0" width="80" height="40" viewBox="0 0 80 40">
        <path 
          d="M 10 35 A 30 30 0 0 1 70 35" 
          fill="none" 
          stroke="rgba(255,255,255,0.1)" 
          strokeWidth="6" 
          strokeLinecap="round" 
        />
        <motion.path 
          d="M 10 35 A 30 30 0 0 1 70 35" 
          fill="none" 
          stroke={color} 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ type: 'spring', bounce: 0 }}
        />
      </svg>
      <div className="absolute bottom-0 text-[10px] font-mono font-bold text-white/70">
        {Math.round((value/max)*100)}%
      </div>
    </div>
  );
};

const TactileSlider = ({ label, value, max, onChange, step = 1 }: any) => {
  const { color, glow } = getSliderColor(value, max);
  const percent = (value / max) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/70">{label}</span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm font-bold text-white">{value.toLocaleString()}</span>
          <Gauge value={value} max={max} />
        </div>
      </div>
      <div className="relative w-full h-3 bg-black/50 rounded-full border border-white/5">
        <div 
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: color, boxShadow: `0 0 15px ${glow}` }}
        />
        <input 
          type="range"
          min="0"
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};

const TIERS = ['Free', 'Pro', 'Enterprise'];

export const RateLimiter = () => {
  const [activeTier, setActiveTier] = useState('Free');
  
  const [limits, setLimits] = useState<Record<string, { rpm: number, burst: number }>>({
    Free: { rpm: 60, burst: 100 },
    Pro: { rpm: 1000, burst: 2500 },
    Enterprise: { rpm: 10000, burst: 50000 }
  });

  const currentLimits = limits[activeTier];

  const updateLimit = (key: 'rpm' | 'burst', val: number) => {
    setLimits(prev => ({
      ...prev,
      [activeTier]: { ...prev[activeTier], [key]: val }
    }));
  };

  return (
    <div className="flex gap-8 pb-32">
      {/* Configuration Hub */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="p-8 rounded-3xl bg-[#0a0a0f] border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Settings2 size={24} className="text-indigo-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Global Gateway Limits</h2>
            </div>
            
            {/* macOS-Style Segmented Control */}
            <div className="relative flex p-1 bg-black/40 rounded-lg border border-white/10 w-fit">
              {TIERS.map(tier => (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`relative z-10 px-6 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTier === tier ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                >
                  {activeTier === tier && (
                    <motion.div
                      layoutId="tier-pill"
                      className="absolute inset-0 bg-white/10 border border-white/20 rounded-md -z-10 shadow-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-12">
            <TactileSlider 
              label="Requests per Minute (RPM)"
              value={currentLimits.rpm}
              max={activeTier === 'Free' ? 500 : activeTier === 'Pro' ? 5000 : 50000}
              step={activeTier === 'Enterprise' ? 1000 : 10}
              onChange={(val: number) => updateLimit('rpm', val)}
            />

            <TactileSlider 
              label="Burst Tolerance (Concurrency)"
              value={currentLimits.burst}
              max={activeTier === 'Free' ? 200 : activeTier === 'Pro' ? 10000 : 100000}
              step={activeTier === 'Enterprise' ? 1000 : 10}
              onChange={(val: number) => updateLimit('burst', val)}
            />
          </div>

          <div className="mt-12 flex items-center justify-end gap-4 border-t border-white/5 pt-6">
            <button className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 transition-colors">
              Revert Changes
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
              <Save size={16} /> Deploy Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Danger & Monitoring Side Panel */}
      <div className="w-80 flex flex-col gap-6">
        {/* The Hazard Kill Switch */}
        <div className="p-6 rounded-3xl bg-[#0a0a0f] border border-rose-500/20 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <ShieldAlert size={100} />
          </div>
          <h3 className="text-lg font-bold text-rose-500 tracking-tight mb-2 flex items-center gap-2">
            <ShieldAlert size={18} /> Emergency Protocol
          </h3>
          <p className="text-[12px] text-white/50 mb-6 leading-relaxed">
            Instantly drop all incoming unauthenticated traffic or block malicious IP ranges. Use only under active DDoS.
          </p>
          <HoldToActivateButton onActivate={() => console.log('Kill switch engaged!')} />
        </div>

        {/* Live Network Health (Aesthetic Filler) */}
        <div className="p-6 rounded-3xl bg-[#0a0a0f] border border-white/5 shadow-2xl">
          <h3 className="text-sm font-bold text-white tracking-tight mb-4 flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" /> Network Health
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[11px] text-white/50 mb-1">
                <span>Global Edge Latency</span>
                <span className="text-emerald-400 font-mono">24ms</span>
              </div>
              <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                <div className="w-1/4 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-white/50 mb-1">
                <span>Error Rate (5xx)</span>
                <span className="text-emerald-400 font-mono">0.01%</span>
              </div>
              <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                <div className="w-[1%] h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
