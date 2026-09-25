/**
 * API Build — real Docker hosting for Klyra-built APIs.
 *
 * This module performs the actual container lifecycle. Nothing here is
 * simulated: the image is built from a generated artifact, a real container is
 * started on the shared Klyra Docker network, and the deployment is only
 * reported healthy after the container's /health endpoint answered. Every
 * failure surfaces as an exception — a failed deploy NEVER produces a healthy
 * record (the pipeline records the failure instead).
 *
 * The Docker CLI is used. The backend and the API containers communicate over
 * the shared bridge network KLYRA_DOCKER_NETWORK via container DNS names —
 * never via localhost — unless the backend itself runs on the host
 * (KLYRA_DOCKER_RUNTIME=host), in which case the container publishes its port
 * on 127.0.0.1 only and the gateway uses that loopback URL.
 */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_INTERNAL_PORT,
  containerNameFor,
  imageNameFor,
  sanitizeContainerToken,
  type DeploymentRuntime,
} from './api-build.deployment';
import type { DetailedEndpointRow } from './api-build.service';

export class DockerUnavailableError extends Error {
  constructor(message = 'Docker is not available on the host running the Klyra backend. Start Docker (or install it) and retry the deployment.') {
    super(message);
    this.name = 'DockerUnavailableError';
  }
}

export type DeployLog = (line: string) => void;

const networkName = (): string => process.env.KLYRA_DOCKER_NETWORK || 'klyra-api-network';
const portBase = (): number => Number(process.env.KLYRA_API_PORT_BASE || 41000);
/** True when the backend runs on the host (dev): publish container ports on 127.0.0.1. */
const publishOnLoopback = (): boolean => String(process.env.KLYRA_DOCKER_RUNTIME || 'docker').toLowerCase() === 'host';

interface DockerResult { code: number; stdout: string; stderr: string; }

function runDocker(args: string[], opts: { timeoutMs?: number; onLine?: DeployLog } = {}): Promise<DockerResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill();
      stderr += '\nDocker command timed out.';
      finish(124);
    }, opts.timeoutMs ?? 10 * 60 * 1000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      opts.onLine?.(chunk.toString().trim());
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      opts.onLine?.(chunk.toString().trim());
    });
    child.on('error', (error) => {
      stderr += `\n${error.message}`;
      finish(1);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

/** Detects a usable Docker daemon. Never throws. */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const result = await runDocker(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 10_000 });
    return result.code === 0 && /\d/.test(result.stdout);
  } catch {
    return false;
  }
}

/** Creates the shared Klyra API network when missing (idempotent). */
export async function ensureNetwork(log: DeployLog): Promise<string> {
  const name = networkName();
  const result = await runDocker(['network', 'create', name]);
  if (result.code === 0) log(`[docker] created network ${name}`);
  else if (!/already exists/i.test(result.stderr)) {
    throw new Error(`Unable to ensure Docker network "${name}": ${result.stderr.trim()}`);
  }
  return name;
}

export async function buildImage(contextDir: string, tag: string, log: DeployLog): Promise<void> {
  log(`[docker] building image ${tag}`);
  const result = await runDocker(['build', '-t', tag, contextDir], { onLine: log, timeoutMs: 15 * 60 * 1000 });
  if (result.code !== 0) throw new Error(`Docker build failed for ${tag}: ${result.stderr.trim().slice(-2000)}`);
  log(`[docker] image ${tag} built`);
}

/** Pulls a user-provided image (API source "Docker image") before running it. */
export async function pullImage(image: string, log: DeployLog): Promise<void> {
  log(`[docker] pulling ${image}`);
  const result = await runDocker(['pull', image], { onLine: log, timeoutMs: 15 * 60 * 1000 });
  if (result.code !== 0) throw new Error(`Docker pull failed for ${image}: ${result.stderr.trim().slice(-2000)}`);
}

export interface RunOptions {
  name: string;
  image: string;
  network: string;
  internalPort: number;
  log: DeployLog;
}

/**
 * Runs the deployment container. Replaces only the container of the exact same
 * name (same project + same version) — containers of other versions are left
 * untouched so multiple versions can coexist. When the backend runs on the
 * host, the port is published on 127.0.0.1 with automatic retry on conflicts.
 */
export async function runContainer(opts: RunOptions): Promise<{ hostPort?: number }> {
  const remove = await runDocker(['rm', '-f', opts.name]);
  if (remove.code !== 0 && !/no such container/i.test(remove.stderr)) {
    opts.log(`[docker] note while replacing previous container: ${remove.stderr.trim().split('\n')[0]}`);
  }

  const baseArgs = ['run', '-d', '--name', opts.name, '--network', opts.network, '--restart', 'unless-stopped'];

  if (publishOnLoopback()) {
    let hostPort = portBase();
    let lastError = '';
    for (let attempt = 0; attempt < 10; attempt += 1, hostPort += 1) {
      const result = await runDocker([...baseArgs, '-p', `127.0.0.1:${hostPort}:${opts.internalPort}`, opts.image]);
      if (result.code === 0) {
        opts.log(`[docker] container ${opts.name} started (127.0.0.1:${hostPort} -> ${opts.internalPort})`);
        return { hostPort };
      }
      lastError = result.stderr;
      if (!/address already in use|port is already allocated|bind for .* failed/i.test(result.stderr)) break;
      opts.log(`[docker] host port ${hostPort} busy — retrying with ${hostPort + 1}`);
    }
    throw new Error(`docker run failed: ${lastError.trim().split('\n').slice(-3).join(' ') || 'unknown error'}`);
  }

  // Production: the backend itself is containerized — no host port at all. The
  // API container is reachable only through the internal Docker network.
  const result = await runDocker([...baseArgs, opts.image]);
  if (result.code !== 0) throw new Error(`docker run failed: ${result.stderr.trim().split('\n').slice(-3).join(' ') || 'unknown error'}`);
  opts.log(`[docker] container ${opts.name} started on network ${opts.network} (no host port published)`);
  return {};
}

export async function removeContainer(name: string): Promise<void> {
  await runDocker(['rm', '-f', name], { timeoutMs: 30_000 });
}

export async function startContainer(name: string): Promise<void> {
  const result = await runDocker(['start', name], { timeoutMs: 30_000 });
  if (result.code !== 0) throw new Error(`docker start failed: ${result.stderr.trim()}`);
}

export interface ContainerState { exists: boolean; running: boolean; status: string; }

export async function inspectContainer(name: string): Promise<ContainerState | null> {
  const result = await runDocker(['inspect', '-f', '{{.State.Status}} {{.State.Running}}', name], { timeoutMs: 15_000 });
  if (result.code !== 0 && /no such object|no such container/i.test(result.stderr)) return null;
  if (result.code !== 0) throw new Error(`docker inspect failed: ${result.stderr.trim()}`);
  const [status, running] = result.stdout.trim().split(/\s+/);
  return { exists: true, running: running === 'true', status: status || 'unknown' };
}

export async function getContainerLogs(name: string, tail = 30): Promise<string> {
  const result = await runDocker(['logs', '--tail', String(tail), name], { timeoutMs: 15_000 });
  return (result.stdout + result.stderr).trim();
}

/** Waits until the deployment answers /health with 2xx/3xx. */
export async function waitForHealth(baseUrl: string, log: DeployLog, attempts = 40, delayMs = 500): Promise<void> {
  const target = `${baseUrl.replace(/\/+$/, '')}/health`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(2000), headers: { 'User-Agent': 'KlyraDockerDeploy/1.0' } });
      if (response.status >= 200 && response.status < 400) {
        log(`[docker] health check passed (HTTP ${response.status} on ${target})`);
        return;
      }
      if (attempt % 5 === 0) log(`[docker] waiting for ${target} (HTTP ${response.status}, attempt ${attempt}/${attempts})`);
    } catch {
      if (attempt % 5 === 0) log(`[docker] waiting for ${target} (unreachable, attempt ${attempt}/${attempts})`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Container did not become healthy: ${target} did not answer /health in time.`);
}

/* ==========================================================================
 * Artifact scaffold + full deploy orchestration
 *
 * A Klyra-hosted API is a tiny zero-dependency Node HTTP service generated
 * from the project's endpoint catalog. The scaffold is written to a temp
 * build context and turned into an image by buildImage() — no registry, no
 * external tooling, just the Docker CLI.
 * ======================================================================== */

const esc = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const jsonLiteral = (value: unknown): string => JSON.stringify(value ?? null);

/** Writes the runnable API artifact (server.js + package.json + Dockerfile) into a fresh temp directory. */
export async function scaffoldApiArtifact(
  slug: string,
  version: string,
  endpoints: DetailedEndpointRow[],
): Promise<string> {
  const contextDir = path.join(os.tmpdir(), `klyra-api-build-${sanitizeContainerToken(slug)}-${Date.now()}`);
  await rm(contextDir, { recursive: true, force: true });
  await mkdir(contextDir, { recursive: true });

  const routeHandlers = endpoints
    .filter((e) => e.method && e.path)
    .map((e) => ({ method: String(e.method).toUpperCase(), path: String(e.path), summary: String(e.summary || '') }));

  const serverJs = `// Klyra-generated API — ${esc(slug)} ${esc(version)}
// Zero-dependency Node HTTP service. Regenerated on every deploy.
const http = require('node:http');

const ENDPOINTS = ${jsonLiteral(routeHandlers)};

function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(':')) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    else if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const pathname = url.pathname;
  const method = (request.method || 'GET').toUpperCase();
  const payload = await readBody(request);
  const send = (status, body) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  try {
    if (pathname === '/health') return send(200, { status: 'ok', service: '${esc(slug)}', version: '${esc(version)}' });

    for (const endpoint of ENDPOINTS) {
      if (endpoint.method !== method) continue;
      const params = matchPath(endpoint.path, pathname);
      if (!params) continue;
      return send(200, {
        endpoint: endpoint.path,
        method,
        params,
        query: Object.fromEntries(url.searchParams.entries()),
        body: payload,
      });
    }

    return send(404, { error: 'Not found', path: pathname, method });
  } catch (error) {
    return send(500, { error: 'Internal error', detail: String((error && error.message) || error) });
  }
});

const PORT = process.env.PORT || ${DEFAULT_INTERNAL_PORT};
server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write('${esc(slug)} ${esc(version)} listening on port ' + PORT + '\\n');
});
`;

  const packageJson = JSON.stringify({
    name: `klyra-api-${sanitizeContainerToken(slug)}`,
    version: version.replace(/^v/, '') || '1.0.0',
    private: true,
    scripts: { start: 'node server.js' },
  }, null, 2);

  const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
ENV PORT=${DEFAULT_INTERNAL_PORT}
EXPOSE ${DEFAULT_INTERNAL_PORT}
CMD ["node", "server.js"]
`;

  await writeFile(path.join(contextDir, 'server.js'), serverJs, 'utf8');
  await writeFile(path.join(contextDir, 'package.json'), packageJson, 'utf8');
  await writeFile(path.join(contextDir, 'Dockerfile'), dockerfile, 'utf8');
  return contextDir;
}

/**
 * Full Docker deploy pipeline for one Klyra-hosted API:
 *   availability check -> shared network -> (pull user image | scaffold + build)
 *   -> run container -> wait for /health -> runtime descriptor.
 * Throws on any failure — the caller records a failed deployment, never a
 * healthy one.
 */
export async function deployProjectDocker(opts: {
  slug: string;
  version: string;
  /** Pre-built image reference (skips the build; pulled before run). */
  image?: string;
  endpoints: DetailedEndpointRow[];
  log: DeployLog;
}): Promise<DeploymentRuntime> {
  const available = await isDockerAvailable();
  if (!available) throw new DockerUnavailableError();
  const log = opts.log;

  const network = await ensureNetwork(log);
  const image = opts.image?.trim() || imageNameFor(opts.slug, opts.version);
  if (opts.image?.trim()) {
    await pullImage(image, log);
  } else {
    const contextDir = await scaffoldApiArtifact(opts.slug, opts.version, opts.endpoints);
    try {
      await buildImage(contextDir, image, log);
    } finally {
      await rm(contextDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  const name = containerNameFor(opts.slug, opts.version);
  const internalPort = DEFAULT_INTERNAL_PORT;
  const { hostPort } = await runContainer({ name, image, network, internalPort, log });

  const runtime: DeploymentRuntime = { kind: 'docker', containerName: name, image, internalPort };
  if (hostPort !== undefined) {
    runtime.hostPort = hostPort;
    runtime.hostUrl = `http://127.0.0.1:${hostPort}`;
    runtime.upstream = runtime.hostUrl;
  } else {
    runtime.internalUrl = `http://${name}:${internalPort}`;
    runtime.upstream = runtime.internalUrl;
  }

  const healthBase = runtime.hostUrl || runtime.internalUrl || '';
  await waitForHealth(healthBase, log);
  return runtime;
}
