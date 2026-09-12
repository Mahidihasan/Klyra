import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Container, Github, Globe2, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { ApiSourceKind, SourceConfig } from '../../types/apibuild';
import { Alert, Field } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

const STEPS = ['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish'];
export const StepSource: React.FC<{ init: SourceConfig; busy: boolean; onNext: (v: SourceConfig) => void; onBack: () => void }> = ({ init, busy, onNext, onBack }) => {
  const [kind, setKind] = useState<ApiSourceKind>(init.kind);
  const [value, setValue] = useState<SourceConfig>(init);
  const [error, setError] = useState('');
  const continueSetup = () => {
    if (kind === 'existing' && !value.baseUrl?.trim()) return setError('Enter the upstream API base URL.');
    if (kind === 'github' && !value.repository?.trim()) return setError('Choose a repository to deploy.');
    if (kind === 'docker' && !value.dockerImage?.trim()) return setError('Enter a container image reference.');
    onNext({ ...value, kind });
  };
  const choices: { id: ApiSourceKind; title: string; description: string; Icon: typeof Globe2 }[] = [
    { id: 'existing', title: 'Connect an existing API', description: 'Proxy any HTTPS origin: AWS, GCP, Azure, Render, Railway, Vercel, a VPS, or a private network.', Icon: Globe2 },
    { id: 'github', title: 'Deploy from GitHub', description: 'Build from a repository with branch-aware releases, environment settings, and repeatable delivery.', Icon: Github },
    { id: 'docker', title: 'Deploy a container', description: 'Run an OCI image from Docker Hub, GHCR, ECR, GCR, or a private registry.', Icon: Container },
  ];
  return <WizardChrome step={1} total={8} labels={STEPS}>
    <div className="ab2-wiz-head"><div><span className="ab2-eyebrow"><Zap size={11} /> Provider connection</span><h2>How will you provide this API?</h2><p>Every provider receives the same gateway, live discovery, observability, versioning, and marketplace controls.</p></div></div>
    <div className="ab2-source-grid">{choices.map(({ id, title, description, Icon }) => <button key={id} className={`ab2-source ${kind === id ? 'active' : ''}`} onClick={() => { setKind(id); setError(''); }}><Icon size={20} color="#a78bfa" /><h4>{title}</h4><p>{description}</p></button>)}</div>
    {kind === 'existing' && <><Field label="API base URL" hint="HTTPS is recommended. Klyra checks reachability before creating a gateway route."><input value={value.baseUrl || ''} onChange={(e) => setValue({ ...value, baseUrl: e.target.value })} placeholder="https://api.example.com" /></Field><Field label="OpenAPI or Swagger URL (optional)" hint="If omitted, Klyra checks common specification locations automatically."><input value={value.openApiUrl || ''} onChange={(e) => setValue({ ...value, openApiUrl: e.target.value })} placeholder="https://api.example.com/openapi.json" /></Field><Field label="Upstream authentication"><select value={value.upstreamAuth || 'Bearer Token'} onChange={(e) => setValue({ ...value, upstreamAuth: e.target.value })}><option>Bearer Token</option><option>API Key</option><option>OAuth 2.0</option><option>mTLS</option><option>None</option></select></Field></>}
    {kind === 'github' && <><Field label="GitHub repository"><input value={value.repository || ''} onChange={(e) => setValue({ ...value, repository: e.target.value })} placeholder="organization/service-api" /></Field><Field label="Deployment branch"><input value={value.branch || 'main'} onChange={(e) => setValue({ ...value, branch: e.target.value })} placeholder="main" /></Field><Alert kind="info"><ShieldCheck size={13} /> Klyra will inspect runtime files, build settings, and available API specifications once the repository is connected.</Alert></>}
    {kind === 'docker' && <><Field label="Container image"><input value={value.dockerImage || ''} onChange={(e) => setValue({ ...value, dockerImage: e.target.value })} placeholder="ghcr.io/organization/service-api:latest" /></Field><div className="ab2-grid2"><Field label="Exposed port"><input type="number" value={value.dockerPort || 8080} onChange={(e) => setValue({ ...value, dockerPort: Number(e.target.value) })} /></Field><Field label="OpenAPI URL (optional)"><input value={value.openApiUrl || ''} onChange={(e) => setValue({ ...value, openApiUrl: e.target.value })} placeholder="https://api.example.com/openapi.json" /></Field></div></>}
    {error && <Alert kind="err">{error}</Alert>}
    <footer className="ab2-foot"><button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button><button className="ab2-primary" onClick={continueSetup} disabled={busy}>{busy ? <><Loader2 size={14} className="ab2-spin" /> Connecting…</> : <>Continue to discovery <ArrowRight size={14} /></>}</button></footer>
  </WizardChrome>;
};
