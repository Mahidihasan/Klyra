import React, { useState } from 'react';
import { X, GitBranch, ArrowRight, Check, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { ExtendedVersion } from '../types';

interface VersionMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ExtendedVersion[];
  onExecuteMigration: (fromSemver: string, toSemver: string) => void;
  onShowToast: (msg: string) => void;
}

export const VersionMigrationModal: React.FC<VersionMigrationModalProps> = ({
  isOpen,
  onClose,
  versions,
  onExecuteMigration,
  onShowToast
}) => {
  const [fromVer, setFromVer] = useState('v2.3.0');
  const [toVer, setToVer] = useState('v2.4.1');
  const [strategy, setStrategy] = useState<'gradual' | 'immediate'>('gradual');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  if (!isOpen) return null;

  const handleStart = () => {
    setIsMigrating(true);
    setTimeout(() => {
      setIsMigrating(false);
      onExecuteMigration(fromVer, toVer);
      onShowToast(`Migration scheduled: 1,284 consumers moving from ${fromVer} to ${toVer}`);
      onClose();
    }, 1500);
  };

  return (
    <div className="kly-modal-overlay" onClick={onClose}>
      <div className="kly-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="kly-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={16} color="#fbbf24" />
            <h3 style={{ fontSize: 15 }}>Migrate Consumers Between Versions</h3>
          </div>
          <button className="kly-btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="kly-modal-body">
          <div className="kly-alert-banner">
            <AlertTriangle size={16} />
            <span>1,284 consumers are currently routing to deprecated version <b>{fromVer}</b>.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
            <div className="kly-input-group">
              <label className="kly-label">Source (Old Version)</label>
              <select className="kly-select kly-mono" value={fromVer} onChange={(e) => setFromVer(e.target.value)}>
                {versions.map(v => (
                  <option key={v.id} value={v.semver}>{v.semver} ({v.status})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
              <ArrowRight size={18} color="var(--kly-primary)" />
            </div>

            <div className="kly-input-group">
              <label className="kly-label">Destination (Target)</label>
              <select className="kly-select kly-mono" value={toVer} onChange={(e) => setToVer(e.target.value)}>
                {versions.map(v => (
                  <option key={v.id} value={v.semver}>{v.semver} ({v.status})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="kly-input-group">
            <label className="kly-label">Migration Policy</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                background: strategy === 'gradual' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${strategy === 'gradual' ? 'var(--kly-border-violet)' : 'var(--kly-border-subtle)'}`,
                borderRadius: 6, cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'gradual'}
                  onChange={() => setStrategy('gradual')}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <b style={{ fontSize: 13, display: 'block' }}>Dual-Header Soft Deprecation (Recommended)</b>
                  <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
                    Inject <code>Sunset: Dec 2026</code> and <code>Deprecation: true</code> HTTP response headers with 30-day grace period.
                  </span>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                background: strategy === 'immediate' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${strategy === 'immediate' ? 'var(--kly-border-violet)' : 'var(--kly-border-subtle)'}`,
                borderRadius: 6, cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'immediate'}
                  onChange={() => setStrategy('immediate')}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <b style={{ fontSize: 13, display: 'block' }}>Immediate Route Rewiring</b>
                  <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
                    Instantly rewrite gateway upstream ingress pointers to {toVer}.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
            />
            <span>Send automated migration guide email to all 1,284 affected developer accounts</span>
          </label>
        </div>

        <div className="kly-modal-footer">
          <button className="kly-btn kly-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="kly-btn kly-btn-primary" disabled={isMigrating} onClick={handleStart}>
            {isMigrating ? <RefreshCw size={13} className="spin-icon" /> : <Send size={13} />}
            <span>{isMigrating ? 'Scheduling...' : 'Start Migration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
