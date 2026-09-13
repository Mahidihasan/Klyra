import React, { useState } from 'react';
import { RefreshCw, Square, Terminal, AlertTriangle, History } from 'lucide-react';
import {
  OperationRecord, OPERATION_META, isOperationCancellable, isOperationRetryable,
} from '../../../types/operations';
import { DrawerShell } from './DrawerShell';

interface OperationDrawerProps {
  operation: OperationRecord | null;
  onClose: () => void;
  onCancel: (op: OperationRecord) => Promise<void>;
  onRetry: (op: OperationRecord) => Promise<void>;
  onShowToast: (msg: string) => void;
  onOpenAudit: () => void;
}

const TABS = ['logs', 'errors', 'payload', 'result'] as const;

export const OperationDrawer: React.FC<OperationDrawerProps> = ({
  operation: op,
  onClose,
  onCancel,
  onRetry,
  onShowToast,
  onOpenAudit,
}) => {
  const [tab, setTab] = useState<(typeof TABS)[number]>('logs');
  const [busy, setBusy] = useState(false);

  if (!op) return null;
  const meta = OPERATION_META[op.state];

  const handleCancel = async () => {
    if (!window.confirm(`Cancel ${op.type} operation ${op.id}? In-flight work will stop.`)) return;
    setBusy(true);
    try {
      await onCancel(op);
      onShowToast(`Cancelled ${op.id}`);
    } finally { setBusy(false); }
  };

  const handleRetry = async () => {
    setBusy(true);
    try {
      await onRetry(op);
      onShowToast(`Re-queued ${op.id}`);
    } finally { setBusy(false); }
  };

  const renderMeta = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--kly-text-dim)' }}>{label}</span>
      <b className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-main)' }}>{value}</b>
    </div>
  );

  return (
    <DrawerShell
      open={!!op}
      onClose={onClose}
      storageKey="operation"
      ariaLabel={`Operation ${op.id}`}
      title={
        <>
          <span className="kly-mono" style={{ color: '#c4b5fd' }}>{op.id}</span>
          <span className="kly-badge">{op.type}</span>
          <span className="kly-badge" style={{ color: meta.color, borderColor: meta.color, background: `${meta.color}1a` }}>
            <span className="kly-pulse-dot" style={{ background: meta.dot }} />
            {meta.label}
          </span>
        </>
      }
      subtitle={<>{op.environment ? `${op.environment} · ` : ''}{op.resource ? `${op.resource} · ` : ''}created {new Date(op.createdAt).toLocaleString()}</>}
      toolbar={
        <>
          {isOperationCancellable(op.state) && (
            <button className="kly-btn kly-btn-secondary" onClick={handleCancel} disabled={busy} title="Stop this operation">
              <Square size={13} color="#f59e0b" /><span>Cancel</span>
            </button>
          )}
          {isOperationRetryable(op.state) && (
            <button className="kly-btn kly-btn-primary" onClick={handleRetry} disabled={busy} title="Re-queue this operation">
              <RefreshCw size={13} /><span>Retry</span>
            </button>
          )}
          <button className="kly-btn kly-btn-ghost" onClick={onOpenAudit} title="See the audit trail for this operation">
            <History size={13} /><span>Audit</span>
          </button>
          {op.requestId && (
            <span className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>req {op.requestId}</span>
          )}
        </>
      }
      footer={
        <>
          {renderMeta('Actor', op.actor)}
          {renderMeta('Started', op.startedAt ? new Date(op.startedAt).toLocaleString() : '—')}
          {renderMeta('Finished', op.finishedAt ? new Date(op.finishedAt).toLocaleString() : '—')}
          {renderMeta('Result', op.result ? (Object.keys(op.result).length ? 'ok' : '{}') : '—')}
        </>
      }
    >
      {/* Progress */}
      <div style={{ margin: '-4px 0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--kly-text-dim)' }}>Progress</span>
          <b className="kly-mono">{op.progress}%</b>
        </div>
        <div className="kly-progress-track">
          <div className="kly-progress-fill" style={{ width: `${op.progress}%`, background: meta.color }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--kly-border-subtle)', margin: '0 0 14px' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'transparent', border: 'none',
              borderBottom: tab === t ? '2px solid var(--kly-primary)' : '2px solid transparent',
              color: tab === t ? 'var(--kly-text-main)' : 'var(--kly-text-dim)',
              padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {t === 'errors' && op.errors.length > 0 ? `${t} (${op.errors.length})` : t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {op.warnings.length > 0 && (
            <div style={{ display: 'flex', gap: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
              <AlertTriangle size={13} />
              <span>{op.warnings.map((w) => `⚠ ${w}`).join('  ·  ')}</span>
            </div>
          )}

          {tab === 'logs' && (
            <div className="kly-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, color: 'var(--kly-text-main)' }}>
              {op.logs.length === 0
                ? <span style={{ color: 'var(--kly-text-dim)', fontStyle: 'italic' }}>No log entries yet.</span>
                : op.logs.map((line, i) => <div key={i}><Terminal size={11} style={{ marginRight: 6, color: 'var(--kly-border-violet)' }} />{line}</div>)}
            </div>
          )}

          {tab === 'errors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {op.errors.length === 0
                ? <div style={{ color: 'var(--kly-text-dim)', fontSize: 12, fontStyle: 'italic' }}>No errors recorded.</div>
                : op.errors.map((err, i) => (
                  <div key={i} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 6, padding: '10px 12px', fontSize: 12 }}>
                    <AlertTriangle size={13} style={{ marginRight: 8 }} />{err}
                  </div>
                ))}
              {op.state === 'failed' && (
                <div style={{ marginTop: 6, padding: '10px 12px', background: 'rgba(22,23,36,0.6)', border: '1px solid var(--kly-border-violet)', borderRadius: 6, fontSize: 12, color: 'var(--kly-text-dim)' }}>
                  The operation failed backend-side. Use <b>Retry</b> to re-queue it. Check the audit log for who/what changed.
                </div>
              )}
            </div>
          )}

          {tab === 'payload' && (
            <pre className="kly-mono" style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--kly-text-main)', background: 'rgba(22,23,36,0.5)', border: '1px solid var(--kly-border-subtle)', borderRadius: 6, padding: 12 }}>
              {op.payload ? JSON.stringify(op.payload, null, 2) : '{}'}
            </pre>
          )}

          {tab === 'result' && (
            <pre className="kly-mono" style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--kly-text-main)', background: 'rgba(22,23,36,0.5)', border: '1px solid var(--kly-border-subtle)', borderRadius: 6, padding: 12 }}>
              {op.result ? JSON.stringify(op.result, null, 2) : <span style={{ color: 'var(--kly-text-dim)' }}>No result yet — operation not finished.</span>}
            </pre>
          )}
        </div>
      </DrawerShell>
  );
};