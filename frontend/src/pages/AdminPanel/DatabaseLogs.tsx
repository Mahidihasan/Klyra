import { motion, AnimatePresence } from 'framer-motion';
import React, { useRef, useState, useEffect } from 'react';

// --- MOCK DATA ---
const MOCK_DB_DATA = Array.from({ length: 20 }).map((_, i) => ({
  id: `rec_${1000 + i}`,
  name: `System Segment ${i}`,
  status: Math.random() > 0.3 ? 'active' : 'archived',
  created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
}));

const MOCK_LOGS = [
  '[INFO] System initialized successfully on port 8080.',
  '[DEBUG] Connecting to database cluster...',
  '[INFO] Connection established.',
  '[WARN] High latency detected on shard 3.',
  '[ERROR] Connection failed: ECONNREFUSED 127.0.0.1:5432',
  '[INFO] Retrying connection (1/5)...',
  "[ERROR] FATAL EXCEPTION: Invalid user permissions for 'admin' action.",
];

// --- STEP 1: THE CURSOR-AWARE ROW COMPONENT ---
const MatrixRow = ({ children }: { children: React.ReactNode }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rowRef.current) {
      return;
    }
    const rect = rowRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    rowRef.current.style.setProperty('--mouse-x', `${x}px`);
    rowRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={rowRef}
      onMouseMove={handleMouseMove}
      className="relative flex items-center border-b border-white/5 transition-colors group
        before:absolute before:inset-0 before:pointer-events-none
        before:bg-[radial-gradient(800px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(255,255,255,0.06),transparent_40%)] 
        before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500"
    >
      {/* Ensure cell content sits above the spotlight pseudo-element */}
      <div className="relative z-10 flex w-full">{children}</div>
    </div>
  );
};

// --- STEP 2: TYPOGRAPHY & CELL RENDERING ---
const MatrixCell = ({
  type,
  value,
}: {
  type: 'id' | 'timestamp' | 'status' | 'string';
  value: string;
}) => {
  if (type === 'id' || type === 'timestamp') {
    return (
      <div className="flex-1 px-6 py-4">
        <span className="font-mono text-[13px] text-zinc-400 tracking-wider">{value}</span>
      </div>
    );
  }

  if (type === 'status') {
    const isActive = value === 'active';
    return (
      <div className="flex-1 px-6 py-4 flex items-center">
        {isActive ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {value.toUpperCase()}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-zinc-500/10 border-zinc-500/20 text-zinc-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            {value.toUpperCase()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-[2] px-6 py-4">
      <span className="text-gray-100 font-medium">{value}</span>
    </div>
  );
};

// --- STEP 4: THE LIVE LOG TERMINAL ---
const LiveLogTerminal = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < MOCK_LOGS.length) {
        setLogs((prev) => [...prev, MOCK_LOGS[currentIdx]]);
        currentIdx++;
      } else {
        // Loop for demo
        currentIdx = 0;
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [logs]);

  const renderLogLine = (line: string, index: number) => {
    const hasError = line.includes('ERROR');

    if (hasError) {
      const parts = line.split(/(ERROR)/g);
      return (
        <div key={index} className="py-1 px-2 mb-1 rounded text-red-400 bg-red-400/5">
          {parts.map((part, i) =>
            part === 'ERROR' ? (
              <span key={i} className="animate-pulse font-bold">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>
      );
    }

    return (
      <div key={index} className="py-1 px-2 mb-1 text-gray-300">
        {line}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/10 shadow-2xl h-[400px]">
      {/* macOS Window Controls */}
      <div className="flex items-center px-4 py-3 bg-[#111] border-b border-white/5 shrink-0 gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
        <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
        <div className="w-3 h-3 rounded-full bg-green-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
        <span className="ml-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Klyra_Live_Stream // Term_01
        </span>
      </div>

      {/* Log Feed */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-sm custom-scrollbar bg-[#0f0f0f]"
      >
        <AnimatePresence initial={false}>
          {logs.map((log, i) => (
            <motion.div
              key={`${i}-${log}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderLogLine(log, i)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function DatabaseLogs() {
  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-8">
        {/* Left Side: Infinite Matrix */}
        <div className="flex-1 flex flex-col">
          <h1 className="text-2xl font-bold mb-6 tracking-wide text-zinc-100">Database Engine</h1>

          {/* STEP 3: THE GLASSMORPHISM WRAPPER */}
          <div className="bg-zinc-950/50 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden flex flex-col h-[700px]">
            {/* Table Header */}
            <div className="flex px-2 sticky top-0 z-20 border-b border-white/10 bg-zinc-950/40 backdrop-blur-md">
              <div className="flex-1 px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Record ID
              </div>
              <div className="flex-[2] px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Name
              </div>
              <div className="flex-1 px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Status
              </div>
              <div className="flex-1 px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Timestamp
              </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative px-2 pb-2">
              {MOCK_DB_DATA.map((row) => (
                <MatrixRow key={row.id}>
                  <MatrixCell type="id" value={row.id} />
                  <MatrixCell type="string" value={row.name} />
                  <MatrixCell type="status" value={row.status} />
                  <MatrixCell type="timestamp" value={row.created_at} />
                </MatrixRow>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Log Terminal */}
        <div className="w-full xl:w-[500px] flex flex-col shrink-0">
          <h1 className="text-2xl font-bold mb-6 tracking-wide text-zinc-100">Live Telemetry</h1>
          <LiveLogTerminal />
        </div>
      </div>
    </div>
  );
}
