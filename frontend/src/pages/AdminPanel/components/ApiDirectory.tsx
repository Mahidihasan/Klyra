import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, Pencil, ArrowUpRight, FolderEdit, PauseCircle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingActionBar } from '../../../components/DataTable/FloatingActionBar';

const generateTrafficData = () => Array.from({ length: 7 }).map(() => Math.floor(Math.random() * 100));

const INITIAL_CATALOG = Array.from({ length: 30 }).map((_, i) => ({
  id: `api_${i}`,
  name: `Production API Service ${i + 1}`,
  version: `1.${i % 5}.0`,
  provider: `Provider ${String.fromCharCode(65 + (i % 5))}`,
  status: i % 4 === 0 ? 'Deprecated' : 'Active',
  category: ['Finance', 'AI', 'Weather', 'Data'][i % 4],
  calls: Math.floor(Math.random() * 500000) + 10000,
  trafficTrend: generateTrafficData()
}));

const Sparkline = ({ data }: { data: number[] }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 24;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 4) - 2; // Add slight padding
    return `${x},${y}`;
  }).join(' L ');

  const isUp = data[data.length - 1] > data[0];
  const color = isUp ? '#34d399' : '#f43f5e'; // emerald-400 : rose-500

  return (
    <div className="w-[64px] h-[24px]">
      <svg width={width} height={height} className="overflow-visible">
        <motion.path
          d={`M ${points}`}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
};

export const ApiDirectory = () => {
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // Micro-popover state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'status' | 'category' | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const toggleSelectAll = () => {
    if (selected.size === catalog.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(catalog.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleEditClick = (e: React.MouseEvent, id: string, type: 'status' | 'category') => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPos({ x: rect.left, y: rect.bottom + 8 });
    setEditingId(id);
    setEditType(type);
  };

  const updateField = (val: string) => {
    if (!editingId || !editType) return;
    setCatalog(prev => prev.map(api => api.id === editingId ? { ...api, [editType]: val } : api));
    setEditingId(null);
    setEditType(null);
  };

  useEffect(() => {
    const handleClickOutside = () => setEditingId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0f]">
      {/* High-Density Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3 w-1/3">
          <div className="flex items-center flex-1 h-8 px-3 gap-2 bg-white/5 rounded-md border border-white/10 focus-within:border-white/20 focus-within:bg-white/10 transition-colors">
            <Search size={14} className="text-white/40" />
            <input 
              type="text" 
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-white placeholder:text-white/30" 
              placeholder="Search directory..." 
            />
          </div>
          <button className="h-8 px-3 rounded-md bg-white/5 border border-white/10 text-[13px] font-medium text-white/70 hover:bg-white/10 transition-colors flex items-center gap-2">
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Linear-Style High-Density Data Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1000px] w-full">
          {/* Grid Header */}
          <div className="sticky top-0 z-20 grid grid-cols-[40px_3fr_2fr_1.5fr_1.5fr_1fr_40px] items-center px-4 py-2 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
            <div className="flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={selected.size === catalog.length && catalog.length > 0}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-white/20 bg-black/50 text-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
            </div>
            <div className="pl-2">API / Service</div>
            <div>Provider</div>
            <div>Category</div>
            <div>Status</div>
            <div className="text-right pr-4">Traffic (7d)</div>
            <div></div>
          </div>

          {/* Grid Body */}
          <div className="flex flex-col">
            {catalog.map(api => {
              const isSelected = selected.has(api.id);
              const isStatusActive = api.status === 'Active';
              
              return (
                <div 
                  key={api.id}
                  className={`grid grid-cols-[40px_3fr_2fr_1.5fr_1.5fr_1fr_40px] items-center px-4 py-2.5 border-b border-white/5 text-[13px] transition-colors hover:bg-white/[0.02] group ${isSelected ? 'bg-indigo-500/5' : ''}`}
                >
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelect(api.id)}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-black/50 text-indigo-500 focus:ring-offset-0 cursor-pointer opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                      style={{ opacity: isSelected ? 1 : undefined }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pl-2 overflow-hidden">
                    <span className="font-semibold text-white/90 truncate">{api.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">v{api.version}</span>
                  </div>
                  
                  <div className="text-white/50 truncate pr-4">{api.provider}</div>
                  
                  {/* Category Badge with Inline Edit */}
                  <div className="flex items-center">
                    <button 
                      onClick={(e) => handleEditClick(e, api.id, 'category')}
                      className="group/badge relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[11px] font-medium hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                    >
                      {api.category}
                      <Pencil size={10} className="opacity-0 group-hover/badge:opacity-100 text-white/40 transition-opacity" />
                    </button>
                  </div>
                  
                  {/* Status Badge with Inline Edit */}
                  <div className="flex items-center">
                    <button 
                      onClick={(e) => handleEditClick(e, api.id, 'status')}
                      className={`group/badge relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium hover:bg-opacity-20 transition-all cursor-pointer ${
                        isStatusActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isStatusActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-400'}`} />
                      {api.status}
                      <Pencil size={10} className="opacity-0 group-hover/badge:opacity-100 transition-opacity" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-end gap-3 pr-4">
                    <Sparkline data={api.trafficTrend} />
                    <span className="font-mono text-[11px] text-white/40 w-12 text-right">
                      {api.calls > 1000 ? `${(api.calls / 1000).toFixed(1)}k` : api.calls}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <button className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Micro-Popover for Inline Edits */}
      <AnimatePresence>
        {editingId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[100] w-36 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl shadow-black/80 overflow-hidden py-1"
            style={{ top: popoverPos.y, left: popoverPos.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {editType === 'status' ? (
              <>
                <button onClick={() => updateField('Active')} className="w-full text-left px-3 py-1.5 text-[12px] text-emerald-400 hover:bg-white/5">Active</button>
                <button onClick={() => updateField('Deprecated')} className="w-full text-left px-3 py-1.5 text-[12px] text-rose-400 hover:bg-white/5">Deprecated</button>
              </>
            ) : (
              <>
                <button onClick={() => updateField('Finance')} className="w-full text-left px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/5 hover:text-white">Finance</button>
                <button onClick={() => updateField('AI')} className="w-full text-left px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/5 hover:text-white">AI</button>
                <button onClick={() => updateField('Weather')} className="w-full text-left px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/5 hover:text-white">Weather</button>
                <button onClick={() => updateField('Data')} className="w-full text-left px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/5 hover:text-white">Data</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bulk Action Bar */}
      <FloatingActionBar
        selectedCount={selected.size}
        onClearSelection={() => setSelected(new Set())}
        actions={[
          { label: 'Bulk Categorize', onClick: () => console.log('Categorize') },
          { label: 'Bulk Pause', onClick: () => console.log('Pause'), variant: 'danger' },
          { label: 'Export Data', onClick: () => console.log('Export') }
        ]}
      />
    </div>
  );
};
