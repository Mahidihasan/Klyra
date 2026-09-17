import React, { useState, useEffect, useRef } from 'react';
import { Key, Globe, Monitor, Smartphone, X, ShieldCheck, Eye, EyeOff, Trash2, AlertTriangle, Wifi, ShieldAlert, Save, Lock } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import toast from 'react-hot-toast';

const HoldToExecute = ({ durationMs, onExecute, label, dangerMode }: { durationMs: number, onExecute: () => void, label: string, dangerMode?: boolean }) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const progressInterval = useRef<ReturnType<typeof setInterval>>();
  const controls = useAnimation();

  useEffect(() => {
    if (isHolding) {
      const startTime = Date.now();
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min((elapsed / durationMs) * 100, 100));
      }, 30);

      holdTimer.current = setTimeout(() => {
        setProgress(100);
        setIsHolding(false);
        onExecute();
        controls.start({ scale: [1, 1.05, 1], transition: { duration: 0.3 } });
      }, durationMs);
    } else {
      clearInterval(progressInterval.current);
      clearTimeout(holdTimer.current);
      setProgress(0);
    }
    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(holdTimer.current);
    };
  }, [isHolding, durationMs, onExecute, controls]);

  return (
    <motion.div animate={controls} className="relative flex-1">
      <button 
        onPointerDown={() => setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerLeave={() => setIsHolding(false)}
        className={`relative overflow-hidden w-full h-full min-h-[44px] rounded-xl border font-bold text-[14px] flex items-center justify-center select-none transition-all duration-300 ${
          dangerMode 
            ? 'bg-rose-950 border-rose-500/30 text-rose-500 hover:border-rose-500 hover:text-rose-400 active:scale-95 cursor-pointer'
            : 'bg-zinc-900 border-zinc-500/30 text-zinc-500 hover:border-zinc-500/60 active:scale-95 cursor-pointer'
        }`}
      >
        <div 
          className={`absolute left-0 top-0 bottom-0 mix-blend-screen transition-all duration-75 ease-linear ${dangerMode ? 'bg-rose-500/30' : 'bg-white/20'}`}
          style={{ width: `${progress}%` }}
        />
        {isHolding && (
          <div className={`absolute inset-0 animate-pulse pointer-events-none ${dangerMode ? 'bg-rose-500/10' : 'bg-white/5'}`} />
        )}
        <span className="relative z-10 flex items-center gap-2">
          {dangerMode && <ShieldAlert size={16} className={isHolding ? 'animate-pulse' : ''} />} {label}
        </span>
      </button>
    </motion.div>
  );
};

// ─── Data ─────────────────────────────────────────────────────────────────────

// Using dynamic data instead of hardcoded PLATFORM_KEYS

const ADMIN_SESSIONS: any[] = [];

const maskKey = (key: string) => key.slice(0, 12) + '••••••••••' + key.slice(-4);

// ─── Security Score Gauge ─────────────────────────────────────────────────────

const SecurityScoreGauge = ({ score }: { score: number | null | undefined }) => {
  const radius = 70;
  const circumference = radius * Math.PI; // half-circle arc
  const isZero = !score || score === 0;
  const displayScore = score || 0;
  
  const offset = circumference - (displayScore / 100) * circumference;
  const color  = isZero ? '#9ca3af' : displayScore >= 90 ? '#34d399' : displayScore >= 70 ? '#fbbf24' : '#f43f5e';
  const glow   = isZero ? 'rgba(156,163,175,0.2)' : displayScore >= 90 ? 'rgba(52,211,153,0.5)' : displayScore >= 70 ? 'rgba(251,191,36,0.5)' : 'rgba(244,63,94,0.5)';

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
          {displayScore}
        </text>
        <text x="100" y="105" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">
          SECURITY SCORE
        </text>
      </svg>
      <div className="flex items-center gap-2 mt-1 text-[12px] font-bold" style={{ color }}>
        {isZero ? '⧖ Pending Evaluation' : displayScore >= 90 ? '✦ Excellent Posture' : displayScore >= 70 ? '⚠ Moderate Risk' : '✕ Critical Risk'}
      </div>
    </div>
  );
};

// ─── Key Row ──────────────────────────────────────────────────────────────────

const KeyRow = ({ apiKey, onRevoke }: { apiKey: any, onRevoke: (id: string) => void }) => {
  const [revealed, setRevealed]       = useState(false);
  const [confirming, setConfirming]   = useState(false); // biometric step
  const [revokeModal, setRevokeModal] = useState(false);

  const handleRevealClick = () => {
    if (apiKey.rawKey) {
      setRevealed(!revealed);
      return;
    }
    // Simulate biometric / password check delay (or actual password prompt)
    setConfirming(true);
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
            {revealed && apiKey.rawKey ? apiKey.rawKey : apiKey.maskedKey}
          </div>
          <div className="text-[11px] text-white/30 mt-1">
            Created {new Date(apiKey.createdAt).toLocaleDateString()} · Last used {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'}
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
                Revoking <span className="font-mono text-white/80 bg-white/5 px-1.5 py-0.5 rounded">{apiKey.maskedKey}</span> will instantly drop all active connections using this key. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setRevokeModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 font-semibold hover:bg-white/5 transition-colors active:scale-95">
                  Cancel
                </button>
                <HoldToExecute 
                  durationMs={2000} 
                  onExecute={() => { setRevokeModal(false); onRevoke(apiKey.id); }} 
                  label="Hold to Revoke" 
                  dangerMode={true} 
                />
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
  const [sessions, setSessions] = useState<any[]>([]);
  const [wiping, setWiping]     = useState(false);
  const [config, setConfig]     = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [keys, setKeys]         = useState<any[]>([]);
  const [metrics, setMetrics]   = useState<any>(null);
  const [saving, setSaving]     = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyEnv, setKeyEnv] = useState('PRODUCTION');
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const [configRes, metricsRes, keysRes, sessionsRes] = await Promise.all([
          fetch('/api/v1/admin/security/config?t=' + new Date().getTime(), { headers }),
          fetch('/api/v1/admin/security/metrics?t=' + new Date().getTime(), { headers }),
          fetch('/api/v1/admin/security/keys?t=' + new Date().getTime(), { headers }),
          fetch('/api/v1/admin/security/sessions?t=' + new Date().getTime(), { headers })
        ]);
        
        const [configData, metricsData, keysData, sessionsData] = await Promise.all([
          configRes.json(), metricsRes.json(), keysRes.json(), sessionsRes.json()
        ]);
        
        if (configData && !configData.error) setConfig(configData);
        if (metricsData && !metricsData.error) setMetrics(metricsData);
        if (keysData && !keysData.error) setKeys(keysData);
        if (sessionsData && !sessionsData.error) setSessions(sessionsData);
      } catch (err) {
        console.error('Failed to fetch security data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const submitGenerateKey = async () => {
    if (!keyName.trim()) { toast.error('Key name is required'); return; }
    setGenerating(true);
    
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/security/keys', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName, environment: keyEnv })
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(prev => [{ ...data.key, rawKey: data.rawKey }, ...prev]);
        setGeneratedRawKey(data.rawKey);
        toast.success('API Key generated successfully');
      } else {
        toast.error('Failed to generate key');
      }
    } catch (err) {
      toast.error('Network error generating key');
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/security/keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== id));
        toast.success('API Key revoked');
      } else {
        toast.error('Failed to revoke key');
      }
    } catch (err) {
      toast.error('Network error revoking key');
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/security/config', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success('Security policies updated successfully!');
      } else {
        toast.error('Failed to update policies.');
      }
    } catch (err) {
      console.error('Failed to save security config', err);
      toast.error('Network error saving policies.');
    } finally {
      setSaving(false);
    }
  };

  const terminateOthers = async () => {
    setWiping(true);
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/security/sessions', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.current));
        toast.success('All other sessions terminated.');
      } else {
        toast.error('Failed to terminate sessions.');
      }
    } catch (err) {
      toast.error('Network error terminating sessions.');
    } finally {
      setWiping(false);
    }
  };

  const terminateSession = async (id: string) => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/security/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        toast.success('Session terminated.');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to terminate session.');
      }
    } catch (err) {
      toast.error('Network error terminating session.');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      {/* Global Security Policies */}
      <div className="rounded-2xl bg-black/60 border border-white/5 overflow-hidden shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-indigo-400" />
            <h3 className="text-[16px] font-bold text-white">Global Security Policies</h3>
          </div>
          <button 
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[13px] font-bold transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : <><Save size={14} /> Save Policies</>}
          </button>
        </div>

        {isLoading || !config ? (
          <div className="animate-pulse flex gap-6">
            <div className="h-32 bg-white/5 rounded-xl flex-1"></div>
            <div className="h-32 bg-white/5 rounded-xl flex-1"></div>
            <div className="h-32 bg-white/5 rounded-xl flex-1"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <div>
                <div className="text-[14px] font-bold text-white mb-1">Require 2FA</div>
                <div className="text-[12px] text-white/40 leading-relaxed mb-4">Mandate two-factor authentication for all platform administrators.</div>
              </div>
              <div
                onClick={() => setConfig((prev: any) => ({ ...prev, require_2fa: !prev.require_2fa }))}
                className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${config.require_2fa ? 'bg-indigo-500' : 'bg-white/10'}`}
              >
                <motion.div animate={{ x: config.require_2fa ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md" />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <div>
                <div className="text-[14px] font-bold text-white mb-1">Block VPN & Tor</div>
                <div className="text-[12px] text-white/40 leading-relaxed mb-4">Automatically drop connections originating from known anonymizer nodes.</div>
              </div>
              <div
                onClick={() => setConfig((prev: any) => ({ ...prev, block_vpn: !prev.block_vpn }))}
                className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${config.block_vpn ? 'bg-indigo-500' : 'bg-white/10'}`}
              >
                <motion.div animate={{ x: config.block_vpn ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md" />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <div>
                <div className="text-[14px] font-bold text-white mb-1">Session Timeout (Minutes)</div>
                <div className="text-[12px] text-white/40 leading-relaxed mb-4">Idle time before an admin is automatically logged out.</div>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="15" 
                  max="240" 
                  step="15" 
                  value={config.session_timeout} 
                  onChange={e => setConfig((prev: any) => ({ ...prev, session_timeout: parseInt(e.target.value) }))}
                  className="flex-1 accent-indigo-500" 
                />
                <span className="text-[14px] font-bold text-white font-mono">{config.session_timeout}m</span>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <div>
                <div className="text-[14px] font-bold text-white mb-1">Max Failed Logins</div>
                <div className="text-[12px] text-white/40 leading-relaxed mb-4">Number of attempts before 20-minute account lockout.</div>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="3" 
                  max="10" 
                  step="1" 
                  value={config.max_failed_logins} 
                  onChange={e => setConfig((prev: any) => ({ ...prev, max_failed_logins: parseInt(e.target.value) }))}
                  className="flex-1 accent-indigo-500" 
                />
                <span className="text-[14px] font-bold text-white font-mono">{config.max_failed_logins}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Score + Key Vault */}
      <div className="grid grid-cols-[280px_1fr] gap-6">

        {/* Security Score Gauge */}
        <div className={`rounded-2xl bg-black/60 border border-white/5 p-6 flex flex-col items-center justify-center shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          <SecurityScoreGauge score={metrics?.score || 0} />
          <div className="grid grid-cols-2 gap-3 mt-6 w-full">
            <div className="text-center">
              <div className="text-[22px] font-mono font-bold text-white">{metrics?.ipsBlocked || 0}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">IPs Blocked</div>
            </div>
            <div className="text-center">
              <div className="text-[22px] font-mono font-bold text-white">{metrics?.mfaAdoption || 0}%</div>
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
            <button onClick={() => { setKeyName(''); setKeyEnv('PRODUCTION'); setGeneratedRawKey(null); setIsModalOpen(true); }} className="px-4 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[12px] font-bold hover:bg-indigo-500/20 transition-colors">
              + Generate Key
            </button>
          </div>
          {keys.length === 0 && !isLoading && (
            <div className="p-8 text-center text-white/40 text-[13px]">No API keys found.</div>
          )}
          {keys.map(key => (
            <KeyRow key={key.id} apiKey={key} onRevoke={revokeKey} />
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

              <div className="text-[12px] text-white/30 font-mono shrink-0">
                {new Date(session.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>

              {!session.current && (
                <button
                  onClick={() => terminateSession(session.id)}
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

      {/* Generate Key Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (!generatedRawKey && !generating) setIsModalOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="w-[420px] p-8 rounded-3xl bg-[#0a0a0f] border border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Key size={20} className="text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">Generate API Key</h3>
                </div>
                {!generatedRawKey && !generating && (
                  <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
                )}
              </div>
              
              {generatedRawKey ? (
                <div>
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
                    <p className="text-[13px] text-indigo-300 mb-2">Please copy this key now. You won't be able to see it again!</p>
                    <div className="font-mono text-[14px] text-white break-all select-all p-3 rounded-lg bg-black/40 border border-white/5">{generatedRawKey}</div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-white/60 mb-2 uppercase tracking-wider">Key Name</label>
                    <input 
                      type="text" 
                      value={keyName} 
                      onChange={e => setKeyName(e.target.value)} 
                      placeholder="e.g. Production Mobile App" 
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[14px] focus:border-indigo-500/50 focus:outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-white/60 mb-2 uppercase tracking-wider">Environment</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setKeyEnv('PRODUCTION')}
                        className={`flex-1 py-2 rounded-lg text-[13px] font-bold border transition-colors ${keyEnv === 'PRODUCTION' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                      >
                        PRODUCTION
                      </button>
                      <button 
                        onClick={() => setKeyEnv('TEST')}
                        className={`flex-1 py-2 rounded-lg text-[13px] font-bold border transition-colors ${keyEnv === 'TEST' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                      >
                        TEST
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setIsModalOpen(false)} disabled={generating} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 font-semibold hover:bg-white/5 transition-colors disabled:opacity-50">
                      Cancel
                    </button>
                    <button 
                      onClick={submitGenerateKey} 
                      disabled={generating || !keyName.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      {generating ? <motion.div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} /> : 'Generate'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
