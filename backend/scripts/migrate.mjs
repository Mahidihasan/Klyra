/* eslint-disable no-console */
// Klyra database migration runner.
//
// Applies the SQL files under infrastructure/database in dependency order and
// records each applied migration in the `_klyra_migrations` bookkeeping table so
// runs are idempotent (run it as many times as you like).
//
// Order:
//   0001_schema                schema.sql                     (base auth/billing/marketplace schema)
//   0002_billing_realtime      2026_09_05_001_billing_realtime.sql
//   0003_email_otp             2026_09_07_001_email_otp.sql
//   0003b_repos_schema         2026_09_07_001_repos_schema.sql
//   0004_repo_realtime         2026_09_07_002_repo_realtime.sql
//   0005_api_build             2026_09_09_001_api_build.sql
//   0006_api_build_extras      2026_09_10_001_api_build_extras.sql
//   0007_api_build_complete    2026_09_12_001_api_build_complete.sql
//   0007b_api_build_draft      2026_09_12_002_draft_system.sql
//   0008_api_build_control_plane 2026_09_13_001_api_build_control_plane.sql
//   0009_account_reactivation  2026_09_13_001_account_reactivation.sql
//   0010_session_activity      2026_09_13_002_session_activity.sql
//   0011_marketplace_enhancements 2026_09_14_001_marketplace_enhancements.sql
//   0011_api_keys_system       2026_09_16_001_api_keys_system.sql
//   0012_wallet                2026_09_16_001_wallet.sql
//   0013_wallet_topup_sessions 2026_09_16_002_wallet_topup_sessions.sql
//   0014_plan_environment      2026_09_18_001_plan_environment.sql
//   0015_admin_security_tables 2026_09_21_001_admin_security_tables.sql
//   0016_admin_models_parity   2026_09_22_001_admin_models_parity.sql
//
// NOTE: 2026_09_11_001_payout_requests.sql and 2026_09_11_002_audit_logs.sql
// are intentionally NOT registered:
//   - payout_requests is not idempotent (plain CREATE TYPE/CREATE TABLE/
//     CREATE POLICY) and payouts are provisioned by their own script
//     (scripts/migrate_payouts.ts);
//   - audit_logs duplicates the baseline schema.sql table with a conflicting
//     column set (resource_type/severity vs entity_type/audit_action) — the
//     baseline table is the one the application uses.
//
// The repository (kr_* ) tables ALSO self-bootstrap at runtime via
// repos.db.ensureReposSchema(); 0003b_repos_schema provisions the identical,
// fully idempotent DDL at migration time so 0004_repo_realtime — which creates
// triggers ON the kr_* tables — can never run before those tables exist on a
// fresh database. This runner reconciles the base + application schema so a
// fresh environment can be built with one command.
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
  // Full kr_* repository schema — migration-time mirror of
  // repos.db.ensureReposSchema() (backend/src/modules/repos/repos.db.ts).
  // MUST run before 0004_repo_realtime: that migration creates triggers ON
  // kr_ci_runs / kr_deployments / kr_activity / kr_repositories and fails on
  // a fresh database ("relation "kr_ci_runs" does not exist") if the tables
  // are only runtime-bootstrapped. The DDL is entirely IF NOT EXISTS /
  // CREATE OR REPLACE / DROP TRIGGER IF EXISTS, so existing databases where
  // the runtime bootstrap already ran are a no-op, and `guard` re-applies it
  // if the tables are ever dropped (same self-healing contract as below).
  { name: '0003b_repos_schema', file: '2026_09_07_001_repos_schema.sql', guard: 'kr_repositories' },
  { name: '0004_repo_realtime', file: '2026_09_07_002_repo_realtime.sql' },
  // The shared development database has repeatedly lost tables while their
  // rows stayed in _klyra_migrations (wallets were dropped twice; api-build
  // audit tables vanished minutes after being created). `guard` names a table
  // each migration must have left behind — whenever it is gone the migration
  // is re-applied, so `pnpm db:migrate` self-heals the schema. Every api-build
  // migration below is idempotent (IF NOT EXISTS), which is what makes that safe.
  { name: '0005_api_build', file: '2026_09_09_001_api_build.sql', guard: 'api_build_projects' },
  { name: '0006_api_build_extras', file: '2026_09_10_001_api_build_extras.sql', guard: 'api_build_categories' },
  { name: '0007_api_build_complete', file: '2026_09_12_001_api_build_complete.sql', guard: 'api_build_endpoints' },
  // Draft & audit-trail system (api_build_audit_log, api_build_draft_changes,
  // project versioning + updated_at trigger). Without it every operation that
  // records an audit event fails with
  //   relation "api_build_audit_log" does not exist
  // which used to fail the whole deploy operation.
  {
    name: '0007b_api_build_draft_system',
    file: '2026_09_12_002_draft_system.sql',
    guard: 'api_build_audit_log',
  },
  { name: '0008_api_build_control_plane', file: '2026_09_13_001_api_build_control_plane.sql', guard: 'api_build_operations' },
  { name: '0009_account_reactivation', file: '2026_09_13_001_account_reactivation.sql' },
  { name: '0010_session_activity', file: '2026_09_13_002_session_activity.sql' },
  { name: '0011_marketplace_enhancements', file: '2026_09_14_001_marketplace_enhancements.sql' },
  { name: '0011_api_keys_system', file: '2026_09_16_001_api_keys_system.sql' },
  { name: '0012_wallet', file: '2026_09_16_001_wallet.sql', guard: 'wallets' },
  {
    name: '0013_wallet_topup_sessions',
    file: '2026_09_16_002_wallet_topup_sessions.sql',
    guard: 'wallet_topup_sessions',
  },
  { name: '0014_plan_environment', file: '2026_09_18_001_plan_environment.sql', guard: 'api_build_plans' },
  // Prisma-managed auth/admin tables the SQL baseline never captured
  // ("Session", role_permissions, "Permission" enum, user_role.SUPER_ADMIN).
  // Without them the login/verify flow fails with
  //   Invalid `prisma.session.create()` invocation (auth.service.ts:958)
  // and auth.middleware rejects every JWT that carries an adminSessionId.
  // Fully idempotent; guard checks the case-sensitive "Session" table.
  { name: '0015_admin_security_tables', file: '2026_09_21_001_admin_security_tables.sql', guard: '"Session"' },
  // Enum drift repair + tables the introspected Prisma models expect but no
  // registered migration ever created: audit_action.ADMIN_KEY_RESET,
  // "Permission".MANAGE_SYSTEM_SETTINGS / MANAGE_SECURITY_CENTER,
  // provider_payouts (admin.revenue.service.ts raw SQL; identical shape to
  // scripts/migrate_payouts.ts), and the admin devops/finances/settings
  // models (FeatureFlag, WebhookLog, CronJob, Invoice, InvoiceItem, Dispute,
  // core_settings, moderation_reports, security_settings, platform_keys).
  // Fully idempotent; guard checks provider_payouts.
  { name: '0016_admin_models_parity', file: '2026_09_22_001_admin_models_parity.sql', guard: 'provider_payouts' },
];

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.on('error', (e) => console.error('[pg] idle error:', e.message));

async function tableExists(table) {
  const r = await client.query(`SELECT to_regclass($1) IS NOT NULL::int AS present`, [table]);
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
         )`,
      );
    }

    const done = new Set(await appliedNames());
    const status = process.argv.includes('--status');

    for (const m of MIGRATIONS) {
      // A migration recorded as applied whose table is no longer there is not
      // applied, whatever the bookkeeping says. On 18 Sep 2026 the three
      // wallet tables were dropped from the shared database twice while their
      // rows stayed in _klyra_migrations; going by the ledger alone, this
      // runner would have reported "DB is up to date" over a missing schema
      // and never rebuilt it. `guard` lets a migration be checked against
      // reality instead. Migrations without one behave exactly as before.
      const recorded = done.has(m.name);
      const healing = recorded && m.guard ? !(await tableExists(m.guard)) : false;

      if (recorded && !healing) {
        console.log(`  [skip]  ${m.name}`);
        continue;
      }
      if (status) {
        console.log(`  [${healing ? 'missing' : 'pending'}] ${m.name}`);
        continue;
      }
      if (healing) {
        console.log(`  [heal]  ${m.name} (recorded, but ${m.guard} is gone)`);
      }

      // Baseline schema.sql uses plain CREATE TABLE (not IF NOT EXISTS). If it
      // has already been provisioned (e.g. existing share or a prior manual
      // apply), record it as applied without re-running, so we never clobber.
      if (m.baseline && (await tableExists('users'))) {
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
      await client.query(
        'INSERT INTO _klyra_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [m.name],
      );
      done.add(m.name);
    }

    console.log(`\n${status ? 'DB migration status listed above.' : 'DB is up to date.'}`);
  } finally {
    await client.end();
  }
}

void main();
