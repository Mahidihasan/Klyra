import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Pause, Play, Trash2, Copy, Check, ChevronDown, ChevronRight, Activity, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types & Mock Data ────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface PayloadLog {
  id: string;
  timestamp: string;
  method: HttpMethod;
  path: string;
  status: number;
  latency: number;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: any;
  bodySize: string;
}

const generateMockLog = (): PayloadLog => {
  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const paths = ['/api/v1/weather', '/api/v2/auth/verify', '/webhooks/stripe', '/api/v1/users', '/graphql'];
  const statuses = [200, 200, 200, 201, 400, 401, 403, 404, 500, 502, 503];
  
  const method = methods[Math.floor(Math.random() * methods.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  let body: any = null;
  if (method === 'POST' || method === 'PUT') {
    body = {
      user: { id: `usr_${Math.random().toString(36).substring(7)}`, email: 'test@example.com' },
      options: { forceSync: true, maxRetries: 3 },
      metadata: { source: 'dashboard_ui' }
    };
  }

  return {
    id: `log_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    method,
    path: paths[Math.floor(Math.random() * paths.length)],
    status,
    latency: Math.floor(Math.random() * 500) + 10,
    headers: {
      'host': 'api.klyra.io',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'x-forwarded-for': `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      'authorization': 'Bearer sk_live_***',
      'content-type': 'application/json'
    },
    queryParams: {
      'limit': '50',
      'offset': '0',
      'filter': 'active'
    },
    body,
    bodySize: `${Math.floor(Math.random() * 50) + 1}kb`
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    'text-blue-400 bg-blue-500/10 ring-1 ring-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.3)]',
  POST:   'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
  PUT:    'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
  PATCH:  'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
  DELETE: 'text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.3)]',
};

const getStatusColor = (status: number) => {
  if (status >= 500) return 'text-rose-400';
  if (status >= 400) return 'text-amber-400';
  return 'text-emerald-400';
};

// ─── JSON Viewer ──────────────────────────────────────────────────────────────

const JsonNode = ({ label, value, isRoot = false }: { label: string; value: any; isRoot?: boolean }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const isObject = value !== null && typeof value === 'object';
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isObject) {
    const valColor = typeof value === 'string' ? 'text-amber-300' : typeof value === 'number' ? 'text-indigo-400' : 'text-rose-400';
    return (
      <div className="flex items-start group py-0.5 relative pl-4">
        <span className="text-sky-300 mr-2">"{label}":</span>
        <span className={valColor}>{typeof value === 'string' ? `"${value}"` : String(value)}</span>
        <button onClick={handleCopy} className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/5 rounded text-white/50 hover:text-white hover:bg-white/10">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
    );
  }

  const entries = Object.entries(value);
  const isEmpty = entries.length === 0;

  return (
    <div className={`relative ${isRoot ? '' : 'pl-4'} py-0.5`}>
      <div className="flex items-center group cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="absolute -left-3 text-white/40 hover:text-white/80 transition-colors">
          {!isEmpty && (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </span>
        {label && <span className="text-sky-300 mr-2">"{label}":</span>}
        <span className="text-white/60">{Array.isArray(value) ? '[' : '{'}</span>
        {!expanded && !isEmpty && <span className="text-white/30 mx-2">...</span>}
        
        <button onClick={handleCopy} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/5 rounded text-white/50 hover:text-white hover:bg-white/10">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
      
      {expanded && !isEmpty && (
        <div className="border-l border-white/10 ml-1 pl-1">
          {entries.map(([k, v], i) => (
            <div key={k}>
              <JsonNode label={k} value={v} />
              {i < entries.length - 1 && <span className="text-white/60 -ml-3">,</span>}
            </div>
          ))}
        </div>
      )}
      <div className="text-white/60">{Array.isArray(value) ? ']' : '}'}</div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const LivePayloadInspector = () => {
  const [logs, setLogs] = useState<PayloadLog[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  
  // Resizable split state
  const [leftWidth, setLeftWidth] = useState(450);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setLogs(prev => {
        const newLog = generateMockLog();
        const newLogs = [newLog, ...prev]; // Prepend for sliding down
        if (newLogs.length > 50) newLogs.pop();
        return newLogs;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Resizable drag logic
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (mv: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newW = Math.min(Math.max(mv.clientX - rect.left, 300), rect.width * 0.7);
      setLeftWidth(newW);
    };
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const selectedLog = logs.find(l => l.id === selectedLogId) || null;

  return (
    <div 
      ref={containerRef}
      className="flex h-[calc(100vh-150px)] rounded-2xl overflow-hidden backdrop-blur-3xl bg-zinc-950/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.5)] border border-white/10"
    >
      {/* ── Left Pane: Stream ── */}
      <div style={{ width: leftWidth, minWidth: leftWidth }} className="flex flex-col border-r border-white/10 shrink-0">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30">
              <Activity size={14} className="text-indigo-400" />
              {!isPaused && (
                <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
              )}
            </div>
            <h3 className="text-[13px] font-bold text-white tracking-widest uppercase">Payload Matrix</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase border transition-colors ${
                isPaused 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />} {isPaused ? 'Resume' : 'Live'}
            </button>
            <button 
              onClick={() => setLogs([])}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
              title="Clear Stream"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Stream List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 relative bg-black/20">
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              const isError = log.status >= 400;
              const isSelected = selectedLogId === log.id;
              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  onClick={() => setSelectedLogId(log.id)}
                  className={`relative mb-2 p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-white/10' : 'bg-white/[0.02] hover:bg-white/5'
                  }`}
                >
                  {/* Subtle pulsing border for errors */}
                  {isError && (
                    <div className="absolute inset-0 rounded-xl border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)] animate-pulse pointer-events-none" />
                  )}
                  {isSelected && (
                    <motion.div layoutId="payload-active" className="absolute inset-0 rounded-xl border border-indigo-500/50 bg-indigo-500/5 z-0" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                  )}
                  
                  <div className="relative z-10 flex items-start gap-3">
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest ${METHOD_COLORS[log.method]}`}>
                      {log.method}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-mono text-white/90 break-words whitespace-normal min-w-0 mr-2">{log.path}</span>
                        <span className={`text-[12px] font-bold font-mono ${getStatusColor(log.status)}`}>{log.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-white/40">
                        <span>{log.timestamp.split('T')[1].substring(0, 12)}</span>
                        <span>{log.latency}ms</span>
                        <span>{log.bodySize}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {logs.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
              <Wifi size={32} className="mb-2 opacity-50" />
              <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-widest">
                <span className="w-2 h-4 bg-indigo-500 animate-[blink_1s_step-end_infinite]" /> Awaiting Uplink
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Drag Handle ── */}
      <div 
        onMouseDown={startDrag}
        className="w-1 cursor-col-resize bg-white/5 hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors shrink-0 z-20"
      />

      {/* ── Right Pane: Deep Inspect ── */}
      <div className="flex-1 bg-black/40 overflow-hidden flex flex-col min-w-0">
        {selectedLog ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-white/10 shrink-0 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest ${METHOD_COLORS[selectedLog.method]}`}>
                  {selectedLog.method}
                </span>
                <span className="text-[15px] font-mono text-white break-all">{selectedLog.path}</span>
              </div>
              <div className="flex items-center gap-4 text-[12px] font-mono text-white/50">
                <span className={getStatusColor(selectedLog.status)}>Status: {selectedLog.status}</span>
                <span>Latency: {selectedLog.latency}ms</span>
                <span>Size: {selectedLog.bodySize}</span>
                <span>Time: {selectedLog.timestamp}</span>
              </div>
            </div>
            
            {/* JSON Viewers */}
            <div className="flex-1 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed">
              <div className="mb-8">
                <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase mb-2">Headers</div>
                <div className="bg-black/50 border border-white/5 rounded-xl p-4">
                  <JsonNode label="" value={selectedLog.headers} isRoot />
                </div>
              </div>

              {Object.keys(selectedLog.queryParams).length > 0 && (
                <div className="mb-8">
                  <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase mb-2">Query Parameters</div>
                  <div className="bg-black/50 border border-white/5 rounded-xl p-4">
                    <JsonNode label="" value={selectedLog.queryParams} isRoot />
                  </div>
                </div>
              )}

              {selectedLog.body && (
                <div>
                  <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase mb-2">Request Body</div>
                  <div className="bg-black/50 border border-white/5 rounded-xl p-4">
                    <JsonNode label="" value={selectedLog.body} isRoot />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <Terminal size={48} className="mb-4 opacity-20" />
            <div className="text-[14px] font-bold tracking-wider">NO PAYLOAD SELECTED</div>
            <div className="text-[12px] mt-2">Select a request from the stream to inspect deep telemetry.</div>
          </div>
        )}
      </div>
    </div>
  );
};
