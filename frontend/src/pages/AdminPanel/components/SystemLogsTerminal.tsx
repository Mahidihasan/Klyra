import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Download, Pause, Play, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  method?: HttpMethod;
  module: string;
  msg: string;
}

const SEED_LOGS: LogEntry[] = [
  { id: 1, time: '14:32:01.442', level: 'INFO',  method: 'POST', module: 'Auth',     msg: 'User usr_9x8f authenticated via OAuth2 (GitHub). Session created.' },
  { id: 2, time: '14:32:05.119', level: 'INFO',  method: 'GET',  module: 'Gateway',  msg: 'Route /v1/market/search received 1,420 hits in last 60s. Cache HIT ratio: 94%.' },
  { id: 3, time: '14:33:12.884', level: 'WARN',                  module: 'RateLimit',msg: 'IP 192.168.1.44 approaching bucket limit on /v1/billing. Throttling at 85%.' },
  { id: 4, time: '14:35:22.911', level: 'ERROR', method: 'POST', module: 'Security', msg: '[BREACH ATTEMPT] 5 failed root login attempts from IP 45.33.12.99 (Tor Exit Node).' },
  { id: 5, time: '14:38:00.114', level: 'INFO',                  module: 'Cron',     msg: 'Daily MRR aggregation job initiated. Scheduler ID: cron_mrr_daily.' },
  { id: 6, time: '14:40:18.203', level: 'ERROR', method: 'POST', module: 'WAF',      msg: '[BREACH] XSS payload detected in /api/v1/generate. Request blocked. Rule: WAF_902.' },
];

const STREAM_LOGS: LogEntry[] = [
  { id: 100, time: '14:42:11.001', level: 'INFO',  method: 'PUT',  module: 'Gateway',  msg: 'New API provider "DataNexus Corp" published to marketplace. Pending review.' },
  { id: 101, time: '14:42:30.512', level: 'WARN',                  module: 'DB',       msg: 'Connection pool utilization at 78%. Consider scaling replica set.' },
  { id: 102, time: '14:43:05.889', level: 'ERROR', method: 'GET',  module: 'Security', msg: '[BREACH] SQL injection attempt on /api/v1/search. Blocked by WAF rule SQL_1023.' },
  { id: 103, time: '14:43:45.221', level: 'INFO',  method: 'POST', module: 'Auth',     msg: 'User usr_new_pro upgraded subscription from Free to Pro tier.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO:  'text-sky-400',
  WARN:  'text-amber-400',
  ERROR: 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)] font-bold',
  DEBUG: 'text-zinc-500',
};

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    'text-blue-400',
  POST:   'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] font-bold',
  PUT:    'text-amber-400',
  PATCH:  'text-amber-400',
  DELETE: 'text-rose-400',
};

// ─── Magnetic Button ──────────────────────────────────────────────────────────

const Magnetic = ({ children }: { children: React.ReactElement }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    if (!ref.current) return;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * 0.4); // 40% pull
    y.set(middleY * 0.4);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      className="relative z-50 flex items-center justify-center p-1"
    >
      {children}
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SystemLogsTerminal = () => {
  const [logs, setLogs] = useState<LogEntry[]>(SEED_LOGS);
  const [paused, setPaused] = useState(false);
  const [streamIndex, setStreamIndex] = useState(0);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Auto-stream simulation
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current && streamIndex < STREAM_LOGS.length) {
        setLogs(prev => [...prev, STREAM_LOGS[streamIndex]]);
        setStreamIndex(i => i + 1);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [streamIndex]);

  // Auto-scroll logic (only if not paused)
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, paused]);

  return (
    <div className="relative w-full max-w-6xl mx-auto h-[600px] rounded-3xl p-6 overflow-hidden">
      
      {/* ── Ambient Mica Glow Background ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <motion.div 
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] bg-indigo-600/30 blur-[120px] rounded-full mix-blend-screen"
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div 
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[80%] bg-rose-600/20 blur-[120px] rounded-full mix-blend-screen"
          animate={{ x: [0, -40, 0], y: [0, -40, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" />
      </div>

      {/* ── Asymmetrical Bento Box Wrapper ── */}
      <div className="relative z-10 w-full h-full flex flex-col rounded-2xl bg-black/50 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden">
        
        {/* macOS-style Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 text-[12px] font-mono text-white/40">
              <Terminal size={14} className="text-indigo-400" />
              <span>root@klyra-engine:~#</span>
            </div>
          </div>
          
          <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">
            Tailing /var/log/syslog
          </div>
        </div>

        {/* ── Terminal Body ── */}
        <div className="relative flex-1 overflow-hidden group">
          
          {/* Floating Magnetic Controls (Top Right) */}
          <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Magnetic>
              <button 
                onClick={() => setPaused(!paused)}
                className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border shadow-lg transition-colors ${
                  paused ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
                title={paused ? 'Resume Stream' : 'Pause Stream'}
              >
                {paused ? <Play size={16} className="ml-1" /> : <Pause size={16} />}
              </button>
            </Magnetic>
            <Magnetic>
              <button 
                onClick={() => setLogs([])}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-white/10 shadow-lg transition-colors"
                title="Clear Logs"
              >
                <Trash2 size={16} />
              </button>
            </Magnetic>
          </div>

          <div 
            ref={terminalRef}
            className="absolute inset-0 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed custom-scrollbar"
          >
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                  className="flex items-start gap-4 mb-1.5 px-2 py-1 rounded hover:bg-white/[0.03] transition-colors group/row"
                >
                  <span className="text-white/20 shrink-0 w-28 select-none">{log.time}</span>
                  
                  <span className={`shrink-0 w-16 ${LEVEL_COLORS[log.level]}`}>
                    [{log.level}]
                  </span>
                  
                  <span className="shrink-0 w-24 text-indigo-300/60">
                    [{log.module}]
                  </span>
                  
                  <span className="flex-1 text-white/80 break-words flex gap-2">
                    {log.method && (
                      <span className={`shrink-0 ${METHOD_COLORS[log.method]}`}>[{log.method}]</span>
                    )}
                    <span className={log.level === 'ERROR' ? 'text-rose-100' : ''}>{log.msg}</span>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Terminal Cursor */}
            <div className="flex items-center gap-3 px-2 py-2 mt-4">
              <span className="text-emerald-400 font-mono text-[13px] shrink-0">klyra-engine:~#</span>
              <motion.span
                className="w-2.5 h-[1.1em] bg-white/80 inline-block"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>

            <div ref={bottomRef} className="h-4" />
          </div>

          {/* Paused Overlay Warning */}
          <AnimatePresence>
            {paused && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-amber-500/10 backdrop-blur-md border border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400 tracking-widest uppercase font-sans">
                  <Pause size={12} /> Stream Paused
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
