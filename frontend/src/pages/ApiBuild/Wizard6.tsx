import React from 'react';
import { ArrowLeft, ArrowRight, FlaskConical, Copy, Check } from 'lucide-react';
import { ProviderProject } from '../../types/apibuild';
import { StatusDot } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

export const StepProduct: React.FC<{
  project: ProviderProject; onNext: () => void; onBack: () => void; onPlayground: () => void;
}> = ({ project, onNext, onBack, onPlayground }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(project.gatewayUrl); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  return (
    <WizardChrome step={5} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>API Product</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>This is what customers subscribe to through Klyra API keys.</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <b style={{ fontSize: 16 }}>{project.name}</b><StatusDot status="deploying" />
      </div>
      <div className="ab2-grid4" style={{ marginBottom: 12 }}>
        {[['Endpoints', String(project.endpointCount || project.detection?.endpointCount || 0)], ['Version', project.version], ['Auth', 'Klyra API Key'], ['Status', 'Ready to publish']].map(([k, v]) => (
          <div key={k} className="ab2-card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</div><b>{v}</b></div>
        ))}
      </div>
      <div className="ab2-kv"><span>Gateway URL</span><b className="ab2-mono">{project.gatewayUrl}</b></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="ab2-ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy URL'}</button>
        <button className="ab2-ghost" onClick={onPlayground}><FlaskConical size={14} /> Open Playground</button>
      </div>
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ab2-primary" onClick={onNext}>Configure Pricing <ArrowRight size={14} /></button>
      </div>
    </WizardChrome>
  );
};
