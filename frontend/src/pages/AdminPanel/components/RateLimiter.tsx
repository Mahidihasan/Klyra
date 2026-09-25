import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, ServerCrash, Save, Activity, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

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
        {Math.round((value / max) * 100)}%
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

export const RateLimiter = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isLiftModalOpen, setIsLiftModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isLockdownActive, setIsLockdownActive] = useState(false);

  const [initialLimits, setInitialLimits] = useState<Record<string, { rpm: number, burst: number }>>({});
  const [limits, setLimits] = useState<Record<string, { rpm: number, burst: number }>>({});

  useEffect(() => {
    const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
    
    // Fetch Gateway Limits (Dynamic Plans)
    fetch('/api/v1/admin/finances/plans', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setPlans(res.data);
          const newLimits: Record<string, { rpm: number, burst: number }> = {};
          res.data.forEach((p: any) => {
            let features = [];
            try {
              if (typeof p.features === 'string') features = JSON.parse(p.features);
              else features = p.features || [];
            } catch (e) {}

            const burstFeature = features.find((f: any) => f.id === 'burst_concurrency');
            
            newLimits[p.id] = {
              rpm: p.rate_limit || 60,
              burst: burstFeature ? burstFeature.value : 100
            };
          });
          setLimits(newLimits);
          setInitialLimits(newLimits);
          if (res.data.length > 0) setActivePlanId(res.data[0].id);
        }
      })
      .catch(err => {
        console.error('Failed to load plans:', err);
        toast.error('Failed to load gateway limits from plans');
      })
      .finally(() => setIsLoading(false));

    // Fetch Lockdown Status
    fetch('/api/v1/admin/security/emergency-lockdown/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setIsLockdownActive(res.data !== undefined ? res.data : res.lockdownActive);
        }
      })
      .catch(err => console.error('Failed to check lockdown status:', err));
  }, []);

  const currentLimits = limits[activePlanId] || { rpm: 0, burst: 0 };

  const updateLimit = (key: 'rpm' | 'burst', val: number) => {
    setLimits(prev => ({
      ...prev,
      [activePlanId]: { ...prev[activePlanId], [key]: val }
    }));
  };

  const handleDeploy = async () => {
    if (!activePlanId) return;
    const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
    const deployPromise = fetch(`/api/v1/admin/finances/plans/${activePlanId}/limits`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(limits[activePlanId])
    }).then(async res => {
      if (!res.ok) throw new Error('Deployment failed');
      return res.json();
    }).then(res => {
      if (res.success) {
        setInitialLimits(prev => ({ ...prev, [activePlanId]: limits[activePlanId] }));
      }
      return res;
    });

    toast.promise(deployPromise, {
      loading: 'Deploying configuration...',
      success: 'Configuration deployed successfully!',
      error: 'Failed to deploy configuration.'
    }, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
  };

  const handleRevert = () => {
    setLimits(initialLimits);
    toast("Reverted to saved configuration", {
      icon: '🔄',
      style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' }
    });
  };

  const handleEmergencyLockdown = async () => {
      if (confirmText !== 'CONFIRM LOCKDOWN') return;

      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const lockdownPromise = fetch('/api/v1/admin/security/emergency-lockdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).then(async res => {
        if (!res.ok) throw new Error('Lockdown failed');
        return res.json();
      });

      toast.promise(lockdownPromise, {
        loading: 'Engaging lockdown...',
        success: 'Emergency Lockdown Engaged!',
        error: 'Failed to engage lockdown.'
      }, { style: { background: '#4c0519', color: '#fff', border: '1px solid #9f1239' } });

      setIsLockdownActive(true);
      setIsEmergencyModalOpen(false);
      setConfirmText('');
    };

    const handleLiftLockdown = async () => {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const liftPromise = fetch('/api/v1/admin/security/lift-lockdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).then(async res => {
        if (!res.ok) throw new Error('Failed to lift lockdown');
        return res.json();
      });

      toast.promise(liftPromise, {
        loading: 'Restoring routing...',
        success: 'Routing Restored!',
        error: 'Failed to lift lockdown.'
      }, { style: { background: '#064e3b', color: '#fff', border: '1px solid #047857' } });

      setIsLockdownActive(false);
      setIsLiftModalOpen(false);
    };

    return (
      <div className="flex gap-8 pb-32">
        <Toaster position="bottom-right" />
        {/* Configuration Hub */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="rounded-3xl bg-[#0a0a0f] border border-white/5 shadow-2xl overflow-hidden flex min-h-[500px]">
            
            {/* Left Column: Plan Sidebar */}
            <div className="w-72 bg-black/40 border-r border-white/5 flex flex-col">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Settings2 size={24} className="text-indigo-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Gateway Limits</h2>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setActivePlanId(plan.id)}
                    className={`relative text-left px-4 py-3 rounded-xl transition-all font-semibold text-sm ${activePlanId === plan.id ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                  >
                    {activePlanId === plan.id && (
                      <motion.div
                        layoutId="active-plan-sidebar"
                        className="absolute inset-0 bg-indigo-500/10 border border-indigo-500/30 rounded-xl -z-10 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {plan.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Configuration Sliders */}
            <div className="flex-1 p-8 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white">Rule Configuration</h3>
                <p className="text-sm text-white/50 mt-1">Adjust limits for {plans.find(p => p.id === activePlanId)?.name || 'the selected plan'}.</p>
              </div>

              <div className="space-y-12 flex-1 min-h-[200px]">
                {isLoading ? (
                  <div className="space-y-12 animate-pulse opacity-50 pt-2">
                    <div className="w-full h-12 bg-white/5 rounded-xl border border-white/5 shadow-inner" />
                    <div className="w-full h-12 bg-white/5 rounded-xl border border-white/5 shadow-inner" />
                  </div>
                ) : (
                  <>
                    <TactileSlider
                      label="Requests per Minute (RPM)"
                      value={currentLimits.rpm}
                      max={100000}
                      step={10}
                      onChange={(val: number) => updateLimit('rpm', val)}
                    />

                    <TactileSlider
                      label="Burst Tolerance (Concurrency)"
                      value={currentLimits.burst}
                      max={100000}
                      step={10}
                      onChange={(val: number) => updateLimit('burst', val)}
                    />
                  </>
                )}
              </div>

              <div className="mt-12 flex items-center justify-end gap-4 border-t border-white/5 pt-6">
                <button
                  onClick={handleRevert}
                  className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 transition-colors"
                >
                  Revert Changes
                </button>
                <button
                  onClick={handleDeploy}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  <Save size={16} /> Deploy Configuration
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Danger & Monitoring Side Panel */}
        <div className="w-80 flex flex-col gap-6">
          {/* The Hazard Kill Switch */}
          <div className={`p-6 rounded-3xl ${isLockdownActive ? 'bg-rose-950 border-rose-500 shadow-[0_0_40px_rgba(225,29,72,0.3)]' : 'bg-[#0a0a0f] border-rose-500/20 shadow-2xl'} border relative overflow-hidden transition-all duration-500`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <ShieldAlert size={100} />
            </div>
            <h3 className={`text-lg font-bold tracking-tight mb-2 flex items-center gap-2 ${isLockdownActive ? 'text-white' : 'text-rose-500'}`}>
              <ShieldAlert size={18} /> {isLockdownActive ? 'SYSTEM UNDER LOCKDOWN' : 'Emergency Protocol'}
            </h3>
            <p className={`text-[12px] mb-6 leading-relaxed ${isLockdownActive ? 'text-white/80' : 'text-white/50'}`}>
              {isLockdownActive 
                ? 'All unauthenticated traffic is currently being dropped. Click below to restore normal API routing.' 
                : 'Instantly drop all incoming unauthenticated traffic or block malicious IP ranges. Use only under active DDoS.'}
            </p>
            {isLockdownActive ? (
              <button
                onClick={() => setIsLiftModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                LIFT LOCKDOWN & RESUME TRAFFIC
              </button>
            ) : (
              <HoldToActivateButton onActivate={() => setIsEmergencyModalOpen(true)} />
            )}
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

        <AnimatePresence>
          {isEmergencyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-md p-8 bg-[#0a0a0f] border border-rose-500/30 rounded-3xl shadow-[0_0_80px_rgba(225,29,72,0.2)] overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-rose-700" />

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <ShieldAlert className="text-rose-500" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-rose-500 tracking-tight">Confirm Lockdown</h2>
                    <p className="text-sm text-white/50">Emergency Protocol Authorization</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 mb-6">
                  <p className="text-sm text-rose-200/80 leading-relaxed font-medium">
                    Are you sure you want to trigger emergency lockdown? This will drop unauthenticated traffic or block malicious ranges globally.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Type CONFIRM LOCKDOWN to verify</label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="CONFIRM LOCKDOWN"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-rose-500/50 transition-colors font-mono"
                    />
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={() => {
                        setIsEmergencyModalOpen(false);
                        setConfirmText('');
                      }}
                      className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEmergencyLockdown}
                      disabled={confirmText !== 'CONFIRM LOCKDOWN'}
                      className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-600 transition-all shadow-lg shadow-rose-900/50"
                    >
                      Confirm Kill Switch
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isLiftModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-md p-8 bg-[#0a0a0f] border border-emerald-500/30 rounded-3xl shadow-[0_0_80px_rgba(16,185,129,0.2)] overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" />
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <ShieldAlert className="text-emerald-500" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-emerald-500 tracking-tight">Restore Routing</h2>
                    <p className="text-sm text-white/50">Lift Emergency Lockdown</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-6">
                  <p className="text-sm text-emerald-200/80 leading-relaxed font-medium">
                    Are you sure you want to lift the emergency lockdown and restore normal traffic routing globally?
                  </p>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setIsLiftModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLiftLockdown}
                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50"
                  >
                    Confirm Restore
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };
