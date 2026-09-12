import React, { useState } from 'react';
import { X, Key, Copy, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ProviderApiKey, ApiConsumer } from '../../../types/apibuild';

interface CreateKeyModalProps {
  consumers: ApiConsumer[];
  isOpen: boolean;
  onClose: () => void;
  onCreateKey: (key: ProviderApiKey) => void;
  onShowToast: (msg: string) => void;
}

export const CreateKeyModal: React.FC<CreateKeyModalProps> = ({
  consumers,
  isOpen,
  onClose,
  onCreateKey,
  onShowToast
}) => {
  const [label, setLabel] = useState('');
  const [consumer, setConsumer] = useState(consumers[0]?.name || 'Acme Robotics');
  const [env, setEnv] = useState<'production' | 'staging' | 'development'>('production');
  const [scopes, setScopes] = useState<string[]>(['read:users', 'write:generate']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!label.trim()) return;
    const prefix = env === 'production' ? 'kly_live_' + Math.random().toString(36).slice(2, 6) : 'kly_test_' + Math.random().toString(36).slice(2, 6);
    const fullSecret = `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

    const newKey: ProviderApiKey = {
      id: `key-${Date.now()}`,
      label: label.trim(),
      prefix,
      consumer,
      plan: 'Pro',
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      revoked: false
    };

    onCreateKey(newKey);
    setCreatedSecret(fullSecret);
  };

  const handleCopySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      onShowToast('API Key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast('Copied key');
    }
  };

  const toggleScope = (sc: string) => {
    setScopes(prev => prev.includes(sc) ? prev.filter(s => s !== sc) : [...prev, sc]);
  };

  return (
    <div className="kly-modal-overlay" onClick={onClose}>
      <div className="kly-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="kly-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={16} color="#8b5cf6" />
            <h3 style={{ fontSize: 15 }}>{createdSecret ? 'API Key Generated' : 'Create New API Key'}</h3>
          </div>
          <button className="kly-btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Body */}
        <div className="kly-modal-body">
          {createdSecret ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="kly-alert-banner" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#a7f3d0' }}>
                <ShieldCheck size={16} />
                <span>Make sure to copy your API secret now. You will not be able to see it again!</span>
              </div>

              <div className="kly-input-group">
                <label className="kly-label">Secret API Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    readOnly
                    value={createdSecret}
                    className="kly-input kly-mono"
                    style={{ flex: 1, color: '#34d399', fontWeight: 600 }}
                  />
                  <button className="kly-btn kly-btn-primary" onClick={handleCopySecret}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="kly-input-group">
                <label className="kly-label">Key Label / Identifier</label>
                <input
                  type="text"
                  className="kly-input"
                  placeholder="e.g. Production Backend Worker"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="kly-input-group">
                <label className="kly-label">Assign to Consumer</label>
                <select className="kly-select" value={consumer} onChange={(e) => setConsumer(e.target.value)}>
                  {consumers.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.plan} Plan)</option>
                  ))}
                </select>
              </div>

              <div className="kly-input-group">
                <label className="kly-label">Target Environment</label>
                <select className="kly-select" value={env} onChange={(e) => setEnv(e.target.value as any)}>
                  <option value="production">Production (kly_live_...)</option>
                  <option value="staging">Staging (kly_test_...)</option>
                  <option value="development">Development (kly_test_...)</option>
                </select>
              </div>

              <div className="kly-input-group">
                <label className="kly-label">Assigned Permissions & Scopes</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {['read:users', 'write:generate', 'write:refunds', 'admin:keys'].map(sc => (
                    <label key={sc} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 5, fontSize: 12, cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={scopes.includes(sc)}
                        onChange={() => toggleScope(sc)}
                      />
                      <span className="kly-mono">{sc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="kly-modal-footer">
          {createdSecret ? (
            <button className="kly-btn kly-btn-primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button className="kly-btn kly-btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="kly-btn kly-btn-primary"
                disabled={!label.trim()}
                onClick={handleCreate}
              >
                Create API Key
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
