import {
  useTable,
  createCoreRowModel,
  ColumnDef,
  ColumnResizeMode,
  Cell,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Database, Search, Settings, Eye, Copy, Trash2, Edit2 } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- Types ---
export type DBRow = Record<string, any>;

interface DatabaseViewerProps {
  initialData?: DBRow[];
  tableName?: string;
}

// --- Helpers ---
const generateMockData = (numRows = 5000): DBRow[] => {
  return Array.from({ length: numRows }).map((_, r) => {
    return {
      id: `rec_${1000 + r}`,
      name: `Project Nexus Segment ${r}`,
      status: Math.random() > 0.8 ? 'archived' : 'active',
      created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      role: r % 3 === 0 ? 'admin' : 'viewer',
    };
  });
};

const columnsDef: any[] = [
  { accessorKey: 'id', header: 'id', size: 120 },
  { accessorKey: 'name', header: 'name', size: 280 },
  { accessorKey: 'status', header: 'status', size: 140 },
  { accessorKey: 'created_at', header: 'created_at', size: 220 },
  { accessorKey: 'role', header: 'role', size: 120 },
];

// --- Magnetic Menu Item ---
const MagneticItem = ({ children, onClick, icon: Icon, danger }: any) => {
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
    x.set((e.clientX - centerX) * 0.2);
    y.set((e.clientY - centerY) * 0.2);
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
        relative flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${
          danger
            ? 'hover:bg-red-500/10 text-red-400'
            : 'hover:bg-white/10 text-gray-200 hover:text-white'
        }
      `}
    >
      <Icon size={16} className={danger ? 'text-red-400' : 'text-gray-400'} />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};

// --- Custom Cell Renderer with Hierarchy & Badges ---
const CellRenderer = ({ cell }: { cell: Cell<DBRow, any> }) => {
  const val = cell.getValue();
  const columnId = cell.column.id;

  if (columnId === 'id' || columnId === 'created_at') {
    return (
      <span className="font-mono text-xs text-gray-500 tracking-wider truncate w-full">{String(val)}</span>
    );
  }

  if (columnId === 'name') {
    return <span className="text-gray-100 font-medium truncate w-full">{String(val)}</span>;
  }

  if (columnId === 'status') {
    const isActive = val === 'active';
    return (
      <div className="flex items-center w-full">
        <div
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase
            ${
              isActive
                ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                : 'bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20'
            }
          `}
        >
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          )}
          {String(val)}
        </div>
      </div>
    );
  }

  return <span className="text-[13px] text-gray-400 truncate w-full">{String(val)}</span>;
};

// --- Spotlight Table Row ---
const TableRow = ({
  row,
  virtualRow,
  handleRowContextMenu,
}: {
  row: any;
  virtualRow: any;
  handleRowContextMenu: (e: React.MouseEvent, id: string, index: number) => void;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rowRef.current) {
      return;
    }
    const rect = rowRef.current.getBoundingClientRect();
    rowRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    rowRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={rowRef}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => handleRowContextMenu(e, row.id, virtualRow.index)}
      className="absolute top-0 left-0 flex w-full border-b border-white/5 group overflow-hidden"
      style={{ transform: `translateY(${virtualRow.start}px)`, height: virtualRow.size }}
    >
      {/* Row Spotlight Gradient */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(400px circle at var(--mouse-x, -100px) var(--mouse-y, -100px), rgba(255,255,255,0.03), transparent 40%)',
        }}
      />

      {row.getVisibleCells().map((cell: any) => (
        <div
          key={cell.id}
          className="relative z-10 flex items-center px-4"
          style={{ width: cell.column.getSize() }}
        >
          <CellRenderer cell={cell} />
        </div>
      ))}
    </div>
  );
};

// --- Main Infinite Matrix Component ---
export default function DatabaseViewer({
  initialData,
  tableName = 'public.records',
}: DatabaseViewerProps) {
  const [data, setData] = useState<DBRow[]>(() => initialData || generateMockData());
  const [columns] = useState<ColumnDef<DBRow, any>[]>(columnsDef);
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowId: string;
    rowIndex: number;
  } | null>(null);

  const tableFn = useTable;
  const table = tableFn({
    data,
    columns: columns as any,
    columnResizeMode,
    getCoreRowModel: createCoreRowModel(),
  } as any);

  const { rows } = table.getRowModel();
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string, rowIndex: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, rowId, rowIndex });
    },
    [],
  );

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <div className="w-full flex flex-col items-center py-6">
      {/* GLASSMORPHISM WRAPPER */}
      <div className="flex flex-col h-[700px] w-full max-w-[1400px] rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] relative isolate bg-[#0a0a0a]/70 backdrop-blur-2xl">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-6 h-[72px] border-b border-white/5 shrink-0 z-10 bg-black/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 shadow-inner">
              <Database size={16} className="text-gray-400" />
              <span className="font-mono text-xs font-semibold text-gray-200 tracking-wider">
                {tableName}
              </span>
            </div>
            <span className="text-[11px] text-gray-500 font-mono tracking-widest uppercase">
              {data.length.toLocaleString()} rows
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group flex items-center">
              <Search
                className="absolute left-3 text-gray-500 group-focus-within:text-white transition-colors"
                size={14}
              />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-2 text-xs bg-black/40 border border-white/10 rounded-lg text-gray-200 focus:border-white/30 focus:ring-1 focus:ring-white/30 outline-none transition-all w-64 placeholder-gray-600 font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
              />
            </div>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-transparent hover:border-white/10">
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div ref={tableScrollRef} className="flex-1 overflow-auto custom-scrollbar z-10">
          <div style={{ width: table.getTotalSize() }} className="grid relative min-h-full">
            {/* Header Row */}
            <div className="sticky top-0 z-30 flex border-b border-white/10 shadow-lg backdrop-blur-xl bg-[#0a0a0a]/90">
              {table.getFlatHeaders().map((header: any) => (
                <div
                  key={header.id}
                  className="relative flex items-center px-4 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] select-none group hover:bg-white/5 transition-colors cursor-default"
                  style={{ width: header.getSize() }}
                >
                  <span className="truncate w-full font-mono">
                    {header.column.columnDef.header as string}
                  </span>
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`
                      absolute right-0 top-0 h-full w-[1px] cursor-col-resize select-none touch-none z-40 transition-colors
                      ${
                        header.column.getIsResizing()
                          ? 'bg-white/30'
                          : 'bg-white/5 group-hover:bg-white/20'
                      }
                    `}
                  />
                </div>
              ))}
            </div>

            {/* Virtualized Infinite Matrix Body */}
            <div
              style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index] as any;
                return (
                  <TableRow
                    key={row.id}
                    row={row}
                    virtualRow={virtualRow}
                    handleRowContextMenu={handleRowContextMenu}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Magnetic Context Menu Overlay */}
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="fixed z-[100] w-56 p-1.5 rounded-xl bg-[#0f0f0f]/90 backdrop-blur-3xl border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 240),
                top: Math.min(contextMenu.y, window.innerHeight - 200),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 mb-1 border-b border-white/5">
                <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-gray-500">
                  Record Actions
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <MagneticItem icon={Eye} onClick={() => setContextMenu(null)}>
                  View Record
                </MagneticItem>
                <MagneticItem icon={Edit2} onClick={() => setContextMenu(null)}>
                  Edit Record
                </MagneticItem>
                <MagneticItem
                  icon={Copy}
                  onClick={() => {
                    navigator.clipboard.writeText(contextMenu.rowId);
                    setContextMenu(null);
                  }}
                >
                  Copy ID
                </MagneticItem>
                <div className="h-px bg-white/5 my-1 mx-2" />
                <MagneticItem
                  icon={Trash2}
                  danger
                  onClick={() => {
                    setData((prev) => prev.filter((_, i) => i !== contextMenu.rowIndex));
                    setContextMenu(null);
                  }}
                >
                  Delete Record
                </MagneticItem>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
