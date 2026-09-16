import React, { useState } from 'react';
import {
  Key, Plus, RefreshCw, Trash2, ShieldCheck, Search, Copy, AlertTriangle,
  Lock, Clock, Hash, CheckCircle2, ShieldAlert, SlidersHorizontal, Download, EyeOff
} from 'lucide-react';
import { ProviderApiKey } from '../../../types/apibuild';

interface TabKeysProps {
  apiKeys: ProviderApiKey[];
  onOpenCreateKey: () => void;
  onRotateKey: (keyId: string) => void;
  onRevokeKey: (keyId: string) => void;
  onShowToast: (msg: string) => void;
}

export const TabKeys: React.FC<TabKeysProps> = ({
  apiKeys,
  onOpenCreateKey,
  onRotateKey,
  onRevokeKey,
  onShowToast
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [envFilter, setEnvFilter] = useState('ALL');

  const filteredKeys = apiKeys.filter((key) => {
    const matchesQuery = !query || `${key.label} ${key.consumer} ${key.prefix}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'active' ? !key.revoked : key.revoked);
    const matchesEnv = envFilter === 'ALL' || true; // Assuming we add env to apiKeys later, placeholder for now
    return matchesQuery && matchesStatus && matchesEnv;
  });

  const activeCount = apiKeys.filter((key) => !key.revoked).length;
  const revokedCount = apiKeys.filter((key) => key.revoked).length;

  return (
    <div className="kly-keys-root">
      
      {/* Security Posture Dashboard */}
      <div className="kly-keys-dashboard">
        <div className="kly-keys-dash-header">
          <div className="kly-keys-dash-title">
            <Lock size={15} color="#c4b5fd" />
            <h4>Security Posture</h4>
          </div>
          <div className="kly-keys-dash-status">
            <CheckCircle2 size={13} color="#34d399" />
            <span>All secrets hashed via Argon2id</span>
          </div>
        </div>
        
        <div className="kly-keys-kpi-grid">
          <div className="kly-keys-kpi-card kly-keys-kpi-active">
            <div className="kly-keys-kpi-icon"><ShieldCheck size={16} /></div>
            <div className="kly-keys-kpi-content">
              <div className="kly-keys-kpi-val">{activeCount}</div>
              <div className="kly-keys-kpi-label">Active Credentials</div>
              <div className="kly-keys-kpi-meta">Serving authenticated traffic</div>
            </div>
          </div>
          
          <div className="kly-keys-kpi-card kly-keys-kpi-warn">
            <div className="kly-keys-kpi-icon"><Clock size={16} /></div>
            <div className="kly-keys-kpi-content">
              <div className="kly-keys-kpi-val">0</div>
              <div className="kly-keys-kpi-label">Expiring in 30d</div>
              <div className="kly-keys-kpi-meta">No immediate action needed</div>
            </div>
          </div>
          
          <div className="kly-keys-kpi-card kly-keys-kpi-idle">
            <div className="kly-keys-kpi-icon"><EyeOff size={16} /></div>
            <div className="kly-keys-kpi-content">
              <div className="kly-keys-kpi-val">2</div>
              <div className="kly-keys-kpi-label">Stale Keys (&gt;90d)</div>
              <div className="kly-keys-kpi-meta" style={{ color: '#fbbf24' }}>Consider rotating</div>
            </div>
          </div>
          
          <div className="kly-keys-kpi-card kly-keys-kpi-danger">
            <div className="kly-keys-kpi-icon"><ShieldAlert size={16} /></div>
            <div className="kly-keys-kpi-content">
              <div className="kly-keys-kpi-val">{revokedCount}</div>
              <div className="kly-keys-kpi-label">Revoked Tokens</div>
              <div className="kly-keys-kpi-meta">Blocked at edge</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="kly-card kly-keys-toolbar">
        <div className="kly-keys-toolbar-left">
          <h3 className="kly-keys-title">Credential Inventory</h3>
        </div>
        <div className="kly-keys-toolbar-right">
          <div className="kly-keys-search">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search prefix, label, consumer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="kly-keys-filters">
            <SlidersHorizontal size={13} color="var(--kly-text-dim)" />
            <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
              <option value="ALL">All Environments</option>
              <option value="prod">Production</option>
              <option value="test">Test / Sandbox</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div className="kly-keys-actions">
            <button className="kly-btn kly-btn-ghost" title="Export Audit Log" onClick={() => onShowToast('Exporting key audit log...')}>
              <Download size={14} />
            </button>
            <button className="kly-btn kly-btn-primary" onClick={onOpenCreateKey}>
              <Plus size={13} />
              <span>Issue New Key</span>
            </button>
          </div>
        </div>
      </div>

      {/* Keys Table */}
      <div className="kly-card kly-keys-table-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="kly-table kly-keys-table">
          <thead>
            <tr>
              <th>Token Identity</th>
              <th>Secret Prefix</th>
              <th>Consumer & Plan</th>
              <th>Permissions</th>
              <th>Last Used</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeys.map((k) => (
              <tr key={k.id} className="kly-keys-row">
                <td>
                  <div className="kly-keys-identity-cell">
                    <div className="kly-keys-icon-wrapper" data-status={!k.revoked ? 'active' : 'revoked'}>
                      <Key size={13} />
                    </div>
                    <div>
                      <div className="kly-keys-label">{k.label}</div>
                      <div className="kly-keys-env">
                        <span className="kly-keys-env-dot" style={{ background: k.label.toLowerCase().includes('test') ? '#fbbf24' : '#c4b5fd' }}></span>
                        {k.label.toLowerCase().includes('test') ? 'Test' : 'Production'}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="kly-keys-prefix-cell">
                    <Hash size={12} color="var(--kly-text-dim)" />
                    <code className="kly-keys-prefix-code">{k.prefix}••••••••</code>
                    <button className="kly-btn-icon kly-keys-copy-btn" title="Copy prefix" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(k.prefix); onShowToast('Key prefix copied'); }}>
                      <Copy size={11} />
                    </button>
                  </div>
                </td>
                <td>
                  <div className="kly-keys-consumer-cell">
                    <div className="kly-keys-consumer-name">{k.consumer}</div>
                    <span className="kly-badge kly-badge-pill kly-keys-plan-badge" data-plan={k.plan.toLowerCase()}>{k.plan}</span>
                  </div>
                </td>
                <td>
                  <div className="kly-keys-scopes">
                    <span className="kly-keys-scope">read:users</span>
                    <span className="kly-keys-scope">write:data</span>
                  </div>
                </td>
                <td className="kly-keys-last-used">
                  {k.lastUsed}
                </td>
                <td>
                  <span className={`kly-badge ${!k.revoked ? 'kly-badge-healthy' : 'kly-badge-error'}`}>
                    {!k.revoked ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="kly-keys-action-group">
                    {!k.revoked && (
                      <button
                        className="kly-btn kly-btn-ghost kly-keys-btn-rotate"
                        title="Rotate key (48h dual-write grace period)"
                        onClick={() => { onRotateKey(k.id); onShowToast(`Key "${k.label}" rotated`); }}
                      >
                        <RefreshCw size={12} /> Rotate
                      </button>
                    )}
                    <button
                      className="kly-btn kly-btn-ghost kly-keys-btn-revoke"
                      title={!k.revoked ? "Revoke key immediately" : "Delete key record"}
                      onClick={() => { onRevokeKey(k.id); onShowToast(`Key "${k.label}" revoked`); }}
                    >
                      <Trash2 size={12} /> {!k.revoked ? 'Revoke' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredKeys.length && (
              <tr>
                <td colSpan={7}>
                  <div className="kly-empty-state">
                    <Search size={18} />
                    <span>No credentials match the current filters.</span>
                    <button className="kly-btn kly-btn-ghost" onClick={() => { setQuery(''); setStatusFilter('ALL'); setEnvFilter('ALL'); }}>Clear filters</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

