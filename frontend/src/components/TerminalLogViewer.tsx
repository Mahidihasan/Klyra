import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Play, Pause, Trash2, Search, Terminal as TerminalIcon, ChevronRight } from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'DEBUG';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'NONE';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  method: HttpMethod;
  path: string;
  status: number;
  message: string;
  payload?: any;
}

interface TerminalLogViewerProps {
  initialLogs?: LogEntry[];
  isLive?: boolean;
}

// --- Mock Data Generator ---
const generateMockLog = (id: number): LogEntry => {
  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'GET', 'POST'];
  const levels: LogLevel[] = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  const paths = [
    '/api/v1/users',
    '/api/v1/auth/login',
    '/api/v1/payments/webhook',
    '/api/v1/products',
    '/health',
  ];

  const method = methods[Math.floor(Math.random() * methods.length)];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const status =
    level === 'ERROR' || level === 'FATAL'
      ? [500, 502, 503][Math.floor(Math.random() * 3)]
      : level === 'WARN'
      ? 400
      : 200;

  return {
    id: `log-${Date.now()}-${id}`,
    timestamp: new Date().toISOString(),
    level,
    method,
    path,
    status,
    message:
      level === 'ERROR' ? `Failed to execute request for ${path}` : `Handled request successfully`,
    payload: {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'x-forwarded-for': '192.168.1.1',
      },
      body: method === 'POST' ? { user_id: 'usr_123', action: 'login' } : null,
      response_time_ms: Math.floor(Math.random() * 500) + 10,
    },
  };
};

// --- Magnetic Button Component ---
const MagneticButton = ({ children, onClick, active }: any) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.3);
    y.set((e.clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`
        relative flex items-center justify-center w-10 h-10 rounded-full transition-colors backdrop-blur-md border shadow-lg
        ${
          active
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : 'bg-white/5 text-gray-400 hover:text-white border-white/10 hover:bg-white/10'
        }
      `}
    >
      {children}
    </motion.button>
  );
};

export default function TerminalLogViewer({ initialLogs, isLive = true }: TerminalLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    if (initialLogs) {
      return initialLogs;
    }
    return Array.from({ length: 15 }).map((_, i) => generateMockLog(i));
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const nextLogId = useRef(50);

  // --- Live Stream Simulation ---
  useEffect(() => {
    if (!isLive || !autoScroll) {
      return;
    }

    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        setLogs((prev) => {
          const newLogs = [...prev, generateMockLog(nextLogId.current++)];
          if (newLogs.length > 500) {
            return newLogs.slice(newLogs.length - 500);
          }
          return newLogs;
        });
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isLive, autoScroll]);

  // --- Cinematic Smooth Auto-scrolling ---
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [logs, autoScroll]);

  const toggleExpand = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setExpandedLogs(new Set());
  };

  // --- Color Helpers ---
  const getMethodColor = (method: HttpMethod) => {
    switch (method) {
      case 'GET':
        return 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]';
      case 'POST':
        return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]';
      case 'PUT':
        return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]';
      case 'DELETE':
        return 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]';
      default:
        return 'text-gray-400';
    }
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'INFO':
        return 'text-gray-500';
      case 'WARN':
        return 'text-yellow-400';
      case 'ERROR':
        return 'text-red-500 font-bold';
      case 'FATAL':
        return 'text-red-500 font-bold drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]';
      case 'DEBUG':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 500) {
      return 'text-red-500';
    }
    if (status >= 400) {
      return 'text-yellow-400';
    }
    if (status >= 200 && status < 300) {
      return 'text-emerald-400';
    }
    return 'text-gray-400';
  };

  const highlightText = (text: string, query: string) => {
    if (!query) {
      return text;
    }
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-accent-purple/40 text-white px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery) {
      return logs;
    }
    const lowerQuery = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.path.toLowerCase().includes(lowerQuery) ||
        log.message.toLowerCase().includes(lowerQuery) ||
        log.method.toLowerCase().includes(lowerQuery) ||
        log.status.toString().includes(lowerQuery),
    );
  }, [logs, searchQuery]);

  return (
    <div className="w-full flex flex-col items-center py-6">
      {/* Asymmetrical Bento-Box Layout */}
      <div className="w-full max-w-[1400px] relative rounded-[32px] p-2 bg-white/[0.02] border border-white/5 shadow-2xl">
        {/* Mica Ambient Glow (Mesh Gradient) */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[32px] pointer-events-none opacity-40 mix-blend-screen">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 45, -20, 0],
              x: ['-10%', '20%', '-15%', '0%'],
              y: ['-10%', '15%', '-20%', '0%'],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full filter blur-[120px] bg-gradient-to-tr from-accent-purple/20 via-blue-500/10 to-transparent"
          />
          <motion.div
            animate={{
              scale: [1, 1.4, 1],
              rotate: [0, -30, 20, 0],
              x: ['10%', '-20%', '15%', '0%'],
              y: ['10%', '-15%', '20%', '0%'],
            }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-[-30%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full filter blur-[120px] bg-gradient-to-bl from-rose-500/10 via-amber-500/10 to-transparent"
          />
        </div>

        {/* Inner Terminal Container */}
        <div className="relative z-10 flex flex-col w-full h-[650px] rounded-[24px] overflow-hidden bg-black/60 backdrop-blur-3xl border border-white/10 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)]">
          {/* Floating Magnetic Controls Dock */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3 p-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg">
            <div className="relative group flex items-center pl-2 pr-1">
              <Search
                className="absolute left-3 text-gray-500 group-focus-within:text-accent-purple transition-colors"
                size={14}
              />
              <input
                type="text"
                placeholder="Grep logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-transparent border-none rounded-full text-gray-200 text-xs focus:outline-none focus:ring-0 transition-all w-32 focus:w-48 placeholder-gray-600 font-mono"
              />
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            <MagneticButton active={autoScroll} onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? <Pause size={16} /> : <Play size={16} />}
            </MagneticButton>

            <MagneticButton onClick={clearLogs}>
              <Trash2 size={16} className="text-gray-400 group-hover:text-rose-400" />
            </MagneticButton>
          </div>

          {/* Terminal Output */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-20 custom-scrollbar scroll-smooth"
          >
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                <TerminalIcon size={32} className="opacity-30" />
                <p className="font-mono text-sm tracking-widest uppercase opacity-50">
                  Awaiting Signal
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <AnimatePresence initial={false}>
                  {filteredLogs.map((log) => {
                    const isExpanded = expandedLogs.has(log.id);
                    const isError = log.level === 'ERROR' || log.level === 'FATAL';

                    return (
                      <motion.div
                        key={log.id}
                        layout="position"
                        initial={{ opacity: 0, y: 30, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                        className="flex flex-col w-full group"
                      >
                        {/* Log Line with Fluid Typography */}
                        <div
                          onClick={() => toggleExpand(log.id)}
                          className={`
                            flex items-start gap-4 py-2 px-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:bg-white/5
                            ${
                              isError && !isExpanded
                                ? 'bg-red-500/10 hover:bg-red-500/15 border-red-500/10'
                                : ''
                            }
                          `}
                          style={{ fontSize: 'clamp(11px, 1.2vw, 13px)' }}
                        >
                          <div className="mt-0.5 text-gray-600 shrink-0">
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={14} />
                            </motion.div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full font-mono">
                            <span className="text-gray-500 shrink-0 opacity-70">
                              {new Date(log.timestamp).toLocaleTimeString('en-US', {
                                hour12: false,
                              } as any)}
                            </span>

                            <span
                              className={`w-14 font-semibold tracking-wider ${getLevelColor(
                                log.level,
                              )} shrink-0`}
                            >
                              {log.level}
                            </span>

                            {log.method !== 'NONE' && (
                              <span className={`font-bold shrink-0 ${getMethodColor(log.method)}`}>
                                {log.method}
                              </span>
                            )}

                            {log.path && (
                              <span className="text-gray-300 font-medium shrink-0">
                                {highlightText(log.path, searchQuery)}
                              </span>
                            )}

                            {log.status !== 0 && (
                              <span
                                className={`font-medium shrink-0 ${getStatusColor(log.status)}`}
                              >
                                {log.status}
                              </span>
                            )}

                            <span className="text-gray-400 flex-1 truncate opacity-80 group-hover:opacity-100 transition-opacity">
                              {highlightText(log.message, searchQuery)}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Payload Accordion */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div
                                className={`
                                  ml-9 mr-3 my-2 p-5 rounded-2xl border backdrop-blur-md shadow-inner
                                  ${
                                    isError
                                      ? 'bg-red-950/20 border-red-900/30 text-red-200'
                                      : 'bg-black/40 border-white/5 text-gray-300'
                                  }
                                `}
                              >
                                <pre className="font-mono text-[clamp(10px,1.1vw,12px)] overflow-x-auto whitespace-pre-wrap leading-relaxed opacity-90">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
