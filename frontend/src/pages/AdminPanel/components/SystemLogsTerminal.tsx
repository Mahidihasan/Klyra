import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Download, Search, PauseCircle, PlayCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Data ---
const SEED_LOGS = [
  { id: 1, time: '14:32:01.442', level: 'INFO',     module: 'Auth',     msg: 'User usr_9x8f authenticated via OAuth2 (GitHub). Session created.' },
  { id: 2, time: '14:32:05.119', level: 'INFO',     module: 'Gateway',  msg: 'Route /v1/market/search received 1,420 hits in last 60s. Cache HIT ratio: 94%.' },
  { id: 3, time: '14:33:12.884', level: 'WARNING',  module: 'RateLimit',msg: 'IP 192.168.1.44 approaching bucket limit on /v1/billing. Throttling at 85%.' },
  { id: 4, time: '14:33:15.002', level: 'INFO',     module: 'DB',       msg: 'Connection timeout reading from replica-us-east-1a. Attempting failover...' },
  { id: 5, time: '14:33:15.421', level: 'INFO',     module: 'DB',       msg: 'Failover to replica-us-east-1b successful. New latency: 45ms.' },
  { id: 6, time: '14:35:22.911', level: 'CRITICAL', module: 'Security', msg: '[BREACH ATTEMPT] 5 failed root login attempts from IP 45.33.12.99 (Tor Exit Node).' },
  { id: 7, time: '14:35:23.010', level: 'WARNING',  module: 'Security', msg: 'Auto-ban triggered for IP 45.33.12.99. Duration: 24h. Incident logged.' },
  { id: 8, time: '14:38:00.114', level: 'INFO',     module: 'Cron',     msg: 'Daily MRR aggregation job initiated. Scheduler ID: cron_mrr_daily.' },
  { id: 9, time: '14:38:05.441', level: 'INFO',     module: 'Cron',     msg: 'Daily MRR aggregation job completed. Records processed: 4,821.' },
  { id: 10,time: '14:40:10.001', level: 'WARNING',  module: 'API',      msg: 'External provider "WeatherStack" returning HTTP 503. Retrying in 5s (Attempt 1/3).' },
  { id: 11,time: '14:40:18.203', level: 'CRITICAL', module: 'WAF',      msg: '[BREACH] XSS payload detected in POST /api/v1/generate. Request blocked. Rule: WAF_902.' },
  { id: 12,time: '14:41:00.312', level: 'INFO',     module: 'Admin',    msg: 'Admin action: User usr_banned1 suspended by admin usr_root. Reason: ToS Violation.' },
];

// Simulate new incoming logs
const STREAM_LOGS = [
  { id: 100, time: '14:42:11.001', level: 'INFO',     module: 'Gateway',  msg: 'New API provider "DataNexus Corp" published to marketplace. Pending review.' },
  { id: 101, time: '14:42:30.512', level: 'WARNING',  module: 'DB',       msg: 'Connection pool utilization at 78%. Consider scaling replica set.' },
  { id: 102, time: '14:43:05.889', level: 'CRITICAL', module: 'Security', msg: '[BREACH] SQL injection attempt on /api/v1/search. Blocked by WAF rule SQL_1023.' },
  { id: 103, time: '14:43:45.221', level: 'INFO',     module: 'Auth',     msg: 'User usr_new_pro upgraded subscription from Free to Pro tier.' },
];

// --- Helpers ---
type LogLevel = 'INFO' | 'WARNING' | 'CRITICAL';

interface LogEntry {
  id: number;
  time: string;
  level: string;
  module: string;
  msg: string;
}

const getLevelStyle = (level: string) => {
  switch (level) {
    case 'CRITICAL': return 'text-rose-400 font-bold';
    case 'WARNING':  return 'text-amber-400 font-semibold';
    default:         return 'text-sky-500/70';
  }
};

const getLineStyle = (level: string) => {
  if (level === 'CRITICAL') return 'bg-rose-500/5 border-l-2 border-rose-500/60';
  if (level === 'WARNING')  return 'border-l-2 border-amber-500/30';
  return '';
};

const getModuleStyle = (level: string) => {
  if (level === 'CRITICAL') return 'text-rose-300';
  if (level === 'WARNING')  return 'text-amber-300';
  return 'text-indigo-400';
};

// Highlight search term in text
const HighlightText = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-amber-400/40 text-amber-200 rounded-sm px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
};

// --- Component ---
export const SystemLogsTerminal = () => {
  const [logs, setLogs] = useState<LogEntry[]>(SEED_LOGS);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [streamIndex, setStreamIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Auto-stream new logs
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current && streamIndex < STREAM_LOGS.length) {
        setLogs(prev => [...prev, STREAM_LOGS[streamIndex]]);
        setStreamIndex(i => i + 1);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [streamIndex]);

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, paused]);

  const filteredLogs = query
    ? logs.filter(l => l.msg.toLowerCase().includes(query.toLowerCase()) || l.module.toLowerCase().includes(query.toLowerCase()) || l.level.toLowerCase().includes(query.toLowerCase()))
    : logs;

  const handleExport = () => {
    const content = logs.map(l => `${l.time} [${l.level}] [${l.module}] ${l.msg}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; a.download = 'klyra-system.log'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] border border-white/10">
      {/* macOS-Style Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1f] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-white/50 font-mono">
            <Terminal size={13} className="text-indigo-400" />
            <span>klyra@sys-1 — <span className="text-white/30">var/log/klyra/core.log</span></span>
          </div>
        </div>

        {/* Terminal Controls */}
        <div className="flex items-center gap-3">
          {/* Live search */}
          <div className="relative flex items-center h-8 px-3 gap-2 bg-black/60 rounded-lg border border-white/10 focus-within:border-white/25 transition-colors">
            <Search size={13} className="text-white/30 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="grep logs..."
              className="bg-transparent border-none outline-none text-[12px] font-mono text-white/80 placeholder:text-white/25 w-36"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-white/30 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => setPaused(p => !p)}
            className={`flex items-center gap-2 h-8 px-4 rounded-lg border text-[12px] font-bold transition-all ${
              paused
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            {paused
              ? <><PlayCircle size={14} /> Resume</>
              : <><PauseCircle size={14} /> Pause</>
            }
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 h-8 px-4 rounded-lg border bg-white/5 border-white/10 text-[12px] font-bold text-white/60 hover:bg-white/10 transition-colors"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 overflow-y-auto bg-black/90 px-6 py-4 font-mono text-[12.5px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Query match count */}
        {query && (
          <div className="text-[11px] text-amber-400/70 mb-4 pb-2 border-b border-white/5">
            {filteredLogs.length} match{filteredLogs.length !== 1 ? 'es' : ''} for "<span className="font-bold text-amber-400">{query}</span>"
          </div>
        )}

        <AnimatePresence initial={false}>
          {filteredLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex items-start gap-3 px-2 py-1 rounded-md mb-0.5 group hover:bg-white/[0.02] transition-colors ${getLineStyle(log.level)}`}
            >
              {/* Timestamp */}
              <span className="text-white/25 shrink-0 w-28">{log.time}</span>

              {/* Level Badge */}
              <span className={`shrink-0 w-20 ${getLevelStyle(log.level)}`}>
                [{log.level}]
              </span>

              {/* Module */}
              <span className={`shrink-0 w-24 ${getModuleStyle(log.level)}`}>
                [{log.module}]
              </span>

              {/* Message with search highlight */}
              <span className={`flex-1 ${log.level === 'CRITICAL' ? 'text-white/90' : 'text-white/60'}`}>
                <HighlightText text={log.msg} query={query} />
                {/* Pulsating dot for critical */}
                {log.level === 'CRITICAL' && (
                  <motion.span
                    className="inline-block w-1.5 h-1.5 ml-2 rounded-full bg-rose-500 align-middle"
                    animate={{ opacity: [1, 0, 1], scale: [1, 0.8, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Blinking cursor */}
        <div className="flex items-center gap-3 px-2 py-1 mt-4">
          <span className="text-white/25 w-28">—</span>
          <span className="text-emerald-400">klyra-admin@sys-1:~$</span>
          <motion.span
            className="w-2 h-[1em] bg-white/70 inline-block"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear', repeatType: 'mirror' }}
          />
        </div>

        {/* Paused overlay */}
        <AnimatePresence>
          {paused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="sticky bottom-2 mx-auto w-fit px-4 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-[11px] font-bold tracking-widest uppercase text-center"
            >
              ⏸ Stream Paused — Scroll to review
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between px-6 py-2 bg-[#0e0e13] border-t border-white/5 shrink-0">
        <div className="flex items-center gap-4 text-[11px] font-mono text-white/30">
          <span>{logs.length} lines</span>
          <span className="text-white/10">|</span>
          <span>{logs.filter(l => l.level === 'CRITICAL').length} critical</span>
          <span className="text-white/10">|</span>
          <span>{logs.filter(l => l.level === 'WARNING').length} warnings</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: paused ? 1 : [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className={paused ? 'text-amber-400/60' : 'text-emerald-400/60'}>
            {paused ? 'STREAM PAUSED' : 'LIVE STREAM'}
          </span>
        </div>
      </div>
    </div>
  );
};
