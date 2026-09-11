import React from 'react';
import { FlaskConical } from 'lucide-react';
import { ProviderProject } from '../../types/apibuild';
import { Alert, MethodBadge } from './bits';

export const TabOverview: React.FC<{ project: ProviderProject }> = ({ project }) => (
  <div>
    <div className="ab2-metric-grid">
      {[['Requests', project.requestsLabel.split(' ')[0]], ['Success', `${project.successRate}%`], ['Latency', project.latencyMs ? `${project.latencyMs}ms` : '-'], ['Consumers', String(project.consumers)], ['Revenue', `$${project.revenue}`]].map(([k, v]) => (
        <div key={k} className="ab2-card ab2-metric"><span>{k}</span><b>{v}</b></div>
      ))}
    </div>
    <div className="ab2-grid2">
      <div className="ab2-card"><h4 style={{ marginBottom: 8 }}>Deployment</h4>
        <div className="ab2-kv"><span>Kind</span><b>{project.deployment.kind}</b></div>
        <div className="ab2-kv"><span>URL</span><b className="ab2-mono">{project.deployment.providerUrl || '-'}</b></div>
        <div className="ab2-kv"><span>Health</span><b>{project.deployment.lastHealthCheck}</b></div>
      </div>
      <div className="ab2-card"><h4 style={{ marginBottom: 8 }}>Activity</h4>
        {project.activity.slice(0, 5).map((a) => (<div key={a.id} className="ab2-kv"><span>{a.label}</span><b>{a.at}</b></div>))}
      </div>
    </div>
  </div>
);

export const TabApi: React.FC<{ project: ProviderProject; onPlayground: () => void }> = ({ project, onPlayground }) => (
  <div>
    {!project.detection?.found && <Alert kind="warn">No API specification — configure manually or upload OpenAPI.</Alert>}
    <div className="ab2-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <h4>Endpoints ({project.detection?.endpoints.length || 0})</h4>
        <button className="ab2-ghost" onClick={onPlayground}><FlaskConical size={13} /> Playground</button>
      </div>
      {(project.detection?.endpoints || []).map((e) => (
        <div key={e.id} className="ab2-ep"><MethodBadge method={e.method} /><span className="ab2-mono">{e.path}</span></div>
      ))}
    </div>
  </div>
);
