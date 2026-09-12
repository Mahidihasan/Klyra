/* eslint-disable no-console */
// Klyra database migration runner.
//
// Applies the SQL files under infrastructure/database in dependency order and
// records each applied migration in the `_klyra_migrations` bookkeeping table so
// runs are idempotent (run it as many times as you like).
//
// Order:
//   0001_schema              schema.sql                     (base auth/billing/marketplace schema)
//   0002_billing_realtime    2026_09_05_001_billing_realtime.sql
//   0003_email_otp           2026_09_07_001_email_otp.sql
//   0004_repo_realtime       2026_09_07_002_repo_realtime.sql
//   0005_api_build           2026_09_09_001_api_build.sql
//
// The repository (kr_* ) tables self-bootstrap at runtime via
// repos.db.ensureReposSchema(); this runner reconciles the base + application
// schema so a fresh environment can be built with one command.
//
// Usage (from backend/):
//   node scripts/migrate.mjs            # apply pending migrations
//   node scripts/migrate.mjs --status   # show applied vs pending, no-op
//
// ENV_FILE can override which dotenv file is loaded (default: ../.env.development).
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../'); // E:\Klyra
const dbDir = path.join(repoRoot, 'infrastructure', 'database');

dotenv.config({ path: path.resolve(repoRoot, process.env.ENV_FILE || '.env.development') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not configured (checked .env.development / environment).');
  process.exit(1);
}

const MIGRATIONS = [
  { name: '0001_schema', file: 'schema.sql', baseline: true },
  { name: '0002_billing_realtime', file: '2026_09_05_001_billing_realtime.sql' },
  { name: '0003_email_otp', file: '2026_09_07_001_email_otp.sql' },
  { name: '0004_repo_realtime', file: '2026_09_07_002_repo_realtime.sql' },
  { name: '0005_api_build', file: '2026_09_09_001_api_build.sql' },
{ name: '0006_api_build_extras', file: '2026_09_10_001_api_build_extras.sql' },
];

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.on('error', (e) => console.error('[pg] idle error:', e.message));

async function tableExists(table) {
  const r = await client.query(
    `SELECT to_regclass($1) IS NOT NULL::int AS present`, [table]);
  return r.rows[0].present === 1;
}

async function appliedNames() {
  if (!(await tableExists('_klyra_migrations'))) return [];
  const r = await client.query('SELECT name FROM _klyra_migrations');
  return r.rows.map((row) => row.name);
}

async function applyFile(sql, label) {
  const text = await readFile(sql, 'utf8');
  await client.query(text);
}

async function main() {
  await client.connect();
  try {
    // Ensure the ledger table exists regardless of baseline state.
    if (!(await tableExists('_klyra_migrations'))) {
      await client.query(
        `CREATE TABLE _klyra_migrations (
           name      TEXT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`);
    }

    const done = new Set(await appliedNames());
    const status = process.argv.includes('--status');

    for (const m of MIGRATIONS) {
      if (done.has(m.name)) { console.log(`  [skip]  ${m.name}`); continue; }
      if (status) { console.log(`  [pending] ${m.name}`); continue; }

      // Baseline schema.sql uses plain CREATE TABLE (not IF NOT EXISTS). If it
      // has already been provisioned (e.g. existing share or a prior manual
      // apply), record it as applied without re-running, so we never clobber.
      if (m.baseline && await tableExists('users')) {
        console.log(`  [skip]  ${m.name} (users table already present — recorded)`);
      } else {
        const sqlPath = path.join(dbDir, m.file);
        try {
          await applyFile(sqlPath, m.name);
          console.log(`  [apply] ${m.name} (${m.file})`);
        } catch (e) {
          console.error(`\nMigration ${m.name} FAILED:\n  ${String(e.message).split('\n')[0]}`);
          process.exitCode = 1;
          return;
        }
      }
      await client.query('INSERT INTO _klyra_migrations (name) VALUES ($1)', [m.name]);
      done.add(m.name);
    }

    console.log(`\n${status ? 'DB migration status listed above.' : 'DB is up to date.'}`);
  } finally {
    await client.end();
  }
}

void main();
