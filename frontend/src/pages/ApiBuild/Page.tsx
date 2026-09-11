import React, { useEffect } from 'react';
import { ProviderProject, SourceConfig } from '../../types/apibuild';
import { apiBuildService } from '../../services/apiBuild';
import { ProjectsDashboard } from './ProjectsDashboard';
import { StepNewProject } from './Wizard1';
import { StepSource } from './Wizard2';
import { StepDetect } from './Wizard3';
import { StepConfigure } from './Wizard4';
import { StepDeploy } from './Wizard5';
import { StepProduct } from './Wizard6';
import { StepPricing } from './Wizard7';
import { StepPublish, PublishSuccess } from './Wizard8';
import { WorkspaceRedesign } from './WorkspaceRedesign';
import { useApiBuild, ApiBuildState } from './state';
import './styles.css';
import './styles2.css';
import './styles-professional.css';

export const ApiBuildPage: React.FC<{ onOpenPlayground: () => void }> = ({ onOpenPlayground }) => {
  const s = useApiBuild(onOpenPlayground);
  const { active } = s;

  useEffect(() => {
    if (s.view !== 'deploy' || !active) return;
    if (active.deployment.kind === 'external') return;
    s.setPhase(0);
    const t = setInterval(() => s.setPhase((p: number) => {
      if (p >= 3) {
        clearInterval(t);
        apiBuildService.update(active.id, {
          status: 'healthy',
          deployment: { ...active.deployment, status: 'healthy', lastHealthCheck: 'just now', log: [...active.deployment.log, 'Build complete', 'Deployment healthy'] },
        } as Partial<ProviderProject>);
        s.refresh();
        return p;
      }
      return p + 1;
    }), 900);
    return () => clearInterval(t);
  }, [s.view]);

  return <ApiBuildRouter s={s} />;
};

async function submitSource(s: ApiBuildState, chosen: SourceConfig) {
  const created = apiBuildService.create(s.draft);
  s.setBusy(true); s.setDetecting(true); s.setManual(false); s.setView('detect');
  const det = await apiBuildService.detect(chosen);
  const base = chosen.baseUrl?.trim() || det.baseUrl;
  const kind = chosen.kind === 'existing' ? 'external' : 'klyra';
  apiBuildService.update(created.id, {
    sourceKind: chosen.kind, baseUrl: base, openApiUrl: chosen.openApiUrl,
    endpointCount: det.endpointCount, schemaCount: det.schemaCount,
    status: det.found ? 'deploying' : 'draft', detection: det,
    deployment: {
      kind, status: chosen.kind === 'existing' ? 'healthy-external' : 'queued',
      providerUrl: chosen.kind === 'existing' ? base : `https://${created.slug}.klyra.dev`,
      source: chosen.kind === 'github' ? 'GitHub' : chosen.kind === 'docker' ? 'Docker' : undefined,
      branch: chosen.branch, environment: 'development', version: 'v1.0.0',
      lastHealthCheck: chosen.kind === 'existing' ? 'just now' : 'queued',
      log: chosen.kind === 'existing' ? [`Connected to ${base}`, det.found ? `Detected ${det.endpointCount} endpoints` : 'Live connectivity OK — no spec found', 'Waiting for first health check'] : ['Queued build', 'Installing dependencies...'],
    },
  } as Partial<ProviderProject>);
  s.setActiveId(created.id); s.setDetection(det);
  s.setDetecting(false); s.setBusy(false); s.refresh();
}

async function retryDetection(s: ApiBuildState, active?: ProviderProject | null) {
  s.setDetecting(true); s.setManual(false);
  const det = await apiBuildService.detect(s.source);
  if (active) {
    apiBuildService.update(active.id, {
      detection: det, endpointCount: det.endpointCount, schemaCount: det.schemaCount,
      status: det.found ? 'deploying' : 'draft',
      deployment: { ...active.deployment, status: det.found ? 'healthy-external' : active.deployment.status, lastHealthCheck: 'just now', log: [...active.deployment.log, det.found ? `Re-scanned: ${det.endpointCount} endpoints` : 'Re-scan: upstream reachable, no spec found'] },
    } as Partial<ProviderProject>);
  }
  s.setDetection(det); s.setDetecting(false); s.refresh();
}

function ApiBuildRouter({ s }: { s: ApiBuildState }) {
  const { view, projects, active } = s;
  const openDashboard = () => { s.setActiveId(null); s.setView('dash'); };
  const openProj = (p: ProviderProject) => { s.setActiveId(p.id); s.setTab('overview'); s.setView('workspace'); };

  if (view === 'dash') return <ProjectsDashboard projects={projects} onNew={() => s.setView('new')} onOpen={openProj} />;
  if (view === 'new') return <StepNewProject init={s.draft} onBack={openDashboard} onNext={(d) => { s.setDraft(d); s.setView('source'); }} />;
  if (view === 'source') return <StepSource init={s.source} busy={s.busy} onBack={() => s.setView('new')} onNext={(v) => { s.setSource(v); submitSource(s, v); }} />;
  if (view === 'detect') return <StepDetect loading={s.detecting} detection={s.detection} manualMode={s.manual} setManualMode={s.setManual} onBack={() => s.setView('source')} onRetry={() => retryDetection(s, apiBuildService.get(active?.id || ''))} onNext={() => s.setView('configure')} />;
  if (!active) return <ProjectsDashboard projects={projects} onNew={() => s.setView('new')} onOpen={openProj} />;
  if (view === 'configure') return <StepConfigure project={active} onBack={() => s.setView('detect')} onNext={(c) => {
    apiBuildService.update(active.id, {
      name: c.apiName, version: c.version, baseUrl: c.baseUrl, authKind: c.authKind,
      rateLimitPerMin: c.rateLimitPerMin, healthCheckPath: c.healthCheckPath, environment: c.environment,
      corsOrigins: c.corsOrigins, cacheTtlSeconds: c.cacheTtlSeconds, retryStrategy: c.retryStrategy,
      connectTimeoutMs: c.connectTimeoutMs, requestTimeoutMs: c.requestTimeoutMs, stripBasePath: c.stripBasePath,
      authHeaderName: c.authHeaderName, tags: c.tags,
      deployment: { ...active.deployment, providerUrl: active.deployment.kind === 'external' ? c.baseUrl : active.deployment.providerUrl, environment: c.environment, version: c.version },
    } as Partial<ProviderProject>);
    s.refresh(); s.setView('deploy'); s.setPhase(0);
  }} />;
  if (view === 'deploy') return <StepDeploy project={active} phase={s.phase} failed={false} onTest={() => { apiBuildService.update(active.id, { deployment: { ...active.deployment, lastHealthCheck: 'just now' } } as Partial<ProviderProject>); s.refresh(); }} onBack={() => s.setView('configure')} onNext={() => s.setView('product')} />;
  if (view === 'product') return <StepProduct project={active} onBack={() => s.setView('deploy')} onPlayground={s.onPlayground} onNext={() => s.setView('pricing')} />;
  if (view === 'pricing') return <StepPricing plans={active.plans} onBack={() => s.setView('product')} onNext={(plans) => { apiBuildService.update(active.id, { plans } as Partial<ProviderProject>); s.refresh(); s.setView('publish'); }} />;
  if (view === 'publish') return <StepPublish project={active} busy={s.busy} onBack={() => s.setView('pricing')} onPublish={(vis, l) => {
    s.setBusy(true);
    setTimeout(() => { apiBuildService.update(active.id, { published: true, status: 'published', visibility: vis, name: l.name, description: l.description } as Partial<ProviderProject>); s.setBusy(false); s.refresh(); s.setView('success'); }, 900);
  }} />;
  if (view === 'success') return <PublishSuccess project={active} onView={() => { s.setTab('overview'); s.setView('workspace'); }} onPlayground={s.onPlayground} onManage={() => { s.setTab('overview'); s.setView('workspace'); }} />;

  return (
    <WorkspaceRedesign
      project={active}
      projectsList={projects}
      tab={s.tab}
      setTab={s.setTab}
      onBackToDashboard={openDashboard}
      onOpenPlayground={s.onPlayground}
      onSelectProject={(p) => {
        s.setActiveId(p.id);
        s.setTab('overview');
      }}
      onPauseToggle={() => {
        apiBuildService.update(active.id, { status: active.status === 'paused' ? 'healthy' : 'paused' } as Partial<ProviderProject>);
        s.refresh();
      }}
      onDeleteProject={() => {
        if (window.confirm(`Delete "${active.name}"? This action cannot be undone.`)) {
          apiBuildService.remove(active.id);
          s.refresh();
          openDashboard();
        }
      }}
      onUpdateProject={(patch) => {
        apiBuildService.update(active.id, patch);
        s.refresh();
      }}
    />
  );
}
