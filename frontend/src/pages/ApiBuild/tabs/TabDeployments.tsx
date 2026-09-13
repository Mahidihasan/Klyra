import React, { useMemo, useState } from 'react';
import { Server, Rocket, Terminal, Activity, CheckCircle2, Clock3, AlertTriangle, Filter } from 'lucide-react';
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
  const [environment, setEnvironment] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const filteredDeployments = useMemo(() => deployments.filter((deployment) => (
    (environment === 'ALL' || deployment.environment === environment) &&
    (status === 'ALL' || deployment.status === status)
  )), [deployments, environment, status]);
  const healthyCount = deployments.filter((deployment) => deployment.status === 'healthy').length;
  const activeCount = deployments.filter((deployment) => deployment.status === 'building').length;

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

      <div className="kly-ops-summary">
        <div><span><CheckCircle2 size={13} /> Healthy releases</span><strong>{healthyCount}</strong><small>Ready to serve traffic</small></div>
        <div><span><Activity size={13} /> In progress</span><strong>{activeCount}</strong><small>Tracked by release pipeline</small></div>
        <div><span><Server size={13} /> Edge coverage</span><strong>42</strong><small>Global locations online</small></div>
        <div><span><Clock3 size={13} /> Last verification</span><strong>2m ago</strong><small>Automated health check</small></div>
      </div>

      {/* Deployments Table */}
      <div className="kly-table-wrapper">
        <div className="kly-table-toolbar">
          <div className="kly-table-toolbar-title"><Filter size={14} /><strong>Release history</strong><span>{filteredDeployments.length} of {deployments.length} releases</span></div>
          <div className="kly-table-toolbar-controls">
            <select className="kly-select kly-select-compact" aria-label="Filter deployment environment" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="ALL">All environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
            <select className="kly-select kly-select-compact" aria-label="Filter deployment status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="building">Building</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
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
            {filteredDeployments.map((d) => (
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
            {!filteredDeployments.length && <tr><td colSpan={8} className="kly-empty-state"><AlertTriangle size={18} /><span>No deployments match these filters.</span><button className="kly-btn kly-btn-ghost" onClick={() => { setEnvironment('ALL'); setStatus('ALL'); }}>Clear filters</button></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
