/**
 * API Build — project build-artifact preparation for Docker build contexts.
 *
 * Uploaded/cloned source projects often ship a Dockerfile that COPYs build
 * outputs (Maven's target/) that are not part of the source tree. Previously
 * such a context went straight to `docker build`, which failed on the first
 * COPY of a missing artifact. This module closes that gap without changing how
 * Docker is driven:
 *
 *   1. Inspect the Dockerfile's COPY/ADD instructions and check which
 *      host-context files they require.
 *   2. When everything required is already present, do nothing — projects that
 *      ship their artifacts are built exactly as before (no rebuild).
 *   3. When artifacts are missing and the project is a Maven project
 *      (pom.xml), run a controlled Maven build inside the official Maven/JDK
 *      Docker image through a synthetic multi-stage build and export the
 *      generated target/ into the workspace. No host Maven/JDK installation is
 *      required, no arbitrary commands are executed, and Maven dependencies
 *      are cached by the BuildKit cache mount so repeated deployments do not
 *      re-download them.
 *   4. After the build, re-validate the Dockerfile's requirements and only
 *      then let the existing pipeline run `docker build`.
 *
 * Security properties:
 *   - Only fixed, literal docker/maven arguments are spawned — never a shell
 *     string and never a command taken from user-controlled input.
 *   - The build sees exactly the deployment workspace (sent as a Docker build
 *     context, the same mechanism the existing `docker build` uses). No bind
 *     mounts of host paths, so user-controlled paths can never reference
 *     arbitrary host directories; COPY/ADD sources that escape the workspace
 *     (absolute/traversal) are never resolved against the host filesystem.
 *   - Generated artifacts and staging data live on the filesystem (the
 *     existing upload sandbox) and are cleaned up with it — nothing here
 *     touches the database.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runDocker, type DeployLog } from './api-build.docker';

/** Maven build budget — a first build downloads the full dependency tree. */
const MAVEN_BUILD_TIMEOUT_MS = 15 * 60 * 1000;
/** Lines of build output streamed into the deployment log (the rest stays local). */
const MAX_STREAMED_LINES = 500;
/** Trailing build output lines kept locally for failure diagnostics. */
const TAIL_LINES = 40;
/** Maximum characters of build output embedded in an error message. */
const MAX_ERROR_TAIL_CHARS = 2000;
/** Manifest search bounds (protect against pathological trees). */
const MAX_MANIFESTS = 8;
const MAX_DOCKERFILES = 32;
const MAX_WALK_DEPTH = 6;

const GLOB_CHARS = /[*?[]/;

export interface MavenBuildPlan {
  system: 'maven';
  /** Absolute directory containing the pom.xml that owns missing outputs. */
  dir: string;
}

/* ==========================================================================
 * Dockerfile COPY/ADD requirement analysis
 * ========================================================================== */

/** Joins backslash-continued physical lines into logical instruction lines. */
export function dockerfileLogicalLines(content: string): string[] {
  const logical: string[] = [];
  let current = '';
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (/\\$/.test(line)) {
      current += `${line.slice(0, -1)} `;
      continue;
    }
    current += line;
    if (current.trim()) {
      logical.push(current.trim());
    }
    current = '';
  }
  if (current.trim()) {
    logical.push(current.trim());
  }
  return logical;
}

/**
 * Extracts the build-context source paths referenced by COPY/ADD instructions.
 * Flags (`--chown`, `--chmod`, `--link`, ...) are ignored; `COPY --from=stage`
 * sources come from another build stage, not the host, and are excluded; remote
 * URLs (ADD) and whole-context copies (`.`) are excluded.
 */
export function parseDockerfileCopySources(content: string): string[] {
  const sources: string[] = [];
  for (const line of dockerfileLogicalLines(content)) {
    if (line.startsWith('#')) {
      continue;
    }
    const match = /^(?:COPY|ADD)\s+(.+)$/i.exec(line);
    if (!match) {
      continue;
    }
    let rest = match[1].trim();
    let fromStage = false;
    for (;;) {
      const flag = /^--([A-Za-z-]+)(?:=(?:"[^"]*"|[^\s]+))?\s+/.exec(rest);
      if (!flag) break;
      if (flag[1] === 'from') fromStage = true;
      rest = rest.slice(flag[0].length);
    }
    if (fromStage || !rest) {
      continue;
    }
    let tokens: string[];
    if (rest.startsWith('[')) {
      try {
        tokens = (JSON.parse(rest) as unknown[]).map((token) => String(token));
      } catch {
        continue;
      }
    } else {
      tokens = rest.split(/\s+/).filter(Boolean);
    }
    if (tokens.length < 2) {
      continue;
    }
    for (const source of tokens.slice(0, -1)) {
      if (/^https?:\/\//i.test(source)) continue; // remote ADD source
      if (source === '.' || source === './') continue; // whole-context copy
      sources.push(source.replace(/\\/g, '/'));
    }
  }
  return sources;
}

/* ==========================================================================
 * Build-context presence checks (traversal-safe)
 * ========================================================================== */

/** True when `relPath` is context-relative and stays inside `rootDir`. */
function isInsideRoot(rootDir: string, relPath: string): boolean {
  // Absolute references (drive letter, UNC, POSIX) are never context-relative.
  if (/^[a-zA-Z]:[\\/]/.test(relPath) || /^[/\\]/.test(relPath)) {
    return false;
  }
  const rel = path.relative(rootDir, path.resolve(rootDir, relPath));
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

/** Pragmatic single-segment glob matcher (enough for `target/*.war`). */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Checks a single COPY/ADD source against the build context. Never throws. */
export function isSourcePresent(contextDir: string, source: string): boolean {
  if (!isInsideRoot(contextDir, source)) {
    // Cannot be satisfied from the context (absolute/traversal) — not our
    // concern: Docker validates and rejects those as it always has.
    return true;
  }
  const normalized = source.replace(/\\/g, '/');
  try {
    if (!GLOB_CHARS.test(normalized)) {
      return existsSync(path.resolve(contextDir, normalized));
    }
    // Glob: the static prefix directory must exist; when the wildcard sits in
    // the final segment, at least one entry must match the pattern.
    const segments = normalized.split('/');
    let prefix = contextDir;
    let index = 0;
    while (index < segments.length && !GLOB_CHARS.test(segments[index])) {
      prefix = path.join(prefix, segments[index]);
      index += 1;
    }
    if (!existsSync(prefix) || !statSync(prefix).isDirectory()) {
      return false;
    }
    if (index === segments.length - 1) {
      const pattern = globToRegExp(segments[index]);
      return readdirSync(prefix).some((name) => pattern.test(name));
    }
    return true; // wildcard mid-path — prefix existence is the practical check
  } catch {
    return false;
  }
}

/** Sources a Dockerfile needs from the build context that are missing. */
export function missingDockerfileSources(contextDir: string, sources: string[]): string[] {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source)) continue;
    seen.add(source);
    if (!isSourcePresent(contextDir, source)) {
      missing.push(source);
    }
  }
  return missing;
}

/* ==========================================================================
 * Maven project detection & build planning
 * ========================================================================== */

/** Directories that never contain a relevant build manifest. */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'target', 'build', 'out', '.idea', '.mvn']);

/** Finds pom.xml manifests, shallowest first (bounded walk). */
function findMavenManifests(rootDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (found.length >= MAX_MANIFESTS || depth > MAX_WALK_DEPTH) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name.toLowerCase() === 'pom.xml')) {
      found.push(path.join(dir, 'pom.xml'));
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(rootDir, 0);
  found.sort(
    (a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b),
  );
  return found;
}

/** True when `missingRel` (context-relative) lives under buildDir's target/. */
function dirOwnsMissing(buildDir: string, contextDir: string, missingRel: string): boolean {
  const rel = path.relative(buildDir, path.resolve(contextDir, missingRel));
  if (path.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${path.sep}`)) {
    return false;
  }
  return rel === 'target' || rel.startsWith(`target${path.sep}`);
}

/**
 * Determines which Maven builds are required before `docker build`.
 *
 * Conservative by design: a build only triggers when a missing COPY/ADD source
 * lives under the standard Maven output directory (`target/`) of a detected
 * pom.xml. Missing files that a build would not produce (in-image RUN outputs,
 * unrelated assets, absolute/traversal paths) are left to Docker's own
 * validation — preserving the existing behavior for every other project.
 */
export function planProjectBuilds(contextDir: string, missing: string[]): MavenBuildPlan[] {
  if (missing.length === 0) return [];
  const plans: MavenBuildPlan[] = [];
  for (const manifest of findMavenManifests(contextDir)) {
    const buildDir = path.dirname(manifest);
    if (missing.some((source) => dirOwnsMissing(buildDir, contextDir, source))) {
      plans.push({ system: 'maven', dir: buildDir });
    }
  }
  return plans;
}

/** Reads the compiler release/source level from pom.xml content (null if undeclared). */
export function javaLevelFromPom(pomContent: string): number | null {
  const patterns = [
    /<maven\.compiler\.release>\s*([\d.]+)\s*<\/maven\.compiler\.release>/i,
    /<maven\.compiler\.source>\s*([\d.]+)\s*<\/maven\.compiler\.source>/i,
    /<maven\.compiler\.target>\s*([\d.]+)\s*<\/maven\.compiler\.target>/i,
    /<java\.version>\s*([\d.]+)\s*<\/java\.version>/i,
    /<release>\s*([\d.]+)\s*<\/release>/i,
    /<source>\s*([\d.]+)\s*<\/source>/i,
    /<target>\s*([\d.]+)\s*<\/target>/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(pomContent);
    if (match) {
      const parts = match[1].split('.');
      // Legacy "1.8" form means Java 8; plain "17" means Java 17.
      const level = Number.parseInt(parts.length >= 2 && parts[0] === '1' ? parts[1] : parts[0], 10);
      if (Number.isFinite(level) && level > 0) {
        return level;
      }
    }
  }
  return null;
}

/** Official Maven image for a Java level. Overridable with KLYRA_MAVEN_IMAGE. */
export function mavenImageFor(javaLevel: number | null): string {
  const override = String(process.env.KLYRA_MAVEN_IMAGE || '').trim();
  if (override) return override;
  const level = javaLevel ?? 8;
  const tag = level <= 8 ? '8' : level <= 11 ? '11' : level <= 17 ? '17' : '21';
  return `maven:3.9-eclipse-temurin-${tag}`;
}

/* ==========================================================================
 * Controlled Maven build (inside the official Maven/JDK Docker image)
 * ========================================================================== */

/**
 * Runs the project's Maven build inside the official Maven/JDK image and
 * exports the generated target/ directory back into the workspace.
 *
 * Mechanism (no bind mounts, no host paths — works with the backend on the
 * host AND with the documented containerized backend + docker.sock topology):
 *   1. A synthetic multi-stage Dockerfile is written into a staging directory
 *      OUTSIDE the Docker build context.
 *   2. `docker build --target klyra-artifacts -o type=local,dest=<staging>/out`
 *      sends the workspace as the context (the same mechanism the existing
 *      `docker build` uses), runs `mvn package` in the image, and streams the
 *      produced target/ back to the backend process.
 *   3. `RUN --mount=type=cache,target=/root/.m2` keeps the Maven repository in
 *      BuildKit's cache so repeated builds do not re-download dependencies.
 *   4. The exported target/ is copied into the workspace by this process, so
 *      file ownership matches the backend (no root-owned files).
 *
 * `stagingDir` must already exist (created by the caller); it is removed by the
 * caller in every path.
 */
export async function runMavenArtifactExport(
  buildDir: string,
  stagingDir: string,
  image: string,
  log: DeployLog,
): Promise<void> {
  const mavenArgs =
    'mvn --batch-mode --no-transfer-progress -DskipTests -Dmaven.test.skip=true package';
  const dockerfile = [
    `FROM ${image} AS klyra-maven-build`,
    'WORKDIR /work',
    'COPY . .',
    `RUN --mount=type=cache,target=/root/.m2 ${mavenArgs}`,
    '',
    'FROM scratch AS klyra-artifacts',
    'COPY --from=klyra-maven-build /work/target ./target',
    '',
  ].join('\n');
  const outDir = path.join(stagingDir, 'out');
  const dockerfilePath = path.join(stagingDir, 'Dockerfile');
  await writeFile(dockerfilePath, dockerfile, 'utf-8');

  const args = [
    'build',
    '-f',
    dockerfilePath,
    '--target',
    'klyra-artifacts',
    '-o',
    `type=local,dest=${outDir}`,
    buildDir,
  ];
  log(`[build] controlled Maven build in ${image} (mvn --batch-mode --no-transfer-progress -DskipTests package)`);
  const result = await runDocker(args, {
    timeoutMs: MAVEN_BUILD_TIMEOUT_MS,
    onLine: cappedStream(log),
  });
  const tail = outputTail(result.stdout, result.stderr);
  if (result.code !== 0) {
    throw new Error(
      `Maven build (${image}) failed with exit code ${result.code}:\n${tail || 'no output'}`,
    );
  }

  const exportedTarget = path.join(outDir, 'target');
  if (!existsSync(exportedTarget)) {
    throw new Error(
      'Maven build finished but produced no target/ directory — nothing to export into the Docker build context.',
    );
  }
  await cp(exportedTarget, path.join(buildDir, 'target'), { recursive: true });
  log('[build] generated target/ copied into the project workspace');
}

/** Wraps a log function with a bounded streaming gate (DB-write protection). */
function cappedStream(log: DeployLog): DeployLog {
  let forwarded = 0;
  return (line: string) => {
    if (!line || !line.trim()) return;
    forwarded += 1;
    if (forwarded <= MAX_STREAMED_LINES) {
      log(line.length > 500 ? `${line.slice(0, 500)}…` : line);
    } else if (forwarded === MAX_STREAMED_LINES + 1) {
      log('[build] … further build output suppressed (kept out of the deployment record)');
    }
  };
}

/** Last lines of combined command output, bounded for error messages. */
function outputTail(stdout: string, stderr: string): string {
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-TAIL_LINES).join('\n').slice(-MAX_ERROR_TAIL_CHARS);
}

/* ==========================================================================
 * Orchestration — prepare the Docker build context
 * ========================================================================== */

export interface PrepareContextOptions {
  /**
   * Test seam: replaces the real controlled Maven runner. Production callers
   * never pass this.
   */
  runBuild?: (build: MavenBuildPlan, stagingDir: string, log: DeployLog) => Promise<void>;
  /** Test seam: Dockerfile content to inspect (defaults to the shallowest Dockerfile in the context). */
  dockerfileContent?: string;
}

const defaultRunBuild = async (
  build: MavenBuildPlan,
  stagingDir: string,
  log: DeployLog,
): Promise<void> => {
  const pomPath = path.join(build.dir, 'pom.xml');
  const pomContent = existsSync(pomPath) ? readFileSync(pomPath, 'utf-8') : '';
  await runMavenArtifactExport(build.dir, stagingDir, mavenImageFor(javaLevelFromPom(pomContent)), log);
};

/** Shallowest Dockerfile in the context (same selection rule as inspectProjectFolder). */
function findShallowestDockerfile(contextDir: string): string | null {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH || found.length >= MAX_DOCKERFILES) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && /^Dockerfile(\..+)?$/i.test(entry.name)) {
        found.push(path.join(dir, entry.name));
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(contextDir, 0);
  found.sort(
    (a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b),
  );
  const selected = found[0];
  if (!selected) return null;
  try {
    return readFileSync(selected, 'utf-8');
  } catch {
    return null;
  }
}

/** Removes a target/ directory only when this pipeline generated it. */
async function removeGeneratedTarget(targetDir: string, preExisted: boolean): Promise<void> {
  if (preExisted) return; // never remove artifacts that shipped with the project
  await rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
}

/**
 * Prepares the Docker build context so `docker build` receives every file its
 * COPY/ADD instructions require:
 *
 *   A. Everything already present → returns without building anything.
 *   B. Missing Maven outputs (target/...) + a pom.xml that owns them → runs the
 *      controlled Maven build, re-validates, and throws a precise error when
 *      the artifacts are still absent (a guaranteed-to-fail `docker build` is
 *      never attempted).
 *   C. Missing files with no owning build system → returns unchanged, exactly
 *      like before this module existed (Docker reports the problem as usual).
 *
 * Staging directories are removed on success and failure; a generated target/
 * is only removed on failure when the project did not ship one.
 */
export async function prepareDockerBuildContext(
  contextDir: string,
  log: DeployLog,
  opts: PrepareContextOptions = {},
): Promise<void> {
  const resolvedContext = path.resolve(contextDir);
  const dockerfile = opts.dockerfileContent ?? findShallowestDockerfile(resolvedContext);
  if (!dockerfile) {
    return; // no Dockerfile — nothing to prepare (docker build reports it as before)
  }
  const sources = parseDockerfileCopySources(dockerfile);
  let missing = missingDockerfileSources(resolvedContext, sources);
  if (missing.length === 0) {
    log('[build] all Dockerfile COPY/ADD sources already present — no project build needed');
    return;
  }
  log(`[build] Dockerfile requires missing build outputs: ${missing.join(', ')}`);

  const runBuild = opts.runBuild ?? defaultRunBuild;
  const ranDirs = new Set<string>();
  let pending = planProjectBuilds(resolvedContext, missing);
  if (pending.length === 0) {
    // No supported build system owns the missing files — keep the previous
    // behavior and let docker build produce its own error message.
    log('[build] no Maven project owns the missing files — deferring to docker build');
    return;
  }

  while (pending.length > 0) {
    const build = pending[0];
    ranDirs.add(build.dir);
    const promised = missing.filter((source) => dirOwnsMissing(build.dir, resolvedContext, source));
    const targetDir = path.join(build.dir, 'target');
    const targetPreExisted = existsSync(targetDir);
    const stagingDir = path.join(
      path.dirname(build.dir),
      `.klyra-maven-build-${randomUUID().slice(0, 8)}`,
    );
    await mkdir(stagingDir, { recursive: true });
    try {
      log(`[build] running controlled Maven build for ${path.relative(resolvedContext, build.dir) || '.'}`);
      await runBuild(build, stagingDir, log);
    } catch (error) {
      await removeGeneratedTarget(targetDir, targetPreExisted);
      throw error;
    } finally {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    }

    missing = missingDockerfileSources(resolvedContext, sources);
    const stillMissing = promised.filter((source) => missing.includes(source));
    if (stillMissing.length > 0) {
      await removeGeneratedTarget(targetDir, targetPreExisted);
      throw new Error(
        `The Maven build completed, but the Docker build context is still missing required files: ` +
          `${stillMissing.join(', ')}. Verify that the build produces every file the Dockerfile ` +
          'COPY/ADD instructions expect.',
      );
    }
    log('[build] required build artifacts generated — Docker build can proceed');
    missing = missingDockerfileSources(resolvedContext, sources);
    if (missing.length === 0) break;
    pending = planProjectBuilds(resolvedContext, missing).filter((plan) => !ranDirs.has(plan.dir));
  }
}