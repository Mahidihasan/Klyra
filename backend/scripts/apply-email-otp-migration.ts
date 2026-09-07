/* eslint-disable no-console */
// One-off helper: applies infrastructure/database/2026_09_07_001_email_otp.sql
// Usage (from backend/):  DOTENV_CONFIG_PATH=../.env.development node -r dotenv/config -r ts-node/register/transpile-only scripts/apply-email-otp-migration.ts
process.env.DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH || '../.env.development';

import { readFileSync } from 'fs';
import path from 'path';
import { pool } from '../src/services/database.service';

async function main(): Promise<void> {
  const sqlPath = path.resolve(__dirname, '../../infrastructure/database/2026_09_07_001_email_otp.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('[migration] 2026_09_07_001_email_otp applied successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migration] failed:', err.message);
  process.exitCode = 1;
});