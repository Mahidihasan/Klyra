import { motion, AnimatePresence } from 'framer-motion';
import React, { useRef, useState, useEffect } from 'react';

import axios from 'axios';
import toast from 'react-hot-toast';

interface PlatformEntity {
  id: string;
  name: string;
  status: string;
  score: number;
  createdAt: string;
  updatedAt: string;
}

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
  type: 'id' | 'timestamp' | 'status' | 'string' | 'number';
  value: string | number;
}) => {
  if (type === 'id' || type === 'timestamp' || type === 'number') {
    return (
      <div className="flex-1 px-6 py-4">
        <span className="font-mono text-[13px] text-zinc-400 tracking-wider">{value}</span>
      </div>
    );
  }

  if (type === 'status') {
    const isActive = value === 'ACTIVE';
    return (
      <div className="flex-1 px-6 py-4 flex items-center">
        {isActive ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {String(value).toUpperCase()}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-zinc-500/10 border-zinc-500/20 text-zinc-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            {String(value).toUpperCase()}
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
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await axios.get('/api/v1/admin/logs/audit-logs', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.data.success) {
          const formattedLogs = res.data.data.map((log: any) => {
            const time = new Date(log.created_at).toLocaleTimeString();
            const action = log.action || 'EVENT';
            const entity = log.entity_type || 'System';
            const isError = action.includes('DELETE') || action.includes('ERROR') || action.includes('FAIL');
            const prefix = isError ? '[ERROR]' : `[${action}]`;
            
            return `${prefix} ${time} - ${entity} modified by user (Target: ${log.entity_id})`;
          });
          setLogs(formattedLogs.reverse());
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      }
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
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
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState('ACTIVE');
  const [selectedTable, setSelectedTable] = useState('User');
  const [isDropdownMenuOpen, setIsDropdownMenuOpen] = useState(false);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await axios.get('/api/v1/admin/explorer?table=' + selectedTable, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setEntities(res.data.data);
    } catch (err) {
      toast.error('Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, [selectedTable]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      await axios.post('/api/v1/admin/explorer', { name: newName, status: newStatus }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Entity created');
      setNewName('');
      setNewStatus('ACTIVE');
      setIsCreating(false);
      fetchEntities();
    } catch (err) {
      toast.error('Failed to create entity');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      await axios.delete(`/api/v1/admin/explorer/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Entity deleted');
      fetchEntities();
    } catch (err) {
      toast.error('Failed to delete entity');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-8">
        {/* Left Side: Infinite Matrix */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="relative">
              <button 
                onClick={() => setIsDropdownMenuOpen(!isDropdownMenuOpen)}
                className="text-2xl font-bold tracking-wide text-zinc-100 flex items-center gap-2 hover:text-white transition-colors"
              >
                PUBLIC.{selectedTable.toUpperCase()}
                <span className="text-[12px] text-zinc-500">▼</span>
              </button>
              {isDropdownMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 py-2">
                  {['User', 'CoreSettings', 'AuditLog'].map(table => (
                    <button
                      key={table}
                      onClick={() => {
                        setSelectedTable(table);
                        setIsDropdownMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-[13px] text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      {table}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Read-only Explorer - Creation is disabled for real tables via this basic UI */}
          </div>

          {/* STEP 3: THE GLASSMORPHISM WRAPPER */}
          <div className="bg-zinc-950/50 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden flex flex-col h-[700px]">
            {/* Table Header */}
            <div className="flex px-2 sticky top-0 z-20 border-b border-white/10 bg-zinc-950/40 backdrop-blur-md">
              {entities.length > 0 ? (
                Object.keys(entities[0]).map(header => (
                  <div key={header} className="flex-1 px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                    {header}
                  </div>
                ))
              ) : (
                <div className="flex-1 px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Loading columns...
                </div>
              )}
              <div className="flex-1 px-4 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">
                Actions
              </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative px-2 pb-2">
              {loading ? (
                <div className="p-8 text-center text-white/50 text-[13px]">Loading entities...</div>
              ) : entities.length === 0 ? (
                <div className="p-8 text-center text-white/50 text-[13px]">No entities found. Create one to begin.</div>
              ) : (
                entities.map((row) => (
                  <MatrixRow key={row.id || Math.random().toString()}>
                    {Object.keys(entities[0]).map(header => {
                      const val = row[header];
                      if (header === 'status') return <MatrixCell key={header} type="status" value={val as string} />;
                      if (header === 'id' || header.toLowerCase().includes('time') || header.toLowerCase().includes('date')) {
                        const strVal = String(val);
                        const isDate = !isNaN(Date.parse(strVal)) && strVal.length > 10;
                        return <MatrixCell key={header} type={header === 'id' ? 'id' : 'timestamp'} value={header === 'id' ? strVal.substring(0, 12) + '...' : isDate ? new Date(strVal).toISOString() : strVal} />;
                      }
                      if (typeof val === 'number') return <MatrixCell key={header} type="number" value={val} />;
                      return <MatrixCell key={header} type="string" value={String(val || '')} />;
                    })}
                    <div className="flex-1 px-6 py-4 flex items-center justify-end">
                      <button 
                        onClick={() => row.id ? handleDelete(row.id) : toast.error("Cannot delete row without ID")}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[11px] font-bold uppercase transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </MatrixRow>
                ))
              )}
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
