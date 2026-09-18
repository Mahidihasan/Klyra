import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Palette, Mail, Webhook, Wrench, AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../context/PermissionsContext';

// ─── Types & Constants ────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'general',     label: 'General',     icon: Settings  },
  { id: 'branding',    label: 'Branding',    icon: Palette   },
  { id: 'email',       label: 'Email / SMTP',icon: Mail      },
  { id: 'webhooks',    label: 'Webhooks',    icon: Webhook   },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench    },
  { id: 'danger',      label: 'Danger Zone', icon: AlertTriangle },
] as const;

type SectionId = typeof NAV_SECTIONS[number]['id'];
type SaveState = 'idle' | 'saving' | 'saved';

// ─── Instant-Save Field ───────────────────────────────────────────────────────

const AutoSaveField = ({
  label, settingKey, defaultValue, type = 'text', placeholder, onSave
}: { label: string; settingKey?: string; defaultValue?: string; type?: string; placeholder?: string; onSave?: (k: string, v: string) => Promise<void> }) => {
  const [val, setVal]       = useState(defaultValue ?? '');
  const [state, setState]   = useState<SaveState>('idle');
  
  useEffect(() => { setVal(defaultValue ?? ''); }, [defaultValue]);

  const handleSave = useCallback(async () => {
    setState('saving');
    if (onSave && settingKey) {
      try {
        await onSave(settingKey, val);
        setState('saved');
      } catch (e) {
        // Failed
      } finally {
        setTimeout(() => setState('idle'), 2000);
      }
    } else {
      // Simulate save if no handler provided (for mock fields)
      setTimeout(() => {
        setState('saved');
        setTimeout(() => setState('idle'), 2000);
      }, 700);
    }
  }, [onSave, settingKey, val]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-semibold text-white/70">{label}</label>
        <AnimatePresence mode="wait">
          {state === 'saving' && (
            <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Loader2 size={11} className="animate-spin" /> Saving...
            </motion.div>
          )}
          {state === 'saved' && (
            <motion.div key="saved" initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <Check size={11} /> Saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleSave}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px]
                   focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40
                   placeholder:text-white/25 transition-all"
      />
    </div>
  );
};

// ─── Large Toggle ─────────────────────────────────────────────────────────────

const LargeToggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <div
    onClick={onToggle}
    className={`relative w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
      enabled
        ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
        : 'bg-white/10 hover:bg-white/15'
    }`}
  >
    <motion.div
      animate={{ x: enabled ? 24 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="w-6 h-6 rounded-full bg-white shadow-md"
    />
  </div>
);

// ─── Danger Action Modal ──────────────────────────────────────────────────────

const DangerModal = ({
  label, confirmWord, onClose, onConfirm,
}: { label: string; confirmWord: string; onClose: () => void; onConfirm: () => void }) => {
  const [input, setInput] = useState('');
  const ready = input === confirmWord;
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="w-[440px] rounded-3xl bg-[#0a0a0f] border border-rose-500/30 shadow-[0_0_60px_rgba(244,63,94,0.2)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,#000,#000_8px,#7f1d1d_8px,#7f1d1d_16px)]" />
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-rose-500" />
              <h3 className="text-lg font-bold text-rose-400">{label}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 transition-colors"><X size={16} /></button>
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed mb-6">
            This action is <span className="text-white/80 font-bold">irreversible</span>. To confirm, type{' '}
            <span className="font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{confirmWord}</span> below.
          </p>
          <input
            autoFocus
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={confirmWord}
            className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-[13px]
                       tracking-widest focus:outline-none focus:border-rose-500/50 transition-colors placeholder:text-white/20 mb-6"
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 font-semibold hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              disabled={!ready}
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${
                ready ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                      : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
              }`}
            >
              Execute
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────

const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <section id={id} className="flex flex-col gap-6 scroll-mt-8">{children}</section>
);

const SectionTitle = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-3 pb-4 border-b border-white/5">
    <Icon size={18} className="text-indigo-400" />
    <h2 className="text-lg font-bold text-white tracking-tight">{label}</h2>
  </div>
);

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-black/40 border border-white/5 p-6 ${className}`}>{children}</div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdminSettings = () => {
  const { hasPermission } = usePermissions();
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [coreSettings, setCoreSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dangerModal, setDangerModal] = useState<{ label: string; word: string; action: string } | null>(null);
  const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTimezoneOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Legacy states for unmigrated sections
  const [brandColor, setBrandColor] = useState('#6366f1');
  const saveSetting = async (key: string, value: any) => {
    console.log(`Mock save: ${key} = ${value}`);
    const toast = await import('react-hot-toast').then(m => m.default);
    toast.success('Setting mock saved');
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/settings/core', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setCoreSettings(data.data);
        } else {
          setError(data.error?.message || 'Failed to fetch settings from API.');
        }
      } catch (err: any) {
        console.error('Failed to load settings', err);
        setError(err.response?.data?.message || err.message || "Failed to load settings. Check backend connection.");
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = coreSettings;
    try {
      // Need to include auth token since axios instance isn't configured globally here
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await axios.put('/api/v1/admin/settings/core', formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log("Save Response:", res.data);
      toast.success('Settings updated successfully!');
    } catch (error: any) {
      let errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to update settings';
      
      if (typeof errorMsg === 'object') {
        errorMsg = JSON.stringify(errorMsg);
      }
      
      console.error("FULL API ERROR:", error.response?.data || error);
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMaintenance = () => {
    if (!coreSettings.maintenanceMode) {
      setDangerModal({ label: 'System Login Lockdown', word: 'LOCKDOWN', action: 'enable_maintenance' });
    } else {
      setCoreSettings((prev: any) => ({ ...prev, maintenanceMode: false }));
    }
  };

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id as SectionId);
        }
      },
      { threshold: 0.4, rootMargin: '-10% 0px -60% 0px' }
    );
    NAV_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const timezoneOptions = React.useMemo(() => {
    return (Intl as any).supportedValuesOf('timeZone').map((tz: string) => {
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
      const offsetString = formatter.format(new Date());
      const match = offsetString.match(/GMT([+-]\d{2}:\d{2})/);
      const offset = match ? `UTC${match[1]}` : 'UTC+00:00';
      return {
        value: tz,
        label: `(${offset}) ${tz.replace(/\//g, ' / ').replace(/_/g, ' ')}`
      };
    }).sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[500px] text-rose-400">
        <div className="flex flex-col items-center gap-3 bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl">
          <AlertTriangle size={24} />
          <span className="font-semibold">{error}</span>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl text-[12px] font-bold text-rose-300 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!coreSettings) {
    return (
      <div className="flex items-center justify-center h-[500px] text-white/40">
        <span className="animate-pulse flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-indigo-500" />
          Loading core settings...
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-8 pb-40 min-h-full">

      {/* ── Left Pill Navigation ── */}
      <div className="w-44 shrink-0">
        <nav className="sticky top-6 flex flex-col gap-1 p-2 bg-white/[0.03] rounded-2xl border border-white/5">
          {NAV_SECTIONS.filter(s => s.id !== 'danger' || hasPermission('VIEW_DANGER_ZONE')).map(s => {
            const active = activeSection === s.id;
            const isDanger = s.id === 'danger';
            return (
              <button
                key={s.id}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl text-[13px] font-semibold transition-colors ${
                  active
                    ? isDanger ? 'text-rose-400' : 'text-white'
                    : isDanger ? 'text-rose-400/50 hover:text-rose-400' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="settings-pill"
                    className={`absolute inset-0 rounded-xl ${isDanger ? 'bg-rose-500/10' : 'bg-white/8 border border-white/10'}`}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                )}
                <s.icon size={15} className="relative z-10 shrink-0" />
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Right Content ── */}
      <div className="flex-1 flex flex-col gap-12 min-w-0">

        {/* General */}
        <Section id="general">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Core Settings</h2>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSaving || !coreSettings}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-[13px] font-bold transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          
          <Card>
            {!coreSettings ? (
              <div className="animate-pulse flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-14 bg-white/5 rounded-xl"></div>
                  <div className="h-14 bg-white/5 rounded-xl"></div>
                </div>
                <div className="h-14 bg-white/5 rounded-xl"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-white/70">Platform Name</label>
                    <input
                      type="text"
                      value={coreSettings.platformName}
                      onChange={e => setCoreSettings({ ...coreSettings, platformName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-white/70">Support Email</label>
                    <input
                      type="email"
                      value={coreSettings.supportEmail}
                      onChange={e => setCoreSettings({ ...coreSettings, supportEmail: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-white/70">System Timezone</label>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsTimezoneOpen(!isTimezoneOpen)}
                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all text-left"
                      >
                        <span className="truncate pr-4">
                          {timezoneOptions.find((t: any) => t.value === coreSettings.systemTimezone)?.label || coreSettings.systemTimezone}
                        </span>
                        <svg className={`w-4 h-4 shrink-0 text-white/50 transition-transform ${isTimezoneOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: isTimezoneOpen ? 1 : 0, y: isTimezoneOpen ? 0 : -4, scale: isTimezoneOpen ? 1 : 0.98 }}
                        style={{ pointerEvents: isTimezoneOpen ? 'auto' : 'none' }}
                        className="absolute z-50 w-full mt-2 bg-[#0a0a0f] border border-white/10 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                      >
                        {timezoneOptions.map((tz: { value: string, label: string }) => (
                          <button
                            key={tz.value}
                            type="button"
                            onClick={() => {
                              setCoreSettings({ ...coreSettings, systemTimezone: tz.value });
                              setIsTimezoneOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                              coreSettings.systemTimezone === tz.value 
                                ? 'bg-indigo-500/20 text-indigo-400 font-medium' 
                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="truncate block">{tz.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Section>

        {/* Branding */}
        <Section id="branding">
          <SectionTitle icon={Palette} label="Branding" />
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Brand Color (Hex)</label>
                <input
                  type="text"
                  placeholder="#6366f1"
                  value={coreSettings.brandColor}
                  onChange={e => setCoreSettings({ ...coreSettings, brandColor: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Logo URL</label>
                <input
                  type="text"
                  placeholder="https://klyra.io/logo.svg"
                  value={coreSettings.logoUrl}
                  onChange={e => setCoreSettings({ ...coreSettings, logoUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Favicon URL</label>
                <input
                  type="text"
                  placeholder="https://klyra.io/favicon.ico"
                  value={coreSettings.faviconUrl}
                  onChange={e => setCoreSettings({ ...coreSettings, faviconUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">OG Image URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={coreSettings.ogImageUrl}
                  onChange={e => setCoreSettings({ ...coreSettings, ogImageUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
            </div>
          </Card>
        </Section>

        {/* Email / SMTP */}
        <Section id="email">
          <SectionTitle icon={Mail} label="Email / SMTP" />
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">SMTP Host</label>
                <input
                  type="text"
                  placeholder="smtp.mailprovider.com"
                  value={coreSettings.smtpHost}
                  onChange={e => setCoreSettings({ ...coreSettings, smtpHost: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">SMTP Port</label>
                <input
                  type="text"
                  placeholder="587"
                  value={coreSettings.smtpPort}
                  onChange={e => setCoreSettings({ ...coreSettings, smtpPort: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">SMTP Username</label>
                <input
                  type="text"
                  placeholder="username"
                  value={coreSettings.smtpUsername}
                  onChange={e => setCoreSettings({ ...coreSettings, smtpUsername: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">SMTP Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={coreSettings.smtpPassword}
                  onChange={e => setCoreSettings({ ...coreSettings, smtpPassword: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">From Address</label>
                <input
                  type="email"
                  placeholder="noreply@..."
                  value={coreSettings.smtpFromAddress}
                  onChange={e => setCoreSettings({ ...coreSettings, smtpFromAddress: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
            </div>
          </Card>
        </Section>

        {/* Webhooks */}
        <Section id="webhooks">
          <SectionTitle icon={Webhook} label="Webhooks" />
          <Card>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Webhook Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={coreSettings.webhookUrl}
                  onChange={e => setCoreSettings({ ...coreSettings, webhookUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Webhook Secret</label>
                <input
                  type="password"
                  placeholder="whsec_••••••••"
                  value={coreSettings.webhookSecret}
                  onChange={e => setCoreSettings({ ...coreSettings, webhookSecret: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-[13px] focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Active Events</label>
                <div className="flex flex-wrap gap-2 items-center bg-black/50 border border-white/10 rounded-xl p-2 min-h-[46px] focus-within:border-indigo-500/60 transition-all">
                  {coreSettings.webhookEvents?.map((ev: string) => (
                    <span key={ev} className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[12px] font-mono font-medium flex items-center gap-1.5">
                      {ev}
                      <button 
                        type="button"
                        onClick={() => setCoreSettings({ ...coreSettings, webhookEvents: coreSettings.webhookEvents.filter((e: string) => e !== ev) })}
                        className="hover:text-white transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Type event and press Enter..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (!coreSettings.webhookEvents?.includes(val)) {
                          setCoreSettings({ ...coreSettings, webhookEvents: [...(coreSettings.webhookEvents || []), val] });
                        }
                        e.currentTarget.value = '';
                      }
                    }}
                    className="flex-1 bg-transparent border-none text-[13px] text-white focus:outline-none min-w-[150px] px-2"
                  />
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Maintenance */}
        <Section id="maintenance">
          <SectionTitle icon={Wrench} label="System Login Lockdown (Maintenance)" />
          <motion.div
            animate={coreSettings?.maintenanceMode ? {
              backgroundColor: 'rgba(245,158,11,0.06)',
              borderColor: 'rgba(245,158,11,0.3)',
            } : {
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderColor: 'rgba(255,255,255,0.05)',
            }}
            className="rounded-2xl border p-6 transition-colors"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[15px] font-bold text-white mb-1 flex items-center gap-2">
                  System Login Lockdown
                  {coreSettings?.maintenanceMode && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest"
                    >
                      ACTIVE
                    </motion.span>
                  )}
                </div>
                <div className="text-[13px] text-white/50 leading-relaxed">
                  When active, regular users cannot log in. Only admins can access the system.
                </div>
                {coreSettings?.maintenanceMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-[12px] text-amber-400/80 font-medium"
                  >
                    ⚠ Platform is offline to the public. Only admins can log in.
                  </motion.div>
                )}
              </div>
              <LargeToggle enabled={coreSettings?.maintenanceMode || false} onToggle={handleToggleMaintenance} />
            </div>
          </motion.div>
        </Section>

        {/* Danger Zone */}
        {hasPermission('VIEW_DANGER_ZONE') && (
          <Section id="danger">
            <div className="relative overflow-hidden rounded-2xl border border-rose-500/30">
              <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(90deg,#f43f5e,#f43f5e_12px,transparent_12px,transparent_24px)]" />
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-rose-500" />
                  <h2 className="text-lg font-bold text-rose-400 tracking-tight">Danger Zone</h2>
                </div>
                <p className="text-[13px] text-white/40 mb-6">These actions are <span className="text-white/70 font-bold">irreversible</span> and affect the entire platform infrastructure.</p>

                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Purge Edge Cache',       desc: 'Invalidate all CDN & Redis caches globally.',     word: 'PURGE'  },
                    { label: 'Reset All API Limits',   desc: 'Reset all custom rate overrides to tier defaults.', word: 'RESET'  },
                    { label: 'Delete Organization',    desc: 'Permanently erase all data, users, and APIs.',    word: 'klyra'  },
                  ].map(action => (
                    <div key={action.label} className="flex items-center justify-between p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                      <div>
                        <div className="text-[14px] font-semibold text-white">{action.label}</div>
                        <div className="text-[12px] text-white/40 mt-0.5">{action.desc}</div>
                      </div>
                      <button
                        onClick={() => setDangerModal({ label: action.label, word: action.word, action: action.label })}
                        disabled={!hasPermission('EXECUTE_DANGER_ZONE_ACTIONS')}
                        className={`px-4 py-2 rounded-xl border text-[12px] font-bold transition-colors shrink-0 ${
                          hasPermission('EXECUTE_DANGER_ZONE_ACTIONS')
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:scale-95'
                            : 'border-white/5 bg-black/50 text-white/20 cursor-not-allowed'
                        }`}
                        title={!hasPermission('EXECUTE_DANGER_ZONE_ACTIONS') ? 'Requires EXECUTE_DANGER_ZONE_ACTIONS permission' : ''}
                      >
                        {action.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}

      </div>

      {/* Danger Zone Modal */}
      <AnimatePresence>
        {dangerModal && (
          <DangerModal
            label={dangerModal.label}
            confirmWord={dangerModal.word}
            onClose={() => setDangerModal(null)}
            onConfirm={async () => {
              if (dangerModal.action === 'enable_maintenance') {
                setCoreSettings((prev: any) => ({ ...prev, maintenanceMode: true }));
              } else {
                try {
                  const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
                  let endpoint = '';
                  if (dangerModal.action === 'Purge Edge Cache') endpoint = '/api/v1/admin/settings/danger/purge-cache';
                  else if (dangerModal.action === 'Reset All API Limits') endpoint = '/api/v1/admin/settings/danger/reset-limits';
                  else if (dangerModal.action === 'Delete Organization') endpoint = '/api/v1/admin/settings/danger/delete-org';
                  
                  if (endpoint) {
                    const res = await axios.post(endpoint, {}, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    toast.success(res.data.message || 'Action executed successfully.');
                  }
                } catch (error: any) {
                  console.error('Danger action failed:', error);
                  toast.error(error.response?.data?.message || 'Failed to execute action');
                }
              }
              setDangerModal(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
