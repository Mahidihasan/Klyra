import React, { useState, MouseEvent, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Search, ArrowRightLeft, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Data ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  type: 'PAYMENT' | 'REFUND' | 'CHARGEBACK' | 'SUSPICIOUS';
  amount: number;
  currency: string;
  user: string;
  timestamp: string;
  stripeId: string;
}

// ─── Cursor-Aware Row Component ───────────────────────────────────────────────

const LedgerRowSkeleton = () => (
  <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-white/5 last:border-0 group overflow-hidden">
    {/* ── Left: Entity Info ── */}
    <div className="relative z-10 flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border bg-white/5 border-white/10 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full hover:translate-x-full" style={{ animationName: 'shimmer' }} />
      </div>
      <div className="flex flex-col min-w-0 pr-4 gap-1.5">
        <div className="w-24 h-3.5 bg-white/10 rounded overflow-hidden relative">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
        <div className="w-32 h-2.5 bg-white/5 rounded overflow-hidden relative">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>

    {/* ── Middle: Badges & Timestamp ── */}
    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 w-full md:w-auto">
      <div className="shrink-0 w-28 h-6 bg-white/5 rounded-md border border-white/5 overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
      <div className="w-40 h-3 bg-white/5 rounded overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
      <div className="shrink-0 text-right w-32 h-4 bg-white/10 rounded overflow-hidden relative ml-auto">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  </div>
);

const LedgerRow = ({ tx }: { tx: Transaction }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const isFraud = tx.type === 'CHARGEBACK' || tx.type === 'SUSPICIOUS';
  const isPositive = tx.amount > 0 && !isFraud;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-white/5 last:border-0 group overflow-hidden cursor-crosshair transition-colors hover:bg-white/[0.02]"
    >
      {/* ── Spotlight Overlay ── */}
      {isHovered && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.06), transparent 40%)`,
          }}
        />
      )}

      {/* ── Left: Entity Info ── */}
      <div className="relative z-10 flex items-center gap-4 w-full md:w-auto mb-3 md:mb-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
          isFraud ? 'bg-rose-500/10 border-rose-500/30' : 'bg-blue-500/10 border-blue-500/20'
        }`}>
          {isFraud ? <ShieldAlert size={18} className="text-rose-400" /> : <CreditCard size={18} className="text-blue-400" />}
        </div>
        
        <div className="flex flex-col min-w-0 pr-4">
          <div className="text-[14px] font-bold text-white whitespace-normal break-words">
            @{tx.user}
          </div>
          <div className="text-[11px] text-white/40 font-mono tracking-widest uppercase mt-0.5">
            {tx.stripeId}
          </div>
        </div>
      </div>

      {/* ── Middle: Badges & Timestamp ── */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 w-full md:w-auto">
        
        {/* Fraud / Status Badge */}
        <div className="shrink-0 w-28">
          {isFraud ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {tx.type}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50">
              <CheckCircle2 size={10} />
              {tx.type}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-[12px] font-mono text-white/30 tracking-widest w-40">
          {tx.timestamp}
        </div>

        {/* Amount */}
        <div className="shrink-0 text-right w-32">
          <span className={`text-[16px] font-mono font-bold tracking-wider ${
            isPositive 
              ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' 
              : isFraud 
                ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                : 'text-white/60'
          }`}>
            {tx.amount > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency }).format(tx.amount)}
          </span>
        </div>
      </div>

    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SpatialLedger = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/financials/disputes', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const json = await res.json();
          // Map Prisma models to frontend UI structure
          const mapped: Transaction[] = json.data.map((tx: any) => ({
            id: tx.id,
            type: tx.type === 'DISPUTE' ? 'CHARGEBACK' : tx.type, // Map DISPUTE to CHARGEBACK for UI
            amount: parseFloat(tx.amount || 0),
            currency: 'USD',
            user: tx.userId,
            timestamp: new Date(tx.createdAt).toISOString().replace('T', ' ').substring(0, 19),
            stripeId: `pi_${tx.id.substring(0, 8)}...`
          }));
          setTransactions(mapped);
        } else {
          console.error('Failed to fetch disputes');
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDisputes();
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col min-h-[500px]">
      
      {/* ── Header ── */}
      <div className="flex justify-between items-end mb-4 shrink-0 px-2">
        <div>
          <h2 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-emerald-400" />
            Spatial Ledger
          </h2>
          <p className="text-[12px] text-white/40 mt-1">
            Real-time forensic transaction feed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              placeholder="Search TX or Stripe ID..." 
              className="bg-black/40 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-[12px] font-mono text-white focus:outline-none focus:border-emerald-500/50 w-48 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── The Forensic Canvas ── */}
      <div className="relative flex-1 bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Subtle Noise Texture Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        />

        {/* Header Row */}
        <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest w-full md:w-auto">Entity / Source</div>
          <div className="hidden md:flex items-center gap-8">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest w-28">Classification</div>
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest w-40">UTC Timestamp</div>
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest w-32 text-right">Settlement</div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <>
              <LedgerRowSkeleton />
              <LedgerRowSkeleton />
              <LedgerRowSkeleton />
              <LedgerRowSkeleton />
            </>
          ) : (
            transactions.map((tx) => (
              <LedgerRow key={tx.id} tx={tx} />
            ))
          )}
          {/* Fading bottom edge */}
          <div className="h-6 w-full" />
        </div>
      </div>

    </div>
  );
};
