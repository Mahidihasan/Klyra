import React, { useEffect, useRef } from 'react';
import { ProviderProject, SourceConfig, DetectionResult } from '../../types/apibuild';
import { PlaygroundOpenEndpoint, PlaygroundOpenPayload } from '../../types/playground';
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
import { WorkspaceRedesignWithDraft } from './WorkspaceRedesignWithDraft';
import { useApiBuild, ApiBuildState, BuildView } from './state';
import { DetailedEndpoint } from './types';
import './styles.css';
import './styles2.css';
import './styles-professional.css';

export const ApiBuildPage: React.FC<{
  onOpenPlayground: (prefill?: PlaygroundOpenPayload) => void;
  onBack?: () => void;
  initialView?: BuildView;
}> = ({ onOpenPlayground, onBack, initialView }) => {
  // The playground lives outside this page, so the navigation callback must
  // carry the API's URL with it. The active project is captured through a ref
  // (same pattern as AdminApis' listRef) so the wrapper below can always read
  // the latest gateway/base URL when any "Playground" / "Test in Playground"
  // button is pressed — with or without a specific endpoint.
  const activeRef = useRef<ProviderProject | null>(null);
  /** Maps a stored endpoint row onto the Playground's folder-import entry. */
  const toPlaygroundEndpoint = (ep: DetailedEndpoint): PlaygroundOpenEndpoint => ({
    method: ep.method,
    path: ep.path,
    name: ep.summary || `${ep.method} ${ep.path}`,
    description: ep.description || undefined,
    sampleBody: ep.requestBody?.sampleBody || undefined,
    // The inputs the endpoint needs (path/query/header) travel with it so the
    // Playground can ask the user for the values instead of sending a request
    // that cannot succeed.
    parameters:
      Array.isArray(ep.parameters) && ep.parameters.length
        ? ep.parameters.map((param) => ({
            name: param.name,
            in: param.in,
            type: param.type,
            required: param.required,
            description: param.description,
            example: param.example,
          }))
        : undefined,
  });

  /**
   * Path prefix the deployed API serves its operations under. It comes from the
   * detected specification (`servers[0].url`) and is stored with the project's
   * detection record; without it every Playground request 404s.
   */
  const playgroundBasePath = (project: ProviderProject | null | undefined): string | undefined => {
    const detected = String(project?.detection?.basePath || '').trim();
    if (detected) return detected.startsWith('/') ? detected : `/${detected}`;
    const specUrl = String(project?.openApiUrl || '').trim();
    const directory = /^(.*\/)[^/]+\.(?:json|yaml|yml)$/i.exec(specUrl)?.[1];
    if (!directory) return undefined;
    try {
      const path = new URL(directory).pathname.replace(/\/+$/, '');
      return path || undefined;
    } catch {
      return undefined;
    }
  };
  const openPlaygroundWithUrl = async (ep?: DetailedEndpoint) => {
    const project = activeRef.current;
    // The "Open API Tester Playground" action carries the project's complete
    // endpoint catalog so the Playground can import it as one folder (named
    // after the API project) where every existing endpoint can be tested.
    let catalog: DetailedEndpoint[] = [];
    if (project) {
      catalog = await apiBuildService
        .listEndpoints<DetailedEndpoint>(project.id)
        .catch(() => [] as DetailedEndpoint[]);
      if (catalog.length === 0 && project.detection?.endpoints?.length) {
        catalog = project.detection.endpoints.map(
          (det) =>
            ({
              id: det.id,
              method: det.method,
              path: det.path,
              summary: det.description || `${det.method} ${det.path}`,
              description: det.description || '',
            }) as unknown as DetailedEndpoint,
        );
      }
    }
    onOpenPlayground({
      apiId: project?.id || undefined,
      apiName: project?.name || undefined,
      folderName: project?.name || undefined,
      baseUrl: project?.gatewayUrl || project?.baseUrl || undefined,
      basePath: playgroundBasePath(project),
      endpoint: ep ? { method: ep.method, path: ep.path } : undefined,
      endpoints: catalog.map(toPlaygroundEndpoint),
    });
  };
  const s = useApiBuild(openPlaygroundWithUrl, initialView);
  const { active } = s;
  activeRef.current = active || null;

  // Guard so the deploy operation is started exactly once per entry.
  const deployStartedFor = useRef<string | null>(null);

  useEffect(() => {
    if (s.view !== 'deploy' || !active) return;
    if (active.deployment.kind === 'external') return;
    // A retry from the Deploy step bumps deployAttempt, which must start a
    // brand-new operation rather than being swallowed by the dedupe guard.
    const attemptKey = `${active.id}:${s.deployAttempt}`;
    if (deployStartedFor.current === attemptKey) return;
    deployStartedFor.current = attemptKey;

    // Real deploy via the durable operation resource — the wizard's phase,
    // percentage and log panel are all driven from backend truth instead of a
    // client-side fake timer.
    s.setPhase(0);
    s.setDeployOp({
      id: '',
      state: 'queued',
      progress: 0,
      logs: ['Submitting deployment operation…'],
      error: null,
    });
    apiBuildService.createOperation(active.id, {
      type: 'deploy',
      environment: active.environment,
      payload: {
        version: active.version,
        strategy: 'rolling',
        sourceKind: active.sourceKind,
        repository: active.repository,
        branch: active.deployment.branch,
        dockerSourceMode: active.dockerSourceMode,
        dockerImage: active.dockerImage,
        dockerUploadId: active.dockerUploadId,
        dockerfilePath: active.dockerfilePath,
        buildContext: active.buildContext,
        dockerPort: active.dockerPort,
        openApiUrl: active.openApiUrl,
        readinessMode: active.readinessMode,
        readinessPath: active.readinessPath,
      },
      reason: 'Initial deployment from the setup flow',
    }).then((op) => {
      const timer = setInterval(async () => {
        try {
          const live = await apiBuildService.getOperation(active.id, op.id);
          if (!live) return;
          // Percentage + phase come from the backend operation's progress.
          s.setPhase(live.progress < 25 ? 0 : live.progress < 55 ? 1 : live.progress < 85 ? 2 : 3);
          s.setDeployOp({
            id: live.id,
            state: live.state,
            progress: live.progress,
            logs: live.logs,
            error: live.errors.length ? live.errors[live.errors.length - 1] : null,
          });
          if (live.state === 'succeeded' || live.state === 'failed' || live.state === 'cancelled') {
            clearInterval(timer);
            await s.refresh();
            if (live.state !== 'succeeded') s.setBusy(false);
          }
        } catch {
          // Backend unreachable during setup — keep the wizard visible; the
          // durable operation row persists and can be retried from the workspace.
        }
      }, 700);
    }).catch((err) => {
      s.setDeployOp({
        id: '',
        state: 'failed',
        progress: 0,
        logs: ['Deployment operation could not be created.'],
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      s.setBusy(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.view, s.deployAttempt]);

  return <ApiBuildRouter s={s} onBack={onBack} />;
};

async function submitSource(s: ApiBuildState, chosen: SourceConfig) {
  s.setDetectProgress(5);
  const created = await apiBuildService.create(s.draft);
  s.setBusy(true); s.setDetecting(true); s.setManual(false); s.setView('detect');
  s.setDetectProgress(20);

  let det: DetectionResult = {
    found: false,
    endpointCount: 0,
    schemaCount: 0,
    baseUrl: chosen.baseUrl || '',
    authKind: null,
    endpoints: [],
    openApiVersion: null,
    reachable: false,
    reason: '',
  };

  // GitHub sources: obtain the repository for real. The clone result gives the
  // Detect step truthful facts (Dockerfile, build context, exposed port) and is
  // reused by the deploy pipeline instead of cloning the repo twice.
  let githubSource: {
    uploadId: string;
    dockerfilePath: string;
    buildContext: string;
    detectedPort: number;
    branch: string;
  } | null = null;
  let sourceError = '';

  if (chosen.kind === 'github') {
    s.setDetectProgress(35);
    if (!chosen.repository?.trim()) {
      sourceError = 'Enter a repository URL (for example https://github.com/owner/repo).';
    } else {
      try {
        const descriptor = await apiBuildService.prepareGitHubSource(created.id, {
          repository: chosen.repository.trim(),
          branch: chosen.branch || 'main',
        });
        githubSource = {
          uploadId: descriptor.uploadId,
          dockerfilePath: descriptor.dockerfilePath,
          buildContext: descriptor.buildContext,
          detectedPort: descriptor.detectedPort,
          branch: descriptor.branch || chosen.branch || 'main',
        };
        det = {
          ...det,
          reason: `Repository ready: Dockerfile ${descriptor.dockerfilePath} · build context ${descriptor.buildContext} · port ${descriptor.detectedPort} · ${descriptor.fileCount} files.`,
        };
      } catch (err) {
        sourceError = err instanceof Error ? err.message : 'The repository could not be cloned.';
      }
      s.setDetectProgress(72);
    }
  }

  s.setDetectProgress(chosen.kind === 'github' ? 80 : 55);
  if (chosen.kind === 'existing' || (chosen.openApiUrl && /^https?:\/\//i.test(chosen.openApiUrl))) {
    try {
      det = await apiBuildService.detect(chosen);
    } catch (err) {
      det = { ...det, reason: err instanceof Error ? err.message : 'Upstream detection failed.' };
    }
  } else if (!sourceError && !det.reason) {
    // Container sources have no reachable upstream yet: the specification is
    // discovered by the deploy pipeline once the container reports healthy.
    det = {
      ...det,
      reason: 'The OpenAPI specification is discovered automatically once the container is running.',
    };
  }
  if (sourceError) {
    det = { ...det, found: false, reachable: false, reason: sourceError };
  }
  s.setDetectProgress(92);

  const base = chosen.baseUrl?.trim() || det.baseUrl || '';
  const kind = chosen.kind === 'existing' ? 'external' : 'klyra';
  await apiBuildService.update(created.id, {
    sourceKind: chosen.kind,
    repository: chosen.repository,
    branch: githubSource?.branch || chosen.branch,
    dockerSourceMode: githubSource ? 'folder' : chosen.dockerSourceMode || 'image',
    dockerImage: chosen.dockerImage,
    dockerUploadId: githubSource?.uploadId || chosen.dockerUploadId,
    dockerfilePath: githubSource?.dockerfilePath || chosen.dockerfilePath,
    buildContext: githubSource?.buildContext || chosen.buildContext,
    dockerPort: githubSource?.detectedPort || chosen.dockerPort,
    readinessMode: chosen.readinessMode,
    readinessPath: chosen.readinessPath,
    baseUrl: base,
    openApiUrl: chosen.openApiUrl,
    endpointCount: det.endpointCount,
    schemaCount: det.schemaCount,
    status: det.found ? 'deploying' : 'draft',
    detection: det,
    deployment: {
      kind,
      status: chosen.kind === 'existing' ? 'healthy-external' : 'queued',
      providerUrl: chosen.kind === 'existing' ? base : created.gatewayUrl,
      source: chosen.kind === 'github' ? 'GitHub' : chosen.kind === 'docker' ? 'Docker' : undefined,
      branch: githubSource?.branch || chosen.branch,
      environment: 'development',
      version: 'v1.0.0',
      lastHealthCheck: chosen.kind === 'existing' ? 'just now' : 'queued',
      log: chosen.kind === 'existing'
        ? [`Connected to ${base}`, det.found ? `Detected ${det.endpointCount} endpoints` : 'Live connectivity OK — no spec found', 'Waiting for first health check']
        : sourceError
          ? ['Source acquisition failed', sourceError]
          : ['Queued for container deployment', ...(githubSource ? [`Repository cloned (${githubSource.branch})`, `Dockerfile ${githubSource.dockerfilePath} · port ${githubSource.detectedPort}`] : []), 'Validating container runtime...'],
    },
  } as Partial<ProviderProject>);
  s.setActiveId(created.id); s.setDetection(det);
  s.setDetectProgress(100); s.setDetecting(false); s.setBusy(false); s.refresh();
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

function ApiBuildRouter({ s, onBack }: { s: ApiBuildState; onBack?: () => void }) {
  const { view, projects, active } = s;
  const openDashboard = () => { s.setActiveId(null); s.setView('dash'); };
  const openProj = (p: ProviderProject) => { s.setActiveId(p.id); s.setTab('overview'); s.setView('workspace'); };
  // Real discovery state for container sources: the deploy pipeline imports the
  // operations it discovers once the container is healthy, and the composed
  // project reports them as endpointCount — so Step 3 shows what actually
  // happened instead of a permanent "nothing to scan yet".
  const deployed = Boolean(
    (active && ['healthy', 'degraded'].includes(String(active.status))) ||
      active?.deployment?.status === 'healthy',
  );
  const importedEndpoints = active?.endpointCount ?? 0;

  if (view === 'dash') return <ProjectsDashboard projects={projects} onNew={() => s.setView('new')} onOpen={openProj} onBack={onBack} />;
  if (view === 'new') return <StepNewProject init={s.draft} onBack={openDashboard} onNext={(d) => { s.setDraft(d); s.setView('source'); }} />;
  if (view === 'source') return <StepSource init={s.source} busy={s.busy} onBack={() => s.setView('new')} onNext={(v) => { s.setSource(v); submitSource(s, v); }} />;
  if (view === 'detect') return <StepDetect loading={s.detecting} detection={s.detection} progress={s.detectProgress} containerSource={s.source.kind === 'docker' || s.source.kind === 'github'} importedEndpoints={importedEndpoints} deployed={deployed} manualMode={s.manual} setManualMode={s.setManual} onBack={() => s.setView('source')} onRetry={() => retryDetection(s, active)} onNext={() => s.setView('configure')} />;
  if (!active) return <ProjectsDashboard projects={projects} onNew={() => s.setView('new')} onOpen={openProj} onBack={onBack} />;
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
  if (view === 'deploy') return <StepDeploy project={active} phase={s.phase} progress={s.deployOp?.progress ?? 0} logs={s.deployOp?.logs} error={s.deployOp?.error ?? null} failed={s.deployOp?.state === 'failed' || s.deployOp?.state === 'cancelled'} onRetry={() => { s.setPhase(0); s.setDeployOp({ id: '', state: 'queued', progress: 0, logs: [`Retrying deployment of ${active.version}…`], error: null }); s.setDeployAttempt((n) => n + 1); }} onTest={() => { apiBuildService.update(active.id, { deployment: { ...active.deployment, lastHealthCheck: 'just now' } } as Partial<ProviderProject>); s.refresh(); }} onBack={() => s.setView('configure')} onNext={() => s.setView('product')} />;
  if (view === 'product') return <StepProduct project={active} onBack={() => s.setView('deploy')} onPlayground={s.onPlayground} onNext={() => s.setView('pricing')} />;
  if (view === 'pricing') return <StepPricing plans={active.plans} onBack={() => s.setView('product')} onNext={(plans) => { apiBuildService.update(active.id, { plans } as Partial<ProviderProject>); s.refresh(); s.setView('publish'); }} />;
  if (view === 'publish') return <StepPublish project={active} busy={s.busy} onBack={() => s.setView('pricing')} onPublish={(vis, l) => {
    // Publish is a durable operation: the backend flips visibility/status and
    // writes audit events. The UI waits for terminal state before advancing.
    if (s.busy) return;
    s.setBusy(true);
    apiBuildService.createOperation(active.id, {
      type: 'publish',
      payload: { visibility: vis, listingName: l.name, listingDescription: l.description },
      reason: 'Publish to marketplace',
    }).then((op) => {
      const timer = setInterval(async () => {
        try {
          const live = await apiBuildService.getOperation(active.id, op.id);
          if (!live) return;
          if (live.state === 'succeeded' || live.state === 'failed') {
            clearInterval(timer);
            await s.refresh();
            s.setBusy(false);
            if (live.state === 'succeeded') s.setView('success');
            else s.setView('publish');
          }
        } catch { /* keep waiting — identical retry semantics as deployment */ }
      }, 800);
    }).catch(() => s.setBusy(false));
  }} />;
  if (view === 'success') return <PublishSuccess project={active} onView={() => { s.setTab('overview'); s.setView('workspace'); }} onPlayground={s.onPlayground} onManage={() => { s.setTab('overview'); s.setView('workspace'); }} />;

  return (
    <WorkspaceRedesignWithDraft
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
