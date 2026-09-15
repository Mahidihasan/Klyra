import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Terminal, MessageSquare, AlertCircle, Search, CheckCircle2,
  XCircle, ShieldBan, ChevronUp, ChevronDown, User, Clock, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';
type ReportType = 'API' | 'USER' | 'REVIEW';

interface ApiLog { time: string; status: number; method: string; path: string; }
interface Report {
  id: string;
  type: ReportType;
  title: string;
  preview: string;
  severity: Severity;
  reporter: string;
  target: string;
  targetDetail: string;
  date: string;
  unread: boolean;
  fullBody: string;
  flaggedWords?: string[];
  apiLogs?: ApiLog[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_REPORTS: Report[] = [
  {
    id: 'rep_1', type: 'API', severity: 'critical', unread: true,
    title: 'Malicious payload in /generate endpoint',
    preview: 'API returns executable scripts when passed certain headers...',
    reporter: 'usr_sec_1', target: 'API: DeepGen v2.1', targetDetail: 'api_x9j2',
    date: '2m ago',
    fullBody: 'This API returns executable scripts when passed the X-Bypass header. I was able to trigger an XSS attack on the documentation page by crafting a specific prompt. The API does not sanitize output before returning it to the client.',
    apiLogs: [
      { time: '14:42:11', status: 403, method: 'POST', path: '/v1/generate' },
      { time: '14:42:08', status: 200, method: 'POST', path: '/v1/generate' },
      { time: '14:41:55', status: 200, method: 'GET',  path: '/v1/status'   },
      { time: '14:41:30', status: 500, method: 'POST', path: '/v1/generate' },
    ],
  },
  {
    id: 'rep_2', type: 'USER', severity: 'high', unread: true,
    title: 'Automated spam account creation',
    preview: 'User is automating account creation and spamming marketplace...',
    reporter: 'System', target: 'User: usr_9x8f', targetDetail: 'usr_9x8f@shadow.net',
    date: '5h ago',
    fullBody: 'User ID usr_9x8f is automating account creation and spamming comments on popular marketplace listings. IP analysis shows 230+ account registrations from the same /24 subnet in the past 6 hours. Behavioural fingerprint matches known bot framework.',
  },
  {
    id: 'rep_3', type: 'REVIEW', severity: 'medium', unread: false,
    title: 'Abusive language in public review',
    preview: '"This API is absolute garbage and the creator should..."',
    reporter: 'usr_abc', target: 'Review on: GeoLocate Pro', targetDetail: 'review_88z',
    date: '1d ago',
    fullBody: 'This API is absolute garbage and the creator should delete their account immediately. The documentation is a complete waste of time and the rate limits are a scam. Absolutely useless product.',
    flaggedWords: ['garbage', 'delete their account', 'scam', 'useless'],
  },
  {
    id: 'rep_4', type: 'API', severity: 'high', unread: false,
    title: 'Rate limit bypass via header spoofing',
    preview: 'Rotating X-Forwarded-For headers to bypass gateway limits...',
    reporter: 'usr_hacker_2', target: 'API: GeoLocate Pro', targetDetail: 'api_gl9',
    date: '2d ago',
    fullBody: 'Found a way to bypass the gateway limits by spoofing X-Forwarded-For headers with a rotating proxy pool. The gateway trusts this header without validation, so it resets the rate limiter for each new "IP" seen.',
    apiLogs: [
      { time: '10:12:00', status: 200, method: 'GET',  path: '/v1/locate' },
      { time: '10:12:00', status: 200, method: 'GET',  path: '/v1/locate' },
      { time: '10:11:59', status: 200, method: 'GET',  path: '/v1/locate' },
      { time: '10:11:59', status: 429, method: 'GET',  path: '/v1/locate' },
    ],
  },
  {
    id: 'rep_5', type: 'REVIEW', severity: 'low', unread: false,
    title: 'Off-topic review (competitor advertising)',
    preview: 'Review contains links to a competing platform...',
    reporter: 'usr_dev99', target: 'Review on: WeatherStack', targetDetail: 'review_12a',
    date: '3d ago',
    fullBody: 'Check out RapidAPI instead, it is way better than Klyra and has way more APIs. You can sign up at rapidapi.com. Klyra is overpriced for what it offers.',
    flaggedWords: ['RapidAPI', 'rapidapi.com'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: 'border-rose-500',
  high:     'border-orange-500',
  medium:   'border-amber-400',
  low:      'border-sky-500',
};

const SEVERITY_GLOW: Record<Severity, string> = {
  critical: 'shadow-[2px_0_12px_rgba(244,63,94,0.6)]',
  high:     'shadow-[2px_0_12px_rgba(249,115,22,0.5)]',
  medium:   'shadow-[2px_0_12px_rgba(251,191,36,0.4)]',
  low:      'shadow-[2px_0_12px_rgba(56,189,248,0.4)]',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low:      'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

const TYPE_ICON: Record<ReportType, React.ReactNode> = {
  API:    <Terminal size={12} />,
  USER:   <AlertCircle size={12} />,
  REVIEW: <MessageSquare size={12} />,
};

const highlightText = (text: string, words: string[]) => {
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        words.some(w => w.toLowerCase() === part.toLowerCase())
          ? <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
};

// ─── Kbd Badge ────────────────────────────────────────────────────────────────

const Kbd = ({ k, className = '' }: { k: string; className?: string }) => (
  <kbd className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-white/20 bg-black/40 text-[10px] font-mono text-white/40 ${className}`}>
    {k}
  </kbd>
);

// ─── Left: Report Card ────────────────────────────────────────────────────────

const ReportCard = ({
  report, isSelected, onSelect,
}: { report: Report; isSelected: boolean; onSelect: () => void }) => (
  <motion.div
    layout
    initial={{ opacity: 1 }}
    exit={{ opacity: 0, x: -40, height: 0, paddingTop: 0, paddingBottom: 0, marginBottom: 0, overflow: 'hidden' }}
    transition={{ duration: 0.3, ease: 'easeInOut' }}
    onClick={onSelect}
    className={`relative pl-3 pr-4 py-4 cursor-pointer group border-b border-white/[0.04] ${isSelected ? '' : 'hover:bg-white/[0.02]'}`}
  >
    {/* Glowing severity left border */}
    <div className={`absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full border-l-0 ${SEVERITY_BORDER[report.severity]} ${SEVERITY_GLOW[report.severity]}`} />

    {/* Active morph background */}
    {isSelected && (
      <motion.div
        layoutId="inbox-active"
        className="absolute inset-0 bg-[#1c1c2a] border-l-2 border-indigo-500 z-0"
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      />
    )}

    <div className="relative z-10">
      <div className="flex justify-between items-center mb-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-white/40">
          {TYPE_ICON[report.type]} {report.type}
        </span>
        <span className={`text-[11px] font-semibold ${report.unread ? 'text-indigo-400' : 'text-white/25'}`}>
          {report.date}
        </span>
      </div>

      <h4 className={`text-[13px] leading-snug mb-1 ${report.unread ? 'font-bold text-white' : 'font-semibold text-white/65'}`}>
        {report.title}
      </h4>

      <p className="text-[12px] text-white/35 leading-relaxed line-clamp-2">{report.preview}</p>

      <div className="mt-2.5 flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${SEVERITY_BADGE[report.severity]}`}>
          {report.severity}
        </span>
        <span className="text-[11px] text-white/30 font-mono">{report.reporter}</span>
      </div>
    </div>
  </motion.div>
);

// ─── Right: Detail Pane ───────────────────────────────────────────────────────

const DetailPane = ({
  report, onAction,
}: { report: Report; onAction: (id: string, action: string) => void }) => (
  <motion.div
    key={report.id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    className="flex flex-col h-full"
  >
    {/* Header */}
    <div className="px-8 py-6 border-b border-white/5 shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${SEVERITY_BADGE[report.severity]}`}>
          {report.severity} Priority
        </span>
        <span className="text-[12px] font-mono text-white/30">#{report.id}</span>
      </div>
      <h2 className="text-xl font-bold text-white leading-tight mb-3">{report.title}</h2>

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-white/50">
        <span className="flex items-center gap-1.5"><User size={12} /> Reporter: <span className="font-mono text-indigo-400">{report.reporter}</span></span>
        <span className="flex items-center gap-1.5"><Tag size={12} /> Target: <span className="font-mono text-white/70">{report.target}</span></span>
        <span className="flex items-center gap-1.5"><Clock size={12} /> {report.date}</span>
      </div>
    </div>

    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* Full report body */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-3">Reporter's Note</div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-[14px] text-white/80 leading-relaxed">
          {report.flaggedWords?.length
            ? highlightText(report.fullBody, report.flaggedWords)
            : report.fullBody
          }
        </div>
        {report.flaggedWords?.length && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-white/30">Flagged keywords:</span>
            {report.flaggedWords.map(w => (
              <span key={w} className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono">{w}</span>
            ))}
          </div>
        )}
      </div>

      {/* API logs snapshot */}
      {report.apiLogs && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-2">
            <Terminal size={12} /> Recent API Log Snapshot
          </div>
          <div className="rounded-2xl bg-black border border-white/5 overflow-hidden">
            {report.apiLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-2.5 border-b border-white/[0.04] last:border-0 font-mono text-[12px] hover:bg-white/[0.02] transition-colors">
                <span className="text-white/30 w-16 shrink-0">{log.time}</span>
                <span className={`w-12 font-bold shrink-0 ${log.method === 'GET' ? 'text-sky-400' : log.method === 'POST' ? 'text-indigo-400' : 'text-amber-400'}`}>
                  {log.method}
                </span>
                <span className={`w-10 font-bold shrink-0 ${log.status >= 500 ? 'text-rose-400' : log.status >= 400 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {log.status}
                </span>
                <span className="text-white/50 truncate">{log.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Target context */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-3">Target</div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            {TYPE_ICON[report.type]}
          </div>
          <div>
            <div className="text-[14px] font-bold text-white">{report.target}</div>
            <div className="text-[12px] font-mono text-white/40">{report.targetDetail}</div>
          </div>
        </div>
      </div>
    </div>

    {/* Floating Action Dock */}
    <div className="px-8 py-5 border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={() => onAction(report.id, 'resolve')}
            className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[13px] hover:bg-emerald-500/20 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          >
            <CheckCircle2 size={16} /> Dismiss
            <Kbd k="E" className="group-hover:border-emerald-500/40 group-hover:text-emerald-400/70" />
          </button>

          <button
            onClick={() => onAction(report.id, 'delete')}
            className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[13px] hover:bg-amber-500/20 transition-colors"
          >
            <XCircle size={16} /> Delete Content
            <Kbd k="D" className="group-hover:border-amber-500/40 group-hover:text-amber-400/70" />
          </button>
        </div>

        <button
          onClick={() => onAction(report.id, 'suspend')}
          className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[13px] hover:bg-rose-500/20 transition-colors shadow-[0_0_20px_rgba(225,29,72,0.1)]"
        >
          <ShieldBan size={16} /> Suspend {report.type === 'USER' ? 'User' : 'API'}
          <Kbd k="S" className="group-hover:border-rose-500/40 group-hover:text-rose-400/70" />
        </button>
      </div>

      {/* Navigation hints */}
      <div className="flex items-center gap-3 mt-3 justify-center text-[11px] text-white/20">
        <span className="flex items-center gap-1"><Kbd k="↑" /><Kbd k="↓" /> Navigate</span>
        <span className="text-white/10">·</span>
        <span className="flex items-center gap-1"><Kbd k="E" /> Dismiss</span>
        <span className="text-white/10">·</span>
        <span className="flex items-center gap-1"><Kbd k="S" /> Suspend</span>
        <span className="text-white/10">·</span>
        <span className="flex items-center gap-1"><Kbd k="D" /> Delete</span>
      </div>
    </div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ModerationInbox = () => {
  const [reports, setReports]     = useState<Report[]>(INITIAL_REPORTS);
  const [selectedId, setSelected] = useState<string | null>(INITIAL_REPORTS[0].id);
  const [filter, setFilter]       = useState<'ALL' | ReportType>('ALL');
  const [query, setQuery]         = useState('');

  // Resizable split state
  const [leftWidth, setLeftWidth] = useState(340);
  const isDragging                = useRef(false);
  const containerRef              = useRef<HTMLDivElement>(null);

  const filtered = reports.filter(r => {
    const matchFilter = filter === 'ALL' || r.type === filter;
    const matchQuery  = !query || r.title.toLowerCase().includes(query.toLowerCase()) || r.reporter.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQuery;
  });

  const activeReport = reports.find(r => r.id === selectedId) ?? null;

  const handleAction = useCallback((id: string, _action: string) => {
    const idx = filtered.findIndex(r => r.id === id);
    const next = filtered[idx + 1] ?? filtered[idx - 1] ?? null;
    setSelected(next?.id ?? null);
    setReports(prev => prev.filter(r => r.id !== id));
  }, [filtered]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (!activeReport) return;
      const key = e.key.toLowerCase();
      if (key === 'e') handleAction(activeReport.id, 'resolve');
      if (key === 'd') handleAction(activeReport.id, 'delete');
      if (key === 's') handleAction(activeReport.id, 'suspend');
      if (e.key === 'ArrowDown') {
        const idx = filtered.findIndex(r => r.id === activeReport.id);
        if (idx < filtered.length - 1) setSelected(filtered[idx + 1].id);
      }
      if (e.key === 'ArrowUp') {
        const idx = filtered.findIndex(r => r.id === activeReport.id);
        if (idx > 0) setSelected(filtered[idx - 1].id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeReport, filtered, handleAction]);

  // Resizable drag logic
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (mv: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect  = containerRef.current.getBoundingClientRect();
      const newW  = Math.min(Math.max(mv.clientX - rect.left, 220), rect.width * 0.55);
      setLeftWidth(newW);
    };
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const selectReport = (id: string) => {
    setSelected(id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, unread: false } : r));
  };

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-150px)] rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-[#0a0a0f]"
    >
      {/* ── Left Pane ── */}
      <div style={{ width: leftWidth, minWidth: leftWidth }} className="flex flex-col border-r border-white/5 bg-[#0a0a0f]/70 shrink-0">
        {/* Toolbar */}
        <div className="p-3 border-b border-white/5 flex flex-col gap-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full bg-black/50 border border-white/10 text-white text-[12px] py-2 pl-8 pr-3 rounded-lg focus:outline-none focus:border-indigo-500/40 transition-colors placeholder:text-white/20"
            />
          </div>
          <div className="flex gap-1">
            {(['ALL', 'API', 'USER', 'REVIEW'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-colors ${
                  filter === f ? 'bg-white/10 text-white' : 'text-white/30 hover:bg-white/5'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence initial={false}>
            {filtered.map(report => (
              <ReportCard
                key={report.id}
                report={report}
                isSelected={selectedId === report.id}
                onSelect={() => selectReport(report.id)}
              />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/25">
              <CheckCircle2 size={28} className="text-emerald-500/30" />
              <span className="text-[13px]">Inbox zero ✦</span>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-2.5 border-t border-white/5 flex justify-between text-[10px] text-white/25 font-mono">
          <span>{filtered.length} reports</span>
          <span>{reports.filter(r => r.unread).length} unread</span>
        </div>
      </div>

      {/* ── Drag Handle ── */}
      <div
        onMouseDown={startDrag}
        className="w-1 cursor-col-resize bg-white/5 hover:bg-indigo-500/50 transition-colors active:bg-indigo-500/80 shrink-0"
        title="Drag to resize"
      />

      {/* ── Right Pane ── */}
      <div className="flex-1 overflow-hidden bg-black/20 flex flex-col min-w-0">
        {activeReport ? (
          <DetailPane key={activeReport.id} report={activeReport} onAction={handleAction} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/25">
            <CheckCircle2 size={48} className="text-emerald-500/20" />
            <div className="text-center">
              <h3 className="text-[18px] font-bold text-white/40 mb-1">All clear</h3>
              <p className="text-[13px]">No reports require your attention.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
