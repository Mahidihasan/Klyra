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
  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDispute = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/finances/forensics/dispute', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setDispute(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch dispute', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDispute();
  }, []);

  const handleResolve = async (status: 'APPROVED' | 'REJECTED') => {
    if (!dispute) return;
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/finances/forensics/dispute/${dispute.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const json = await res.json();
        setDispute(json.data);
      }
    } catch (err) {
      console.error('Failed to resolve dispute', err);
    }
  };

  return (
    <div className="bg-zinc-950/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col h-full">
      
      {/* ── Persistent Header ── */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <AlertCircle size={20} className="text-amber-500" />
        <div>
          <h3 className="text-[16px] font-bold text-white tracking-tight m-0 uppercase letter-spacing-[0.05em]">
            Dispute Manager
          </h3>
          <p className="text-[12px] text-white/40 mt-0.5">Automated Truth Engine verification.</p>
        </div>
      </div>

      {loading ? (
        /* ── Sleek Skeleton UI Loader ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 animate-pulse">
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-5 flex flex-col justify-between h-[280px]">
            <div className="w-24 h-4 bg-white/10 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="w-full h-3 bg-white/5 rounded"></div>
              <div className="w-4/5 h-3 bg-white/5 rounded"></div>
              <div className="w-3/4 h-3 bg-white/5 rounded"></div>
            </div>
            <div className="mt-auto pt-4 border-t border-white/5">
              <div className="w-32 h-6 bg-white/10 rounded"></div>
            </div>
          </div>
          <div className="bg-[#050505] border border-emerald-500/10 rounded-xl p-5 flex flex-col justify-between h-[280px]">
            <div className="w-28 h-4 bg-emerald-500/20 rounded mb-4"></div>
            <div className="w-full h-16 bg-emerald-500/10 rounded mb-4"></div>
            <div className="mt-auto pt-4 border-t border-emerald-900/30 flex justify-between items-end">
               <div className="w-24 h-6 bg-emerald-500/20 rounded"></div>
               <div className="w-24 h-6 bg-amber-500/20 rounded"></div>
            </div>
          </div>
        </div>
      ) : !dispute ? (
        /* ── Clean Empty State ── */
        <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
          <CheckCircle2 size={32} className="text-emerald-500/50 mb-3" />
          <p className="text-[12px] font-mono text-white/40 uppercase tracking-widest">No active disputes requiring verification.</p>
        </div>
      ) : (
        /* ── Actual Dispute Content ── */
        <>
          {/* ── Asymmetrical Split ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* Left: User Claim (Forensic Evidence Ticket) */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 flex flex-col relative overflow-hidden">
          {/* Subtle noise for paper ticket feel */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
          
          <div className="relative z-10 flex items-center gap-2 text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
            <FileQuestion size={14} className="text-amber-500/70" /> User Claim <span className="font-mono text-white/20 ml-2">{dispute.userId}</span>
          </div>
          
          <div className="relative z-10 bg-black/40 border-l-2 border-amber-500/30 p-4 rounded-r-lg text-[13px] text-white/60 font-mono italic leading-relaxed mb-6">
            {dispute.claimText}
          </div>
          
          <div className="mt-auto relative z-10 pt-4 border-t border-white/5">
            <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-1">Billed Amount</div>
            <div className="text-[24px] font-black text-rose-500 font-mono tracking-wider">${dispute.billedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
              <div className="text-[24px] font-black text-emerald-400 font-mono tracking-wider drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">${dispute.actualBillable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-amber-500/50 uppercase tracking-widest mb-1">Discrepancy</div>
              <div className="text-[16px] font-bold text-amber-500 font-mono">{dispute.discrepancy < 0 ? '-' : ''}${Math.abs(dispute.discrepancy).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── High-Friction Financial Controls ── */}
      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mt-6 pt-6 border-t border-white/5 shrink-0">
        
        {dispute.status === 'PENDING' ? (
          <>
            {/* Reject Button */}
            <button 
              onClick={() => handleResolve('REJECTED')}
              className="group relative overflow-hidden w-full sm:w-auto h-[48px] px-6 rounded-lg border border-rose-500/30 bg-zinc-900 text-rose-500 font-mono font-bold text-[12px] uppercase tracking-widest transition-all hover:border-rose-500 hover:text-white"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-screen" 
                   style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, #e11d48 10px, #e11d48 20px)' }} />
              <span className="relative z-10 flex items-center gap-2">
                <ShieldAlert size={14} className="group-hover:animate-pulse" /> Reject Claim
              </span>
            </button>

            {/* Hold to Approve Refund */}
            <HoldToApprove onExecute={() => handleResolve('APPROVED')} />
          </>
        ) : (
          <div className={`px-4 py-2 rounded font-mono font-bold text-xs uppercase ${dispute.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            STATUS: {dispute.status}
          </div>
        )}
        
      </div>
      </>
      )}
    </div>
  );
};
