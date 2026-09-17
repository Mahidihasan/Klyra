import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Download, Pause, Play, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  module: string;
  action: string;
  user: string;
  details: string;
  ip: string;
}

const formatBDTime = (dateString: string) => {
  if (!dateString) return "N/A";
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

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
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [showHighlight, setShowHighlight] = useState(true);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Fetch logs with auto-refresh polling
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const fetchLogs = async () => {
      // Skip fetching if the user paused the terminal stream
      if (pausedRef.current) return;

      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch(`/api/v1/admin/logs/system?t=` + new Date().getTime(), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log("Fetched Logs:", data);
        if (Array.isArray(data)) {
          setLogs(data);
        } else {
          console.warn("Backend returned non-array data, setting to empty array.");
          setLogs([]);
        }
      } catch (err) {
        console.error('Failed to fetch system logs', err);
      }
    };

    fetchLogs(); // Initial fetch
    intervalId = setInterval(fetchLogs, 3000); // 3-second polling

    return () => clearInterval(intervalId);
  }, []);

  // 30-second highlight effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHighlight(false);
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll logic (only if not paused)
  useEffect(() => {
    if (!paused && logs !== null) {
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
            {logs === null ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-white/20">
                <div className="w-8 h-8 rounded-full border-4 border-white/5 border-t-indigo-500/50 animate-spin"></div>
                <div className="text-[13px] text-white/40 font-sans font-medium">Loading system logs...</div>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-white/20">
                <div className="p-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
                  <Terminal size={32} className="text-indigo-400/50" />
                </div>
                <div className="text-center font-sans">
                  <h3 className="text-[16px] font-bold text-white/40 mb-1">System Logs Empty</h3>
                  <p className="text-[13px] text-white/30 max-w-[250px]">No active system events, deployment logs, or audit activities to display.</p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
              {logs.map((log) => {
                const isWarningOrError = log.level === 'WARN' || log.level === 'ERROR';
                const isHighlighted = showHighlight && isWarningOrError;

                return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                  className={`flex items-start gap-4 mb-1.5 px-2 py-1 rounded transition-colors group/row ${
                    isHighlighted ? 'bg-rose-500/10 border border-rose-500/30' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-white/30 shrink-0 w-44 select-none" title={log.time}>{formatBDTime(log.time)}</span>
                  
                  <span className={`shrink-0 w-16 ${LEVEL_COLORS[log.level]}`}>
                    [{log.level}]
                  </span>
                  
                  <span className="shrink-0 w-28 text-indigo-300/60 font-bold">
                    {log.action}
                  </span>
                  
                  <span className="shrink-0 w-40 text-emerald-400/80 truncate pr-2" title={log.user}>
                    {log.user}
                  </span>

                  <span className="flex-1 text-white/60 break-words flex flex-col">
                    <span className={log.level === 'ERROR' ? 'text-rose-100' : 'text-white/80'}>
                      [{log.module}] {log.details}
                    </span>
                    <span className="text-white/30 text-[11px]">IP: {log.ip}</span>
                  </span>
                </motion.div>
                );
              })}
              </AnimatePresence>
            )}

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
