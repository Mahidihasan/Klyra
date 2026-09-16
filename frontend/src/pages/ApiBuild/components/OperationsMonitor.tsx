import React from 'react';
import { Activity, X } from 'lucide-react';
import { OperationRecord, OPERATION_META, isOperationTerminal } from '../../../types/operations';

/**
 * OperationsMonitor — persistent status bar shown while any backend operation
 * is still running. Renders real executor progress (never simulated), and
 * collapses to a compact summary. Clicking anywhere expands the drawer.
 */
interface OperationsMonitorProps {
  operations: OperationRecord[];
  onSelect: (op: OperationRecord) => void;
  onOpenAll: () => void;
}

export const OperationsMonitor: React.FC<OperationsMonitorProps> = ({
  operations,
  onSelect,
  onOpenAll,
}) => {
  const active = operations.filter((op) => !isOperationTerminal(op.state));
  const recent = operations.slice(0, 3);

  // Nothing running and nothing finished yet — no bar.
  if (active.length === 0 && operations.length === 0) return null;

  return (
    <div
      className="kly-operations-monitor"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70,
        borderTop: '1px solid var(--kly-border-subtle)',
        background: 'rgba(22,23,36,0.94)',
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px',
        fontSize: 12,
      }}
    >
      <Activity size={13} color={active.length ? '#38bdf8' : 'var(--kly-text-dim)'} />
      <span style={{ fontWeight: 700, color: 'var(--kly-text-main)' }}>
        Operations{active.length ? ` · ${active.length} running` : ''}
      </span>

      <div style={{ flex: 1, display: 'flex', gap: 10, overflow: 'hidden' }}>
        {active.length === 0 && (
          <span style={{ color: 'var(--kly-text-dim)', whiteSpace: 'nowrap' }}>
            No operations in progress.
          </span>
        )}
        {active.map((op) => {
          const meta = OPERATION_META[op.state];
          return (
            <button
              key={op.id}
              onClick={() => onSelect(op)}
              title={`${op.id} — ${op.type} (${op.progress}%)`}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '2px 6px', borderRadius: 5, color: 'var(--kly-text-main)',
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}
            >
              <span className="kly-pulse-dot" style={{ background: meta.dot }} />
              <span className="kly-mono">{op.type}</span>
              <span style={{ color: 'var(--kly-text-dim)' }}>{op.progress}%</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onOpenAll}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--kly-text-dim)', fontSize: 12 }}
      >
        {operations.length} total
      </button>

      {recent.length > 0 && active.length === 0 && (
        <button
          onClick={() => onSelect(recent[0])}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--kly-text-dim)', fontSize: 12 }}
        >
          <X size={12} /> last: {recent[0].type} · {OPERATION_META[recent[0].state].label}
        </button>
      )}
    </div>
  );
};