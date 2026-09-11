import React from 'react';
import { ProviderProjectStatus } from '../../types/apibuild';
import { STATUS_META } from '../../services/apiBuild';

export const StatusDot: React.FC<{ status: ProviderProjectStatus; showLabel?: boolean }> = ({ status, showLabel = true }) => {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className="ab2-status" style={{ color: meta.color }}>
      <span className="ab2-dot" style={{ background: meta.color, color: meta.color }} />
      {showLabel && meta.label}
    </span>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="ab2-field">
    <span>{label}</span>
    {children}
    {hint && <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>{hint}</small>}
  </label>
);

export const Alert: React.FC<{ kind: 'info' | 'ok' | 'warn' | 'err'; children: React.ReactNode }> = ({ kind, children }) => (
  <div className={`ab2-alert ${kind}`}>{children}</div>
);

export const Skeleton: React.FC<{ h?: number }> = ({ h = 14 }) => (
  <div className="ab2-skel" style={{ height: h }} />
);

const NAMES = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const COLORS: Record<string, string> = { GET: '#22c55e', POST: '#a78bfa', PUT: '#f59e0b', PATCH: '#3b82f6', DELETE: '#ef4444' };
export const MethodBadge: React.FC<{ method: string }> = ({ method }) => (
  <span className="ab2-method" style={{ background: `${COLORS[method] || '#8b5cf6'}22`, color: COLORS[method] || '#a78bfa' }}>{method}</span>
);
export { NAMES };
