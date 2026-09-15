import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Palette, Mail, Webhook, Wrench, AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  label, defaultValue, type = 'text', placeholder,
}: { label: string; defaultValue?: string; type?: string; placeholder?: string }) => {
  const [val, setVal]       = useState(defaultValue ?? '');
  const [state, setState]   = useState<SaveState>('idle');
  const timerRef            = useRef<ReturnType<typeof setTimeout>>();

  const simulateSave = useCallback(() => {
    setState('saving');
    timerRef.current = setTimeout(() => {
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    }, 700);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

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
        onBlur={simulateSave}
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
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [maintenanceMode, setMaintenance] = useState(false);
  const [publicReg, setPublicReg]         = useState(true);
  const [dangerModal, setDangerModal]     = useState<{ label: string; word: string } | null>(null);

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

  return (
    <div className="flex gap-8 pb-40 min-h-full">

      {/* ── Left Pill Navigation ── */}
      <div className="w-44 shrink-0">
        <nav className="sticky top-6 flex flex-col gap-1 p-2 bg-white/[0.03] rounded-2xl border border-white/5">
          {NAV_SECTIONS.map(s => {
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
          <SectionTitle icon={Settings} label="General" />
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <AutoSaveField label="Platform Name"     defaultValue="Klyra"                      placeholder="Your platform name" />
              <AutoSaveField label="Platform URL"      defaultValue="https://klyra.io"           placeholder="https://..." />
              <AutoSaveField label="Support Email"     defaultValue="support@klyra.io"  type="email" placeholder="support@..." />
              <AutoSaveField label="Contact Phone"     defaultValue="+1 (800) 555-0100"          placeholder="+1..." />
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-5">
              {[
                { label: 'Public Registration', desc: 'Allow new users to sign up for Klyra accounts.', value: publicReg, onChange: () => setPublicReg(p => !p) },
                { label: 'Global API Rate Limiting', desc: 'Enforce strict gateway limits across all tiers to prevent DDoS.', value: true, onChange: () => {} },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between gap-6">
                  <div>
                    <div className="text-[14px] font-semibold text-white">{row.label}</div>
                    <div className="text-[12px] text-white/40 mt-0.5">{row.desc}</div>
                  </div>
                  <LargeToggle enabled={row.value} onToggle={row.onChange} />
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Branding */}
        <Section id="branding">
          <SectionTitle icon={Palette} label="Branding" />
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <AutoSaveField label="Brand Color (Hex)"  defaultValue="#6366f1" placeholder="#6366f1" />
              <AutoSaveField label="Logo URL"            defaultValue="https://klyra.io/logo.svg" placeholder="https://..." />
              <AutoSaveField label="Favicon URL"         defaultValue="https://klyra.io/favicon.ico" placeholder="https://..." />
              <AutoSaveField label="OG Image URL"        placeholder="https://..." />
            </div>
          </Card>
        </Section>

        {/* Email / SMTP */}
        <Section id="email">
          <SectionTitle icon={Mail} label="Email / SMTP" />
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <AutoSaveField label="SMTP Host"      defaultValue="smtp.sendgrid.net"    placeholder="smtp.mailprovider.com" />
              <AutoSaveField label="SMTP Port"      defaultValue="587"                   placeholder="587" />
              <AutoSaveField label="SMTP Username"  defaultValue="apikey"               placeholder="username" />
              <AutoSaveField label="SMTP Password"  type="password"                      placeholder="••••••••••••" />
              <div className="col-span-2">
                <AutoSaveField label="From Address" defaultValue="noreply@klyra.io" type="email" placeholder="noreply@..." />
              </div>
            </div>
          </Card>
        </Section>

        {/* Webhooks */}
        <Section id="webhooks">
          <SectionTitle icon={Webhook} label="Webhooks" />
          <Card>
            <div className="flex flex-col gap-6">
              <AutoSaveField label="Webhook Endpoint URL"  defaultValue="https://hooks.klyra.io/inbound" placeholder="https://..." />
              <AutoSaveField label="Webhook Secret"        type="password" placeholder="whsec_••••••••" />
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-white/70">Active Events</label>
                <div className="flex flex-wrap gap-2">
                  {['user.created', 'api.approved', 'payment.success', 'api.revoked', 'user.suspended'].map(ev => (
                    <span key={ev} className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[12px] font-mono font-medium">{ev}</span>
                  ))}
                  <button className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[12px] hover:bg-white/10 transition-colors">
                    + Add event
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Maintenance */}
        <Section id="maintenance">
          <SectionTitle icon={Wrench} label="Maintenance" />
          <motion.div
            animate={maintenanceMode ? {
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
                  Maintenance Mode
                  {maintenanceMode && (
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
                  Redirect all non-admin traffic to the maintenance screen. Admins can still access the panel.
                </div>
                {maintenanceMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-[12px] text-amber-400/80 font-medium"
                  >
                    ⚠ Platform is offline to the public. Only admins can log in.
                  </motion.div>
                )}
              </div>
              <LargeToggle enabled={maintenanceMode} onToggle={() => setMaintenance(p => !p)} />
            </div>
          </motion.div>
        </Section>

        {/* Danger Zone */}
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
                      onClick={() => setDangerModal({ label: action.label, word: action.word })}
                      className="px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-[12px] font-bold hover:bg-rose-500/20 transition-colors whitespace-nowrap"
                    >
                      {action.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

      </div>

      {/* Danger Zone Modal */}
      <AnimatePresence>
        {dangerModal && (
          <DangerModal
            label={dangerModal.label}
            confirmWord={dangerModal.word}
            onClose={() => setDangerModal(null)}
            onConfirm={() => setDangerModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
