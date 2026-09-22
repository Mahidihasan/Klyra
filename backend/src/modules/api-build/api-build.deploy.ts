/**
 * API Build — Common Docker Deployment Pipeline & Orchestration Service.
 *
 * This module is the single orchestration layer for all container deployments.
 * Whether an API originates from:
 *   - an existing OCI image (pull)
 *   - an uploaded project folder / ZIP (extract, validate, build)
 *   - a GitHub source repo (obtain & build)
 *
 * All flows normalize into a deployment specification and pass through this
 * single pipeline:
 *   1. Validate configuration
 *   2. Ensure Docker is available
 *   3. Ensure shared Klyra network
 *   4. Obtain/build the image
 *   5. Determine internal port & readiness configuration
 *   6. Replace previous container for the same project + version only
 *   7. Run container (attached to klyra-api-network; loopback host port if host runtime)
 *   8. Wait for readiness (auto/http/tcp) — never assuming /health
 *   9. Inspect container state
 *  10. Persist deployment records and project runtime
 *  11. Run independent OpenAPI discovery (never failing deployment on missing spec)
 *  12. Keep Gateway route pointing to the live container
 */

import { stat } from 'node:fs/promises';
import path from 'node:path';

import {
  containerNameFor,
  imageNameFor,
  slugOfProject,
  buildGatewayUrl,
  DEFAULT_INTERNAL_PORT,
  resolveDeploymentKind,
  type DeploymentKind,
} from './api-build.deployment';
import { detectUpstream, extractOperations } from './api-build.detect';
import {
  getDockerDiagnostic,
  DockerUnavailableError,
  ReadinessError,
  ensureNetwork,
  buildImage,
  pullImage,
  runContainer,
  removeContainer,
  inspectContainer,
  inspectImageExposedPorts,
  waitForReadiness,
  type DeployLog,
} from './api-build.docker';
import {
  getProject,
  saveProject,
  addDeployment,
  addActivity,
  importEndpoints,
  type ApiBuildProject,
  type DeploymentRow,
  type DetailedEndpointRow,
} from './api-build.service';
import { probeProjectHealth } from './api-build.telemetry';
import { getUploadDirectory, cleanupUpload, prepareGitHubSource } from './api-build.upload';

export interface DeployOptions {
  actor?: string;
  version?: string;
  environment?: string;
  strategy?: string;
  sourceKind?: string;
  repository?: string;
  branch?: string;
  dockerSourceMode?: 'image' | 'folder';
  dockerImage?: string;
  dockerUploadId?: string;
  dockerfilePath?: string;
  buildContext?: string;
  dockerPort?: number;
  openApiUrl?: string;
  readinessMode?: 'auto' | 'http' | 'tcp';
  readinessPath?: string;
  onLog?: (line: string) => void;
  onStep?: (label: string, progress: number) => Promise<void> | void;
}

export interface DeployExecutionResult {
  ok: boolean;
  deploymentId: string;
  version: string;
  environment: string;
  status: 'healthy' | 'failed';
  containerName?: string;
  gatewayUrl: string;
  logs: string[];
  error?: string;
}

/** True when the path exists and is a directory (validates build contexts). */
async function directoryExists(dir: string): Promise<boolean> {
  try {
    const info = await stat(dir);
    return info.isDirectory();
  } catch {
    return false;
  }
}

/** Validates image reference to prevent dangerous characters or shell injection. */
export function validateImageReference(imageRef: string): void {
  const trimmed = imageRef.trim();
  if (!trimmed) {
    throw new Error('Docker image reference cannot be empty.');
  }
  // OCI reference format: [registry/][namespace/]repository[:tag|@digest]
  // Disallow control characters, spaces, shell metacharacters: ; & | ` $ > < \ " '
  // '@' is required for digest-pinned references (repo@sha256:...).
  if (!/^[a-zA-Z0-9_./:@-]+$/.test(trimmed)) {
    throw new Error(
      `Invalid Docker image reference: "${trimmed}". Contains disallowed characters.`,
    );
  }
}

/**
 * In-flight deployments keyed by `projectId::version::environment`.
 *
 * The same deployment target can legitimately be triggered twice in quick
 * succession (a deploy operation and a queued deploy job, a double click, a
 * replayed request). Both invocations resolve to the same container name
 * (`klyra-api-<slug>-<version>`), so the duplicate AWAITS the running pipeline
 * instead of racing it with a second `docker run` — idempotent processing at
 * the deployment level, not a swallowed state error.
 */
const inFlightDeployments = new Map<string, Promise<DeployExecutionResult>>();

/**
 * Orchestrates a complete deployment for an API project.
 * Guaranteed:
 *  - Single deployment pipeline for all Docker sources
 *  - Duplicate invocations of the same project+version+environment share one run
 *  - Failed deployments NEVER report healthy
 *  - Containers of other versions are never removed
 *  - Real execution logs are captured and persisted
 */
export async function deployProject(
  projectId: string,
  opts: DeployOptions = {},
): Promise<DeployExecutionResult> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project "${projectId}" not found.`);
  }
  const version = String(opts.version || project.version || 'v1.0.0');
  const environment = String(opts.environment || project.environment || 'development');

  const key = `${projectId}::${version}::${environment}`;
  const running = inFlightDeployments.get(key);
  if (running) return running;

  const run = runDeployPipeline(project, projectId, opts, version, environment).finally(() => {
    inFlightDeployments.delete(key);
  });
  inFlightDeployments.set(key, run);
  return run;
}

async function runDeployPipeline(
  project: ApiBuildProject,
  projectId: string,
  opts: DeployOptions,
  version: string,
  environment: string,
): Promise<DeployExecutionResult> {
  const startedAt = Date.now();
  const logs: string[] = [];
  const log: DeployLog = (line: string) => {
    logs.push(line);
    opts.onLog?.(line);
  };

  const step = async (label: string, progress: number) => {
    log(`[deploy] ${label}`);
    if (opts.onStep) {
      await opts.onStep(label, progress);
    }
  };

  const slug = slugOfProject(project);
  const gatewayUrl = buildGatewayUrl(slug);
  const actor = opts.actor || 'system';

  // 1. Resolve deployment kind
  const deploymentKind: DeploymentKind = resolveDeploymentKind(project, {
    kind: opts.sourceKind || project.sourceKind,
    deploymentKind: (project.deployment as Record<string, unknown> | undefined)?.kind,
  });

  // --------------------------------------------------------------------------
  // EXTERNAL API DEPLOYMENT
  // --------------------------------------------------------------------------
  if (deploymentKind === 'external') {
    await step(`Probing external upstream for ${version}`, 30);
    const probe = await probeProjectHealth(projectId);
    const healthy = probe.ok;
    log(
      `[external] Probed ${probe.target || 'upstream'} -> HTTP ${
        probe.statusCode || 'no response'
      } in ${probe.latencyMs}ms`,
    );

    const depRow = await addDeployment(projectId, {
      version,
      environment,
      source: 'External API',
      region: 'auto',
      status: healthy ? 'healthy' : 'failed',
      url: gatewayUrl,
      durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      author: actor,
      logs: [
        ...logs,
        healthy ? 'External health check passed' : 'External upstream health check failed',
      ],
    });

    const prevDep = (project.deployment as Record<string, unknown> | undefined) || {};
    await saveProject({
      ...project,
      status: healthy ? 'healthy' : 'failed',
      updatedAt: new Date().toISOString(),
      deployment: {
        ...prevDep,
        kind: 'external',
        status: healthy ? 'healthy' : 'failed',
        environment,
        version,
        // The probe DID run here — record its true outcome.
        lastHealthCheck: healthy ? 'just now' : 'failed',
        log: [...logs],
      },
    });

    await addActivity(
      projectId,
      healthy
        ? `External deployment healthy (${version})`
        : `External deployment check failed (${version})`,
      healthy ? 'ok' : 'critical',
    );

    if (!healthy) {
      throw new Error(`External upstream check failed for ${probe.target || project.baseUrl}`);
    }

    return {
      ok: true,
      deploymentId: depRow.id,
      version,
      environment,
      status: 'healthy',
      gatewayUrl,
      logs,
    };
  }

  // --------------------------------------------------------------------------
  // DOCKER DEPLOYMENT (COMMON PIPELINE)
  // --------------------------------------------------------------------------
  const containerName = containerNameFor(slug, version);
  const projectDep = (project.deployment as Record<string, unknown> | undefined) || {};
  const prevRuntime = (projectDep.runtime as Record<string, unknown> | undefined) || {};

  const dockerSourceMode =
    opts.dockerSourceMode ||
    (project.dockerSourceMode as 'image' | 'folder' | undefined) ||
    (projectDep.dockerSourceMode as 'image' | 'folder' | undefined) ||
    (opts.dockerUploadId || project.dockerUploadId ? 'folder' : 'image');

  const openApiUrl = opts.openApiUrl || (project.openApiUrl as string | undefined) || '';
  const readinessMode =
    opts.readinessMode || (project.readinessMode as 'auto' | 'http' | 'tcp' | undefined) || 'auto';
  const readinessPath = opts.readinessPath || (project.readinessPath as string | undefined) || '';

  /** Temporary GitHub clone sandbox, removed on both success and failure. */
  let clonedUploadId = '';
  // The value recorded in api_build_deployments.source must satisfy the
  // database CHECK constraint (api_build_deployments_source_check):
  //   source IN ('External API','GitHub','Docker','Klyra Hosted')
  const repositoryForSource = String(opts.repository || project.repository || '').trim();
  // (The external branch above has already returned, so only container sources
  // reach this point.)
  const deploymentSource = repositoryForSource
    ? 'GitHub'
    : dockerSourceMode === 'folder'
    ? 'Klyra Hosted'
    : 'Docker';

  try {
    await step('Validating Docker runtime', 5);

    // 2. Check Docker availability
    const diagnostic = await getDockerDiagnostic();
    if (!diagnostic.available) {
      log(`[docker] ${diagnostic.detail}`);
      throw new DockerUnavailableError(diagnostic.detail);
    }
    log(`[docker] Docker daemon available (${diagnostic.dockerBin})`);

    // 3. Ensure network exists
    const network = await ensureNetwork(log);

    // 4. Resolve / build image — the common pipeline accepts three sources:
    //    uploaded project folder, GitHub repository, and a prebuilt OCI image.
    let imageToRun = '';
    const repository = String(opts.repository || project.repository || '').trim();
    const branch = String(opts.branch || project.branch || '').trim();
    const explicitImage = String(opts.dockerImage || project.dockerImage || '').trim();
    /** Facts discovered while obtaining a GitHub source (persisted on success). */
    let discovered: { dockerfilePath: string; buildContext: string; dockerPort: number } | null =
      null;

    if (dockerSourceMode === 'folder') {
      const uploadId = opts.dockerUploadId || (project.dockerUploadId as string | undefined);
      const buildContextRel =
        opts.buildContext || (project.buildContext as string | undefined) || './';
      /** Resolves the buildable directory, re-cloning a GitHub source if needed. */
      const resolveContextDir = async (): Promise<string> => {
        if (uploadId) {
          const uploadDir = getUploadDirectory(uploadId);
          if (await directoryExists(uploadDir)) {
            return path.resolve(uploadDir, buildContextRel);
          }
          log(`[docker] Source sandbox ${uploadId} is no longer available`);
        }
        if (repository) {
          // A previous successful build removes the clone sandbox — obtain the
          // source again so redeploys keep working without user action.
          await step(`Cloning ${repository}`, 15);
          const source = await prepareGitHubSource(repository, branch, log);
          clonedUploadId = source.uploadId;
          discovered = {
            dockerfilePath: source.dockerfilePath,
            buildContext: source.buildContext,
            dockerPort: source.detectedPort,
          };
          return path.resolve(getUploadDirectory(source.uploadId), source.buildContext || './');
        }
        throw new Error(
          'Project folder mode requires a valid project upload ID. Re-upload the project archive or provide a repository.',
        );
      };

      const contextDir = await resolveContextDir();
      log(`[docker] Preparing project build context ${contextDir}`);
      const tag = imageNameFor(slug, version);
      await step(`Building Docker image ${tag}`, 25);
      await buildImage(contextDir, tag, log);
      imageToRun = tag;
      if (clonedUploadId) {
        await cleanupUpload(clonedUploadId);
        clonedUploadId = '';
      }
    } else if (repository && !explicitImage) {
      // GitHub source: obtain the repository, then build its Dockerfile.
      await step(`Cloning ${repository}`, 15);
      const source = await prepareGitHubSource(repository, branch, log);
      clonedUploadId = source.uploadId;
      discovered = {
        dockerfilePath: source.dockerfilePath,
        buildContext: source.buildContext,
        dockerPort: source.detectedPort,
      };
      log(
        `[github] Dockerfile ${source.dockerfilePath} · context ${source.buildContext} · port ${source.detectedPort} · ${source.fileCount} files`,
      );

      const tag = imageNameFor(slug, version);
      await step(`Building Docker image ${tag}`, 30);
      await buildImage(
        path.resolve(getUploadDirectory(source.uploadId), source.buildContext || './'),
        tag,
        log,
      );
      imageToRun = tag;
      // The clone has served its purpose once the image exists.
      await cleanupUpload(clonedUploadId);
      clonedUploadId = '';
    } else {
      // OCI Image mode
      const rawImage = explicitImage || (projectDep.image as string | undefined);
      if (!rawImage) {
        throw new Error(
          'No container source configured. Provide a container image reference, a GitHub repository, or upload a project folder.',
        );
      }
      validateImageReference(String(rawImage));
      imageToRun = String(rawImage).trim();

      await step(`Pulling container image ${imageToRun}`, 25);
      await pullImage(imageToRun, log);
    }

    // 5. Determine internal container port
    let internalPort =
      opts.dockerPort || (project.dockerPort as number | undefined) || discovered?.dockerPort;
    if (!internalPort) {
      const exposed = await inspectImageExposedPorts(imageToRun);
      if (exposed.length > 0) {
        internalPort = exposed[0];
        log(`[docker] Detected exposed port ${internalPort} from image metadata`);
      } else {
        internalPort = DEFAULT_INTERNAL_PORT;
        log(`[docker] Using default internal port ${internalPort}`);
      }
    }

    // 6. Replace previous container for the same project + version
    await step(`Preparing container ${containerName}`, 50);

    // 7. Start new container
    await step(`Starting container on network ${network}`, 60);
    const runResult = await runContainer({
      name: containerName,
      image: imageToRun,
      network,
      internalPort,
      log,
    });

    const preferHost =
      String(process.env.KLYRA_DOCKER_RUNTIME || 'docker').toLowerCase() === 'host';
    const internalUrl = `http://${containerName}:${internalPort}`;
    const hostUrl = runResult.hostPort ? `http://127.0.0.1:${runResult.hostPort}` : undefined;
    const probeTargetUrl = preferHost && hostUrl ? hostUrl : hostUrl || internalUrl;

    // 8. Wait for readiness
    await step(`Waiting for container readiness (${readinessMode} mode)`, 75);
    await waitForReadiness(probeTargetUrl, log, {
      mode: readinessMode,
      path: readinessPath,
      port: runResult.hostPort || internalPort,
      openApiUrl,
      attempts: 40,
      delayMs: 500,
    });

    // 9. Inspect container
    const state = await inspectContainer(containerName);
    if (!state || !state.running) {
      throw new Error(`Container ${containerName} exited unexpectedly.`);
    }
    log(`[docker] Container verified running (status: ${state.status})`);

    // 10. Independent OpenAPI Discovery (never prevents deployment success)
    await step('Discovering API specification', 85);
    try {
      const detected = await detectUpstream(probeTargetUrl, openApiUrl);
      if (detected && detected.found && detected.endpoints.length > 0) {
        log(
          `[docker] Discovered OpenAPI specification with ${detected.endpoints.length} endpoints`,
        );
        const operations = extractOperations(
          detected.foundAt || probeTargetUrl,
          detected.endpoints,
        );
        // ImportableEndpoint -> DetailedEndpointRow: freshly discovered
        // endpoints start with zero traffic metrics.
        const rows: DetailedEndpointRow[] = operations.map((op) => ({
          ...op,
          avgLatencyMs: 0,
          p95LatencyMs: 0,
          totalRequests: 0,
          errorRate: 0,
          isHealthy: true,
          updatedAt: new Date().toISOString(),
        }));
        await importEndpoints(projectId, rows).catch(() => undefined);
      } else {
        log(
          '[docker] OpenAPI specification not detected — API is live and endpoints can be configured manually',
        );
      }
    } catch {
      log('[docker] Note: OpenAPI detection check completed without spec import');
    }

    // 11. Persist deployment record
    await step('Finalizing deployment records', 95);
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const deploymentRecord = await addDeployment(projectId, {
      version,
      environment,
      source: deploymentSource,
      region: 'auto',
      status: 'healthy',
      url: gatewayUrl,
      durationSec,
      author: actor,
      logs: [...logs, 'Deployment healthy and routable through Klyra Gateway'],
    });

    // 12. Persist project runtime state
    await saveProject({
      ...project,
      version,
      environment,
      status: 'healthy',
      updatedAt: new Date().toISOString(),
      // GitHub sources record what was discovered, so a redeploy does not have
      // to re-clone to know the Dockerfile/context/port.
      ...(repository ? { repository, branch, sourceKind: 'github' } : {}),
      ...(discovered
        ? {
            dockerfilePath: discovered.dockerfilePath,
            buildContext: discovered.buildContext,
            dockerPort: discovered.dockerPort,
          }
        : {}),
      deployment: {
        ...projectDep,
        kind: 'docker',
        status: 'healthy',
        environment,
        version,
        providerUrl: gatewayUrl,
        lastHealthCheck: 'just now',
        log: [...logs],
        runtime: {
          kind: 'docker',
          containerName,
          image: imageToRun,
          internalPort,
          hostPort: runResult.hostPort,
          internalUrl,
          hostUrl,
          upstream: hostUrl || internalUrl,
        },
      },
    });

    await addActivity(
      projectId,
      `Deployment completed for ${version} — container ${containerName} healthy`,
      'ok',
    );

    // Optional: cleanup temporary upload directory on success if folder mode
    if (dockerSourceMode === 'folder' && (opts.dockerUploadId || project.dockerUploadId)) {
      void cleanupUpload(opts.dockerUploadId || (project.dockerUploadId as string));
    }

    await step(`Deployment healthy in ${environment}`, 100);

    return {
      ok: true,
      deploymentId: deploymentRecord.id,
      version,
      environment,
      status: 'healthy',
      containerName,
      gatewayUrl,
      logs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const readinessRan = error instanceof ReadinessError;
    log(`[docker] Deployment failed: ${errorMsg}`);

    // Cleanup failed container to avoid orphans
    await removeContainer(containerName).catch(() => undefined);
    // Cleanup a GitHub clone sandbox that never produced a running container
    if (clonedUploadId) {
      await cleanupUpload(clonedUploadId).catch(() => undefined);
    }

    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const failedRecord = await addDeployment(projectId, {
      version,
      environment,
      source: deploymentSource,
      region: 'auto',
      status: 'failed',
      url: gatewayUrl,
      durationSec,
      author: actor,
      logs: [...logs, `Deployment failed: ${errorMsg}`],
    });

    await saveProject({
      ...project,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      deployment: {
        ...projectDep,
        kind: 'docker',
        status: 'failed',
        environment,
        version,
        // Only a deployment that reached the readiness gate reports a failed
        // health check. Failures before it (daemon unavailable, pull/build/run
        // errors) never ran a probe — recording "failed" there told the UI
        // "Last health check: failed" at 5% progress for a health check that
        // never happened.
        lastHealthCheck: readinessRan ? 'failed' : 'not verified',
        log: [...logs],
      },
    });

    await addActivity(projectId, `Deployment failed for ${version}: ${errorMsg}`, 'critical');

    return {
      ok: false,
      deploymentId: failedRecord.id,
      version,
      environment,
      status: 'failed',
      gatewayUrl,
      logs,
      error: errorMsg,
    };
  }
}
