import React, { useState } from 'react';
import { Server, Rocket, RefreshCw, RotateCcw, ExternalLink, Terminal, Plus, Check } from 'lucide-react';
import { DeploymentRecord } from '../types';
import { ProviderProject } from '../../../types/apibuild';

interface TabDeploymentsProps {
  project: ProviderProject;
  deployments: DeploymentRecord[];
  onSelectDeployment: (dep: DeploymentRecord) => void;
  onTriggerRedeploy: () => void;
  onShowToast: (msg: string) => void;
}

export const TabDeployments: React.FC<TabDeploymentsProps> = ({
  project,
  deployments,
  onSelectDeployment,
  onTriggerRedeploy,
  onShowToast
}) => {
  return (
    <div className="kly-page-stack">
      {/* Header card */}
      <div className="kly-card kly-tab-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Edge Deployments & Pipeline</h3>
            <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', marginTop: 4 }}>
              Zero-downtime routing across global Klyra edge clusters.
            </p>
          </div>
          <button className="kly-btn kly-btn-primary" onClick={onTriggerRedeploy}>
            <Rocket size={13} />
            <span>Trigger New Deployment</span>
          </button>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="kly-table-wrapper">
        <table className="kly-table">
          <thead>
            <tr>
              <th>Deployment</th>
              <th>Version</th>
              <th>Environment</th>
              <th>Source</th>
              <th>Region</th>
              <th>Status</th>
              <th>Deployed</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((d) => (
              <tr
                key={d.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectDeployment(d)}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Server size={14} color="#8b5cf6" />
                    <div>
                      <div className="kly-mono" style={{ fontWeight: 600, color: '#c4b5fd' }}>{d.id}</div>
                      {d.commitMessage && <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.commitMessage}</div>}
                    </div>
                  </div>
                </td>
                <td className="kly-mono" style={{ fontWeight: 600 }}>{d.version}</td>
                <td>
                  <span className="kly-badge kly-badge-pill" style={{ textTransform: 'capitalize' }}>
                    {d.environment}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 12 }}>{d.source} {d.branch ? `(${d.branch})` : ''}</span>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: 'var(--kly-text-muted)' }}>{d.region}</span>
                </td>
                <td>
                  <span className={`kly-badge ${d.status === 'healthy' ? 'kly-badge-healthy' : d.status === 'building' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>
                    <span className={d.status === 'healthy' || d.status === 'building' ? 'kly-pulse-dot' : ''} style={{
                      background: d.status === 'healthy' ? '#10b981' : d.status === 'building' ? '#f59e0b' : '#94a3b8'
                    }} />
                    {d.status}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>{d.deployedAt}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="kly-btn kly-btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={(e) => { e.stopPropagation(); onSelectDeployment(d); }}
                  >
                    <Terminal size={12} />
                    <span>Inspect</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
