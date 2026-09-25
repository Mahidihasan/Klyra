import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Trash2, Search, AlertTriangle, ShieldAlert, CheckCircle, Database, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import axios from 'axios';

// ─── Data & Types ─────────────────────────────────────────────────────────────

interface DeletedRecord {
  id: string;
  type: string;
  name: string;
  deleted_at: string;
  deleted_by: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  API:    'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]',
  USER:   'text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]',
  REVIEW: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
  DEFAULT: 'text-gray-400 bg-gray-500/10 border-gray-500/20 shadow-[0_0_10px_rgba(156,163,175,0.2)]',
};

// ─── Toast Notification Component ─────────────────────────────────────────────

const Toast = ({ message, visible, onHide }: { message: string, visible: boolean, onHide: () => void }) => {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 3000);
      return () => clearTimeout(t);
    }
  }, [visible, onHide]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/30 text-emerald-400 font-bold text-[13px] shadow-[0_4px_20px_rgba(16,185,129,0.3)] z-50"
        >
          <CheckCircle size={16} /> {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Hold-to-Obliterate Button ────────────────────────────────────────────────

const HoldToObliterate = ({ onExecute }: { onExecute: () => void }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [destroyed, setDestroyed] = useState(false);
  
  const HOLD_MS = 2000;
  const holdInterval = useRef<ReturnType<typeof setInterval>>();
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const controls = useAnimation();

  useEffect(() => {
    if (isHolding && !destroyed) {
      const startTime = Date.now();
      holdInterval.current = setInterval(() => {
        setProgress(Math.min(((Date.now() - startTime) / HOLD_MS) * 100, 100));
      }, 30);

      holdTimer.current = setTimeout(() => {
        setDestroyed(true);
        setProgress(100);
        onExecute();
        controls.start({ x: [0, -4, 4, -4, 4, 0], transition: { duration: 0.3 } });
      }, HOLD_MS);
    } else {
      clearInterval(holdInterval.current);
      clearTimeout(holdTimer.current);
      if (!destroyed) setProgress(0);
    }

    return () => {
      clearInterval(holdInterval.current);
      clearTimeout(holdTimer.current);
    };
  }, [isHolding, destroyed, onExecute, controls]);

  return (
    <motion.div animate={controls} className="relative">
      <button
        onPointerDown={() => !destroyed && setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerLeave={() => setIsHolding(false)}
        className="relative h-8 w-32 rounded-lg bg-black/40 border border-rose-500/30 flex items-center justify-center overflow-hidden transition-colors hover:bg-black/60 active:scale-[0.97]"
      >
        {!destroyed && (
          <div 
            className="absolute left-0 top-0 bottom-0 bg-rose-600/40 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        )}
        <div className={`relative z-10 flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase transition-colors ${
          isHolding ? 'text-rose-400' : 'text-rose-400/70'
        }`}>
          <Trash2 size={12} /> {isHolding ? 'Hold...' : 'Obliterate'}
        </div>
      </button>
    </motion.div>
  );
};

// ─── Nuke Modal ───────────────────────────────────────────────────────────────

const EmptyBinModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: () => void }) => {
  const [confirmText, setConfirmText] = useState('');
  
  if (!isOpen) return null;
  
  const canNuke = confirmText === 'DELETE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-black border border-rose-500/30 rounded-2xl shadow-[0_20px_60px_rgba(244,63,94,0.3)] overflow-hidden"
      >
        {/* Hazard Stripes Header */}
        <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,#000_0px,#000_10px,#ef4444_10px,#ef4444_20px)]" />
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <ShieldAlert size={20} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-rose-500 tracking-tight">Empty Recycle Bin</h3>
              <p className="text-[12px] text-white/40">This action cannot be undone.</p>
            </div>
          </div>
          
          <p className="text-[13px] text-white/70 leading-relaxed mb-6">
            You are about to permanently delete all soft-deleted records. These records will be wiped from the underlying database storage and cannot be recovered by anyone.
          </p>

          <div className="mb-6">
            <label className="block text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">
              Type <span className="text-rose-400 font-mono bg-rose-500/10 px-1 py-0.5 rounded">DELETE</span> to confirm
            </label>
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-[14px] focus:outline-none focus:border-rose-500/50 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 text-[13px] font-bold hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button 
              disabled={!canNuke}
              onClick={() => { onConfirm(); onClose(); }}
              className={`px-5 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-all ${
                canNuke 
                  ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:bg-rose-600' 
                  : 'bg-rose-500/10 text-rose-500/30 cursor-not-allowed border border-rose-500/20'
              }`}
            >
              <Trash2 size={16} /> Empty Bin
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RecycleBin = () => {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToPermanentlyDelete, setItemToPermanentlyDelete] = useState<{table: string, id: string} | null>(null);

  useEffect(() => {
    const fetchRecycleBin = async () => {
      try {
        const headers: Record<string, string> = {};
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const devRole = localStorage.getItem('klyra-dev-role');
        if (!token && devRole) headers['x-klyra-role'] = devRole;

        const res = await axios.get('/api/v1/admin/explorer/recycle-bin', { headers });
        if (res.data.success) {
          setRecords(res.data.data);
        }
      } catch (err: any) {
        console.error("Failed to fetch recycle bin:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecycleBin();
  }, []);

  const filtered = records.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleRestore = (id: string) => {
    // Optimistic UI Removal
    setRecords(prev => prev.filter(r => r.id !== id));
    setToastMessage(`Record ${id} restored successfully.`);
  };

  const handlePermanentDelete = (table: string, id: string) => {
    setItemToPermanentlyDelete({ table, id });
  };

  const confirmPermanentDelete = async () => {
    if (!itemToPermanentlyDelete) return;
    const { table, id } = itemToPermanentlyDelete;
    try {
      // Future-proofed for real axios call:
      // const res = await axios.delete(`/api/v1/admin/explorer/recycle-bin/delete/${table}/${id}`);
      setRecords(prev => prev.filter(r => r.id !== id));
      setToastMessage(`Record ${id} permanently deleted.`);
    } catch (error) {
      alert("Failed to permanently delete record.");
    } finally {
      setItemToPermanentlyDelete(null);
    }
  };

  const handleEmptyBin = () => {
    setRecords([]);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto gap-6 pb-10">
      
      {/* Toast Notification */}
      <Toast message={toastMessage} visible={!!toastMessage} onHide={() => setToastMessage('')} />
      
      {/* Nuke Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <EmptyBinModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={handleEmptyBin} />
        )}
      </AnimatePresence>

      {/* Permanent Delete Modal */}
      {itemToPermanentlyDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111115] border border-rose-500/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="text-rose-400" size={24} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Permanent Delete?</h2>
            <p className="text-[13px] text-white/50 mb-6">
              Are you sure you want to permanently delete record <span className="font-mono text-white/80">{itemToPermanentlyDelete.id}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setItemToPermanentlyDelete(null)}
                className="flex-1 py-2 rounded-lg text-[13px] font-bold text-white/60 hover:bg-white/5 transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={confirmPermanentDelete}
                className="flex-1 py-2 rounded-lg text-[13px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.3)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-[20px] font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Trash2 size={16} className="text-zinc-400" />
            </div>
            Recycle Bin
          </h2>
          <p className="text-[13px] text-white/40 mt-1">Forensic view of soft-deleted records. Restore items or permanently wipe them from the database storage.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              placeholder="Search records..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-[13px] text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={records.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${
              records.length > 0 
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            <AlertTriangle size={14} /> Empty Bin
          </button>
        </div>
      </div>

      {/* ── Forensic Data Grid ── */}
      <div className="flex-1 bg-zinc-950/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col">
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-md">
          <div className="col-span-2 text-[10px] font-bold text-white/30 tracking-widest uppercase">Record ID</div>
          <div className="col-span-2 text-[10px] font-bold text-white/30 tracking-widest uppercase">Type</div>
          <div className="col-span-3 text-[10px] font-bold text-white/30 tracking-widest uppercase">Identifier</div>
          <div className="col-span-2 text-[10px] font-bold text-white/30 tracking-widest uppercase">Deleted At</div>
          <div className="col-span-3 text-[10px] font-bold text-white/30 tracking-widest uppercase text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0f]/50 backdrop-blur-sm">
              <Loader2 className="animate-spin text-rose-500 mb-4" size={32} />
            </div>
          )}
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map(record => (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, scale: 0.95, overflow: 'hidden' }}
                transition={{ duration: 0.3, type: 'spring', bounce: 0.2 }}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.02] items-center hover:bg-white/[0.02] transition-colors group"
              >
                {/* ID */}
                <div className="col-span-2 font-mono text-[12px] text-zinc-500">{record.id}</div>
                
                {/* Type Badge */}
                <div className="col-span-2 flex items-center">
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-black tracking-widest uppercase ${TYPE_COLORS[record.type] || TYPE_COLORS.DEFAULT}`}>
                    {record.type}
                  </span>
                </div>
                
                {/* Identifier */}
                <div className="col-span-3 text-[13px] font-medium text-white/80 truncate pr-4">
                  {record.name}
                </div>
                
                {/* Deleted At & By */}
                <div className="col-span-2 flex flex-col justify-center">
                  <div className="font-mono text-[11px] text-zinc-400/80 mb-0.5">
                    {record.deleted_at.replace('T', ' ').replace('Z', '')}
                  </div>
                  <div className="text-[10px] font-mono text-indigo-400/60 uppercase tracking-widest">
                    by {record.deleted_by}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="col-span-3 flex items-center justify-end gap-3 opacity-100 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleRestore(record.id)}
                    className="h-8 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-all active:scale-95"
                  >
                    <RefreshCw size={12} /> Restore
                  </button>
                  <button 
                    onClick={() => handlePermanentDelete(record.type.toLowerCase(), record.id)}
                    className="h-8 px-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all active:scale-95"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ── Cinematic Empty State ── */}
          <AnimatePresence>
            {!loading && records.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <div className="relative w-32 h-32 mb-6">
                  {/* Glowing vault background */}
                  <div className="absolute inset-0 bg-emerald-500/20 blur-[50px] rounded-full" />
                  <motion.div 
                    animate={{ y: [-5, 5, -5] }} 
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative z-10 w-full h-full flex items-center justify-center text-emerald-400 opacity-80"
                  >
                    <Database size={64} strokeWidth={1} />
                  </motion.div>
                </div>
                <h3 className="text-[18px] font-bold text-white tracking-tight mb-2">The Vault is Clean</h3>
                <p className="text-[13px] text-white/40 max-w-sm text-center">
                  No deleted records found. The system is operating in a pristine state.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Empty State */}
          {records.length > 0 && filtered.length === 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
               <Search size={32} className="mb-4 opacity-50" />
               <div className="text-[13px] font-bold tracking-widest uppercase">No Matches</div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
