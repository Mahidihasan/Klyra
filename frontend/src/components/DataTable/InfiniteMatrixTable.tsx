import React, { useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditableCell } from './EditableCell';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey: keyof T;
  width?: number;
  isEditable?: boolean;
  cellRenderer?: (row: T) => React.ReactNode;
}

interface InfiniteMatrixTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  selectedRowIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onCellSave?: (rowId: string, columnId: string, newValue: string) => void;
  getRowId: (row: T) => string;
  rowHeight?: number;
  onRowClick?: (row: T) => void;
  onContextMenu?: (e: React.MouseEvent, row: T) => void;
}

// Internal component for draggable headers
const SortableHeader = ({ 
  column, 
  onResize 
}: { 
  column: ColumnDef<any>; 
  onResize: (id: string, newWidth: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: column.width || 150,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = column.width || 150;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
      onResize(column.id, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div ref={setNodeRef} style={style} className="matrix-header-cell group">
      <div className="header-content" {...attributes} {...listeners}>
        {column.header}
      </div>
      {/* Resizer Handle */}
      <div 
        className="resizer-handle opacity-0 group-hover:opacity-100"
        onMouseDown={handleResize}
      />
    </div>
  );
};

export function InfiniteMatrixTable<T>({
  data,
  columns: initialColumns,
  selectedRowIds,
  onSelectionChange,
  onCellSave,
  getRowId,
  rowHeight = 64, // Taller rows for rich avatars
  onRowClick,
  onContextMenu
}: InfiniteMatrixTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // State for columns (order and widths)
  const [columns, setColumns] = useState(initialColumns);

  // Setup virtualization
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before dragging starts to allow clicks
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((cols) => {
        const oldIndex = cols.findIndex((col) => col.id === active.id);
        const newIndex = cols.findIndex((col) => col.id === over.id);
        return arrayMove(cols, oldIndex, newIndex);
      });
    }
  };

  const handleColumnResize = (id: string, newWidth: number) => {
    setColumns(cols => cols.map(c => c.id === id ? { ...c, width: newWidth } : c));
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(d => getRowId(d))));
    }
  };

  const toggleRowSelect = (id: string) => {
    const newSet = new Set(selectedRowIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onSelectionChange(newSet);
  };

  return (
    <div className="matrix-table-container">
      <div className="matrix-table-inner" ref={parentRef}>
        
        {/* Sticky Header Row */}
        <div className="matrix-header-row bg-[#0a0a0f]/70 backdrop-blur-xl">
          <div className="matrix-cell checkbox-cell" style={{ width: 48, minWidth: 48 }}>
            <input 
              type="checkbox" 
              checked={data.length > 0 && selectedRowIds.size === data.length}
              onChange={toggleSelectAll}
            />
          </div>
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={columns.map(c => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map(col => (
                <SortableHeader 
                  key={col.id} 
                  column={col} 
                  onResize={handleColumnResize}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Virtualized Body */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowData = data[virtualRow.index];
            const rId = getRowId(rowData);
            const isSelected = selectedRowIds.has(rId);

            return (
              <div
                key={virtualRow.key}
                onClick={() => onRowClick?.(rowData)}
                onContextMenu={(e) => onContextMenu?.(e, rowData)}
                className={`matrix-row group ${isSelected ? 'selected' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="matrix-cell checkbox-cell" style={{ width: 48, minWidth: 48 }}>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => toggleRowSelect(rId)}
                  />
                </div>
                
                {columns.map(col => {
                  return (
                    <div 
                      key={col.id} 
                      className="matrix-cell"
                      style={{ width: col.width || 150 }}
                    >
                      {col.cellRenderer ? (
                        col.cellRenderer(rowData)
                      ) : (
                        <EditableCell 
                          value={rowData[col.accessorKey] as string | number} 
                          isEditable={col.isEditable}
                          onSave={(newVal) => onCellSave?.(rId, col.id, newVal)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .matrix-table-container {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          /* Borderless design */
          border: none;
        }
        .matrix-table-inner {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        .matrix-header-row {
          display: flex;
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .matrix-header-cell {
          position: relative;
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          height: 48px;
          user-select: none;
          background: transparent;
        }
        .header-content {
          flex: 1;
          cursor: grab;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .header-content:active {
          cursor: grabbing;
        }
        .resizer-handle {
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          width: 4px;
          cursor: col-resize;
          background: transparent;
          transition: background 0.2s, opacity 0.2s;
        }
        .resizer-handle:hover, .resizer-handle:active {
          background: rgba(167, 139, 250, 0.5);
          opacity: 1 !important;
        }
        
        .matrix-row {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          transition: background 0.15s ease;
        }
        .matrix-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .matrix-row.selected {
          background: rgba(167, 139, 250, 0.08);
        }
        
        .matrix-cell {
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.9);
          border-right: 1px solid rgba(255, 255, 255, 0.02);
        }
        .matrix-cell:last-child {
          border-right: none;
        }
        
        .checkbox-cell {
          justify-content: center;
          padding: 0;
        }
        .checkbox-cell input[type="checkbox"] {
          accent-color: #a78bfa;
          width: 16px;
          height: 16px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        .matrix-row:hover .checkbox-cell input[type="checkbox"],
        .checkbox-cell input[type="checkbox"]:checked {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
