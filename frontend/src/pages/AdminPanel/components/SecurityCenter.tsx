import React, { useState, useEffect } from 'react';
import { Key, Globe, Monitor, Smartphone, X, ShieldCheck, Eye, EyeOff, Trash2, AlertTriangle, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLATFORM_KEYS = [
  { id: 'k1', name: 'Production Gateway Key', key: 'sk_live_Kl9xR2mP4qBv7zA3tYwE', created: '2026-08-01', lastUsed: '2m ago',  env: 'production' },
  { id: 'k2', name: 'Webhook Signing Secret',  key: 'whsec_8NrK5jQm2pLxCvD0uYtF', created: '2026-07-15', lastUsed: '1h ago',  env: 'production' },
  { id: 'k3', name: 'Analytics Read Token',    key: 'sk_test_3WzA9sXd6bNqPe1mHrGu', created: '2026-09-01', lastUsed: '12m ago', env: 'test'       },
];

const ADMIN_SESSIONS = [
  { id: 's1', device: 'Mac',     name: 'MacBook Pro 16"', ip: '192.168.1.10', location: 'Dhaka, BD',      ua: 'Chrome 128',  current: true,  time: 'Now'     },
  { id: 's2', device: 'Windows', name: 'Windows 11 PC',   ip: '45.33.12.88',  location: 'London, UK',     ua: 'Firefox 121', current: false, time: '4h ago'  },
  { id: 's3', device: 'Mobile',  name: 'iPhone 16 Pro',   ip: '77.88.44.22',  location: 'New York, US',   ua: 'Safari iOS',  current: false, time: '1d ago'  },
];

const maskKey = (key: string) => key.slice(0, 12) + '••••••••••' + key.slice(-4);

// ─── Security Score Gauge ─────────────────────────────────────────────────────

const SecurityScoreGauge = ({ score }: { score: number }) => {
  const radius = 70;
  const circumference = radius * Math.PI; // half-circle arc
  const offset = circumference - (score / 100) * circumference;
  const color  = score >= 90 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f43f5e';
  const glow   = score >= 90 ? 'rgba(52,211,153,0.5)' : score >= 70 ? 'rgba(251,191,36,0.5)' : 'rgba(244,63,94,0.5)';

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="200" height="110" className="overflow-visible">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="1"   />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
        {/* Fill */}
        <motion.path
          d="M 15 100 A 85 85 0 0 1 185 100"
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          initial={{ strokeDashoffset: circumference }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
        />
        {/* Score label */}
        <text x="100" y="85" textAnchor="middle" fill="white" fontSize="32" fontWeight="900" fontFamily="monospace">
          {score}
        </text>
        <text x="100" y="105" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">
          SECURITY SCORE
        </text>
      </svg>
      <div className="flex items-center gap-2 mt-1 text-[12px] font-bold" style={{ color }}>
        {score >= 90 ? '✦ Excellent Posture' : score >= 70 ? '⚠ Moderate Risk' : '✕ Critical Risk'}
      </div>
    </div>
  );
};

// ─── Key Row ──────────────────────────────────────────────────────────────────

const KeyRow = ({ apiKey }: { apiKey: typeof PLATFORM_KEYS[0] }) => {
  const [revealed, setRevealed]       = useState(false);
  const [confirming, setConfirming]   = useState(false); // biometric step
  const [revokeModal, setRevokeModal] = useState(false);

  const handleRevealClick = () => {
    if (revealed) { setRevealed(false); return; }
    setConfirming(true);
    // Simulate biometric / password check delay
    setTimeout(() => { setConfirming(false); setRevealed(true); }, 1200);
  };

  return (
    <>
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-white">{apiKey.name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              apiKey.env === 'production'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>{apiKey.env}</span>
          </div>
          <div className="font-mono text-[12px] text-white/50 tracking-wider">
            {revealed ? apiKey.key : maskKey(apiKey.key)}
          </div>
          <div className="text-[11px] text-white/30 mt-1">
            Created {apiKey.created} · Last used {apiKey.lastUsed}
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleRevealClick}
            disabled={confirming}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              confirming
                ? 'bg-white/5 border-white/10 text-white/30 cursor-wait'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {confirming
              ? <><motion.div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} /> Verifying...</>
              : revealed
                ? <><EyeOff size={13} /> Hide</>
                : <><Eye size={13} /> Reveal</>
            }
          </button>

          <button
            onClick={() => setRevokeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 transition-colors"
          >
            <Trash2 size={13} /> Revoke
          </button>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <AnimatePresence>
        {revokeModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRevokeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="w-[420px] p-8 rounded-3xl bg-[#0a0a0f] border border-rose-500/30 shadow-[0_0_60px_rgba(244,63,94,0.2)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={20} className="text-rose-500" />
                <h3 className="text-lg font-bold text-rose-400">Revoke API Key</h3>
              </div>
              <p className="text-[13px] text-white/60 leading-relaxed mb-6">
                Revoking <span className="font-mono text-white/80 bg-white/5 px-1.5 py-0.5 rounded">{maskKey(apiKey.key)}</span> will instantly drop all active connections using this key. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setRevokeModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 font-semibold hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button onClick={() => setRevokeModal(false)} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                  Revoke Key
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Session Row ──────────────────────────────────────────────────────────────

const DeviceIcon = ({ device }: { device: string }) => {
  if (device === 'Mobile') return <Smartphone size={18} className="text-white/50" />;
  if (device === 'Mac')    return <Monitor size={18} className="text-white/50" />;
  return <Monitor size={18} className="text-white/50" />;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SecurityCenter = () => {
  const [sessions, setSessions] = useState(ADMIN_SESSIONS);
  const [wiping, setWiping]     = useState(false);

  const terminateOthers = () => {
    setWiping(true);
    setTimeout(() => {
      setSessions(prev => prev.filter(s => s.current));
      setWiping(false);
    }, 800);
  };

  return (
    <div className="flex flex-col gap-6 pb-32">

      {/* Row 1: Score + Key Vault */}
      <div className="grid grid-cols-[280px_1fr] gap-6">

        {/* Security Score Gauge */}
        <div className="rounded-2xl bg-black/60 border border-white/5 p-6 flex flex-col items-center justify-center shadow-2xl">
          <SecurityScoreGauge score={94} />
          <div className="grid grid-cols-2 gap-3 mt-6 w-full">
            <div className="text-center">
              <div className="text-[22px] font-mono font-bold text-white">842</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">IPs Blocked</div>
            </div>
            <div className="text-center">
              <div className="text-[22px] font-mono font-bold text-white">68%</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">MFA Adoption</div>
            </div>
          </div>
        </div>

        {/* Key Vault */}
        <div className="rounded-2xl bg-black/60 border border-white/5 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Platform Key Vault</h3>
            </div>
            <button className="px-4 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[12px] font-bold hover:bg-indigo-500/20 transition-colors">
              + Generate Key
            </button>
          </div>
          {PLATFORM_KEYS.map(key => (
            <KeyRow key={key.id} apiKey={key} />
          ))}
        </div>
      </div>

      {/* Row 2: Active Session Inspector */}
      <div className="rounded-2xl bg-black/60 border border-white/5 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Active Admin Sessions</h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              {sessions.length} Active
            </span>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={terminateOthers}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[12px] font-bold hover:bg-rose-500/20 transition-colors"
            >
              <X size={13} /> Terminate All Other Sessions
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              layout
              initial={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ delay: session.current ? 0 : i * 0.08, duration: 0.35 }}
              className={`flex items-center gap-5 px-6 py-4 border-b border-white/5 last:border-0 ${session.current ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'} transition-colors`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${session.current ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                <DeviceIcon device={session.device} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-white">{session.name}</span>
                  {session.current && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-white/40 font-mono">
                  <span>{session.ip}</span>
                  <span className="text-white/15">·</span>
                  <span className="flex items-center gap-1"><Globe size={10} />{session.location}</span>
                  <span className="text-white/15">·</span>
                  <span>{session.ua}</span>
                </div>
              </div>

              <div className="text-[12px] text-white/30 font-mono shrink-0">{session.time}</div>

              {!session.current && (
                <button
                  onClick={() => setSessions(prev => prev.filter(s => s.id !== session.id))}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-white/10 text-white/40 hover:border-rose-500/30 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
                >
                  Terminate
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sessions.length === 1 && (
          <div className="px-6 py-8 text-center">
            <ShieldCheck size={32} className="text-emerald-500/50 mx-auto mb-3" />
            <p className="text-[13px] text-white/40">Only your current session is active.</p>
          </div>
        )}
      </div>
    </div>
  );
};
