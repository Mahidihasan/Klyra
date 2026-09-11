import React from 'react';
import { ProviderProject } from '../../types/apibuild';

export const TabConsumers: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-card">
    <h4 style={{ marginBottom: 10 }}>Consumers ({project.consumersList.length || project.consumers})</h4>
    <table className="ab2-table"><thead><tr><th>Name</th><th>Plan</th><th>Status</th><th>Requests</th><th>Joined</th></tr></thead>
      <tbody>{project.consumersList.map((c) => (
        <tr key={c.id}><td>{c.name}<div style={{ fontWeight: 400, fontSize: 11 }}>{c.email}</div></td><td>{c.plan}</td><td>{c.status}</td><td>{c.requests.toLocaleString()}</td><td>{c.joinedAt}</td></tr>
      ))}</tbody></table>
    {project.consumersList.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>No consumers yet — publish to accept subscribers.</p>}
  </div>
);

export const TabKeys: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-card">
    <h4 style={{ marginBottom: 10 }}>API Keys</h4>
    <table className="ab2-table"><thead><tr><th>Label</th><th>Prefix</th><th>Consumer</th><th>Last used</th><th>Status</th></tr></thead>
      <tbody>{project.apiKeys.map((k) => (
        <tr key={k.id}><td>{k.label}</td><td className="ab2-mono">{k.prefix}...</td><td>{k.consumer}</td><td>{k.lastUsed}</td><td>{k.revoked ? 'Revoked' : 'Active'}</td></tr>
      ))}</tbody></table>
    {project.apiKeys.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Keys are issued to customers at subscribe time.</p>}
  </div>
);

export const TabUsage: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-grid2">
    <div className="ab2-card"><h4>Usage this period</h4>
      <div className="ab2-kv"><span>Total requests</span><b>{project.requestsLabel}</b></div>
      <div className="ab2-kv"><span>Success rate</span><b>{project.successRate}%</b></div>
      <div className="ab2-kv"><span>Avg latency</span><b>{project.latencyMs ? `${project.latencyMs}ms` : '-'}</b></div>
      <div className="ab2-kv"><span>Active consumers</span><b>{project.consumers.toLocaleString()}</b></div>
    </div>
    <div className="ab2-card"><h4>By plan</h4>
      {project.plans.map((p) => (<div key={p.id} className="ab2-kv"><span>{p.name}</span><b>{p.subscribers} subs</b></div>))}
    </div>
  </div>
);

export const TabLogs: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-card">
    <h4 style={{ marginBottom: 8 }}>Logs</h4>
    <div className="ab2-deploy-log" style={{ maxHeight: 260 }}>
      {project.deployment.log.map((l, i) => <div key={i}>[{new Date().toISOString().slice(11, 19)}] {l}</div>)}
      <div>[gateway] GET /users -&gt; 200 (84ms)</div>
      <div>[gateway] POST /generate -&gt; 200 (312ms)</div>
      <div>[gateway] GET /health -&gt; 200 (12ms)</div>
    </div>
  </div>
);

export const TabMonitor: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div className="ab2-grid2">
    <div className="ab2-card"><h4>Monitoring</h4>
      <div className="ab2-kv"><span>Uptime (30d)</span><b>{project.successRate}%</b></div>
      <div className="ab2-kv"><span>p50 latency</span><b>{project.latencyMs ? `${project.latencyMs}ms` : '-'}</b></div>
      <div className="ab2-kv"><span>Health check</span><b className="ab2-mono">GET {project.healthCheckPath}</b></div>
      <div className="ab2-kv"><span>Last check</span><b>{project.deployment.lastHealthCheck}</b></div>
    </div>
    <div className="ab2-card"><h4>Analytics</h4>
      <div className="ab2-kv"><span>Revenue</span><b>${project.revenue.toLocaleString()}</b></div>
      <div className="ab2-kv"><span>Top endpoint</span><b className="ab2-mono">POST /generate</b></div>
      <div className="ab2-kv"><span>Error budget</span><b>{(100 - project.successRate).toFixed(1)}% used</b></div>
    </div>
  </div>
);

export const TabSettings: React.FC<{ p: ProviderProject }> = ({ p }) => (
  <div className="ab2-grid2">
    <div className="ab2-card"><h4>Project</h4>
      <div className="ab2-kv"><span>Name</span><b>{p.name}</b></div>
      <div className="ab2-kv"><span>Slug</span><b className="ab2-mono">{p.slug}</b></div>
      <div className="ab2-kv"><span>Category</span><b>{p.category}</b></div>
      <div className="ab2-kv"><span>Visibility</span><b style={{ textTransform: 'capitalize' }}>{p.visibility}</b></div>
    </div>
    <div className="ab2-card"><h4>Gateway</h4>
      <div className="ab2-kv"><span>Gateway URL</span><b className="ab2-mono">{p.gatewayUrl}</b></div>
      <div className="ab2-kv"><span>Base URL</span><b className="ab2-mono">{p.baseUrl || '-'}</b></div>
      <div className="ab2-kv"><span>Rate limit</span><b>{p.rateLimitPerMin}/min</b></div>
    </div>
  </div>
);
