import React from 'react';
import { ProviderProject } from '../../types/apibuild';
import { StatusDot } from './bits';

export const TabDeployments: React.FC<{ project: ProviderProject; onTest: () => void }> = ({ project, onTest }) => {
  const d = project.deployment;
  const external = d.kind === 'external';
  return (
    <div className="ab2-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4>{external ? 'External API' : 'Klyra Deployment'}</h4>
        {external ? <StatusDot status="healthy" /> : <StatusDot status={project.status} />}
      </div>
      <div className="ab2-kv"><span>Provider URL</span><b className="ab2-mono">{d.providerUrl || '-'}</b></div>
      <div className="ab2-kv"><span>Environment</span><b style={{ textTransform: 'capitalize' }}>{d.environment}</b></div>
      <div className="ab2-kv"><span>Version</span><b className="ab2-mono">{d.version}</b></div>
      <div className="ab2-kv"><span>Last health check</span><b>{d.lastHealthCheck}</b></div>
      <div className="ab2-deploy-log" style={{ marginTop: 10 }}>{d.log.map((l, i) => <div key={i}>$ {l}</div>)}</div>
      <div style={{ marginTop: 10 }}><button className="ab2-ghost" onClick={onTest}>Test Connection</button></div>
    </div>
  );
};

export const TabVersions: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-card">
    <h4 style={{ marginBottom: 10 }}>Versions</h4>
    <table className="ab2-table"><thead><tr><th>Version</th><th>Status</th><th>Notes</th><th>Endpoints</th><th>Created</th></tr></thead>
      <tbody>{project.versions.map((v) => (
        <tr key={v.id}><td className="ab2-mono">{v.semver}</td><td>{v.status}</td><td>{v.notes}</td><td>{v.endpoints}</td><td>{v.createdAt.slice(0, 10)}</td></tr>
      ))}</tbody></table>
  </div>
);

export const TabPlans: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-grid3">
    {project.plans.map((p) => (
      <div key={p.id} className="ab2-card"><h4>{p.name}</h4>
        <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0' }}>${p.priceMonthly}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/mo</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.requestsPerMonth.toLocaleString()} req/mo</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{p.rateLimitPerMin}/min · {p.trialDays}d trial · {p.subscribers} subs</div>
      </div>
    ))}
  </div>
);
