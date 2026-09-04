import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { pool } from '../../services/database.service';
import { cloneWorkingCopy } from './git.service';

export type CiType = 'build' | 'test';

interface ScriptPlan {
  install: string | null;
  command: string;
}

function planScripts(dir: string, type: CiType): ScriptPlan {
  const pkgPath = path.join(dir, 'package.json');
  try {
    const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));
    const script = type === 'test' ? (pkg.scripts?.test || null) : (pkg.scripts?.build || null);
    const pm = ['pnpm-lock.yaml', 'yarn.lock'].some(f => require('fs').existsSync(path.join(dir, f)));
    const npmCmd = require('fs').existsSync(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm'
      : require('fs').existsSync(path.join(dir, 'yarn.lock')) ? 'yarn' : 'npm';
    void pm;
    return { install: `${npmCmd} install --no-audit --no-fund`, command: script ? `${npmCmd} run ${type === 'test' ? 'test' : 'build'}` : '' };
  } catch {
    return { install: null, command: '' };
  }
}

/**
 * Runs a REAL build or test against the actual repository contents.
 * The result status comes from the actual exit code of the toolchain —
 * a failing script is recorded as a failure with its real logs.
 */
export async function runCi(repoId: string, ref: string, type: CiType, sha: string | null): Promise<{ id: string }> {
  const inserted = await pool.query(
    `INSERT INTO kr_ci_runs (repo_id, commit_sha, branch, type, status, log, started_at)
     VALUES ($1, $2, $3, $4, 'running', 'Queued…', NOW()) RETURNING id`,
    [repoId, sha, ref, type]
  );
  const runId = inserted.rows[0].id as string;

  // Fire-and-forget: the UI polls /runs for live status
  (async () => {
    let dir: string | null = null;
    let log = `$ klyra ci ${type} @ ${ref}\n`;
    let status = 'failure';
    let summary = '';
    try {
      dir = await cloneWorkingCopy(repoId, ref);
      log += `Cloned ${ref} → working copy\n`;
      const plan = planScripts(dir, type);
      if (!plan.command) {
        status = 'skipped';
        summary = `No ${type} script found in package.json`;
        log += `${summary}\n`;
      } else {
        const steps = [plan.install, plan.command].filter(Boolean) as string[];
        for (const step of steps) {
          log += `\n$ ${step}\n`;
          const ok = await new Promise<boolean>(resolve => {
            exec(step, { cwd: dir!, timeout: 10 * 60 * 1000, maxBuffer: 10 * 1024 * 1024, windowsHide: true, env: { ...process.env, CI: '1' } },
              (err, stdout, stderr) => {
                log += (stdout || '') + (stderr || '');
                resolve(!err);
              });
          });
          if (!ok) { summary = `Step failed: ${step}`; break; }
        }
        if (!summary) { status = 'success'; summary = `${type} passed`; }
      }
    } catch (e: any) {
      log += `\nERROR: ${e.message || e}`;
      summary = `CI run errored: ${e.message || e}`;
    } finally {
      if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      await pool.query(
        `UPDATE kr_ci_runs SET status=$1, log=$2, summary=$3, finished_at=NOW() WHERE id=$4`,
        [status, log.slice(0, 200000), summary, runId]
      );
    }
  })().catch(() => undefined);

  return { id: runId };
}

export async function latestRuns(repoId: string) {
  const res = await pool.query(
    `SELECT * FROM kr_ci_runs WHERE repo_id=$1 ORDER BY started_at DESC LIMIT 20`, [repoId]
  );
  return res.rows;
}
