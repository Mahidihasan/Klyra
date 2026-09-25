import React, { useState, useRef, useEffect } from 'react';
import { Server, Activity, ServerCrash, AlignRight, Rocket, Loader2 } from 'lucide-react';
import { motion, animate, useMotionValue } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

// ─── Data ────────────────────────────────────────────────────────────────────

interface Breaker {
  id: string;
  name: string;
  desc: string;
  isClosed: boolean; // Closed = Traffic flows (Active), Open = Tripped (Blocked)
}

const INITIAL_BREAKERS: Breaker[] = [
  { id: 'b_1', name: 'Auth Gateway', desc: 'OAuth & Token Issuance', isClosed: true },
  { id: 'b_2', name: 'Stripe Webhooks', desc: 'Billing & Invoice Events', isClosed: true },
  { id: 'b_3', name: 'Legacy Geo-IP', desc: 'Deprecating in v2.1', isClosed: false },
  { id: 'b_4', name: 'Cache Layer', desc: 'Redis Edge Nodes', isClosed: true },
];

const TRAFFIC_ROUTES = [
  { id: 't_1', name: 'Stable v1.9 → Canary v2.0', initial: 20 },
  { id: 't_2', name: 'Global Search → Vector DB Beta', initial: 5 },
];

// ─── Hardware Switch Component ──────────────────────────────────────

const MassiveHardwareSwitch = ({ isClosed, onToggle }: { isClosed: boolean; onToggle: () => void }) => {
  return (
    <div
      onClick={onToggle}
      className={`relative w-[80px] h-[40px] rounded-full p-1.5 cursor-pointer flex items-center shadow-inner transition-colors duration-300 shrink-0 ${
        isClosed 
          ? 'bg-zinc-900 border-2 border-emerald-500/20 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]' 
          : 'bg-rose-500/10 border-2 border-rose-500/30 shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)]'
      }`}
    >
      {!isClosed && (
        <div className="absolute inset-0 rounded-full bg-[repeating-linear-gradient(45deg,#000_0px,#000_10px,#ef4444_10px,#ef4444_20px)] opacity-20 pointer-events-none overflow-hidden" />
      )}
      
      <motion.div
        animate={{ x: isClosed ? 40 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`relative z-10 w-7 h-7 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center ${
          isClosed 
            ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_15px_rgba(52,211,153,0.5)]' 
            : 'bg-gradient-to-b from-rose-500 to-rose-700 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
      </motion.div>
    </div>
  );
};

// ─── Mixing Board Slider ────────────────────────────────────────────

const MixingBoardSlider = ({ route, val, setVal }: { route: typeof TRAFFIC_ROUTES[0], val: number, setVal: (val: number) => void }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const motionVal = useMotionValue(route.initial);
  const [displayNumber, setDisplayNumber] = useState(route.initial);

  useEffect(() => {
    const controls = animate(motionVal, val, {
      type: 'spring', stiffness: 100, damping: 20,
      onUpdate: (v) => setDisplayNumber(Math.round(v))
    });
    return controls.stop;
  }, [val, motionVal]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    updateVal(e.clientX);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.current) return;
    updateVal(e.clientX);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const updateVal = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((x / rect.width) * 100);
    setVal(percentage);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1 min-w-0 pr-4">
          <div className="text-[12px] font-bold text-white/40 uppercase tracking-widest">Routing Rule</div>
          <div className="text-[16px] font-bold text-white whitespace-normal break-words">{route.name}</div>
        </div>
        
        <div className="flex items-baseline gap-1 shrink-0">
          <motion.span className="text-4xl font-mono font-black text-white/90 tracking-tighter">
            {displayNumber}
          </motion.span>
          <span className="text-xl font-mono text-white/40">%</span>
        </div>
      </div>

      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative h-8 w-full bg-zinc-900 rounded-xl cursor-ew-resize border border-white/5 shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <motion.div 
          className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500"
          initial={false}
          animate={{ width: `${val}%` }}
          transition={{ type: 'spring', stiffness: 250, damping: 25 }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
        </motion.div>
        
        <motion.div
          className="absolute top-0 bottom-0 w-3 bg-zinc-300 rounded-[2px] shadow-[0_0_15px_rgba(255,255,255,0.6)] cursor-ew-resize border-l border-white border-r border-zinc-500"
          initial={false}
          animate={{ left: `calc(${val}% - 6px)` }}
          transition={{ type: 'spring', stiffness: 250, damping: 25 }}
        />
      </div>
    </div>
  );
};

// ─── Exported: Circuit Breakers (Tactical Rail) ─────────────────────────────────

const BreakerSkeleton = () => (
  <div className="flex flex-row justify-between items-center gap-4 p-5 rounded-xl border border-white/5 bg-black/40 overflow-hidden">
    <div className="flex flex-col flex-1 min-w-0 gap-2">
      <div className="w-32 h-4 bg-white/10 rounded overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
      <div className="w-48 h-3 bg-white/5 rounded overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
    <div className="shrink-0 flex items-center justify-center">
      <div className="w-[80px] h-[40px] rounded-full bg-white/5 border border-white/10 overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  </div>
);

export const CircuitBreakers = () => {
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/engine/health', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const json = await res.json();
          // Map backend engine status to Circuit Breakers
          const mapped: Breaker[] = [
            { id: 'db', name: 'Primary Database', desc: `PostgreSQL Cluster (${json.components.database.latencyMs}ms)`, isClosed: json.components.database.status === 'up' },
            { id: 'redis', name: 'Cache Layer', desc: `Redis Edge Nodes (${json.components.redis.latencyMs}ms)`, isClosed: json.components.redis.status === 'up' },
            { id: 'b_1', name: 'Auth Gateway', desc: 'OAuth & Token Issuance', isClosed: true },
            { id: 'b_2', name: 'Stripe Webhooks', desc: 'Billing & Invoice Events', isClosed: true }
          ];
          setBreakers(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch engine health', err);
        setBreakers(INITIAL_BREAKERS); // Fallback
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  const toggleBreaker = async (id: string, currentIsClosed: boolean) => {
    // 1. Optimistic Update
    setBreakers(prev => prev.map(b => b.id === id ? { ...b, isClosed: !currentIsClosed } : b));
    
    // 2. API Call
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/engine/circuit-breakers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: currentIsClosed ? 'TRIPPED' : 'ACTIVE' }) // If it was closed, we are tripping it
      });

      if (!res.ok) {
        throw new Error('Server rejected toggle');
      }
      
      const newStatus = currentIsClosed ? 'TRIPPED (OPEN)' : 'ACTIVE (CLOSED)';
      toast.success(`Circuit Breaker ${newStatus}`, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
    } catch (err) {
      // 3. Fallback on error
      setBreakers(prev => prev.map(b => b.id === id ? { ...b, isClosed: currentIsClosed } : b));
      toast.error('Failed to toggle circuit breaker');
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="flex items-center gap-3 mb-2 shrink-0">
        <Server size={20} className="text-emerald-400" />
        <div>
          <h2 className="text-[18px] font-bold text-white tracking-tight">Circuit Breakers</h2>
          <p className="text-[12px] text-white/40 mt-0.5">Physical microservice cutoffs.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full">
        {loading ? (
          <>
            <BreakerSkeleton />
            <BreakerSkeleton />
            <BreakerSkeleton />
            <BreakerSkeleton />
          </>
        ) : (
          breakers.map((b) => (
            <div key={b.id} className="flex flex-row justify-between items-center gap-4 p-5 rounded-xl border border-white/5 bg-black/40">
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[15px] font-bold text-white whitespace-normal break-words">{b.name}</span>
                  {!b.isClosed && (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 shrink-0">
                      <ServerCrash size={10} /> Tripped
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-white/40 font-mono whitespace-normal break-words">{b.desc}</div>
              </div>
              
              <div className="shrink-0 flex items-center justify-center">
                <MassiveHardwareSwitch isClosed={b.isClosed} onToggle={() => toggleBreaker(b.id, b.isClosed)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Exported: Traffic Shaping (Mixing Board) ───────────────────────────────────

export const TrafficShaping = () => {
  const [routes, setRoutes] = useState(TRAFFIC_ROUTES);

  const handleDeploy = async () => {
    const deployPromise = (async () => {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/engine/traffic-shaping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rules: routes })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server rejected routing rules');
      }
      return await res.json();
    })();

    toast.promise(deployPromise, {
      loading: 'Deploying routing rules...',
      success: 'Traffic Rules Deployed',
      error: 'Deploy Failed'
    }, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full relative">
      <div className="flex items-center gap-3 shrink-0">
        <AlignRight size={20} className="text-purple-400" />
        <div>
          <h2 className="text-[18px] font-bold text-white tracking-tight">Traffic Shaping</h2>
          <p className="text-[12px] text-white/40 mt-0.5">Granular analog routing control.</p>
        </div>
      </div>

      <div className="bg-zinc-950/50 backdrop-blur-3xl border border-white/5 rounded-2xl p-8 flex flex-col gap-10 flex-1 relative overflow-hidden">
        {routes.map(route => (
          <MixingBoardSlider 
            key={route.id} 
            route={route} 
            val={route.initial} 
            setVal={(newVal) => setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, initial: newVal } : r))} 
          />
        ))}

        <div className="mt-auto pt-6 border-t border-white/5 w-full flex justify-end">
          <button 
            onClick={handleDeploy}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-600/20 text-purple-400 font-bold tracking-widest text-[13px] uppercase border border-purple-500/30 hover:bg-purple-600/30 hover:border-purple-400/50 transition-all active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Rocket size={16} /> Deploy Routing Rules
          </button>
        </div>
      </div>
    </div>
  );
};
