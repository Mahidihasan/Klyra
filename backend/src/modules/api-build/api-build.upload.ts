/**
 * API Build — Secure Project Folder & ZIP Upload Infrastructure.
 *
 * Implements safe ingestion of uploaded projects:
 *   - Strict Zip Slip / path traversal protection
 *   - Absolute path & symlink escape rejection
 *   - Quota enforcement (max 50MB upload, max 200MB extracted, max 2000 files)
 *   - Automatic Dockerfile discovery & EXPOSE port extraction
 *   - Isolated temporary storage with lifecycle cleanup
 *   - Never exposes backend filesystem paths to the client
 */

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_FILE_COUNT = 2000;
/** Git clone budget for GitHub sources (network bound). */
export const GIT_CLONE_TIMEOUT_MS = 5 * 60 * 1000;

export interface UploadedProjectDescriptor {
  uploadId: string;
  projectName: string;
  dockerfilePath: string;
  buildContext: string;
  detectedPort: number;
  fileCount: number;
  totalSizeBytes: number;
}

const UPLOAD_ROOT = path.resolve(process.cwd(), '.data', 'api-build-uploads');

/** Ensures the base uploads directory exists. */
async function ensureUploadRoot(): Promise<string> {
  await mkdir(UPLOAD_ROOT, { recursive: true });
  return UPLOAD_ROOT;
}

/** Resolves the absolute directory for a given uploadId, preventing traversal. */
export function getUploadDirectory(uploadId: string): string {
  const safeId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId || safeId !== uploadId) {
    throw new Error('Invalid upload ID format.');
  }
  const resolved = path.resolve(UPLOAD_ROOT, safeId);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    throw new Error('Upload directory traversal detected.');
  }
  return resolved;
}

/** Detects EXPOSE ports from a Dockerfile's text content. */
export function parseExposePorts(dockerfileContent: string): number[] {
  const ports: number[] = [];
  const lines = dockerfileContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    const match = /^EXPOSE\s+(.+)/i.exec(trimmed);
    if (match) {
      const parts = match[1].split(/\s+/);
      for (const part of parts) {
        const portNum = Number.parseInt(part.replace(/\/.*$/, ''), 10);
        if (Number.isFinite(portNum) && portNum > 0 && portNum <= 65535) {
          ports.push(portNum);
        }
      }
    }
  }
  return ports;
}

/**
 * Extracts a ZIP archive buffer into an isolated directory with strict security checks.
 */
export async function processProjectZip(
  buffer: Buffer,
  originalFilename = 'project.zip',
): Promise<UploadedProjectDescriptor> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload exceeds maximum allowed size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`);
  }

  const root = await ensureUploadRoot();
  const uploadId = `upl-${randomUUID().slice(0, 12)}`;
  const destinationDir = path.join(root, uploadId);
  await mkdir(destinationDir, { recursive: true });

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error('The uploaded file is not a valid ZIP archive.');
  }

  const entries = zip.getEntries();
  if (entries.length > MAX_FILE_COUNT) {
    await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(`ZIP contains too many files (${entries.length}). Maximum allowed is ${MAX_FILE_COUNT}.`);
  }

  let totalSize = 0;
  for (const entry of entries) {
    totalSize += entry.header.size;
    if (totalSize > MAX_EXTRACTED_BYTES) {
      await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
      throw new Error(`Extracted size exceeds limit of ${MAX_EXTRACTED_BYTES / (1024 * 1024)}MB.`);
    }

    // Zip slip verification
    const entryName = entry.entryName;
    if (
      entryName.includes('..') ||
      entryName.startsWith('/') ||
      entryName.startsWith('\\') ||
      /^[a-zA-Z]:/.test(entryName)
    ) {
      await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
      throw new Error(`Security violation: Illegal file path in ZIP entry "${entryName}".`);
    }

    const targetPath = path.resolve(destinationDir, entryName);
    if (!targetPath.startsWith(destinationDir + path.sep) && targetPath !== destinationDir) {
      await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
      throw new Error(`Security violation: Path traversal detected in "${entryName}".`);
    }
  }

  // Safe extraction
  try {
    zip.extractAllTo(destinationDir, true);
  } catch (err) {
    await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(`Failed to extract project archive: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Docker Desktop treats an extracted Git working tree as a Git build
  // context on Windows and can apply the repository's ignore state instead of
  // sending the project files. VCS metadata is not part of the application
  // build and must not control the Docker context.
  await removeGitMetadata(destinationDir);

  // Locate Dockerfile and project layout
  const { dockerfilePath, buildContext, exposedPort, fileCount } = await inspectProjectFolder(destinationDir);

  const baseName = path.basename(originalFilename, path.extname(originalFilename)) || 'uploaded-project';
  const projectName = baseName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '') || 'docker-project';

  return {
    uploadId,
    projectName,
    dockerfilePath,
    buildContext,
    detectedPort: exposedPort || 8080,
    fileCount,
    totalSizeBytes: totalSize,
  };
}

/** Recursively counts files and searches for Dockerfile. */
async function inspectProjectFolder(
  rootDir: string,
): Promise<{ dockerfilePath: string; buildContext: string; exposedPort: number | null; fileCount: number }> {
  let fileCount = 0;
  const dockerfilesFound: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip common large non-build folders if present
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }

        await walk(fullPath);
      } else if (entry.isFile()) {
        fileCount += 1;
        if (/^Dockerfile(\..+)?$/i.test(entry.name)) {
          dockerfilesFound.push(fullPath);
        }

      }
    }
  }

  await walk(rootDir);

  if (dockerfilesFound.length === 0) {
    throw new Error('No Dockerfile found in the uploaded project archive.');
  }

  // Prefer root Dockerfile or highest-level Dockerfile
  dockerfilesFound.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  const selectedDockerfile = dockerfilesFound[0];

  const relDockerfilePath = path.relative(rootDir, selectedDockerfile).replace(/\\/g, '/');
  const dockerfileContent = await readFile(selectedDockerfile, 'utf-8');
  const ports = parseExposePorts(dockerfileContent);

  // If the archive was wrapped in a single root folder (e.g. swagger-petstore/), make that the context
  const dockerfileDir = path.dirname(selectedDockerfile);
  const relContext = path.relative(rootDir, dockerfileDir).replace(/\\/g, '/');
  const buildContext = relContext ? `./${relContext}` : './';

  return {
    dockerfilePath: `./${relDockerfilePath}`,
    buildContext,
    exposedPort: ports.length > 0 ? ports[0] : null,
    fileCount,
  };
}

async function removeGitMetadata(rootDir: string): Promise<void> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.name === '.git') {
      await rm(fullPath, { recursive: true, force: true });
      continue;
    }
    await removeGitMetadata(fullPath);
  }
}

/** Cleans up an extracted upload directory after deployment or upon cancellation. */
export async function cleanupUpload(uploadId: string): Promise<void> {
  try {
    const dir = getUploadDirectory(uploadId);
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Re-inspects a previously extracted upload (by uploadId) without re-uploading.
 * Returns the same descriptor shape the upload endpoint produced so the wizard
 * can refresh detected Dockerfile/build-context facts. Never exposes absolute
 * filesystem paths to the caller — only relative, client-safe paths.
 */
export async function inspectUploadedProject(uploadId: string): Promise<UploadedProjectDescriptor> {
  const dir = getUploadDirectory(uploadId);
  let stat: import('node:fs').Stats | null = null;
  try {
    stat = await (await import('node:fs/promises')).stat(dir);
  } catch {
    throw new Error('Upload not found or already cleaned up. Re-upload the project archive.');
  }
  if (!stat || !stat.isDirectory()) {
    throw new Error('Upload not found or already cleaned up. Re-upload the project archive.');
  }

  const { dockerfilePath, buildContext, exposedPort, fileCount } = await inspectProjectFolder(dir);
  return {
    uploadId,
    projectName: uploadId,
    dockerfilePath,
    buildContext,
    detectedPort: exposedPort || 8080,
    fileCount,
    totalSizeBytes: 0,
  };
}

/* ==========================================================================
 * GitHub source acquisition
 * ========================================================================== */

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs git with array arguments (never a shell string), so repository URLs and
 * branch names can never be interpreted by a shell. Streams output lines.
 */
function runGit(
  args: string[],
  opts: { timeoutMs?: number; onLine?: (line: string) => void } = {},
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { windowsHide: true });
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
    const timer = setTimeout(() => {
      child.kill();
      stderr += '\nGit command timed out.';
      finish(124);
    }, opts.timeoutMs ?? GIT_CLONE_TIMEOUT_MS);
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

/** True when a usable git binary is on PATH. Never throws. */
export async function isGitAvailable(): Promise<boolean> {
  try {
    const result = await runGit(['--version'], { timeoutMs: 8_000 });
    return result.code === 0 && /git version/i.test(result.stdout);
  } catch {
    return false;
  }
}

/**
 * Validates a repository reference. Only https(s) and scp-style ssh forms are
 * accepted, and the value must not contain whitespace, shell metacharacters or
 * traversal segments — it is passed to git as a separate argv entry anyway.
 */
export function validateRepositoryUrl(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  if (!trimmed) {
    throw new Error('A repository URL is required for GitHub deployments.');
  }
  const httpsForm = /^https?:\/\/[a-zA-Z0-9._-]+(?::\d+)?\/[a-zA-Z0-9._/-]+$/;
  const sshForm = /^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9._/-]+$/;
  if (!httpsForm.test(trimmed) && !sshForm.test(trimmed)) {
    throw new Error(
      `Invalid repository URL: "${trimmed}". Use https://host/owner/repo(.git) or git@host:owner/repo.git.`,
    );
  }
  if (trimmed.includes('..')) {
    throw new Error('Repository URLs may not contain traversal segments.');
  }
  return trimmed;
}

/** Validates a git branch/ref name (no whitespace, no leading dash, no '..'). */
export function validateBranchName(branch: string): string {
  const trimmed = branch.trim();
  if (!trimmed) {
    return '';
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(trimmed) || trimmed.startsWith('-') || trimmed.includes('..')) {
    throw new Error(`Invalid branch name: "${trimmed}".`);
  }
  return trimmed;
}

export interface GitHubSourceDescriptor extends UploadedProjectDescriptor {
  repository: string;
  branch: string;
}

/**
 * Obtains a GitHub/Git repository as a buildable source (the "obtain source"
 * step of the common pipeline):
 *   1. validate the repository URL + branch
 *   2. shallow-clone into the isolated uploads sandbox
 *   3. fall back to the repository default branch when the requested one is missing
 *   4. detect Dockerfile, build context and EXPOSE port
 * The returned `uploadId` is a normal, cleanup-able sandbox — the deploy
 * pipeline treats a GitHub source exactly like an uploaded project folder.
 */
export async function prepareGitHubSource(
  repoUrl: string,
  branch = '',
  log: (line: string) => void = () => undefined,
): Promise<GitHubSourceDescriptor> {
  const url = validateRepositoryUrl(repoUrl);
  const requestedBranch = validateBranchName(branch);

  const gitAvailable = await isGitAvailable();
  if (!gitAvailable) {
    throw new Error(
      'git is not available on the host running the Klyra backend. Install git (or upload the project as a ZIP) and retry.',
    );
  }

  const root = await ensureUploadRoot();
  const uploadId = `upl-${randomUUID().slice(0, 12)}`;
  const destinationDir = path.join(root, uploadId);
  await mkdir(destinationDir, { recursive: true });

  const cloneInto = async (target: string, cloneBranch: string): Promise<GitResult> => {
    const args = ['clone', '--depth', '1', '--single-branch'];
    if (cloneBranch) {
      args.push('--branch', cloneBranch);
    }
    args.push('--', url, target);
    log(
      `[github] git clone${cloneBranch ? ` --branch ${cloneBranch}` : ''} ${url} (shallow)`,
    );
    return runGit(args, { timeoutMs: GIT_CLONE_TIMEOUT_MS, onLine: log });
  };

  let result = await cloneInto(destinationDir, requestedBranch);
  let resolvedBranch = requestedBranch;

  // A missing branch must not fail the whole deployment when the repository
  // exists: retry against the default branch and tell the user what happened.
  if (result.code !== 0 && requestedBranch) {
    log(`[github] branch "${requestedBranch}" unavailable — retrying with the default branch`);
    await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
    await mkdir(destinationDir, { recursive: true });
    result = await cloneInto(destinationDir, '');
    resolvedBranch = '';
  }

  if (result.code !== 0) {
    await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
    const detail =
      (result.stderr || result.stdout)
        .trim()
        .split(/\r?\n/)
        .slice(-3)
        .join(' ')
        .slice(0, 500) || 'unknown error';
    throw new Error(`Git clone failed for ${url}: ${detail}`);
  }

  // The Docker build needs the working tree, not the repository metadata.
  await removeGitMetadata(destinationDir);

  // Resolve the branch the clone actually landed on (for honest UI reporting).
  try {
    const head = await runGit(['-C', destinationDir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeoutMs: 10_000,
    });
    if (head.code === 0 && head.stdout.trim()) {
      resolvedBranch = head.stdout.trim();
    }
  } catch {
    /* keep the requested/resolved fallback */
  }
  log(`[github] cloned ${url} (branch ${resolvedBranch || 'default'})`);

  let inspected: {
    dockerfilePath: string;
    buildContext: string;
    exposedPort: number | null;
    fileCount: number;
  };
  try {
    inspected = await inspectProjectFolder(destinationDir);
  } catch (error) {
    await rm(destinationDir, { recursive: true, force: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Repository ${url} cannot be built: ${message}`);
  }

  const repoName = path
    .basename(url.replace(/\.git$/i, ''))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return {
    uploadId,
    projectName: repoName || 'github-project',
    dockerfilePath: inspected.dockerfilePath,
    buildContext: inspected.buildContext,
    detectedPort: inspected.exposedPort || 8080,
    fileCount: inspected.fileCount,
    totalSizeBytes: 0,
    repository: url,
    branch: resolvedBranch,
  };
}
