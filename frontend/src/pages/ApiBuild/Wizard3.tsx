import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Upload, Link2, Pencil, Loader2 } from 'lucide-react';
import { DetectionResult } from '../../types/apibuild';
import { Alert, MethodBadge, Skeleton } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

export const StepDetect: React.FC<{
  loading: boolean; detection: DetectionResult | null;
  manualMode: boolean; setManualMode: (v: boolean) => void;
  onNext: () => void; onBack: () => void; onRetry: () => void;
}> = ({ loading, detection, manualMode, setManualMode, onNext, onBack, onRetry }) => (
  <WizardChrome step={2} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
    {loading && (<>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Detecting API specification...</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>Fetching OpenAPI, counting endpoints and schemas.</p>
      <Skeleton h={18} /><div style={{ height: 8 }} /><Skeleton h={18} /><div style={{ height: 8 }} /><Skeleton h={90} />
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}><Loader2 size={13} className="ab2-spin" /> Contacting upstream (simulated)...</p>
    </>)}
    {!loading && detection?.found && (<>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>API Detected</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Everything below was read from your specification.</p>
      <div className="ab2-grid4" style={{ marginBottom: 14 }}>
        {[`✓ ${detection.openApiVersion}`, `✓ ${detection.endpointCount} endpoints`, `✓ ${detection.schemaCount} schemas`, `✓ ${detection.authKind}`].map((t) => (
          <div key={t} className="ab2-card" style={{ padding: 12, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={14} color="#22c55e" />{t}</div>
        ))}
      </div>
      <div className="ab2-kv"><span>Base URL</span><b className="ab2-mono">{detection.baseUrl}</b></div>
      <h4 style={{ fontSize: 13, margin: '14px 0 8px' }}>Detected endpoints</h4>
      {detection.endpoints.map((e) => (
        <div key={e.id} className="ab2-ep"><MethodBadge method={e.method} /><span className="ab2-mono">{e.path}</span><span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{e.description}</span></div>
      ))}
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <div style={{ display: 'flex', gap: 8 }}><button className="ab2-ghost" onClick={onRetry}>Scan again</button><button className="ab2-primary" onClick={onNext}>Continue <ArrowRight size={14} /></button></div>
      </div>
    </>)}
    {!loading && detection && !detection.found && (
      manualMode ? (<>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Configure endpoints manually</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Base URL: <span className="ab2-mono">{detection.baseUrl}</span>. Add the routes Klyra should expose — the gateway config accepts this shape today.</p>
        <Alert kind="info">Manual mode keeps the same project model: method + path rows below become your API surface.</Alert>
        {[['GET', '/users'], ['POST', '/users'], ['GET', '/health']].map(([m, p]) => (
          <div key={p + m} className="ab2-ep"><MethodBadge method={m} /><span className="ab2-mono">{p}</span></div>
        ))}
        <div className="ab2-foot">
          <button className="ab2-ghost" onClick={() => setManualMode(false)}><ArrowLeft size={14} /> Back</button>
          <button className="ab2-primary" onClick={onNext}>Continue <ArrowRight size={14} /></button>
        </div>
      </>) : (<>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>API specification not found</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>Klyra couldn't automatically detect an API specification at <span className="ab2-mono">{detection.baseUrl}</span>.</p>
        <Alert kind="warn">Connection error handling: verify the URL is reachable, or continue manually. Nothing is deployed yet.</Alert>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ab2-ghost" onClick={onNext}><Upload size={14} /> Upload OpenAPI</button>
          <button className="ab2-ghost" onClick={onBack}><Link2 size={14} /> Enter URL</button>
          <button className="ab2-primary" onClick={() => setManualMode(true)}><Pencil size={14} /> Configure Manually</button>
        </div>
      </>)
    )}
  </WizardChrome>
);
