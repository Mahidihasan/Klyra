/* eslint-disable no-console */
// One-off: force a repository's default_branch to a specific value and mark it
// protected. Usage: node scripts/set-default-branch.mjs <repoId> <branch>
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env.development') });

const [repoId, branch] = process.argv.slice(2);
if (!repoId || !branch) { console.error('usage: node set-default-branch.mjs <repoId> <branch>'); process.exit(1); }

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const r = await client.query('UPDATE kr_repositories SET default_branch=$1 WHERE id=$2 RETURNING id, default_branch', [branch, repoId]);
await client.query(
  `INSERT INTO kr_branches (repo_id, name, protected)
   SELECT $1, $2, TRUE WHERE NOT EXISTS (SELECT 1 FROM kr_branches WHERE repo_id=$1 AND name=$2)`,
  [repoId, branch]);
await client.query('UPDATE kr_branches SET protected=TRUE WHERE repo_id=$1 AND name=$2', [repoId, branch]);
console.log(JSON.stringify(r.rows[0] || null));
await client.end();
