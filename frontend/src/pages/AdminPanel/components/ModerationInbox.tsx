import React, { useState, useEffect, useCallback } from 'react';
import { Flag, MessageSquare, AlertCircle, Search, CheckCircle2, XCircle, ShieldBan, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_REPORTS = [
  { id: 'rep_1', type: 'API', title: 'Malicious payload in /generate endpoint', preview: 'This API returns executable scripts when passed certain headers. I was able to trigger an XSS attack on the documentation page.', severity: 'critical', reporter: 'usr_sec_1', date: '2h ago', unread: true },
  { id: 'rep_2', type: 'USER', title: 'Spam accounts creation', preview: 'User ID usr_9x8f is automating account creation and spamming comments on popular marketplace listings.', severity: 'medium', reporter: 'System Alert', date: '5h ago', unread: true },
  { id: 'rep_3', type: 'REVIEW', title: 'Inappropriate language in review', preview: '"This API is absolute garbage and the creator should delete their account immediately. Waste of money."', severity: 'low', reporter: 'usr_abc', date: '1d ago', unread: false },
  { id: 'rep_4', type: 'API', title: 'Rate limit bypass vulnerability', preview: 'Found a way to bypass the gateway limits by spoofing X-Forwarded-For headers with a rotating proxy pool.', severity: 'high', reporter: 'usr_hacker_2', date: '2d ago', unread: false },
];

export const ModerationInbox = () => {
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [filter, setFilter] = useState<'ALL' | 'API' | 'USER' | 'REVIEW'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_REPORTS[0].id);

  const filtered = filter === 'ALL' ? reports : reports.filter(r => r.type === filter);
  const activeReport = reports.find(r => r.id === selectedId) || null;

  const takeAction = useCallback((id: string, actionName: string) => {
    // Optimistically remove the report from the list
    setReports(prev => prev.filter(r => r.id !== id));
    
    // Auto-select the next available report (like Superhuman)
    if (selectedId === id) {
      const remaining = filtered.filter(r => r.id !== id);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
      } else {
        setSelectedId(null);
      }
    }
  }, [filtered, selectedId]);

  const markRead = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, unread: false } : r));
    setSelectedId(id);
  };

  // Keyboard Shortcuts (Superhuman-style UX)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (!activeReport) return;

      const key = e.key.toLowerCase();
      if (key === 'e') takeAction(activeReport.id, 'resolve');
      if (key === 'r') takeAction(activeReport.id, 'reject');
      if (key === 's') takeAction(activeReport.id, 'suspend');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReport, takeAction]);

  return (
    <div className="flex h-[calc(100vh-140px)] border border-white/5 rounded-2xl overflow-hidden bg-[#0a0a0f] shadow-2xl">
      
      {/* Left Pane: Triage List */}
      <div className="w-[380px] flex flex-col border-r border-white/5 bg-[#0a0a0f]/50 backdrop-blur-xl">
        <div className="p-4 border-b border-white/5 flex flex-col gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              placeholder="Search reports... (Press '/')" 
              className="w-full bg-black/50 border border-white/10 text-white text-[13px] py-2 pl-9 pr-4 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'API', 'USER', 'REVIEW'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1 text-[11px] font-bold tracking-wider rounded-md transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {filtered.map(report => (
              <motion.div 
                key={report.id}
                layout
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                transition={{ opacity: { duration: 0.2 }, height: { duration: 0.3 } }}
                onClick={() => markRead(report.id)}
                className={`relative p-5 cursor-pointer border-b border-white/5 transition-colors group ${selectedId === report.id ? 'z-10' : 'hover:bg-white/[0.02]'}`}
              >
                {/* Active Morph Background */}
                {selectedId === report.id && (
                  <motion.div 
                    layoutId="inbox-active" 
                    className="absolute inset-0 bg-[#1a1a24]/80 backdrop-blur-lg border-l-2 border-indigo-500 -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                {/* Unread Glow Indicator */}
                {report.unread && (
                  <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-300 ${selectedId === report.id ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]' : 'bg-indigo-500/50'}`} />
                )}

                <div className="flex justify-between items-start mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-white/50">
                    {report.type === 'API' && <Terminal size={12} />}
                    {report.type === 'USER' && <AlertCircle size={12} />}
                    {report.type === 'REVIEW' && <MessageSquare size={12} />}
                    {report.type}
                  </span>
                  <span className={`text-[11px] font-semibold ${report.unread ? 'text-indigo-400' : 'text-white/30'}`}>
                    {report.date}
                  </span>
                </div>
                
                <h4 className={`text-[14px] leading-snug mb-1.5 truncate ${report.unread ? 'font-bold text-white' : 'font-semibold text-white/70'}`}>
                  {report.title}
                </h4>
                
                <p className="text-[13px] text-white/40 line-clamp-2 leading-relaxed">
                  {report.preview}
                </p>

                {/* Severity Badge */}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    report.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    report.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    report.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-white/5 text-white/50 border-white/10'
                  }`}>
                    {report.severity}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-[13px] text-white/30 font-medium">
              Inbox Zero. Great job! 🚀
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Deep Context Details */}
      <div className="flex-1 bg-black/20 flex flex-col relative overflow-hidden">
        {activeReport ? (
          <motion.div 
            key={activeReport.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full"
          >
            {/* Context Header */}
            <div className="p-8 pb-6 border-b border-white/5">
              <div className="flex items-center gap-3 mb-4">
                 <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-widest border ${
                    activeReport.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    activeReport.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    activeReport.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-white/5 text-white/50 border-white/10'
                  }`}>
                    {activeReport.severity} Priority
                  </span>
                  <span className="text-[13px] font-mono text-white/30">ID: {activeReport.id}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{activeReport.title}</h2>
              <div className="flex items-center gap-2 text-[13px] text-white/50">
                Reported by <span className="font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{activeReport.reporter}</span> • {activeReport.date}
              </div>
            </div>

            {/* Deep Context Body */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5 text-[12px] font-bold uppercase tracking-widest text-white/40">
                  <Flag size={14} /> Reporter's Note
                </div>
                <p className="text-[14px] leading-loose text-white/80 whitespace-pre-wrap">
                  {activeReport.preview}
                </p>
              </div>

              {/* Fake System Logs to make it look like a deep command center */}
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4 text-[12px] font-bold uppercase tracking-widest text-white/40">
                  <Terminal size={14} /> System Telemetry Context
                </div>
                <div className="p-4 rounded-xl bg-black border border-white/5 font-mono text-[11px] text-white/50 leading-relaxed overflow-x-auto">
                  <div className="text-emerald-400/70">{`> [SYS] Threat Intel Match: 84% probability`}</div>
                  <div>{`> [LOG] Anomalous payload detected originating from IP 192.168.1.42`}</div>
                  <div>{`> [NET] Target Endpoint: /api/v1/generate`}</div>
                  <div className="text-rose-400/70">{`> [WARN] WAF Rule Triggered: XSS_HEURISTIC_902`}</div>
                </div>
              </div>
            </div>

            {/* Action Bar (Keyboard-First) */}
            <div className="p-6 border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl flex justify-between items-center shrink-0">
              <div className="flex gap-4">
                <button 
                  onClick={() => takeAction(activeReport.id, 'resolve')}
                  className="group flex items-center gap-3 px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <CheckCircle2 size={16} /> 
                  <span className="font-bold text-sm">Resolve (Safe)</span>
                  <kbd className="px-1.5 py-0.5 rounded md bg-black/50 border border-emerald-500/30 text-[10px] font-mono text-emerald-400/70 group-hover:border-emerald-500/50 transition-colors">E</kbd>
                </button>
                
                <button 
                  onClick={() => takeAction(activeReport.id, 'reject')}
                  className="group flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <XCircle size={16} /> 
                  <span className="font-bold text-sm">Dismiss Report</span>
                  <kbd className="px-1.5 py-0.5 rounded md bg-black/50 border border-white/20 text-[10px] font-mono text-white/40 group-hover:border-white/40 transition-colors">R</kbd>
                </button>
              </div>

              <button 
                onClick={() => takeAction(activeReport.id, 'suspend')}
                className="group flex items-center gap-3 px-5 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors shadow-[0_0_15px_rgba(225,29,72,0.1)]"
              >
                <ShieldBan size={16} /> 
                <span className="font-bold text-sm">Suspend Entity</span>
                <kbd className="px-1.5 py-0.5 rounded md bg-black/50 border border-rose-500/30 text-[10px] font-mono text-rose-400/70 group-hover:border-rose-500/50 transition-colors">S</kbd>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30">
            <CheckCircle2 size={48} className="mb-4 text-emerald-500/30" />
            <h3 className="text-xl font-bold text-white/50 mb-2">You're all caught up.</h3>
            <p className="text-sm">No active reports require moderation.</p>
          </div>
        )}
      </div>
    </div>
  );
};
