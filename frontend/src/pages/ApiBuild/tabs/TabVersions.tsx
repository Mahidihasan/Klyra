import React, { useState } from 'react';
import {
  GitBranch, Plus, ArrowRight, Check, AlertTriangle, RefreshCw,
  Layers, ShieldAlert, Sparkles
} from 'lucide-react';
import { ExtendedVersion } from '../types';
import { ProviderProject } from '../../../types/apibuild';

interface TabVersionsProps {
  project: ProviderProject;
  versions: ExtendedVersion[];
  selectedVersion: string;
  onSelectVersion: (semver: string) => void;
  onOpenMigrationModal: () => void;
  onShowToast: (msg: string) => void;
}

export const TabVersions: React.FC<TabVersionsProps> = ({
  project,
  versions,
  selectedVersion,
  onSelectVersion,
  onOpenMigrationModal,
  onShowToast
}) => {
  const [activeVerId, setActiveVerId] = useState<string>(versions[1]?.id || versions[0]?.id);

  const activeVersion = versions.find(v => v.id === activeVerId) || versions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Deprecation & Migration Notice Banner */}
      <div className="kly-alert-banner">
        <div className="kly-alert-left">
          <AlertTriangle size={18} color="#fbbf24" />
          <div>
            <b>Multi-Version Lifecycle Active</b>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              1,284 consumers are still calling deprecated <code>v2.3.0</code>. Migration workflow is ready.
            </div>
          </div>
        </div>
        <button className="kly-btn kly-btn-primary" onClick={onOpenMigrationModal} style={{ background: '#d97706', borderColor: '#f59e0b' }}>
          <GitBranch size={13} />
          <span>Start Migration</span>
        </button>
      </div>

      {/* Version Traffic Distribution Bar */}
      <div className="kly-card">
        <div className="kly-card-header">
          <div>
            <h4 className="kly-card-title">Version Traffic Distribution</h4>
            <p className="kly-card-subtitle">Real-time edge gateway routing split</p>
          </div>
        </div>

        <div style={{ height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: '74%', background: '#8b5cf6' }} title="v2.4.1 (Current): 74%" />
          <div style={{ width: '21%', background: '#f59e0b' }} title="v2.3.0 (Deprecated): 21%" />
          <div style={{ width: '5%', background: '#64748b' }} title="v1.9.0 (Legacy): 5%" />
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#8b5cf6' }} />
            <b className="kly-mono">v2.4.1 (Current)</b> — 74% (2,431 consumers)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
            <b className="kly-mono">v2.3.0 (Deprecated)</b> — 21% (1,284 consumers)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#64748b' }} />
            <b className="kly-mono">v1.9.0 (Legacy)</b> — 5% (142 consumers)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#06b6d4' }} />
            <b className="kly-mono">v3.0.0 (Beta)</b> — 0% (14 staging testers)
          </div>
        </div>
      </div>

      {/* Split Grid: Version list & Version Changelog/Detail */}
      <div className="kly-grid-split">
        {/* Left: Versions Table/Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {versions.map((v) => {
            const isSelected = activeVerId === v.id;
            return (
              <div
                key={v.id}
                className="kly-card"
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--kly-primary)' : 'var(--kly-border-subtle)',
                  background: isSelected ? 'rgba(139,92,246,0.06)' : 'var(--kly-bg-surface)'
                }}
                onClick={() => setActiveVerId(v.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="kly-mono" style={{ fontSize: 15, fontWeight: 700, color: isSelected ? '#c4b5fd' : 'var(--kly-text-main)' }}>
                      {v.semver}
                    </span>
                    <span className={`kly-badge ${v.status === 'Current' ? 'kly-badge-healthy' : v.status === 'Beta' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>
                      {v.status}
                    </span>
                    {v.isDefault && <span className="kly-badge kly-badge-pill" style={{ color: '#c4b5fd' }}>Default</span>}
                  </div>

                  <span style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>
                    Released {v.releasedAt.slice(0, 10)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--kly-text-muted)' }}>
                  <span><b>{v.endpointsCount}</b> endpoints</span>
                  <span><b>{v.consumersCount}</b> consumers</span>
                  <span><b>{v.successRate}%</b> success</span>
                  <span><b>{v.avgLatencyMs}ms</b> latency</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Version Changelog & Inspector */}
        <div className="kly-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="kly-mono" style={{ fontSize: 18, fontWeight: 700 }}>{activeVersion.semver}</h3>
                <span className="kly-badge kly-badge-pill">{activeVersion.status}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--kly-text-dim)', marginTop: 2 }}>
                Released on {activeVersion.releasedAt.slice(0, 10)} · {activeVersion.endpointsCount} active routes
              </p>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="kly-btn kly-btn-secondary"
                onClick={() => {
                  onSelectVersion(activeVersion.semver);
                  onShowToast(`Switched active context to ${activeVersion.semver}`);
                }}
              >
                <span>Set as View Context</span>
              </button>
            </div>
          </div>

          {/* Changelog Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeVersion.changelog.added.length > 0 && (
              <div>
                <h5 style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 4 }}>
                  + Added Endpoints & Features
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  {activeVersion.changelog.added.map((item, i) => (
                    <div key={i} className="kly-mono" style={{ color: 'var(--kly-text-muted)' }}>• {item}</div>
                  ))}
                </div>
              </div>
            )}

            {activeVersion.changelog.modified.length > 0 && (
              <div>
                <h5 style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 4 }}>
                  ~ Modified Improvements
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  {activeVersion.changelog.modified.map((item, i) => (
                    <div key={i} className="kly-mono" style={{ color: 'var(--kly-text-muted)' }}>• {item}</div>
                  ))}
                </div>
              </div>
            )}

            {activeVersion.changelog.breaking.length > 0 && (
              <div style={{ padding: '8px 12px', background: 'rgba(244,63,94,0.1)', borderRadius: 6, border: '1px solid rgba(244,63,94,0.25)' }}>
                <h5 style={{ fontSize: 11, fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', marginBottom: 4 }}>
                  ⚠️ Breaking Changes
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  {activeVersion.changelog.breaking.map((item, i) => (
                    <div key={i} style={{ color: '#fecdd3' }}>• {item}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
