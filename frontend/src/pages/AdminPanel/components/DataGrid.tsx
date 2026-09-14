import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Search, Filter } from 'lucide-react';

const INITIAL_DATA = Array.from({ length: 50 }, (_, i) => ({
  id: `rec_${1000 + i}`,
  name: `Entity ${i}`,
  status: i % 3 === 0 ? 'archived' : 'active',
  created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  score: Math.floor(Math.random() * 100),
}));

export const DataGrid = () => {
  const [data, setData] = useState(INITIAL_DATA);
  
  // cell navigation: { rowIdx, colIdx }
  const [focusedCell, setFocusedCell] = useState<{ r: number, c: number } | null>(null);
  
  // cell edit: { rowIdx, colIdx, value }
  const [editingCell, setEditingCell] = useState<{ r: number, c: number, val: string } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const columns = ['id', 'name', 'status', 'created_at', 'score'];

  // Handle Keyboard Navigation & Editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) {
        if (e.key === 'Escape') {
          setEditingCell(null);
          // Return focus to the grid
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
        } else if (e.key === 'ArrowDown' && focusedCell.r < data.length - 1) {
          e.preventDefault();
          setFocusedCell({ r: focusedCell.r + 1, c: focusedCell.c });
        } else if (e.key === 'ArrowLeft' && focusedCell.c > 0) {
          e.preventDefault();
          setFocusedCell({ r: focusedCell.r, c: focusedCell.c - 1 });
        } else if (e.key === 'ArrowRight' && focusedCell.c < columns.length - 1) {
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
  }, [focusedCell, editingCell, data, columns]);

  // Focus input automatically when entering edit mode
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      // Select all text
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEdit = (r: number, c: number) => {
    // Only allow editing non-ID columns for this demo
    if (columns[c] === 'id') return;
    
    setEditingCell({
      r, c, 
      val: String((data[r] as any)[columns[c]])
    });
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { r, c, val } = editingCell;
    const key = columns[c];
    
    setData(prev => {
      const newData = [...prev];
      (newData[r] as any)[key] = val;
      return newData;
    });
    
    setEditingCell(null);
    gridRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s ease' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Database size={14} /> public.entities
          </button>
          <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <Filter size={14} /> Filter
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 8 }} />
            <input type="text" placeholder="Search..." style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '6px 12px 6px 30px', borderRadius: 6, fontSize: 13 }} />
          </div>
          <button className="btn-primary" style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>

      <div 
        ref={gridRef}
        tabIndex={0} 
        style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 8, overflow: 'auto', outline: 'none' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
            <tr>
              {columns.map(col => (
                <th key={col} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-card)', borderRight: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={row.id}>
                {columns.map((col, cIdx) => {
                  const isFocused = focusedCell?.r === rIdx && focusedCell?.c === cIdx;
                  const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;

                  return (
                    <td 
                      key={col}
                      onClick={() => setFocusedCell({ r: rIdx, c: cIdx })}
                      onDoubleClick={() => startEdit(rIdx, cIdx)}
                      style={{ 
                        padding: isEditing ? 0 : '8px 16px', 
                        borderBottom: '1px solid var(--border-subtle)',
                        borderRight: '1px solid var(--border-subtle)',
                        fontSize: 13,
                        fontFamily: col === 'id' || col === 'created_at' || col === 'score' ? 'var(--font-mono)' : 'inherit',
                        color: col === 'id' ? 'var(--text-muted)' : 'var(--text-primary)',
                        position: 'relative',
                        boxShadow: isFocused && !isEditing ? 'inset 0 0 0 2px #a78bfa' : 'none',
                        cursor: col === 'id' ? 'default' : 'cell',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        background: isFocused ? 'rgba(255,255,255,0.03)' : 'transparent',
                        height: 35
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editingCell.val}
                          onChange={e => setEditingCell({ ...editingCell, val: e.target.value })}
                          onBlur={commitEdit}
                          style={{
                            width: '100%', height: '100%', padding: '8px 16px', border: 'none', background: '#a78bfa', color: '#000', fontSize: 13, outline: 'none', fontWeight: 600, fontFamily: 'inherit'
                          }}
                        />
                      ) : (
                        (row as any)[col]
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '12px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
        <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>Double Click</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>Enter</kbd> to edit cell. <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>Arrows</kbd> to navigate.
      </div>
    </div>
  );
};
