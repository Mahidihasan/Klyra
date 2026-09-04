import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const GIT_ROOT = path.join(process.cwd(), '.data', 'git');

export function repoGitDir(repoId: string): string {
  return path.join(GIT_ROOT, `${repoId}.git`);
}

function git(dir: string | null, args: string[], timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullArgs = dir ? ['-C', dir, ...args] : args;
    execFile('git', fullArgs, { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) reject(new Error(`${stderr || err.message}`.trim()));
        else resolve(stdout);
      });
  });
}

export { git };

const PRE_RECEIVE_HOOK = `#!/usr/bin/env node
// Klyra protected-branch enforcement (auto-generated). Denies direct pushes
// to protected branches (e.g. main) for anyone but the repository owner.
const stdin = require('fs').readFileSync(0, 'utf8');
const refs = stdin.trim().split('\\n').filter(Boolean).map(l => l.split('\\t'));
const owner = process.env.KL_IS_OWNER === '1';
const prot = (process.env.KL_PROTECTED || 'refs/heads/main').split(',').filter(Boolean);
for (const [oldRef, newRef, refName] of refs) {
  const del = newRef === '0000000000000000000000000000000000000000';
  if (prot.includes(refName) && !owner) {
    console.error('KLYRA DENY: "' + refName + '" is a protected branch. Use feature branches + pull requests.');
    process.exit(1);
  }
  if (del && prot.includes(refName)) {
    console.error('KLYRA DENY: protected branches cannot be deleted.');
    process.exit(1);
  }
}
process.exit(0);
`;

export async function initBareRepo(repoId: string, defaultBranch: string): Promise<string> {
  await fs.mkdir(GIT_ROOT, { recursive: true });
  const dir = repoGitDir(repoId);
  await git(null, ['init', '--bare', '--initial-branch=' + defaultBranch, dir]);
  const hooksDir = path.join(dir, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, 'pre-receive');
  await fs.writeFile(hookPath, PRE_RECEIVE_HOOK, { mode: 0o755 });
  await git(dir, ['config', 'http.receivepack', 'true']);
  await git(dir, ['config', 'core.logallrefupdates', 'true']);
  return dir;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  email: string;
  date: string;
}

const LOG_FORMAT = '%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1e';

function parseLog(out: string): CommitInfo[] {
  return out.split('\x1e').map(s => s.trim()).filter(Boolean).map(entry => {
    const [sha, message, author, email, date] = entry.split('\x1f');
    return { sha, message, author, email, date };
  });
}

export async function listBranches(repoId: string): Promise<{ name: string; sha: string }[]> {
  const dir = repoGitDir(repoId);
  try {
    const out = await git(dir, ['for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads']);
    return out.trim().split('\n').filter(Boolean).map(line => {
      const [name, sha] = line.split('\t');
      return { name, sha };
    });
  } catch { return []; }
}

export async function listCommits(repoId: string, ref: string, limit = 50, skip = 0): Promise<CommitInfo[]> {
  const dir = repoGitDir(repoId);
  const out = await git(dir, ['log', `--pretty=format:${LOG_FORMAT}`, '-n', String(limit), `--skip=${skip}`, ref]);
  return parseLog(out);
}

export async function commitCount(repoId: string, ref: string): Promise<number> {
  try {
    const out = await git(repoGitDir(repoId), ['rev-list', '--count', ref]);
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
}

export async function latestCommit(repoId: string, ref: string): Promise<CommitInfo | null> {
  const commits = await listCommits(repoId, ref, 1);
  return commits[0] || null;
}

export interface TreeEntry {
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  path: string;
  size?: number;
}

export async function listTree(repoId: string, ref: string, dir = '', recursive = false): Promise<TreeEntry[]> {
  // Recursive listing always starts at the ref root so paths are repo-absolute.
  const spec = dir && !recursive ? `${ref}:${dir}` : ref;
  const args = recursive ? ['ls-tree', '-r', '-l', spec] : ['ls-tree', '-l', spec];
  const out = await git(repoGitDir(repoId), args);
  return out.trim().split('\n').filter(Boolean).map(line => {
    const [meta, p] = line.split('\t');
    const [mode, type, sha, size] = meta.split(/\s+/);
    return { mode, type: type as 'blob' | 'tree', sha, path: p, size: size === '-' ? undefined : parseInt(size, 10) };
  });
}

/** Recursively list every blob path in the repo at a ref. */
export async function listAllFiles(repoId: string, ref: string): Promise<string[]> {
  try {
    const out = await git(repoGitDir(repoId), ['ls-tree', '-r', '--name-only', ref]);
    return out.split('\n').filter(Boolean);
  } catch { return []; }
}

export async function readFileAt(repoId: string, ref: string, filePath: string): Promise<string> {
  return git(repoGitDir(repoId), ['show', `${ref}:${filePath}`], 15000);
}

export async function fileCommitHistory(repoId: string, ref: string, filePath: string): Promise<CommitInfo[]> {
  const out = await git(repoGitDir(repoId), ['log', `--pretty=format:${LOG_FORMAT}`, ref, '--', filePath]);
  return parseLog(out);
}

export async function getDiff(repoId: string, fromRef: string, toRef: string, filePath?: string): Promise<string> {
  const args = ['diff', fromRef, toRef];
  if (filePath) args.push('--', filePath);
  return git(repoGitDir(repoId), args, 30000);
}

export async function getCommitDiff(repoId: string, sha: string): Promise<string> {
  return git(repoGitDir(repoId), ['show', '--stat', '--patch', '--format=%H%n%s%n%an%n%aI', sha, '-m', '--first-parent'], 30000);
}

export async function branchExists(repoId: string, name: string): Promise<boolean> {
  try {
    await git(repoGitDir(repoId), ['rev-parse', '--verify', `refs/heads/${name}`]);
    return true;
  } catch { return false; }
}

export async function createBranchFrom(repoId: string, newName: string, fromRef: string): Promise<void> {
  await git(repoGitDir(repoId), ['branch', newName, fromRef]);
}

export async function deleteBranch(repoId: string, name: string): Promise<void> {
  await git(repoGitDir(repoId), ['branch', '-D', name]);
}

export async function aheadBehind(repoId: string, from: string, to: string): Promise<{ ahead: number; behind: number }> {
  try {
    const out = await git(repoGitDir(repoId), ['rev-list', '--left-right', '--count', `${from}...${to}`]);
    const [ahead, behind] = out.trim().split(/\s+/).map(Number);
    return { ahead: ahead || 0, behind: behind || 0 };
  } catch { return { ahead: 0, behind: 0 }; }
}

export async function listTagRefs(repoId: string): Promise<{ name: string; sha: string; date: string }[]> {
  const dir = repoGitDir(repoId);
  try {
    const out = await git(dir, ['for-each-ref', '--format=%(refname:short)%09%(objectname)%09%(creatordate:iso)', 'refs/tags']);
    return out.trim().split('\n').filter(Boolean).map(line => {
      const [name, sha, ...rest] = line.split('\t');
      return { name, sha, date: rest.join(' ') };
    });
  } catch { return []; }
}

export async function createTag(repoId: string, name: string, ref: string, message: string): Promise<void> {
  await git(repoGitDir(repoId), ['tag', '-a', name, ref, '-m', message || `Tag ${name}`]);
}

export async function deleteTag(repoId: string, name: string): Promise<void> {
  await git(repoGitDir(repoId), ['tag', '-d', name]);
}

export interface MergeResult {
  ok: boolean;
  sha?: string;
  log: string;
}

/**
 * Merges `source` into `target` using a real temporary clone of the bare repo.
 * Runs an on-disk merge with --no-ff so history matches a true Git merge.
 */
export async function mergeBranches(
  repoId: string,
  source: string,
  target: string,
  message: string,
  committer: { name: string; email: string }
): Promise<MergeResult> {
  const dir = repoGitDir(repoId);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'klyra-merge-'));
  const log: string[] = [];
  try {
    const run = async (args: string[], allowFail = false) => {
      try {
        const out = await git(tmp, args, 60000);
        log.push(`$ git ${args.join(' ')}\n${out}`);
        return out;
      } catch (e: any) {
        log.push(`$ git ${args.join(' ')}\nFAILED: ${e.message}`);
        if (!allowFail) throw e;
        return '';
      }
    };
    await run(['clone', '--no-hardlinks', dir, '.']);
    await run(['config', 'user.name', committer.name]);
    await run(['config', 'user.email', committer.email]);
    await run(['checkout', target]);
    await run(['merge', '--no-ff', `origin/${source}`, '-m', message], true);
    const sha = await run(['rev-parse', 'HEAD']);
    await run(['push', dir, `HEAD:refs/heads/${target}`]);
    return { ok: true, sha: sha.trim(), log: log.join('\n') };
  } catch (e: any) {
    return { ok: false, log: log.join('\n') + '\n' + (e.message || String(e)) };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/** Clone working copy for CI / detection. Returns temp dir path (caller cleans up). */
export async function cloneWorkingCopy(repoId: string, ref: string): Promise<string> {
  const dir = repoGitDir(repoId);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'klyra-work-'));
  await new Promise<void>((resolve, reject) => {
    execFile('git', ['clone', '--quiet', '--branch', ref, '--single-branch', dir, tmp], { timeout: 60000, windowsHide: true },
      err => (err ? reject(err) : resolve()));
  });
  await fs.rm(path.join(tmp, '.git'), { recursive: true, force: true });
  return tmp;
}