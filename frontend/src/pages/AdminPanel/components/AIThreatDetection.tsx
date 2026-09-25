import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, AlertTriangle, Cpu, Crosshair, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ──────────────────────────────────────────────────────────────────────

const THREAT_NODES: { id: string; cx: number; cy: number; severity: 'normal' | 'warn' | 'critical'; ip: string }[] = [
  { id: 'n1', cx: 180, cy: 110, severity: 'critical', ip: '45.33.12.99'   },
  { id: 'n2', cx: 280, cy: 230, severity: 'warn',     ip: '192.168.1.44'  },
  { id: 'n3', cx: 110, cy: 220, severity: 'normal',   ip: '203.0.113.12'  },
  { id: 'n4', cx: 310, cy: 100, severity: 'normal',   ip: '198.51.100.4'  },
  { id: 'n5', cx: 230, cy: 280, severity: 'warn',     ip: '172.16.254.1'  },
  { id: 'n6', cx: 140, cy: 175, severity: 'normal',   ip: '10.0.0.55'     },
];

const CENTER = { cx: 200, cy: 200 };

const INITIAL_FEED: any[] = [];

// ─── Sub-components ────────────────────────────────────────────────────────────

const NodePulse = ({ cx, cy, severity }: { cx: number; cy: number; severity: string }) => {
  const color = severity === 'critical' ? '#f43f5e' : severity === 'warn' ? '#f59e0b' : '#34d399';
  const glowColor = severity === 'critical' ? 'rgba(244,63,94,0.6)' : severity === 'warn' ? 'rgba(245,158,11,0.5)' : 'rgba(52,211,153,0.4)';

  return (
    <g>
      {/* Expanding ping rings for threats */}
      {severity !== 'normal' && [0, 1].map(i => (
        <motion.circle
          key={i}
          cx={cx} cy={cy}
          initial={{ r: 6, opacity: 0.8 }}
          animate={{ r: 26 + i * 8, opacity: 0 }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
      ))}
      {/* Core dot */}
      <motion.circle
        cx={cx} cy={cy} r={6}
        fill={color}
        style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        animate={severity === 'critical' ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </g>
  );
};

const RadarSweep = ({ hasCritical }: { hasCritical?: boolean }) => {
  const sweepColor = hasCritical ? '#f43f5e' : '#6366f1';
  return (
    <motion.g
      style={{ transformOrigin: '200px 200px' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
    >
      <defs>
        <radialGradient id="sweepGradient" cx="0%" cy="50%" r="100%">
          <stop offset="0%" stopColor={sweepColor} stopOpacity="0.4" />
          <stop offset="100%" stopColor={sweepColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M 200 200 L 200 20 A 180 180 0 0 1 380 200 Z"
        fill="url(#sweepGradient)"
      />
    </motion.g>
  );
};

const ThreatFeedItem = ({ item }: { item: typeof INITIAL_FEED[0] }) => {
  const color = item.level === 'critical' ? 'text-rose-400' : item.level === 'warning' ? 'text-amber-400' : 'text-sky-400/70';
  const dot   = item.level === 'critical' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : item.level === 'warning' ? 'bg-amber-400' : 'bg-sky-500/60';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex gap-3 items-start py-3 border-b border-white/5 last:border-0"
    >
      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-mono leading-relaxed ${color}`}>{item.msg}</p>
        <span className="text-[11px] text-white/25 font-mono">{item.time}</span>
      </div>
    </motion.div>
  );
};

// ─── DEFCON Lockdown Modal ─────────────────────────────────────────────────────

const DefconModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => {
  const [input, setInput] = useState('');
  const ready = input === 'CONFIRM';

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="relative w-[480px] rounded-3xl bg-[#0a0a0f] border border-rose-500/40 shadow-[0_0_80px_rgba(244,63,94,0.3)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Hazard stripe top bar */}
        <div className="h-3 w-full bg-[repeating-linear-gradient(45deg,#000,#000_10px,#7f1d1d_10px,#7f1d1d_20px)]" />

        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <Lock size={22} className="text-rose-500" />
            <h2 className="text-xl font-black text-rose-400 tracking-tight uppercase">DEFCON — Global Lockdown</h2>
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed mb-8">
            This will immediately activate <span className="text-white/80 font-semibold">System Maintenance Mode</span> and block all non-essential traffic platform-wide. This action is <span className="text-rose-400 font-bold">irreversible</span> without a manual reset.
          </p>

          <div className="mb-6">
            <label className="block text-[11px] uppercase tracking-widest font-bold text-white/40 mb-2">
              Type <span className="text-rose-400">CONFIRM</span> to proceed
            </label>
            <input
              autoFocus
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="CONFIRM"
              className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-[14px] tracking-widest focus:outline-none focus:border-rose-500/60 transition-colors placeholder:text-white/20"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold hover:bg-white/5 transition-colors"
            >
              Abort
            </button>
            <button
              disabled={!ready}
              onClick={onConfirm}
              className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${
                ready
                  ? 'bg-rose-600 text-white shadow-[0_0_30px_rgba(244,63,94,0.5)] hover:bg-rose-700'
                  : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
              }`}
            >
              Engage Lockdown
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export const AIThreatDetection = () => {
  const [feed, setFeed]             = useState(INITIAL_FEED);
  const [stats, setStats]           = useState({ critical: 0, warnings: 0, mitigated: 0, systemStatus: true });
  const [lockdownOpen, setLockdown] = useState(false);
  const [locked, setLocked]         = useState(false);

  // Fetch threats and stats on mount
  useEffect(() => {
    const fetchThreats = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        
        // Fetch feed
        const res = await fetch('/api/v1/admin/security/threats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data && Array.isArray(data)) {
          setFeed(data.slice(0, 12));
        }

        // Fetch stats
        const resStats = await fetch('/api/v1/admin/security/threat-stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await resStats.json();
        if (statsData && typeof statsData.critical === 'number') {
          setStats(statsData);
        }
      } catch (err) {
        console.error('Failed to fetch threats or stats:', err);
      }
    };
    fetchThreats();
  }, []);

  const handleConfirmLockdown = async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      await fetch('/api/v1/admin/security/emergency-lockdown', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true })
      });
      setLocked(true);
      setLockdown(false);
      import('react-hot-toast').then(m => m.default.success('DEFCON Lockdown Engaged'));
    } catch (err) {
      import('react-hot-toast').then(m => m.default.error('Failed to engage lockdown'));
    }
  };

  const handleDisengageLockdown = async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      await fetch('/api/v1/admin/security/emergency-lockdown', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      });
      setLocked(false);
      import('react-hot-toast').then(m => m.default.success('Lockdown Disengaged'));
    } catch (err) {
      import('react-hot-toast').then(m => m.default.error('Failed to disengage lockdown'));
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">

      {/* DEFCON Lockdown Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-rose-500/30">
        {/* Hazard stripe border */}
        <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(90deg,#f43f5e,#f43f5e_12px,transparent_12px,transparent_24px)]" />
        <div className="flex items-center justify-between px-8 py-5 bg-rose-950/20">
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div
                className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center"
                animate={locked ? {} : { boxShadow: ['0 0 0px rgba(244,63,94,0)', '0 0 20px rgba(244,63,94,0.5)', '0 0 0px rgba(244,63,94,0)'] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <Lock size={22} className={locked ? 'text-rose-300' : 'text-rose-500'} />
              </motion.div>
            </div>
            <div>
              <div className="text-[13px] font-black uppercase tracking-widest text-rose-400">
                DEFCON — Global Lockdown Protocol
              </div>
              <div className="text-[12px] text-white/40 mt-0.5">
                {locked
                  ? '⚠️ System is in LOCKDOWN MODE — all non-essential traffic blocked'
                  : 'Instantly enforce system-wide maintenance mode and block all non-essential traffic.'}
              </div>
            </div>
          </div>

          {locked ? (
            <button
              onClick={handleDisengageLockdown}
              className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm hover:bg-white/10 transition-colors"
            >
              Disengage Lockdown
            </button>
          ) : (
            <button
              onClick={() => setLockdown(true)}
              className="px-6 py-2.5 rounded-xl bg-rose-600/80 text-white font-black text-sm uppercase tracking-widest hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all border border-rose-500/50"
            >
              Engage Lockdown
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="grid grid-cols-[1fr_360px] gap-6">

        {/* AI Threat Radar */}
        <div className="rounded-2xl bg-black/60 border border-white/5 p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Cpu size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">Live Threat Radar</h3>
            <motion.div
              className={`ml-auto flex items-center gap-2 text-[11px] font-mono ${stats.critical > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${stats.critical > 0 ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`} />
              {stats.critical > 0 ? 'THREAT DETECTED' : 'SCANNING'}
            </motion.div>
          </div>

          <div className="flex items-center justify-center">
            <svg width="400" height="400" className="overflow-visible">
              <defs>
                <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0"    />
                </radialGradient>
              </defs>

              {/* Background radar fill */}
              <circle cx="200" cy="200" r="180" fill="url(#radarBg)" />

              {/* Concentric rings */}
              {[60, 110, 160, 180].map(r => (
                <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="1" />
              ))}

              {/* Crosshair lines */}
              <line x1="200" y1="20"  x2="200" y2="380" stroke="rgba(99,102,241,0.1)" strokeWidth="1" />
              <line x1="20"  y1="200" x2="380" y2="200" stroke="rgba(99,102,241,0.1)" strokeWidth="1" />

              {/* Connection lines from center to nodes */}
              {THREAT_NODES.map(n => (
                <line
                  key={n.id + 'l'}
                  x1={CENTER.cx} y1={CENTER.cy}
                  x2={n.cx}      y2={n.cy}
                  stroke={n.severity === 'critical' ? 'rgba(244,63,94,0.2)' : 'rgba(99,102,241,0.1)'}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Radar sweep */}
              <RadarSweep hasCritical={stats.critical > 0} />

              {/* Center node — the gateway */}
              <circle cx="200" cy="200" r="8" fill={stats.critical > 0 ? '#f43f5e' : '#6366f1'} style={{ filter: `drop-shadow(0 0 12px ${stats.critical > 0 ? 'rgba(244,63,94,0.8)' : 'rgba(99,102,241,0.8)'})` }} />
              <circle cx="200" cy="200" r="20" fill="none" stroke={stats.critical > 0 ? 'rgba(244,63,94,0.3)' : 'rgba(99,102,241,0.3)'} strokeWidth="1" />

              {/* Threat nodes */}
              {THREAT_NODES.map(n => {
                let severity = n.severity;
                if (stats.critical === 0 && severity === 'critical') {
                  severity = 'warn'; // Make criticals warn if system is secure
                }
                return <NodePulse key={n.id} cx={n.cx} cy={n.cy} severity={severity} />;
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4 text-[11px] font-semibold text-white/40">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Clean</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Suspicious</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Critical Threat</span>
          </div>
        </div>

        {/* AI Security Insights Feed */}
        <div className="rounded-2xl bg-black/60 border border-white/5 flex flex-col shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Radio size={15} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">AI Security Insights</h3>
            </div>
            <motion.div
              className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              LIVE
            </motion.div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {feed.length === 0 || (!stats.systemStatus && feed.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20 min-h-[200px]">
                <div className={`p-4 rounded-full border backdrop-blur-md ${stats.systemStatus ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                  {stats.systemStatus ? (
                    <Shield size={28} className="text-emerald-400/50" />
                  ) : (
                    <AlertTriangle size={28} className="text-rose-400/50" />
                  )}
                </div>
                <div className="text-center font-sans">
                  <h4 className="text-[14px] font-bold text-white/40 mb-1">{stats.systemStatus ? 'System Secure' : 'Active Threats Detected'}</h4>
                  <p className="text-[12px] text-white/30 px-4">
                    {stats.systemStatus ? 'No active AI threats or anomalies detected.' : 'Critical severity anomalies require immediate attention.'}
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {(!stats.systemStatus && feed.length > 0) && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex gap-3 items-center">
                    <AlertTriangle size={18} className="text-rose-400" />
                    <span className="text-[12px] font-bold text-rose-400">System under active threat. Review logs immediately.</span>
                  </div>
                )}
                {feed.map(item => (
                  <ThreatFeedItem key={item.id} item={item} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Threat Summary Chips */}
          <div className="px-6 py-4 border-t border-white/5 flex gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-400">
              🔴 {stats.critical} Critical
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-400">
              🟡 {stats.warnings} Warnings
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] font-bold text-sky-400">
              🔵 {stats.mitigated} Mitigated
            </div>
          </div>
        </div>
      </div>

      {/* DEFCON Modal */}
      <AnimatePresence>
        {lockdownOpen && (
          <DefconModal
            onClose={() => setLockdown(false)}
            onConfirm={handleConfirmLockdown}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
