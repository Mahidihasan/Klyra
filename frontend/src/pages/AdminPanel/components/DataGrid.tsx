import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Search, Filter, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import axios from 'axios';

// ─── Types & Mock Data ────────────────────────────────────────────────────────

type EntityStatus = 'active' | 'archived' | 'suspended' | 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';

interface Entity {
  [key: string]: any;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: EntityStatus }) => {
  const normalizedStatus = (status || 'active').toLowerCase() as 'active' | 'archived' | 'suspended';
  
  const colors = {
    active:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    archived:  'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    suspended: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };
  const dotColors = {
    active:    'bg-emerald-400',
    archived:  'bg-zinc-400',
    suspended: 'bg-rose-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border ${colors[normalizedStatus] || colors.active}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[normalizedStatus] || dotColors.active} ${normalizedStatus === 'active' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const DataGrid = () => {
  const [data, setData] = useState<Entity[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>(['User', 'CoreSettings', 'AuditLog']);
  const [selectedTable, setSelectedTable] = useState('User');
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // cell navigation: { rowIdx, colIdx }
  const [focusedCell, setFocusedCell] = useState<{ r: number, c: number } | null>(null);
  // cell edit: { rowIdx, colIdx, val }
  const [editingCell, setEditingCell] = useState<{ r: number, c: number, val: string } | null>(null);

  const fetchExplorerData = async () => {
    if (!selectedTable) return;
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const response = await axios.get('/api/v1/admin/explorer?table=' + selectedTable, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setData(response.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const response = await axios.get('/api/v1/admin/explorer/tables', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success && response.data.tables) {
        setAvailableTables(response.data.tables);
        if (!response.data.tables.includes(selectedTable) && response.data.tables.length > 0) {
          setSelectedTable(response.data.tables[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchExplorerData();
  }, [selectedTable]);

  const COLUMNS = data.length > 0 ? Object.keys(data[0]) : [];

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Spotlight Effect State
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  const filteredData = data.filter(r => 
    !query || Object.values(r).some(val => String(val).toLowerCase().includes(query.toLowerCase()))
  );

  // Keyboard Navigation & Editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) {
        if (e.key === 'Escape') {
          setEditingCell(null);
          gridRef.current?.focus();
        } else if (e.key === 'Enter') {
          commitEdit();
        }
        return;
      }

      if (focusedCell) {
        if (e.key === 'ArrowUp' && focusedCell.r > 0) {
          e.preventDefault();
          setFocusedCell({ r: focusedCell.r - 1, c: focusedCell.c });
        } else if (e.key === 'ArrowDown' && focusedCell.r < filteredData.length - 1) {
          e.preventDefault();
          setFocusedCell({ r: focusedCell.r + 1, c: focusedCell.c });
        } else if (e.key === 'ArrowLeft' && focusedCell.c > 0) {
          e.preventDefault();
          setFocusedCell({ r: focusedCell.r, c: focusedCell.c - 1 });
        } else if (e.key === 'ArrowRight' && focusedCell.c < COLUMNS.length - 1) {
          e.preventDefault();
          setFocusedCell({ r: focusedCell.r, c: focusedCell.c + 1 });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          startEdit(focusedCell.r, focusedCell.c);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, editingCell, filteredData]);

  // Focus input automatically when entering edit mode
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEdit = (r: number, c: number) => {
    const col = COLUMNS[c];
    if (col === 'id' || col === 'created_at') return; // Immutable columns
    
    setEditingCell({
      r, c, 
      val: String((filteredData[r] as any)[col])
    });
  };

  const commitEdit = () => {
    setEditingCell(null);
    gridRef.current?.focus();
    // Re-fetch or trigger backend update here ideally
  };

  // Track mouse for spotlight
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: -1000, y: -1000 });
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* ── Header Toolbar ── */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[12px] font-bold tracking-widest uppercase hover:bg-indigo-500/20 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)] outline-none"
            >
              <Database size={14} /> PUBLIC.{selectedTable}
              <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-[#111115] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden backdrop-blur-xl"
                >
                  {availableTables.map(table => (
                    <button
                      key={table}
                      onClick={() => {
                        setSelectedTable(table);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-[13px] text-zinc-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                    >
                      {table}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[12px] font-bold hover:bg-white/10 transition-colors">
            <Filter size={14} /> Filter
          </button>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              placeholder="Search ID or Name..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-black/40 border border-white/10 text-white text-[12px] py-1.5 pl-8 pr-3 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20" 
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-[12px] font-bold hover:bg-indigo-600 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>

      {/* ── Organic Canvas Grid ── */}
      <div 
        ref={gridRef}
        tabIndex={0}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex-1 rounded-2xl overflow-hidden outline-none bg-black/40 backdrop-blur-2xl border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.5)]"
      >
        {/* SVG Noise Texture Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay z-0"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        />
        
        {/* Dynamic Spotlight */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,0.1), transparent 40%)`,
          }}
        />

        <div className="relative z-10 w-full h-full overflow-auto custom-scrollbar">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-md z-20 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
              <tr>
                {COLUMNS.length > 0 ? (
                  COLUMNS.map(col => (
                    <th key={col} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30 border-r border-white/5 last:border-0">
                      {col}
                    </th>
                  ))
                ) : (
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    STATUS
                  </th>
                )}
              </tr>
            </thead>
            
            <tbody>
              {filteredData.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                  {COLUMNS.map((col, cIdx) => {
                    const isFocused = focusedCell?.r === rIdx && focusedCell?.c === cIdx;
                    const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;
                    const isImmutable = col === 'id' || col.toLowerCase().includes('time') || col.toLowerCase().includes('date');

                    return (
                      <td 
                        key={col}
                        onClick={() => setFocusedCell({ r: rIdx, c: cIdx })}
                        onDoubleClick={() => startEdit(rIdx, cIdx)}
                        className={`relative px-5 py-3 border-r border-white/5 last:border-0 h-12
                                    ${isFocused && !isEditing ? 'bg-white/[0.04]' : ''}
                                    ${isImmutable ? 'cursor-default' : 'cursor-text'}`}
                      >
                        {/* Focus Ring */}
                        {isFocused && !isEditing && (
                          <div className="absolute inset-0 border-2 border-indigo-500/50 pointer-events-none z-10 shadow-[inset_0_0_10px_rgba(99,102,241,0.2)]" />
                        )}

                        <div className="relative z-0 w-full h-full flex items-center">
                          {isEditing ? (
                            <AnimatePresence>
                              <motion.input
                                ref={inputRef}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                value={editingCell.val}
                                onChange={e => setEditingCell({ ...editingCell, val: e.target.value })}
                                onBlur={commitEdit}
                                className="absolute inset-0 w-full h-full px-4 -mx-1 -my-1 rounded-lg bg-indigo-950/80 border border-indigo-500/50 
                                           text-indigo-200 text-[13px] font-semibold outline-none ring-2 ring-indigo-500/30 shadow-[0_4px_20px_rgba(99,102,241,0.4)] z-50
                                           backdrop-blur-xl"
                              />
                            </AnimatePresence>
                          ) : (
                            <div className="w-full truncate">
                              {col === 'status' ? (
                                <StatusBadge status={String(row[col]).toLowerCase() as EntityStatus} />
                              ) : isImmutable ? (
                                <span className="font-mono text-[12px] text-zinc-400/70">{String(row[col])}</span>
                              ) : (
                                <span className="text-[13px] text-white/80 font-medium">{String(row[col] || '')}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredData.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-white/30">
              <Database size={32} className="mb-2 opacity-50" />
              <div className="text-[13px]">No records found matching your query.</div>
            </div>
          )}
        </div>
      </div>
      
      {/* ── Footer Hints ── */}
      <div className="flex items-center justify-between text-[11px] text-white/30 shrink-0">
        <div className="flex items-center gap-2">
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/50 border border-white/10">Double Click</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/50 border border-white/10">Enter</kbd> to edit cell</span>
          <span className="text-white/10">|</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/50 border border-white/10">Arrows</kbd> to navigate</span>
        </div>
        <div className="font-mono">{filteredData.length} Records loaded</div>
      </div>
    </div>
  );
};
