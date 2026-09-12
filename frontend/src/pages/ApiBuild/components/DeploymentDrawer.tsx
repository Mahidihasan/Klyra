import React, { useState } from 'react';
import { X, RefreshCw, RotateCcw, Eye, EyeOff, Plus, Check, Terminal, ExternalLink } from 'lucide-react';
import { DeploymentRecord } from '../types';

interface DeploymentDrawerProps {
  deployment: DeploymentRecord | null;
  onClose: () => void;
  onRedeploy: (dep: DeploymentRecord) => void;
  onRollback: (dep: DeploymentRecord) => void;
  onShowToast: (msg: string) => void;
}

export const DeploymentDrawer: React.FC<DeploymentDrawerProps> = ({
  deployment,
  onClose,
  onRedeploy,
  onRollback,
  onShowToast
}) => {
  const [showSecrets, setShowSecrets] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'env' | 'overview'>('logs');

  if (!deployment) return null;

  return (
    <div className="kly-drawer-overlay" onClick={onClose}>
      <div className="kly-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--kly-border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="kly-mono" style={{ fontSize: 16, fontWeight: 700, color: '#c4b5fd' }}>
                Deployment {deployment.id}
              </span>
              <span className={`kly-badge ${deployment.status === 'healthy' ? 'kly-badge-healthy' : 'kly-badge-deploying'}`}>
                {deployment.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--kly-text-dim)', marginTop: 4 }}>
              {deployment.environment} · {deployment.version} · {deployment.region} · {deployment.deployedAt}
            </div>
          </div>
          <button className="kly-btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Action Bar */}
        <div style={{
          padding: '10px 20px', background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--kly-border-subtle)', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <button className="kly-btn kly-btn-primary" onClick={() => onRedeploy(deployment)}>
            <RefreshCw size={13} />
            <span>Redeploy</span>
          </button>
          <button className="kly-btn kly-btn-secondary" onClick={() => onRollback(deployment)}>
            <RotateCcw size={13} color="#f59e0b" />
            <span>Rollback</span>
          </button>
          <a
            href={deployment.url}
            target="_blank"
            rel="noreferrer"
            className="kly-btn kly-btn-ghost"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink size={13} />
            <span>Open Target URL</span>
          </a>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--kly-border-subtle)', padding: '0 20px' }}>
          {(['logs', 'env', 'overview'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: activeTab === t ? '2px solid var(--kly-primary)' : '2px solid transparent',
                color: activeTab === t ? 'var(--kly-text-main)' : 'var(--kly-text-dim)',
                padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t === 'logs' ? 'Build & Runtime Logs' : t === 'env' ? 'Environment Variables' : 'Overview & Metadata'}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--kly-text-muted)' }}>Real-time Gateway / Pipeline Stream</span>
                <span style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="kly-pulse-dot" /> Live
                </span>
              </div>
              <div className="kly-terminal">
                {deployment.logs.map((log, i) => (
                  <div key={i} className="kly-log-row">
                    <span className="kly-log-time">[{new Date(Date.now() - (deployment.logs.length - i) * 3000).toISOString().slice(11, 19)}]</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 13 }}>Runtime Variables</h4>
                  <p style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>Encrypted at rest using AES-256 GCM.</p>
                </div>
                <button
                  className="kly-btn kly-btn-secondary"
                  onClick={() => setShowSecrets(!showSecrets)}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>{showSecrets ? 'Hide Secrets' : 'Reveal Secrets'}</span>
                </button>
              </div>

              {deployment.envVars.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--kly-text-dim)', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                  No environment variables configured for this deployment.
                </div>
              ) : (
                <table className="kly-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployment.envVars.map((e, i) => (
                      <tr key={i}>
                        <td className="kly-mono" style={{ color: '#c4b5fd', fontWeight: 600 }}>{e.key}</td>
                        <td className="kly-mono" style={{ fontSize: 11 }}>
                          {e.isSecret && !showSecrets ? '••••••••••••••••' : e.value}
                        </td>
                        <td>
                          <span className={`kly-badge ${e.isSecret ? 'kly-badge-pill' : ''}`}>
                            {e.isSecret ? 'Secret' : 'Plain'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="kly-card">
                <h4 style={{ fontSize: 13, marginBottom: 10 }}>Metadata</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Upstream Target URL</span>
                    <b className="kly-mono">{deployment.url}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Source</span>
                    <b>{deployment.source} {deployment.branch ? `(${deployment.branch})` : ''}</b>
                  </div>
                  {deployment.commitHash && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kly-text-dim)' }}>Git Commit</span>
                      <b className="kly-mono">{deployment.commitHash}</b>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Deployed By</span>
                    <b>{deployment.author}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kly-text-dim)' }}>Duration</span>
                    <b>{deployment.durationSec}s</b>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
