import React from 'react';
import { ArrowLeft, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { ProviderProject } from '../../types/apibuild';
import { Alert } from './bits';
import { StatusDot } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

const PHASES = ['Queued', 'Building', 'Deploying', 'Healthy'];

export const StepDeploy: React.FC<{
  project: ProviderProject; phase: number; failed: boolean;
  onTest: () => void; onNext: () => void; onBack: () => void;
}> = ({ project, phase, failed, onTest, onNext, onBack }) => {
  const d = project.deployment;
  const external = d.kind === 'external';
  return (
    <WizardChrome step={4} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Deployment</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        {external ? 'Your API stays where it is — Klyra fronts it with a managed gateway.' : 'Simulated Klyra deployment pipeline (frontend only).'}
      </p>
      {failed ? <Alert kind="err">Deployment failed — upstream image not found (simulated). Fix the source and retry.</Alert>
        : external ? <Alert kind="ok">External API connected. Gateway health checks are passing.</Alert>
        : <Alert kind="info">Deploying API... phase {Math.min(phase + 1, 4)} of 4.</Alert>}
      <div className="ab2-card" style={{ background: 'var(--bg-input)', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <b>{external ? 'External API' : 'Klyra Deployment'}</b>
          {external ? <StatusDot status="healthy" /> : failed ? <StatusDot status="failed" /> : <StatusDot status="deploying" />}
        </div>
        <div className="ab2-kv"><span>{external ? 'Provider URL' : 'Source'}</span><b className="ab2-mono">{external ? d.providerUrl : `${d.source || 'GitHub'} · ${d.branch || 'main'}`}</b></div>
        <div className="ab2-kv"><span>Environment</span><b style={{ textTransform: 'capitalize' }}>{d.environment}</b></div>
        <div className="ab2-kv"><span>Version</span><b className="ab2-mono">{d.version}</b></div>
        <div className="ab2-kv"><span>Last health check</span><b>{d.lastHealthCheck}</b></div>
        {!external && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>{PHASES.map((p, i) => (
            <span key={p} className="ab2-pill" style={{ opacity: i <= phase ? 1 : 0.45, borderColor: i <= phase ? '#8b5cf6' : undefined, display: 'flex', gap: 6, alignItems: 'center' }}>
              {i < phase ? '✓ ' : i === phase && !failed ? (<Loader2 size={11} className="ab2-spin" />) : null}{p}
            </span>
          ))}</div>
        )}
      </div>
      <div className="ab2-deploy-log">{d.log.map((l, i) => <div key={i}>$ {l}</div>)}</div>
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {external && <button className="ab2-ghost" onClick={onTest}><RefreshCw size={14} /> Test Connection</button>}
          <button className="ab2-primary" onClick={onNext}>Continue <ArrowRight size={14} /></button>
        </div>
      </div>
    </WizardChrome>
  );
};
