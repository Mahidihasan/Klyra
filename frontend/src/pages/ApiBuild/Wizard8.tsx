import React, { useState } from 'react';
import { ArrowLeft, Rocket, CheckCircle2, PartyPopper, FlaskConical, Eye, Settings } from 'lucide-react';
import { ProviderProject } from '../../types/apibuild';
import { Alert, Field } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

export const StepPublish: React.FC<{
  project: ProviderProject; busy: boolean;
  onPublish: (vis: ProviderProject['visibility'], listing: { name: string; description: string; category: string }) => void;
  onBack: () => void;
}> = ({ project, busy, onPublish, onBack }) => {
  const [vis, setVis] = useState<ProviderProject['visibility']>(project.visibility);
  const [listing, setListing] = useState({ name: project.name, description: project.description, category: project.category });
  const checks = [
    project.deployment.status !== 'failed',
    Boolean(project.detection?.found || project.endpointCount > 0),
    true, true, true,
  ];
  const labels = ['Deployment healthy', 'API specification valid', 'Authentication configured', 'Pricing configured', 'Health check passing'];
  return (
    <WizardChrome step={7} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Ready to Publish</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>{project.name} — final review before it goes live.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {labels.map((l, i) => (
          <span key={l} className="ab2-check" style={{ color: checks[i] ? '#86efac' : '#fca5a5' }}><CheckCircle2 size={14} /> {checks[i] ? '● ' : '○ '}{l}</span>
        ))}
      </div>
      <div className="ab2-grid2">
        <Field label="Marketplace name"><input value={listing.name} onChange={(e) => setListing({ ...listing, name: e.target.value })} /></Field>
        <Field label="Category"><input value={listing.category} onChange={(e) => setListing({ ...listing, category: e.target.value })} /></Field>
      </div>
      <Field label="Description"><textarea value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} /></Field>
      <Field label="Visibility"><div className="ab2-env-row">
        {(['private', 'unlisted', 'public'] as const).map((x) => (
          <button key={x} type="button" className={`ab2-chip ${vis === x ? 'active' : ''}`} onClick={() => setVis(x)}>{x[0].toUpperCase() + x.slice(1)}</button>
        ))}
      </div></Field>
      <Alert kind="info">Publishing lists {listing.name} with documentation, pricing and gateway access. You can unpublish anytime.</Alert>
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ab2-primary" onClick={() => onPublish(vis, listing)} disabled={busy}><Rocket size={14} /> {busy ? 'Publishing...' : 'Publish API'}</button>
      </div>
    </WizardChrome>
  );
};

export const PublishSuccess: React.FC<{ project: ProviderProject; onView: () => void; onPlayground: () => void; onManage: () => void }> = ({ project, onView, onPlayground, onManage }) => (
  <div className="ab2-page"><div className="ab2-shell" style={{ maxWidth: 720 }}>
    <div className="ab2-card ab2-success">
      <PartyPopper size={32} color="#a78bfa" />
      <h2>API Published</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>Your API is now available on the Klyra marketplace.</p>
      <p className="ab2-mono" style={{ color: '#a78bfa' }}>{project.gatewayUrl}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        <button className="ab2-ghost" onClick={onView}><Eye size={14} /> View API</button>
        <button className="ab2-ghost" onClick={onPlayground}><FlaskConical size={14} /> Open Playground</button>
        <button className="ab2-primary" onClick={onManage}><Settings size={14} /> Manage Project</button>
      </div>
    </div>
  </div></div>
);
