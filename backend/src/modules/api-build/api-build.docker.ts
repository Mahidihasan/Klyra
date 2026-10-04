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

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import {
  accessSync,
  constants as fsConstants,
} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_INTERNAL_PORT,
  containerNameFor,
  imageNameFor,
  sanitizeContainerToken,
  type DeploymentRuntime,
  usesHostDockerRuntime,
} from './api-build.deployment';
import type { DetailedEndpointRow } from './api-build.service';

export class DockerUnavailableError extends Error {
  constructor(message = 'Docker is not available on the host running the Klyra backend. Start Docker (or install it) and retry the deployment.') {
    super(message);
    this.name = 'DockerUnavailableError';
  }
}

export class ReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadinessError';
  }
}

export type DeployLog = (line: string) => void;

const networkName = (): string => process.env.KLYRA_DOCKER_NETWORK || 'klyra-api-network';
const portBase = (): number => Number(process.env.KLYRA_API_PORT_BASE || 41000);
/** True when the backend runs on the host (dev): publish container ports on 127.0.0.1. */
const publishOnLoopback = (): boolean => usesHostDockerRuntime();

interface DockerResult { code: number; stdout: string; stderr: string; }

function dockerCandidatePaths(): string[] {
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return [
    path.join(programFiles, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
    path.join(programFilesX86, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
    path.join(localAppData, 'Docker', 'resources', 'bin', 'docker.exe'),
    path.join(localAppData, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
  ];
}

function resolveDockerBin(): string {
  const override = String(process.env.KLYRA_DOCKER_BIN || '').trim();
  if (override) return override;
  const installed = dockerCandidatePaths().find((candidate) => {
    try { accessSync(candidate, fsConstants.X_OK); return true; } catch { return false; }
  });
  if (installed) return installed;
  try {
    if (spawnSync('docker', ['--version'], { shell: true, windowsHide: true, timeout: 3000 }).status === 0) return 'docker';
  } catch { /* fall through to the normal spawn error path */ }
  return 'docker';
}

function runDocker(args: string[], opts: { timeoutMs?: number; onLine?: DeployLog } = {}): Promise<DockerResult> {
  return new Promise((resolve) => {
    const child = spawn(resolveDockerBin(), args, { windowsHide: true });
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

export interface DockerDiagnostic {
  available: boolean;
  dockerBin: string;
  detail: string;
}

export async function getDockerDiagnostic(): Promise<DockerDiagnostic> {
  const dockerBin = resolveDockerBin();
  const result = await runDocker(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 10_000 });
  if (result.code === 0 && /\d/.test(result.stdout)) {
    return { available: true, dockerBin, detail: `Docker daemon reachable (server ${result.stdout.trim()}).` };
  }
  const detail = result.stderr.trim().split(/\r?\n/).filter(Boolean)[0] || `docker version exited with code ${result.code}`;
  return { available: false, dockerBin, detail: `Docker runtime unavailable: ${detail}` };
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
export async function ensureNetwork(log: DeployLog, requestedName = networkName()): Promise<string> {
  const name = requestedName;
  const result = await runDocker(['network', 'create', name]);
  if (result.code === 0) log(`[docker] created network ${name}`);
  else if (!/already exists/i.test(result.stderr)) {
    throw new Error(`Unable to ensure Docker network "${name}": ${result.stderr.trim()}`);
  }
  return name;
}

/** Connects an in-container backend to one deployment's isolated network. */
export async function connectContainerToNetwork(
  containerName: string,
  network: string,
  log: DeployLog,
): Promise<void> {
  const result = await runDocker(['network', 'connect', network, containerName], { timeoutMs: 30_000 });
  if (result.code === 0) {
    log(`[docker] backend container ${containerName} connected to isolated network ${network}`);
    return;
  }
  if (/already exists|already connected/i.test(result.stderr)) {
    log(`[docker] backend container ${containerName} already attached to isolated network ${network}`);
    return;
  }
  throw new Error(`Unable to attach backend container ${containerName} to ${network}: ${result.stderr.trim()}`);
}

/** Docker reports the current container ID as HOSTNAME in the backend container. */
export function backendContainerForDockerNetwork(): string | null {
  if (usesHostDockerRuntime()) return null;
  return String(process.env.KLYRA_BACKEND_CONTAINER || process.env.HOSTNAME || '').trim() || null;
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

function isContainerNameConflict(message: string): boolean {
  // Docker Desktop and Engine versions vary the wording and punctuation here
  // (for example, `Conflict. The container name "/x" is already in use`).
  return /container\s+name[^\r\n]*(?:already\s+in\s+use|in\s+use)|conflict[^\r\n]*name[^\r\n]*in\s+use/i.test(message);
}

function conflictFallbackName(name: string): string {
  const suffix = `-r${randomBytes(4).toString('hex')}`;
  return `${name.slice(0, 63 - suffix.length).replace(/-+$/, '')}${suffix}`;
}

async function reportContainerNameConflict(name: string, message: string, log: DeployLog): Promise<void> {
  const reportedId = /container\s+["']([^"']+)["']/i.exec(message)?.[1];
  const [contextResult, nameResult, idResult] = await Promise.all([
    runDocker(['context', 'show'], { timeoutMs: 5_000 }),
    runDocker(['inspect', '--format', '{{.Id}} {{.Name}} {{.State.Status}}', name], { timeoutMs: 5_000 }),
    reportedId
      ? runDocker(['inspect', '--format', '{{.Id}} {{.Name}} {{.State.Status}}', reportedId], { timeoutMs: 5_000 })
      : Promise.resolve(null),
  ]);
  log(
    `[docker] container name conflict diagnostic: dockerContext=${contextResult.code === 0 ? contextResult.stdout.trim() : 'unavailable'}, name=${name}, daemonReportedId=${reportedId || 'unknown'}, nameLookup=${nameResult.code === 0 ? nameResult.stdout.trim() : nameResult.stderr.trim() || 'not found'}, idLookup=${idResult ? (idResult.code === 0 ? idResult.stdout.trim() : idResult.stderr.trim() || 'not found') : 'not supplied'}`,
  );
}

/**
 * Runs the deployment container. Replaces only the container of the exact same
 * name (same project + same version) — containers of other versions are left
 * untouched so multiple versions can coexist. When the backend runs on the
 * host, the port is published on 127.0.0.1 with automatic retry on conflicts.
 */
export async function runContainer(opts: RunOptions): Promise<{ hostPort?: number; containerName: string }> {
  const remove = await runDocker(['rm', '-f', opts.name]);
  if (remove.code !== 0 && !/no such container/i.test(remove.stderr)) {
    opts.log(`[docker] note while replacing previous container: ${remove.stderr.trim().split('\n')[0]}`);
  }

  const runArgs = (name: string) => [
    'run', '-d', '--name', name, '--network', opts.network, '--restart', 'unless-stopped',
  ];

  if (publishOnLoopback()) {
    let hostPort = portBase();
    let lastError = '';
    let containerName = opts.name;
    const attemptedNames = new Set<string>([containerName]);
    // Failed `docker run -p` starts can leave a container in `created` state.
    // Remove that exact failed attempt before trying the next host port, or
    // the next iteration only reports a name conflict and burns another slot.
    for (let attempt = 0; attempt < 50; attempt += 1, hostPort += 1) {
      const result = await runDocker([
        ...runArgs(containerName),
        '-p',
        `127.0.0.1:${hostPort}:${opts.internalPort}`,
        opts.image,
      ]);
      if (result.code === 0) {
        opts.log(
          `[docker] container ${containerName} started (127.0.0.1:${hostPort} -> ${opts.internalPort})`,
        );
        return { hostPort, containerName };
      }
      lastError = result.stderr;
      if (isContainerNameConflict(result.stderr)) {
        await reportContainerNameConflict(containerName, result.stderr, opts.log);
        if (await removeCreatedContainer(containerName, opts.log)) {
          opts.log(`[docker] removed stale created container ${containerName} before retrying host port ${hostPort + 1}`);
          continue;
        }
        const previous = containerName;
        do {
          containerName = conflictFallbackName(opts.name);
        } while (attemptedNames.has(containerName));
        attemptedNames.add(containerName);
        opts.log(`[docker] retrying with unique container name ${containerName} (instead of ${previous})`);
        continue;
      }
      if (
        !/address already in use|port is already allocated|bind for .* failed/i.test(result.stderr)
      ) {
        break;
      }
      if (!(await removeCreatedContainer(containerName, opts.log))) {
        // If Docker left a running or otherwise non-removable container behind,
        // preserve it and move this attempt to a fresh name.
        const previous = containerName;
        do {
          containerName = conflictFallbackName(opts.name);
        } while (attemptedNames.has(containerName));
        attemptedNames.add(containerName);
        opts.log(`[docker] could not clean failed container ${previous}; retrying with ${containerName}`);
      } else {
        opts.log(`[docker] removed failed container ${containerName} after host port ${hostPort} was unavailable`);
      }
      opts.log(`[docker] host port ${hostPort} busy — retrying with ${hostPort + 1}`);
    }
    throw new Error(`docker run failed: ${lastError.trim().split('\n').slice(-3).join(' ') || 'unknown error'}`);
  }

  // Production: the backend itself is containerized — no host port at all. The
  // API container is reachable only through the internal Docker network.
  let containerName = opts.name;
  const attemptedNames = new Set<string>([containerName]);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await runDocker([...runArgs(containerName), opts.image]);
    if (result.code === 0) {
      opts.log(
        `[docker] container ${containerName} started on network ${opts.network} (no host port published)`,
      );
      return { containerName };
    }
    if (!isContainerNameConflict(result.stderr) || attempt === 9) {
      throw new Error(
        `docker run failed: ${result.stderr.trim().split('\n').slice(-3).join(' ') || 'unknown error'}`,
      );
    }
    await reportContainerNameConflict(containerName, result.stderr, opts.log);
    const previous = containerName;
    do {
      containerName = conflictFallbackName(opts.name);
    } while (attemptedNames.has(containerName));
    attemptedNames.add(containerName);
    opts.log(`[docker] retrying with unique container name ${containerName} (instead of ${previous})`);
  }
  throw new Error(`docker run failed: could not allocate a unique container name for ${opts.name}`);
}

/**
 * `docker run` creates the container before publishing its host port. If port
 * binding fails, Docker may leave that container behind in `created` state.
 * Only remove that exact name when it is not running; never disturb a live API.
 */
async function removeCreatedContainer(name: string, log: DeployLog): Promise<boolean> {
  try {
    const state = await inspectContainer(name);
    if (!state) return true;
    if (state.running || state.status !== 'created') return false;
    await removeContainer(name);
    return true;
  } catch (error) {
    log(`[docker] unable to remove failed container ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function removeContainer(name: string): Promise<void> {
  const result = await runDocker(['rm', '-f', name], { timeoutMs: 30_000 });
  if (result.code !== 0 && !/no such container|no such object/i.test(result.stderr)) {
    throw new Error(`docker rm failed for ${name}: ${result.stderr.trim()}`);
  }
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

/** Reads a container's address on the deployment network for DNS startup fallback. */
export async function inspectContainerNetworkIp(name: string, network: string): Promise<string | null> {
  const result = await runDocker(['inspect', '--format', '{{json .NetworkSettings.Networks}}', name], {
    timeoutMs: 15_000,
  });
  if (result.code !== 0) return null;
  try {
    const networks = JSON.parse(result.stdout.trim()) as Record<string, { IPAddress?: string }>;
    return networks[network]?.IPAddress || null;
  } catch {
    return null;
  }
}

export async function getContainerLogs(name: string, tail = 30): Promise<string> {
  const result = await runDocker(['logs', '--tail', String(tail), name], { timeoutMs: 15_000 });
  return (result.stdout + result.stderr).trim();
}

export interface ReadinessOptions {
  mode?: 'auto' | 'http' | 'tcp';
  path?: string;
  /** Explicit Docker DNS name. Avoid URL parsing for container names with dotted version suffixes. */
  hostname?: string;
  /** Docker inspect address used only when DNS has not resolved the container name yet. */
  fallbackHostname?: string;
  port?: number;
  openApiUrl?: string;
  attempts?: number;
  /** Wall-clock startup window; when supplied it takes precedence over attempts. */
  startupGraceMs?: number;
  delayMs?: number;
}

/** Inspects image metadata to detect exposed ports (e.g. from EXPOSE in Dockerfile). */
export async function inspectImageExposedPorts(image: string): Promise<number[]> {
  try {
    const result = await runDocker(
      ['inspect', '--format', '{{json .Config.ExposedPorts}}', image],
      { timeoutMs: 15_000 },
    );
    if (result.code !== 0 || !result.stdout.trim()) {
      return [];
    }
    const portsObj = JSON.parse(result.stdout.trim()) as Record<string, unknown> | null;
    if (!portsObj || typeof portsObj !== 'object') {
      return [];
    }
    const ports: number[] = [];
    for (const key of Object.keys(portsObj)) {
      const match = /^(\d+)/.exec(key);
      if (match) {
        ports.push(Number(match[1]));
      }
    }
    return ports;
  } catch {
    return [];
  }
}

/** Raw TCP port probe to check if container socket is accepting connections. */
export function checkTcpPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Flexible readiness check for arbitrary Docker containers.
 * Does NOT assume /health: supports automatic path discovery, explicit HTTP path, or TCP socket checks.
 */
export async function waitForReadiness(
  baseUrl: string,
  log: DeployLog,
  opts: ReadinessOptions = {},
): Promise<void> {
  const attempts = opts.attempts ?? 40;
  // The configured budget can end just before a cold JVM/.NET host finishes
  // starting. Keep a short final grace window and probe the same live endpoint
  // before classifying a still-starting container as failed.
  const graceAttempts = 6;
  const startupDeadline = opts.startupGraceMs ? Date.now() + opts.startupGraceMs : null;
  const totalAttempts = startupDeadline ? Number.POSITIVE_INFINITY : attempts + graceAttempts;
  const delayMs = opts.delayMs ?? 500;
  const mode = opts.mode || 'auto';

  // URL rejects valid Docker names whose final dotted version component looks
  // numeric (for example `klyra-api-demo-v1.0.0`). Parse authority ourselves
  // and pass the hostname directly to Node's socket/HTTP clients.
  const scheme = /^https:/i.test(baseUrl) ? 'https:' : 'http:';
  const authority = /^(?:https?:\/\/)?([^/?#]+)/i.exec(baseUrl)?.[1] || '';
  const parsedAuthority = /^(?:[^@]+@)?(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(authority);
  const authorityHost = parsedAuthority?.[1]?.replace(/^\[|\]$/g, '') || '';
  const host = opts.hostname || authorityHost || '127.0.0.1';
  const port = opts.port || Number(parsedAuthority?.[2]) || (scheme === 'https:' ? 443 : 80);
  const authorityIndex = baseUrl.indexOf(authority);
  const rawBasePath = authorityIndex >= 0 ? baseUrl.slice(authorityIndex + authority.length) : '';
  const basePath = rawBasePath.split(/[?#]/, 1)[0].replace(/\/+$/, '');

  const reportDns = async (): Promise<boolean> => {
    try {
      const addresses = await lookup(host, { all: true });
      log(`[docker] DNS resolved ${host} -> ${addresses.map((entry) => `${entry.address} (IPv${entry.family})`).join(', ')}`);
      return true;
    } catch (error) {
      log(`[docker] DNS resolution failed for ${host}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  const dnsResolved = await reportDns();
  const probeHost = !dnsResolved && opts.fallbackHostname ? opts.fallbackHostname : host;
  if (probeHost !== host) {
    log(`[docker] probing inspected container address ${probeHost} while Docker DNS for ${host} is unavailable`);
  }

  if (mode === 'tcp') {
    log(`[docker] waiting for TCP socket on ${probeHost}:${port}...`);
    for (let attempt = 1; attempt <= totalAttempts && (!startupDeadline || Date.now() < startupDeadline); attempt += 1) {
      if (attempt === attempts + 1 && !startupDeadline) log(`[docker] readiness budget reached; checking startup grace (${graceAttempts} additional attempts)`);
      const tcpTimeout = startupDeadline ? Math.max(100, Math.min(1500, startupDeadline - Date.now())) : 1500;
      const connected = await checkTcpPort(probeHost, port, tcpTimeout);
      if (connected) {
        log(`[docker] TCP readiness check passed on ${probeHost}:${port}`);
        return;
      }
      if (attempt % 5 === 0) {
        log(`[docker] waiting for ${probeHost}:${port} TCP (attempt ${attempt}/${totalAttempts})`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new ReadinessError(
      `Container did not become ready: TCP port ${port} on ${probeHost} did not open in time.`,
    );
  }

  // Try the configured endpoint first, then a root-page fallback. A missing
  // `/health` is not a deployment failure when the API root answers.
  const candidatePaths: string[] = [];
  const addCandidate = (candidate: string): void => {
    const normalized = `/${candidate.replace(/^\/+/, '')}`;
    if (!candidatePaths.includes(normalized)) candidatePaths.push(normalized);
  };

  if (mode === 'http') {
    addCandidate(opts.path || '/health');
  } else {
    if (opts.path?.trim()) addCandidate(opts.path.trim());
    if (opts.openApiUrl && opts.openApiUrl.startsWith('/')) {
      addCandidate(opts.openApiUrl);
    }
    addCandidate('/health');
  }
  addCandidate('/');

  log(
    `[docker] checking readiness (${mode} mode) at http${scheme === 'https:' ? 's' : ''}://${probeHost}:${port} (container ${host}); candidates: ${candidatePaths.join(', ')}`,
  );

  for (let attempt = 1; attempt <= totalAttempts && (!startupDeadline || Date.now() < startupDeadline); attempt += 1) {
    if (attempt === attempts + 1 && !startupDeadline) log(`[docker] readiness budget reached; checking startup grace (${graceAttempts} additional attempts)`);
    for (const endpoint of candidatePaths) {
      const requestPath = `${basePath}${endpoint}` || '/';
      const client = scheme === 'https:' ? https : http;
      const statusCode = await new Promise<number | null>((resolve) => {
        const request = client.request({
          hostname: probeHost,
          port,
          path: requestPath,
          method: 'GET',
          headers: { 'User-Agent': 'KlyraDockerDeploy/1.0', Accept: '*/*' },
          timeout: startupDeadline ? Math.max(100, Math.min(2500, startupDeadline - Date.now())) : 2500,
        }, (response) => {
          const status = response.statusCode || 0;
          response.resume();
          resolve(status);
        });
        request.once('timeout', () => request.destroy(new Error('request timed out')));
        request.once('error', (error) => {
          if (attempt === 1 || attempt % 5 === 0) {
            log(`[docker] connection failed for ${probeHost}:${port}${requestPath}: ${error.message}`);
          }
          resolve(null);
        });
        request.end();
      });

      if (statusCode === null) continue;
      log(`[docker] HTTP ${statusCode} from ${probeHost}:${port}${requestPath}`);
      // Only successful/redirect responses establish HTTP readiness. A missing
      // health path falls through to the root candidate.
      if (statusCode >= 200 && statusCode < 400) {
        log(`[docker] readiness passed using ${endpoint} at ${probeHost}:${port} (HTTP ${statusCode})`);
        return;
      }
    }

    if (attempt % 5 === 0) {
      log(`[docker] waiting for container HTTP readiness (attempt ${attempt}/${totalAttempts})`);
      await reportDns();
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new ReadinessError(
    `Container did not become ready: no candidate HTTP endpoints answered on ${scheme}//${probeHost}:${port} in time.`,
  );
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

/** Backward-compatible readiness check for the generated Klyra API scaffold. */
export async function waitForHealth(baseUrl: string, log: DeployLog, attempts = 40, delayMs = 500): Promise<void> {
  return waitForReadiness(baseUrl, log, { mode: 'http', path: '/health', attempts, delayMs });
}
