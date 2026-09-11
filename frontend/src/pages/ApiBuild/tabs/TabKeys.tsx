import React, { useState } from 'react';
import { Key, Plus, RefreshCw, Trash2, ShieldCheck, Check } from 'lucide-react';
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header bar */}
      <div className="kly-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Security & API Key Provisioning</h3>
            <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', marginTop: 4 }}>
              Keys are salted and hashed using Argon2id. Full secret tokens are masked after creation.
            </p>
          </div>
          <button className="kly-btn kly-btn-primary" onClick={onOpenCreateKey}>
            <Plus size={13} />
            <span>Generate New API Key</span>
          </button>
        </div>
      </div>

      {/* Keys Table */}
      <div className="kly-table-wrapper">
        <table className="kly-table">
          <thead>
            <tr>
              <th>Key Label</th>
              <th>Token Prefix</th>
              <th>Assigned Consumer</th>
              <th>Plan</th>
              <th>Scopes</th>
              <th>Last Used</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((k) => (
              <tr key={k.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={14} color="#8b5cf6" />
                    <span style={{ fontWeight: 600 }}>{k.label}</span>
                  </div>
                </td>
                <td className="kly-mono" style={{ color: '#c4b5fd', fontWeight: 600 }}>
                  {k.prefix}...
                </td>
                <td>{k.consumer}</td>
                <td>
                  <span className="kly-badge kly-badge-pill">{k.plan}</span>
                </td>
                <td>
                  <span style={{ fontSize: 11, color: 'var(--kly-text-dim)', fontFamily: 'var(--kly-font-mono)' }}>
                    read:users, write:generate
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--kly-text-muted)' }}>{k.lastUsed}</td>
                <td>
                  <span className={`kly-badge ${!k.revoked ? 'kly-badge-healthy' : 'kly-badge-paused'}`}>
                    {!k.revoked ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <button
                      className="kly-btn-icon"
                      title="Rotate key (48h dual-write grace period)"
                      onClick={() => { onRotateKey(k.id); onShowToast(`Key "${k.label}" rotated`); }}
                    >
                      <RefreshCw size={12} color="#10b981" />
                    </button>
                    <button
                      className="kly-btn-icon"
                      title="Revoke key immediately"
                      onClick={() => { onRevokeKey(k.id); onShowToast(`Key "${k.label}" revoked`); }}
                    >
                      <Trash2 size={12} color="#fb7185" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
