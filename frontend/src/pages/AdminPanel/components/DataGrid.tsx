import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Search, Filter, ChevronDown, Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import axios from 'axios';
import toast from 'react-hot-toast';

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
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>(['User', 'CoreSettings', 'AuditLog']);
  const [selectedTable, setSelectedTable] = useState('User');
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const [editModalData, setEditModalData] = useState<Entity | null>(null);
  const [createModalData, setCreateModalData] = useState<Entity | null>(null);
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // cell navigation: { rowIdx, colIdx }
  const [focusedCell, setFocusedCell] = useState<{ r: number, c: number } | null>(null);
  // cell edit: { rowIdx, colIdx, val }
  const [editingCell, setEditingCell] = useState<{ r: number, c: number, val: string } | null>(null);

  const fetchExplorerData = async () => {
    if (!selectedTable) return;
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const devRole = localStorage.getItem('klyra-dev-role');
      if (!token && devRole) headers['x-klyra-role'] = devRole;

      const response = await axios.get('/api/v1/admin/explorer?table=' + selectedTable, { headers });
      setData(response.data.data || []);
      setTableSchema(response.data.schema || []);
      setDebugError(null);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setIsAccessDenied(true);
        setDebugError(null);
      } else {
        const errMsg = `DATA API ERROR [${err.response?.status}]: ${err.response?.data?.message || err.message}`;
        console.error(errMsg);
        setDebugError(errMsg);
      }
    }
  };

  const fetchTables = async () => {
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const devRole = localStorage.getItem('klyra-dev-role');
      if (!token && devRole) headers['x-klyra-role'] = devRole;

      const response = await axios.get('/api/v1/admin/explorer/tables', { headers });
      if (response.data.success && response.data.tables) {
        setAvailableTables(response.data.tables);
        if (!response.data.tables.includes(selectedTable) && response.data.tables.length > 0) {
          setSelectedTable(response.data.tables[0]);
        }
      }
      setDebugError(null);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setIsAccessDenied(true);
        setDebugError(null);
      } else {
        const errMsg = `TABLES API ERROR [${err.response?.status}]: ${err.response?.data?.message || err.message}`;
        console.error(errMsg);
        setDebugError(errMsg);
      }
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

  const filteredData = data.filter(r => {
    if (!query) return true;
    const stringifiedValues = JSON.stringify(Object.values(r)).toLowerCase();
    return stringifiedValues.includes(query.toLowerCase());
  });

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

  const requestAccess = async () => {
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const devRole = localStorage.getItem('klyra-dev-role');
      if (!token && devRole) headers['x-klyra-role'] = devRole;

      await axios.post('/api/v1/admin/explorer/request-access', {}, { headers });
      setAccessRequested(true);
      toast.success('Access request logged!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to request access');
    }
  };

  const handleDelete = (id: string) => {
    setEntityToDelete(id);
  };

  const confirmDelete = async () => {
    if (!entityToDelete) return;
    const id = entityToDelete;
    
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const devRole = localStorage.getItem('klyra-dev-role');
      if (!token && devRole) headers['x-klyra-role'] = devRole;

      // Call the backend delete endpoint
      const response = await axios.delete(`/api/v1/admin/explorer/${selectedTable}/${id}`, { headers });
      
      if (response.data.success) {
        // Remove the deleted row from the UI instantly without reloading
        setData(prevData => prevData.filter(e => e.id !== id));
        toast.success("Record deleted successfully");
      } else {
        toast.error("Failed to delete record: " + response.data.message);
      }
    } catch (error: any) {
      console.error("Delete API failed:", error);
      toast.error(`Error deleting record: ${error.response?.data?.message || error.message}`);
    } finally {
      setEntityToDelete(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModalData) return;
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const devRole = localStorage.getItem('klyra-dev-role');
      if (!token && devRole) headers['x-klyra-role'] = devRole;

      const response = await axios.put(`/api/v1/admin/explorer?table=${selectedTable}&id=${editModalData.id}`, editModalData, { headers });
      
      if (response.data.success) {
        setData(prevData => prevData.map(e => e.id === editModalData.id ? response.data.data : e));
        setEditModalData(null);
        toast.success("Record updated successfully");
      } else {
        toast.error("Failed to update record: " + response.data.message);
      }
    } catch (error: any) {
      console.error("Update API failed:", error);
      toast.error(`Error updating record: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSaveCreate = async () => {
    if (!createModalData) return;
    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const devRole = localStorage.getItem('klyra-dev-role');
      if (!token && devRole) headers['x-klyra-role'] = devRole;

      const response = await axios.post(`/api/v1/admin/explorer?table=${selectedTable}`, createModalData, { headers });
      
      if (response.data.success) {
        setData(prevData => [...prevData, response.data.data]);
        setCreateModalData(null);
        toast.success("Record created successfully");
      } else {
        toast.error("Failed to create record: " + response.data.message);
      }
    } catch (error: any) {
      console.error("Create API failed:", error);
      toast.error(`Error creating record: ${error.response?.data?.message || error.message}`);
    }
  };

  if (isAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-[#0a0a0f]/90 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
          <Lock size={32} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Database Access Restricted</h2>
        <p className="text-white/50 text-[13px] max-w-md text-center mb-6">
          You do not have the required permissions to view raw database tables.
        </p>
        <button
          onClick={requestAccess}
          disabled={accessRequested}
          className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${
            accessRequested 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.3)]'
          }`}
        >
          {accessRequested 
            ? 'Request logged! Please open pgAdmin / Prisma Studio and manually upgrade your user role to ADMIN.' 
            : 'Request Database Access'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* ── Top Action Bar ── */}
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
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
                        // Reset all states to prevent crossover bugs when schema changes
                        setCreateModalData(null);
                        setEditModalData(null);
                        setEditingCell(null);
                        setFocusedCell(null);
                        setTableSchema([]);
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
          <button 
            onClick={() => document.getElementById('searchInput')?.focus()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[12px] font-bold hover:bg-white/10 transition-colors"
          >
            <Filter size={14} /> Filter
          </button>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              id="searchInput"
              type="text" 
              placeholder="Search ID or Name..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-64 bg-black/40 border border-white/10 text-white text-[12px] py-1.5 pl-8 pr-3 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-white/20" 
            />
          </div>
          <button 
            onClick={() => setCreateModalData({})}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-[12px] font-bold hover:bg-indigo-600 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>

      {debugError && (
        <div className="mx-6 mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono break-all">
          {debugError}
        </div>
      )}

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
          <table className="w-full text-left text-sm whitespace-nowrap min-w-max border-collapse">
            <thead className="sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-md z-20 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
              <tr>
                {COLUMNS.length > 0 ? (
                  <>
                    {COLUMNS.map(col => (
                      <th key={col} className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30 border-r border-white/5 last:border-0">
                        {col}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white/30 text-right sticky right-0 bg-[#0a0a0f]/95 backdrop-blur-xl z-30 shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]">
                      ACTIONS
                    </th>
                  </>
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
                        className={`relative px-5 py-3 border-r border-white/5 last:border-0 h-12 max-w-[200px] truncate
                                    ${isFocused && !isEditing ? 'bg-white/[0.04]' : ''}
                                    ${isImmutable ? 'cursor-default' : 'cursor-text'}`}
                        title={String(row[col] ?? '')}
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
                  <td className="px-5 py-3 border-white/5 h-12 text-right sticky right-0 bg-[#0a0a0f]/80 group-hover:bg-[#111115]/90 backdrop-blur-xl z-20 shadow-[inset_1px_0_0_rgba(255,255,255,0.05)] transition-colors">
                    <div className="flex justify-end items-center gap-3">
                      {/* Edit Button */}
                      <button 
                        onClick={() => setEditModalData(row)}
                        className="flex items-center px-3 py-1.5 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-300 transition-all duration-200 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        title="Edit Record"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Edit
                      </button>

                      {/* Delete Button */}
                      <button 
                        onClick={() => handleDelete(row.id)}
                        className="flex items-center px-3 py-1.5 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 hover:text-rose-300 transition-all duration-200 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                        title="Delete Record"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
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

      {/* ── Edit Modal Overlay ── */}
      {editModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h2 className="text-lg font-bold text-white">Edit Record</h2>
              <button onClick={() => setEditModalData(null)} className="text-white/40 hover:text-white transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {tableSchema.map(fieldMeta => {
                const key = fieldMeta.name;
                
                // Strictly skip auto-generated, relation objects, arrays, and virtual fields
                if (
                  key === 'id' || 
                  key === 'createdAt' || 
                  key === 'updatedAt' || 
                  key === 'created_at' || 
                  key === 'updated_at' || 
                  fieldMeta.kind === 'object' || 
                  fieldMeta.isList ||
                  fieldMeta.relationName
                ) {
                  return null;
                }

                const isImmutable = key.toLowerCase().includes('time') || key.toLowerCase().includes('date');
                const isEnum = fieldMeta.kind === 'enum';
                const isBoolean = fieldMeta.type === 'Boolean';
                const isNumber = fieldMeta.type === 'Int' || fieldMeta.type === 'Float';
                const isForeignKey = key.toLowerCase().endsWith('id');

                return (
                  <div key={key}>
                    <label className="block text-[11px] font-bold text-white/40 uppercase mb-1">
                      {key} 
                      {isImmutable && ' (Immutable)'}
                      {fieldMeta.isRequired && <span className="text-rose-500 ml-1">*</span>}
                      {fieldMeta.isRequired && isForeignKey && <span className="text-rose-400/80 text-[9px] ml-1 lowercase tracking-normal">(parent must exist)</span>}
                    </label>
                    {isImmutable ? (
                      <div className="w-full bg-white/5 border border-white/5 text-white/50 text-[13px] py-2 px-3 rounded-lg font-mono break-all">
                        {String(editModalData[key] ?? '')}
                      </div>
                    ) : isEnum ? (
                      <div className="relative">
                        <select
                          value={editModalData[key] || ''}
                          onChange={e => setEditModalData({ ...editModalData, [key]: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 pr-8 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                        >
                          <option value="" disabled className="bg-[#111115]">Select {key}...</option>
                          {fieldMeta.enumValues?.map((v: string) => (
                            <option key={v} value={v} className="bg-[#111115]">{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      </div>
                    ) : isBoolean ? (
                      <div className="relative">
                        <select
                          value={editModalData[key] === true ? 'true' : editModalData[key] === false ? 'false' : ''}
                          onChange={e => setEditModalData({ ...editModalData, [key]: e.target.value === 'true' })}
                          className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 pr-8 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                        >
                          <option value="" disabled className="bg-[#111115]">Select...</option>
                          <option value="true" className="bg-[#111115]">True</option>
                          <option value="false" className="bg-[#111115]">False</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      </div>
                    ) : isNumber ? (
                      <input 
                        type="number" 
                        value={editModalData[key] ?? ''}
                        onChange={e => setEditModalData({ ...editModalData, [key]: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    ) : (
                      <input 
                        type="text" 
                        value={editModalData[key] || ''}
                        onChange={e => setEditModalData({ ...editModalData, [key]: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
              <button 
                onClick={() => setEditModalData(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold text-white/60 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg text-[13px] font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {entityToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111115] border border-rose-500/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="text-rose-400" size={24} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Delete Record?</h2>
            <p className="text-[13px] text-white/50 mb-6">
              Are you sure you want to permanently delete record <span className="font-mono text-white/80">{entityToDelete}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setEntityToDelete(null)}
                className="flex-1 py-2 rounded-lg text-[13px] font-bold text-white/60 hover:bg-white/5 transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-lg text-[13px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.3)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal Overlay ── */}
      {createModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h2 className="text-lg font-bold text-white">Create New Record</h2>
              <button onClick={() => setCreateModalData(null)} className="text-white/40 hover:text-white transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {tableSchema.map(fieldMeta => {
                const key = fieldMeta.name;
                
                // Strictly skip auto-generated, relation objects, arrays, and virtual fields
                if (
                  key === 'id' || 
                  key === 'createdAt' || 
                  key === 'updatedAt' || 
                  key === 'created_at' || 
                  key === 'updated_at' || 
                  fieldMeta.kind === 'object' || 
                  fieldMeta.isList ||
                  fieldMeta.relationName
                ) {
                  return null;
                }

                const isEnum = fieldMeta.kind === 'enum';
                const isBoolean = fieldMeta.type === 'Boolean';
                const isNumber = fieldMeta.type === 'Int' || fieldMeta.type === 'Float';
                const isForeignKey = key.toLowerCase().endsWith('id');

                return (
                  <div key={key}>
                    <label className="block text-[11px] font-bold text-white/40 uppercase mb-1">
                      {key} 
                      {fieldMeta.isRequired && <span className="text-rose-500 ml-1">*</span>}
                      {fieldMeta.isRequired && isForeignKey && <span className="text-rose-400/80 text-[9px] ml-1 lowercase tracking-normal">(parent must exist)</span>}
                    </label>
                    {isEnum ? (
                      <div className="relative">
                        <select
                          value={createModalData[key] || ''}
                          onChange={e => setCreateModalData({ ...createModalData, [key]: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 pr-8 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                        >
                          <option value="" disabled className="bg-[#111115]">Select {key}...</option>
                          {fieldMeta.enumValues?.map((v: string) => (
                            <option key={v} value={v} className="bg-[#111115]">{v}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      </div>
                    ) : isBoolean ? (
                      <div className="relative">
                        <select
                          value={createModalData[key] === true ? 'true' : createModalData[key] === false ? 'false' : ''}
                          onChange={e => setCreateModalData({ ...createModalData, [key]: e.target.value === 'true' })}
                          className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 pr-8 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                        >
                          <option value="" disabled className="bg-[#111115]">Select...</option>
                          <option value="true" className="bg-[#111115]">True</option>
                          <option value="false" className="bg-[#111115]">False</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      </div>
                    ) : isNumber ? (
                      <input 
                        type="number" 
                        value={createModalData[key] ?? ''}
                        onChange={e => setCreateModalData({ ...createModalData, [key]: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    ) : (
                      <input 
                        type="text" 
                        value={createModalData[key] || ''}
                        onChange={e => setCreateModalData({ ...createModalData, [key]: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 text-white text-[13px] py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
              <button 
                onClick={() => setCreateModalData(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold text-white/60 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCreate}
                className="px-4 py-2 rounded-lg text-[13px] font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                Create Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
