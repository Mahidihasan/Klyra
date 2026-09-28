/**
 * API Build — real Docker hosting for Klyra-built APIs.
 *
 * This module performs the actual container lifecycle. Nothing here is
 * simulated: the image is pulled or built, a real container is started on the
 * shared Klyra Docker network, and the deployment is only reported healthy
 * after a real readiness check passes (automatic path discovery, an explicit
 * HTTP endpoint, or a TCP socket probe). Every failure surfaces as an
 * exception — a failed deploy NEVER produces a healthy record (the pipeline
 * records the failure instead).
 *
 * The Docker CLI is resolved through resolveDockerBin() (KLYRA_DOCKER_BIN
 * override, then the well-known Docker Desktop install locations, then PATH) and
 * getDockerDiagnostic() distinguishes a missing CLI from a daemon that is not
 * running, so a "Docker unavailable" failure tells the user exactly what to do.
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
import {
  accessSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { usesHostDockerRuntime } from './api-build.deployment';

export class DockerUnavailableError extends Error {
  constructor(
    message = 'Docker is not available on the host running the Klyra backend. Start Docker (or install it) and retry the deployment.',
  ) {
    super(message);
    this.name = 'DockerUnavailableError';
  }
}

/**
 * Thrown when a container never answered the readiness probe (HTTP or TCP).
 * Deploy failures are distinguished by this class so a deployment that aborted
 * BEFORE the health gate is never recorded as "health check failed" — no probe
 * ran, so the last health check is "not verified".
 */
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

interface DockerResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Marker appended to stderr when the docker executable itself cannot be spawned. */
const CLI_MISSING_MARKER = '__KLYRA_DOCKER_CLI_MISSING__';

/** Well-known docker.exe locations, used when `docker` is not on PATH. */
function dockerCandidatePaths(): string[] {
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData =
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    return [
    path.join(programFiles, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
    path.join(programFilesX86, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
    path.join(localAppData, 'Docker', 'resources', 'bin', 'docker.exe'),
    path.join(localAppData, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
  ];
}

function looksExecutable(candidate: string): boolean {
  try {
    accessSync(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the docker executable. Order:
 *   1. KLYRA_DOCKER_BIN (explicit override — absolute path or bare name)
 *   2. well-known install locations (Windows: Docker Desktop's resources\bin)
 *   3. bare `docker` on PATH — spawn resolves it; a missing binary is reported
 *      as a cli-missing diagnostic rather than a crash.
 */
export function resolveDockerBin(): string | null {
  const override = String(process.env.KLYRA_DOCKER_BIN || '').trim();
  if (override) {
    return override;
  }
  const fromPaths = dockerCandidatePaths().find((candidate) => looksExecutable(candidate));
  if (fromPaths) return fromPaths;
  // Fall back to PATH lookup — documented as step 3 in the Docker runtime docs.
  // spawnSync with shell:true lets CreateProcess / the shell resolve bare
  // `docker` the same way the user's terminal does, so the diagnostic can
  // report the CLI that was actually used instead of claiming it is missing.
  try {
    const { status } = spawnSync('docker', ['--version'], {
      shell: true,
      windowsHide: true,
      timeout: 3000,
    });
    if (status === 0) return 'docker';
  } catch {
    // spawnSync threw — fall through to null
  }
  return null;
}

export function runDocker(
  args: string[],
  opts: { timeoutMs?: number; onLine?: DeployLog; cwd?: string } = {},
): Promise<DockerResult> {
  return new Promise((resolve) => {
    const bin = resolveDockerBin() ?? 'docker';
    const child = spawn(bin, args, { windowsHide: true, cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };
    const timer = setTimeout(
      () => {
        child.kill();
        stderr += '\nDocker command timed out.';
        finish(124);
      },
      opts.timeoutMs ?? 10 * 60 * 1000,
    );
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      opts.onLine?.(chunk.toString().trim());
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      opts.onLine?.(chunk.toString().trim());
    });
    child.on('error', (error) => {
      // ENOENT means the executable itself was not found — distinguish that
      // from a daemon problem so the deploy failure says what to install/start.
      const code = (error as NodeJS.ErrnoException).code;
      stderr += code === 'ENOENT' ? `\n${CLI_MISSING_MARKER}` : `\n${error.message}`;
      finish(1);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

export interface DockerDiagnostic {
  available: boolean;
  /** The docker executable that was probed (null when the CLI was not found). */
  dockerBin: string | null;
  problem: 'ok' | 'cli-missing' | 'daemon-unreachable';
  /** Human-readable, actionable explanation surfaced by the deploy failure. */
  detail: string;
}

/**
 * Full diagnosis of the Docker runtime. Distinguishes a missing CLI from a
 * daemon that is installed but not reachable (Docker Desktop not started), so
 * the deploy failure tells the user exactly what to install or start — and
 * mentions DOCKER_HOST for pointing at a daemon on another machine.
 */
export async function getDockerDiagnostic(): Promise<DockerDiagnostic> {
  const discovered = resolveDockerBin();
  const result = await runDocker(['version', '--format', '{{.Server.Version}}'], {
    timeoutMs: 10_000,
  });
  if (result.code === 0 && /\d/.test(result.stdout)) {
    return {
      available: true,
      dockerBin: discovered ?? 'docker',
      problem: 'ok',
      detail: `Docker daemon reachable (server ${result.stdout.trim()}).`,
    };
  }

  if (result.stderr.includes(CLI_MISSING_MARKER)) {
    return {
      available: false,
      dockerBin: null,
      problem: 'cli-missing',
      detail:
        'The Docker CLI ("docker") was not found on this host (checked PATH and the Docker Desktop install locations). ' +
        'Install Docker Desktop, or set KLYRA_DOCKER_BIN to an existing docker binary. ' +
        'You can also set DOCKER_HOST to use a daemon on another machine (for example ssh://user@host).',
    };
  }

  const detail =
    result.stderr.replace(CLI_MISSING_MARKER, '').trim().split(/\r?\n/).filter(Boolean)[0] ||
    `docker version exited with code ${result.code}`;
  return {
    available: false,
    dockerBin: discovered,
    problem: 'daemon-unreachable',
    detail: `Docker CLI found${
      discovered ? ` at ${discovered}` : ' on PATH'
    } but the daemon is not reachable (${detail}). Start Docker Desktop — or set DOCKER_HOST to a reachable daemon (for example tcp://host:2375 or ssh://user@host) — and retry the deployment.`,
  };
}

/** Detects a usable Docker daemon. Never throws. */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    return (await getDockerDiagnostic()).available;
  } catch {
    return false;
  }
}

/** Creates the shared Klyra API network when missing (idempotent). */
export async function ensureNetwork(log: DeployLog, requestedName = networkName()): Promise<string> {
  const name = requestedName;
  const result = await runDocker(['network', 'create', name]);
  if (result.code === 0) {
    log(`[docker] created network ${name}`);
  } else if (!/already exists/i.test(result.stderr)) {
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
  const resolvedContext = path.resolve(contextDir);
  const dockerignore = path.join(resolvedContext, '.dockerignore');
  const entries: string[] = [];
  const directories: string[] = [];
  const reparsePoints: string[] = [];
  let gitFound = false;
  const walk = (directory: string, relative = '') => {
    directories.push(relative || '.');
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      const entryRelative = path.join(relative, entry.name);
      const metadata = lstatSync(entryPath);
      if (entry.name === '.git') {
        gitFound = true;
      }
      if (entry.isSymbolicLink()) {
        reparsePoints.push(`${entryRelative} [${metadata.isSymbolicLink() ? 'symlink' : 'reparse-point'}]`);
      }
      if (entry.isDirectory()) walk(entryPath, entryRelative);
      else if (entry.isFile()) entries.push(`${entryRelative} [${metadata.size} bytes]`);
    }
  };
  walk(resolvedContext);
  entries.sort();
  const totalBytes = entries.reduce((total, entry) => total + Number(entry.match(/\[(\d+) bytes\]$/)?.[1] || 0), 0);
  const jarPath = path.join(resolvedContext, 'target', 'lib', 'jetty-runner.jar');
  const warFiles = existsSync(path.join(resolvedContext, 'target'))
    ? readdirSync(path.join(resolvedContext, 'target')).filter((name) => /\.war$/i.test(name))
    : [];
  log(`[docker] build context: ${resolvedContext}`);
  log(`[docker] build context files: ${entries.length}, ${totalBytes} bytes`);
  log(`[docker] effective .dockerignore: ${existsSync(dockerignore) ? readFileSync(dockerignore, 'utf8') || '<empty>' : '<absent>'}`);
  log(`[docker] build context directories: ${directories.sort().join(', ') || '.'}`);
  log(`[docker] build context entries: ${entries.join(', ') || '<empty>'}`);
  log(`[docker] build context reparse points: ${reparsePoints.join(', ') || '<none>'}`);
  log(`[docker] .git exists anywhere: ${gitFound}`);
  log(`[docker] target/lib/jetty-runner.jar exists: ${existsSync(jarPath)}`);
  log(`[docker] target/*.war: ${warFiles.join(', ') || '<none>'}`);
  log(`[docker] command: docker build -t ${tag} . (cwd: ${resolvedContext})`);
  const result = await runDocker(['build', '-t', tag, '.'], {
    onLine: log,
    timeoutMs: 15 * 60 * 1000,
    cwd: resolvedContext,
  });
  if (result.code !== 0) {
    throw new Error(`Docker build failed for ${tag}: ${result.stderr.trim().slice(-2000)}`);
  }
  log(`[docker] image ${tag} built`);
}

/** Pulls a user-provided image (API source "Docker image") before running it. */
export async function pullImage(image: string, log: DeployLog): Promise<void> {
  log(`[docker] pulling ${image}`);
  const result = await runDocker(['pull', image], { onLine: log, timeoutMs: 15 * 60 * 1000 });
  if (result.code !== 0) {
    throw new Error(`Docker pull failed for ${image}: ${result.stderr.trim().slice(-2000)}`);
  }
}

export interface RunOptions {
  name: string;
  image: string;
  network: string;
  internalPort: number;
  log: DeployLog;
}

function isContainerNameConflict(message: string): boolean {
  return /conflict.*container name|container name .*already in use/i.test(message);
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
    opts.log(
      `[docker] note while replacing previous container: ${remove.stderr.trim().split('\n')[0]}`,
    );
  }

  const runArgs = (name: string) => [
    'run', '-d', '--name', name, '--network', opts.network, '--restart', 'unless-stopped',
  ];

  if (publishOnLoopback()) {
    let hostPort = portBase();
    let lastError = '';
    let containerName = opts.name;
    for (let attempt = 0; attempt < 10; attempt += 1, hostPort += 1) {
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
        const previous = containerName;
        containerName = conflictFallbackName(opts.name);
        opts.log(`[docker] retrying with unique container name ${containerName} (instead of ${previous})`);
        continue;
      }
      if (
        !/address already in use|port is already allocated|bind for .* failed/i.test(result.stderr)
      ) {
        break;
      }
      opts.log(`[docker] host port ${hostPort} busy — retrying with ${hostPort + 1}`);
    }
    throw new Error(
      `docker run failed: ${lastError.trim().split('\n').slice(-3).join(' ') || 'unknown error'}`,
    );
  }

  // Production: the backend itself is containerized — no host port at all. The
  // API container is reachable only through the internal Docker network.
  let containerName = opts.name;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await runDocker([...runArgs(containerName), opts.image]);
    if (result.code === 0) {
      opts.log(
        `[docker] container ${containerName} started on network ${opts.network} (no host port published)`,
      );
      return { containerName };
    }
    if (!isContainerNameConflict(result.stderr) || attempt === 2) {
      throw new Error(
        `docker run failed: ${result.stderr.trim().split('\n').slice(-3).join(' ') || 'unknown error'}`,
      );
    }
    await reportContainerNameConflict(containerName, result.stderr, opts.log);
    const previous = containerName;
    containerName = conflictFallbackName(opts.name);
    opts.log(`[docker] retrying with unique container name ${containerName} (instead of ${previous})`);
  }
  throw new Error(`docker run failed: could not allocate a unique container name for ${opts.name}`);
}

export async function removeContainer(name: string): Promise<void> {
  const result = await runDocker(['rm', '-f', name], { timeoutMs: 30_000 });
  if (result.code !== 0 && !/no such container|no such object/i.test(result.stderr)) {
    throw new Error(`docker rm failed for ${name}: ${result.stderr.trim()}`);
  }
}

export async function startContainer(name: string): Promise<void> {
  const result = await runDocker(['start', name], { timeoutMs: 30_000 });
  if (result.code !== 0) {
    throw new Error(`docker start failed: ${result.stderr.trim()}`);
  }
}

export interface ContainerState {
  exists: boolean;
  running: boolean;
  status: string;
}

export async function inspectContainer(name: string): Promise<ContainerState | null> {
  const result = await runDocker(['inspect', '-f', '{{.State.Status}} {{.State.Running}}', name], {
    timeoutMs: 15_000,
  });
  if (result.code !== 0 && /no such object|no such container/i.test(result.stderr)) {
    return null;
  }
  if (result.code !== 0) {
    throw new Error(`docker inspect failed: ${result.stderr.trim()}`);
  }
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

/** Waits until the deployment answers /health with 2xx/3xx. Backward-compatible wrapper. */
export async function waitForHealth(
  baseUrl: string,
  log: DeployLog,
  attempts = 40,
  delayMs = 500,
): Promise<void> {
  return waitForReadiness(baseUrl, log, { mode: 'http', path: '/health', attempts, delayMs });
}
