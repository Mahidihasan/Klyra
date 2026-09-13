import React, { useState, useEffect, useMemo } from 'react';
import { History, ShieldCheck, RefreshCw, ChevronDown, ChevronRight, RotateCcw, Filter, Search } from 'lucide-react';
import { ProviderProject } from '../../../types/apibuild';
import { ResourceHistoryEntry } from '../../../types/operations';
import { apiBuildService } from '../../../services/apiBuild';

interface AuditEvent {
  id: string; projectId: string; actorId: string; actorEmail?: string;
  timestamp: string; resourceType: string; resourceId?: string; operation: string;
  before?: unknown; after?: unknown; changeSummary?: string; requestId?: string; context?: unknown;
}

interface TabAuditProps {
  project: ProviderProject;
  onUpdateProject: (patch: Partial<ProviderProject>) => void;
  onShowToast: (msg: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  project: '#c4b5fd', deployment: '#22c55e', endpoint: '#38bdf8',
  operation: '#f59e0b', draft: '#64748b', plan: '#10b981', key: '#e879f9',
};
const OP_META: Record<string, { label: string; color: string }> = {
  create: { label: 'Create', color: '#22c55e' }, update: { label: 'Update', color: '#eab308' },
  delete: { label: 'Delete', color: '#ef4444' }, deploy: { label: 'Deploy', color: '#22c55e' },
  rollback: { label: 'Rollback', color: '#f59e0b' }, publish: { label: 'Publish', color: '#10b981' },
  cancel: { label: 'Cancel', color: '#f59e0b' }, restore: { label: 'Restore', color: '#6366f1' },
  bulk_update: { label: 'Bulk update', color: '#38bdf8' },
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 1);
}

export const TabAudit: React.FC<TabAuditProps> = ({ project, onUpdateProject, onShowToast }) => {
  const [mode, setMode] = useState<'audit' | 'history'>('audit');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [history, setHistory] = useState<ResourceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterOp, setFilterOp] = useState<string>('');
  const [search, setSearch] = useState('');
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const evts = await apiBuildService.getAuditLog<AuditEvent>(project.id, { limit: 60 });
      setEvents(evts);
      const hist = await apiBuildService.listHistory<ResourceHistoryEntry>(project.id, { limit: 60 });
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit data');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filteredEvents = useMemo(() => events.filter((e) =>
    (!filterType || e.resourceType === filterType) &&
    (!filterOp || e.operation === filterOp) &&
    (!search || JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))
  ), [events, filterType, filterOp, search]);

  const handleRestore = async (versionNo: number) => {
    if (!window.confirm(`Restore project configuration to history version ${versionNo}? This applies that snapshot and is recorded in audit.`)) return;
    setRestoring(versionNo);
    try {
      await apiBuildService.restoreHistoryVersion(project.id, 'project', versionNo);
      onUpdateProject({ version: project.version });
      onShowToast(`Restored to history version ${versionNo}`);
      await load();
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Restore failed');
    } finally { setRestoring(null); }
  };

  return (
    <section className="kly-tab-content">
      <div className="kly-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 className="kly-card-title"><History size={14} style={{ marginRight: 6 }} />Immutable Change History</h4>
          <p className="kly-card-subtitle">Every privileged change, who performed it, and restore points.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`kly-btn ${mode === 'audit' ? 'kly-btn-primary' : 'kly-btn-ghost'}`} onClick={() => setMode('audit')}><ShieldCheck size={13} /><span>Audit events</span></button>
          <button className={`kly-btn ${mode === 'history' ? 'kly-btn-primary' : 'kly-btn-ghost'}`} onClick={() => setMode('history')}><History size={13} /><span>Resource history</span></button>
          <button className="kly-btn kly-btn-ghost" onClick={() => void load()} title="Refresh"><RefreshCw size={13} /></button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 10 }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', margin: '10px 0', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--kly-border-subtle)', borderRadius: 8 }}>
        <Search size={13} style={{ color: 'var(--kly-text-dim)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit trail…" style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--kly-text-main)', fontSize: 12 }} />
        <Filter size={13} style={{ color: 'var(--kly-text-dim)' }} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ background: '#161724', border: '1px solid var(--kly-border-subtle)', color: 'var(--kly-text-main)', borderRadius: 5, fontSize: 12, padding: '4px 6px' }}>
          <option value="">All types</option>
          {['project', 'deployment', 'endpoint', 'operation', 'draft'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)} style={{ background: '#161724', border: '1px solid var(--kly-border-subtle)', color: 'var(--kly-text-main)', borderRadius: 5, fontSize: 12, padding: '4px 6px' }}>
          <option value="">All operations</option>
          {Object.keys(OP_META).map((op) => <option key={op} value={op}>{OP_META[op].label}</option>)}
        </select>
      </div>

      {loading && <div className="kly-skeleton" aria-busy="true">Loading audit trail…</div>}

      {!loading && mode === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--kly-text-dim)', fontSize: 13 }}>
              No audit events match your filters.
              <button className="kly-btn kly-btn-ghost" style={{ marginTop: 10, display: 'block' }} onClick={() => { setSearch(''); setFilterType(''); setFilterOp(''); }}>Clear filters</button>
            </div>
          ) : filteredEvents.map((e) => {
            const opMeta = OP_META[e.operation] || { label: e.operation, color: '#64748b' };
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} style={{ border: '1px solid var(--kly-border-subtle)', borderRadius: 6, background: 'rgba(255,255,255,0.015)' }}>
                <div role="button" tabIndex={0} aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setExpanded(isOpen ? null : e.id); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer' }}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="kly-badge" style={{ color: TYPE_COLORS[e.resourceType] || '#c4b5fd', borderColor: TYPE_COLORS[e.resourceType] || '#c4b5fd' }}>{e.resourceType}</span>
                  <span className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-main)', minWidth: 120 }}>{new Date(e.timestamp).toLocaleString()}</span>
                  <span style={{ minWidth: 80, fontSize: 12, fontWeight: 700, color: opMeta.color }}>{opMeta.label}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--kly-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.changeSummary || `${e.operation} ${e.resourceType}`}</span>
                  <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>{e.actorEmail || e.actorId}</span>
                  {e.requestId && <span className="kly-mono" style={{ fontSize: 10, color: 'var(--kly-text-dim)' }}>{e.requestId}</span>}
                </div>
                {isOpen && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="diff-view">
                      <div className="diff-section"><div className="diff-label"><span style={{ color: '#ef4444' }}>Before</span></div><pre className="kly-mono">{fmtValue(e.before)}</pre></div>
                      <div className="diff-arrow">→</div>
                      <div className="diff-section"><div className="diff-label"><span style={{ color: '#22c55e' }}>After</span></div><pre className="kly-mono">{fmtValue(e.after)}</pre></div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--kly-text-dim)' }}>
                      <span>resource: <b className="kly-mono">{e.resourceId || '—'}</b></span>
                      <span>context: <b className="kly-mono">{e.context ? JSON.stringify(e.context) : '—'}</b></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && mode === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {history.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--kly-text-dim)', fontSize: 13 }}>
              No resource history recorded yet. Save a configuration change and it will appear here.
            </div>
          ) : history.map((h) => {
            const isOpen = expanded === `h${h.id}`;
            return (
              <div key={h.id} style={{ border: '1px solid var(--kly-border-subtle)', borderRadius: 6, background: 'rgba(255,255,255,0.015)' }}>
                <div role="button" tabIndex={0} aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : `h${h.id}`)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setExpanded(isOpen ? null : `h${h.id}`); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer' }}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="kly-badge" style={{ color: TYPE_COLORS[h.resourceType] || '#c4b5fd' }}>{h.resourceType}</span>
                  <span className="kly-mono" style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', minWidth: 86 }}>v{h.versionNo}</span>
                  <span className="kly-mono" style={{ fontSize: 11, color: 'var(--kly-text-dim)', minWidth: 120 }}>{new Date(h.createdAt).toLocaleString()}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--kly-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.summary || `${h.resourceType} version ${h.versionNo}`}
                    {h.reason ? <span style={{ color: 'var(--kly-text-dim)', fontStyle: 'italic' }}> — {h.reason}</span> : null}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>{h.actor}</span>
                  <button
                    className="kly-btn kly-btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }}
                    disabled={restoring === h.versionNo}
                    onClick={(e) => { e.stopPropagation(); void handleRestore(h.versionNo); }}
                    title="Restore this snapshot through the normal update path"
                  >
                    <RotateCcw size={12} color="#f59e0b" /><span>{restoring === h.versionNo ? 'Restoring…' : 'Restore'}</span>
                  </button>
                </div>
                {isOpen && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="diff-view">
                      <div className="diff-section"><div className="diff-label"><span style={{ color: '#ef4444' }}>Before</span></div><pre className="kly-mono">{fmtValue(h.before)}</pre></div>
                      <div className="diff-arrow">→</div>
                      <div className="diff-section"><div className="diff-label"><span style={{ color: '#22c55e' }}>After</span></div><pre className="kly-mono">{fmtValue(h.after)}</pre></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};