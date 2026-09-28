import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { ProviderProject } from '../../types/apibuild';
import { Alert } from './bits';
import { StatusDot } from './bits';
import { WizardChrome } from './Wizard1';
import './styles.css';

const PHASES = ['Build', 'Start', 'Health Check', 'Ready'];

export const StepDeploy: React.FC<{
  project: ProviderProject; phase: number; failed: boolean;
  progress?: number; logs?: string[]; error?: string | null; onRetry?: () => void;
  ready: boolean; onTest: () => void; onNext: () => void; onBack: () => void;
  onRenameProject?: (name: string) => Promise<void>;
  onDeleteConflict?: () => Promise<void>;
}> = ({ project, phase, failed, ready, progress = 0, logs, error, onRetry, onTest, onNext, onBack, onRenameProject, onDeleteConflict }) => {
  const [renameName, setRenameName] = useState(`${project.name} 2`);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [conflictError, setConflictError] = useState('');
  const d = project.deployment;
  const external = d.kind === 'external';
  const isDocker = d.kind === 'docker' || d.kind === 'klyra';
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  // Live operation logs (backend truth) replace the recorded log lines while
  // the deploy operation runs; the persisted project log is the fallback.
  const pipelineLogs = logs && logs.length ? logs : d.log;
  // The last pipeline line is the most actionable signal on failure —
  // backend deployProject persists the exact error (e.g. DockerUnavailableError,
  // docker build failure, readiness timeout) as the final log entry.
  const lastError = error || [...pipelineLogs].reverse().find((l) => /failed|error|unavailable|exited|not (become )?ready|refused/i.test(l));
  const nameConflict = failed && /container name .*already in use|name .*already in use/i.test(lastError || '');
  useEffect(() => {
    if (nameConflict) {
      setRenameName(`${project.name} 2`);
      setConflictError('');
    }
  }, [nameConflict, project.name]);

  const renameAndRetry = async () => {
    if (!renameName.trim() || !onRenameProject) return;
    setConflictBusy(true);
    setConflictError('');
    try {
      await onRenameProject(renameName.trim());
    } catch (err) {
      setConflictError(err instanceof Error ? err.message : 'Could not rename the project.');
    } finally {
      setConflictBusy(false);
    }
  };
  const deleteAndReturn = async () => {
    if (!onDeleteConflict) return;
    setConflictBusy(true);
    setConflictError('');
    try {
      await onDeleteConflict();
    } catch (err) {
      setConflictError(err instanceof Error ? err.message : 'Could not remove the conflicting container.');
      setConflictBusy(false);
    }
  };
  return (
    <WizardChrome step={4} total={8} labels={['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish']}>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Deployment</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        {external
          ? 'Your API stays where it is — Klyra fronts it with a managed gateway.'
          : 'The Klyra backend is building and running your container for real — image pull/build, container start and readiness checks are all executed live.'}
      </p>
      {failed ? <Alert kind="err">{lastError ? `Deployment failed — ${lastError.replace(/^\[[^\]]+\]\s*/, '')} Fix the source and retry from the Deploy step.` : 'Deployment failed — the container did not become healthy. Check the pipeline log below and retry.'}</Alert>
        : external ? <Alert kind="ok">External API connected. Gateway health checks are passing.</Alert>
        : isDocker ? <Alert kind={ready ? 'ok' : 'info'}>{ready ? 'Sandbox API is reachable and ready.' : `Docker sandbox: ${PHASES[Math.min(phase, 3)]} (${pct}%).`}</Alert>
        : <Alert kind="info">Deploying API... phase {Math.min(phase + 1, 4)} of 4.</Alert>}
      {!external && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${failed ? pct : Math.max(3, pct)}%`, height: '100%', background: failed ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#8b5cf6,#22d3ee)', borderRadius: 6, transition: 'width .35s ease' }} />
          </div>
          <b className="ab2-mono" style={{ fontSize: 12, minWidth: 40, textAlign: 'right' }}>{pct}%</b>
        </div>
      )}
      <div className="ab2-card" style={{ background: 'var(--bg-input)', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <b>{external ? 'External API' : 'Klyra Deployment'}</b>
          {external ? <StatusDot status="healthy" /> : failed ? <StatusDot status="failed" /> : <StatusDot status="deploying" />}
        </div>
        <div className="ab2-kv"><span>{external ? 'Provider URL' : 'Source'}</span><b className="ab2-mono">{external ? d.providerUrl : project.repository ? `${project.repository} · ${d.branch || 'main'}` : isDocker ? (d.image || d.source || 'Container') : `${d.source || 'GitHub'} · ${d.branch || 'main'}`}</b></div>
        {isDocker && d.containerName && (
          <div className="ab2-kv"><span>Container</span><b className="ab2-mono">{d.containerName}</b></div>
        )}
        <div className="ab2-kv"><span>Environment</span><b style={{ textTransform: 'capitalize' }}>{d.environment}</b></div>
        <div className="ab2-kv"><span>Version</span><b className="ab2-mono">{d.version}</b></div>
        <div className="ab2-kv"><span>Last health check</span><b>{d.lastHealthCheck}</b></div>
        {!external && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>{PHASES.map((p, i) => (
            <span key={p} className="ab2-pill" style={{ opacity: i <= phase ? 1 : 0.45, borderColor: i <= phase ? '#8b5cf6' : undefined, display: 'flex', gap: 6, alignItems: 'center' }}>
              {i < phase || (ready && i === phase) ? '✓ ' : i === phase && !failed ? (<Loader2 size={11} className="ab2-spin" />) : null}{p}
            </span>
          ))}</div>
        )}
      </div>
      <div className="ab2-deploy-log">
        {pipelineLogs.length === 0
          ? <div>$ Waiting for the backend pipeline to report…</div>
          : pipelineLogs
              .flatMap((entry) => entry.split('\n'))
              .map((line, i) => <div key={i}>$ {line}</div>)}
      </div>
      <div className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {external && <button className="ab2-ghost" onClick={onTest}><RefreshCw size={14} /> Test Connection</button>}
          {failed && onRetry && (
            <button className="ab2-primary" onClick={onRetry}><RefreshCw size={14} /> Retry deployment</button>
          )}
          <button className="ab2-primary" onClick={onNext} disabled={failed || (!external && !ready)} style={failed || (!external && !ready) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Continue <ArrowRight size={14} /></button>
        </div>
      </div>
      {nameConflict && (
        <div className="ab2-modal-overlay" role="presentation">
          <div className="ab2-modal" role="alertdialog" aria-modal="true" aria-labelledby="deploy-name-conflict-title" onClick={(event) => event.stopPropagation()}>
            <div className="ab2-modal-head">
              <div>
                <h3 id="deploy-name-conflict-title">Deployment container name is already in use</h3>
                <p>{lastError}</p>
              </div>
            </div>
            <div className="ab2-modal-body" style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                Rename the project and retry. This also changes its deployment slug.
                <input value={renameName} onChange={(event) => setRenameName(event.target.value)} disabled={conflictBusy} />
              </label>
              {conflictError && <Alert kind="err">{conflictError}</Alert>}
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>
                Removing the existing container can stop an API that is currently serving traffic.
              </p>
            </div>
            <div className="ab2-modal-foot">
              <button className="ab2-ghost" onClick={deleteAndReturn} disabled={conflictBusy}>
                <Trash2 size={14} /> Delete conflicting deployment and return to Studio
              </button>
              <button className="ab2-primary" onClick={renameAndRetry} disabled={conflictBusy || !renameName.trim()}>
                <AlertTriangle size={14} /> {conflictBusy ? 'Working…' : 'Rename project and retry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </WizardChrome>
  );
};
