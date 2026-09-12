/* eslint-disable no-console */
// One-off repair: reconcile kr_repositories.default_branch (and kr_branches)
// with what actually exists in each repo's bare git directory. Fixes imported
// repos whose metadata says "main" but whose HEAD is e.g. "master", which made
// every tree/file/overview request 400 in the UI.
//
// Usage (from backend/): node scripts/fix-default-branches.mjs
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import dotenv from 'dotenv';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../');
dotenv.config({ path: path.resolve(repoRoot, '.env.development') });
dotenv.config({ path: path.resolve(repoRoot, 'backend', '.env') });
dotenv.config();

const GIT_ROOT = path.join(repoRoot, 'backend', '.data', 'git');
const run = (dir, args) => new Promise((resolve, reject) => {
  execFile('git', ['-C', dir, ...args], { windowsHide: true }, (e, stdout) => e ? reject(e) : resolve(stdout));
});

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const repos = (await client.query('SELECT id, default_branch FROM kr_repositories')).rows;
let fixed = 0;
for (const repo of repos) {
  const dir = path.join(GIT_ROOT, `${repo.id}.git`);
  if (!existsSync(dir)) continue;
  let branches = [];
  let head = '';
  try {
    branches = (await run(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']))
      .split('\n').map(s => s.trim()).filter(Boolean);
    head = ((await run(dir, ['symbolic-ref', '--short', 'HEAD']).catch(() => '')) || '').trim();
  } catch (e) { console.log(`skip ${repo.id}: ${e.message}`); continue; }
  if (!branches.length) continue;
  const real =
    branches.includes(repo.default_branch) ? repo.default_branch :
    branches.includes('main') ? 'main' :
    branches.includes('master') ? 'master' :
    (head && branches.includes(head) ? head : branches[0]);
  for (const name of branches) {
    await client.query(
      `INSERT INTO kr_branches (repo_id, name, protected, created_by)
       SELECT $1, $2, $3, NULL WHERE NOT EXISTS (SELECT 1 FROM kr_branches WHERE repo_id=$1 AND name=$2)`,
      [repo.id, name, name === real]);
  }
  if (real !== repo.default_branch) {
    await client.query('UPDATE kr_repositories SET default_branch=$1 WHERE id=$2', [real, repo.id]);
    await client.query('UPDATE kr_branches SET protected=TRUE WHERE repo_id=$1 AND name=$2', [repo.id, real]);
    console.log(`fixed ${repo.id}: ${repo.default_branch} -> ${real}`);
    fixed++;
  }
}
console.log(`done, ${fixed} repo(s) repaired`);
await client.end();
