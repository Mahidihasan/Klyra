import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Network, ShieldCheck, Timer } from 'lucide-react';
import { AuthKind, ConfigureInput, ProjectEnvironment, ProviderProject } from '../../types/apibuild';
import { Field } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

export const StepConfigure: React.FC<{
  project: ProviderProject;
  onNext: (v: ConfigureInput) => void; onBack: () => void;
}> = ({ project, onNext, onBack }) => {
  const [v, setV] = useState<ConfigureInput>({
    apiName: project.name, version: project.version, baseUrl: project.baseUrl || project.deployment.providerUrl,
    authKind: project.authKind, rateLimitPerMin: project.rateLimitPerMin,
    healthCheckPath: project.healthCheckPath, environment: project.environment,
    corsOrigins: project.corsOrigins || '*', cacheTtlSeconds: project.cacheTtlSeconds || 0,
    retryStrategy: project.retryStrategy || 'Exponential backoff (3 attempts)',
    connectTimeoutMs: project.connectTimeoutMs || 5000, requestTimeoutMs: project.requestTimeoutMs || 30000,
    stripBasePath: project.stripBasePath || false, authHeaderName: project.authHeaderName || 'Authorization',
    tags: project.tags || project.category,
  });
  const auths: { id: AuthKind; label: string }[] = [
    { id: 'bearer', label: 'Bearer' }, { id: 'apiKey', label: 'API Key' }, { id: 'oauth2', label: 'OAuth 2.0' }, { id: 'none', label: 'None' },
  ];
  const envs: ProjectEnvironment[] = ['development', 'staging', 'production'];
  return (
    <WizardChrome step={3} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
      <div className="ab2-wiz-head"><div><span className="ab2-eyebrow"><Network size={11} /> Gateway configuration</span><h2>Configure API gateway</h2><p>Set the contract, resilience, and security controls Klyra will enforce between consumers and your upstream.</p></div></div>
      <div className="ab2-grid2">
        <Field label="API Name"><input value={v.apiName} onChange={(e) => setV({ ...v, apiName: e.target.value })} /></Field>
        <Field label="Version"><input value={v.version} onChange={(e) => setV({ ...v, version: e.target.value })} placeholder="v1.0.0" /></Field>
      </div>
      <Field label="Upstream base URL" hint="The origin Klyra will route requests to."><input value={v.baseUrl} onChange={(e) => setV({ ...v, baseUrl: e.target.value })} /></Field>
      <section className="ab2-config-section"><div className="ab2-config-section-title"><ShieldCheck size={14} /> Security & access</div><Field label="Consumer authentication" hint="Required by the Klyra gateway before traffic reaches your API."><div className="ab2-auth-row">{auths.map((a) => (
        <button key={a.id} type="button" className={`ab2-auth ${v.authKind === a.id ? 'active' : ''}`} onClick={() => setV({ ...v, authKind: a.id })}>{a.label}</button>
      ))}</div></Field><div className="ab2-grid2"><Field label="Authentication header"><input value={v.authHeaderName} onChange={(e) => setV({ ...v, authHeaderName: e.target.value })} /></Field><Field label="CORS allowed origins"><input value={v.corsOrigins} onChange={(e) => setV({ ...v, corsOrigins: e.target.value })} placeholder="https://app.example.com" /></Field></div></section>
      <section className="ab2-config-section"><div className="ab2-config-section-title"><Timer size={14} /> Reliability & performance</div>
      <div className="ab2-grid2">
        <Field label="Rate limit (requests/minute)"><input type="number" value={v.rateLimitPerMin} onChange={(e) => setV({ ...v, rateLimitPerMin: Number(e.target.value) })} /></Field>
        <Field label="Health check path"><input value={v.healthCheckPath} onChange={(e) => setV({ ...v, healthCheckPath: e.target.value })} placeholder="GET /health" /></Field>
        <Field label="Connection timeout (ms)"><input type="number" value={v.connectTimeoutMs} onChange={(e) => setV({ ...v, connectTimeoutMs: Number(e.target.value) })} /></Field>
        <Field label="Request timeout (ms)"><input type="number" value={v.requestTimeoutMs} onChange={(e) => setV({ ...v, requestTimeoutMs: Number(e.target.value) })} /></Field>
        <Field label="Retry policy"><select value={v.retryStrategy} onChange={(e) => setV({ ...v, retryStrategy: e.target.value })}><option>None</option><option>Exponential backoff (3 attempts)</option><option>Exponential backoff (5 attempts)</option></select></Field>
        <Field label="Cache TTL (seconds)"><input type="number" min="0" value={v.cacheTtlSeconds} onChange={(e) => setV({ ...v, cacheTtlSeconds: Number(e.target.value) })} /></Field>
      </div></section>
      <Field label="Environment"><div className="ab2-env-row">{envs.map((e) => (
        <button key={e} type="button" className={`ab2-chip ${v.environment === e ? 'active' : ''}`} onClick={() => setV({ ...v, environment: e })}>{e[0].toUpperCase() + e.slice(1)}</button>
      ))}</div></Field>
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ab2-primary" onClick={() => onNext(v)}>Save Configuration <ArrowRight size={14} /></button>
      </div>
    </WizardChrome>
  );
};
