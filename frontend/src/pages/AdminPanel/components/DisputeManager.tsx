import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, FileQuestion, Terminal, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

// ─── Hold-to-Execute Approve Button ──────────────────────────────────────────

const HoldToApprove = ({ onExecute }: { onExecute: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressInterval = useRef<ReturnType<typeof setInterval>>();
  const HOLD_DURATION = 2000;
  const controls = useAnimation();

  useEffect(() => {
    if (isHolding && !isApproved) {
      const startTime = Date.now();
      
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min((elapsed / HOLD_DURATION) * 100, 100));
      }, 30);

      holdTimer.current = setTimeout(() => {
        setIsApproved(true);
        setProgress(100);
        onExecute();
        controls.start({ scale: [1, 1.05, 1], transition: { duration: 0.3 } });
      }, HOLD_DURATION);
    } else {
      clearInterval(progressInterval.current);
      clearTimeout(holdTimer.current);
      if (!isApproved) setProgress(0);
    }

    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(holdTimer.current);
    };
  }, [isHolding, isApproved, onExecute, controls]);

  return (
    <motion.div animate={controls} className="relative">
      <button 
        onPointerDown={() => !isApproved && setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerLeave={() => setIsHolding(false)}
        className={`relative overflow-hidden w-full sm:w-[220px] h-[48px] rounded-lg border font-mono font-bold tracking-widest text-[12px] uppercase flex items-center justify-center select-none transition-all duration-300 ${
          isApproved 
            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]'
            : 'bg-zinc-900 border-emerald-500/30 text-emerald-500 hover:border-emerald-500/60 active:scale-95 cursor-pointer'
        }`}
      >
        {/* Progress Fill */}
        {!isApproved && (
          <div 
            className="absolute left-0 top-0 bottom-0 bg-emerald-500/20 mix-blend-screen transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        )}
        
        {/* Glow Overlay */}
        {isHolding && !isApproved && (
          <div className="absolute inset-0 bg-emerald-500/10 animate-pulse pointer-events-none" />
        )}

        <span className="relative z-10 flex items-center gap-2">
          {isApproved ? <><CheckCircle2 size={16} /> Refunded</> : 'Hold to Approve'}
        </span>
      </button>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const DisputeManager = () => {
  return (
    <div className="bg-zinc-950/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col h-full">
      
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <AlertCircle size={20} className="text-amber-500" />
        <div>
          <h3 className="text-[16px] font-bold text-white tracking-tight m-0 uppercase letter-spacing-[0.05em]">
            Dispute Manager
          </h3>
          <p className="text-[12px] text-white/40 mt-0.5">Automated Truth Engine verification.</p>
        </div>
      </div>

      {/* ── Asymmetrical Split ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* Left: User Claim (Forensic Evidence Ticket) */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 flex flex-col relative overflow-hidden">
          {/* Subtle noise for paper ticket feel */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
          
          <div className="relative z-10 flex items-center gap-2 text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
            <FileQuestion size={14} className="text-amber-500/70" /> User Claim <span className="font-mono text-white/20 ml-2">usr_992</span>
          </div>
          
          <div className="relative z-10 bg-black/40 border-l-2 border-amber-500/30 p-4 rounded-r-lg text-[13px] text-white/60 font-mono italic leading-relaxed mb-6">
            "I am being billed for 50,000 requests to the ML endpoint, but my server logs only show 12,000 successful requests. The rest were 502s from your end."
          </div>
          
          <div className="mt-auto relative z-10 pt-4 border-t border-white/5">
            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-1">Billed Amount</div>
            <div className="text-[24px] font-black text-rose-500 font-mono tracking-wider">$2,500.00</div>
          </div>
        </div>

        {/* Right: System Reality (Hacker Terminal) */}
        <div className="bg-[#050505] border border-emerald-500/20 rounded-xl p-5 flex flex-col relative shadow-[inset_0_0_30px_rgba(16,185,129,0.02)]">
          <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-500/70 uppercase tracking-widest mb-4">
            <Terminal size={14} /> System Reality
          </div>
          
          <div className="flex flex-col gap-3 mb-6 bg-emerald-950/10 p-4 rounded-lg border border-emerald-900/30">
            <div className="flex justify-between items-center text-[13px] font-mono">
              <span className="text-emerald-500/50">&gt; grep "200 OK" /var/log/api.log | wc -l</span>
              <span className="text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">12,041</span>
            </div>
            <div className="flex justify-between items-center text-[13px] font-mono">
              <span className="text-rose-500/50">&gt; grep "502 Bad Gateway" /var/log/api.log | wc -l</span>
              <span className="text-rose-500 font-bold animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]">37,959</span>
            </div>
          </div>
          
          <div className="mt-auto pt-4 border-t border-emerald-900/30 flex justify-between items-end">
            <div>
              <div className="text-[11px] font-bold text-emerald-500/50 uppercase tracking-widest mb-1">Actual Billable</div>
              <div className="text-[24px] font-black text-emerald-400 font-mono tracking-wider drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">$602.05</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-amber-500/50 uppercase tracking-widest mb-1">Discrepancy</div>
              <div className="text-[16px] font-bold text-amber-500 font-mono">-$1,897.95</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── High-Friction Financial Controls ── */}
      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mt-6 pt-6 border-t border-white/5 shrink-0">
        
        {/* Reject Button */}
        <button className="group relative overflow-hidden w-full sm:w-auto h-[48px] px-6 rounded-lg border border-rose-500/30 bg-zinc-900 text-rose-500 font-mono font-bold text-[12px] uppercase tracking-widest transition-all hover:border-rose-500 hover:text-white">
          {/* Danger Pattern Hover Fill */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-screen" 
               style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, #e11d48 10px, #e11d48 20px)' }} />
          <span className="relative z-10 flex items-center gap-2">
            <ShieldAlert size={14} className="group-hover:animate-pulse" /> Reject Claim
          </span>
        </button>

        {/* Hold to Approve Refund */}
        <HoldToApprove onExecute={() => console.log('Refund of $1,897.95 Authorized')} />
        
      </div>
    </div>
  );
};
