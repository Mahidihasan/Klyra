/* eslint-disable no-console */
// Read-only inspection helper: resolves the enum labels, an owner for a new
// public API listing, the Weather category id, and whether the target slug is
// already taken.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../');
dotenv.config({ path: path.resolve(repoRoot, '.env.development') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const enums = await client.query(
    `SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS labels
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname IN ('api_status', 'api_pricing_model')
     GROUP BY t.typname`,
  );
  console.log('ENUMS:', JSON.stringify(enums.rows, null, 2));

  const apis = await client.query(
    `SELECT a.slug, a.status, a.is_public, a.pricing_model, a.current_version, a.rating,
            a.total_subscribers, a.total_requests, a.docs_url, a.logo_url,
            (a.last_published_at IS NOT NULL) AS has_last_published,
            u.email AS owner_email, a.owner_id
     FROM apis a JOIN users u ON u.id = a.owner_id
     WHERE a.deleted_at IS NULL ORDER BY a.created_at`,
  );
  console.log('APIS:', JSON.stringify(apis.rows, null, 2));

  const slugTaken = await client.query(`SELECT id FROM apis WHERE slug = $1`, ['open-meteo-weather']);
  console.log('SLUG open-meteo-weather TAKEN:', slugTaken.rows.length > 0);

  const weather = await client.query(`SELECT id FROM categories WHERE slug = 'weather'`);
  console.log('WEATHER CATEGORY:', JSON.stringify(weather.rows));

  const userCols = await client.query(
    `SELECT column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = 'users' AND is_nullable = 'NO'
     ORDER BY ordinal_position`,
  );
  console.log('USERS NOT NULL COLS:', JSON.stringify(userCols.rows, null, 2));

  const userTriggers = await client.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid = 'users'::regclass AND NOT tgisinternal`,
  );
  console.log('USERS TRIGGERS:', JSON.stringify(userTriggers.rows));

  const owners = await client.query(
    `SELECT id, email, name, role, status, (password_hash IS NOT NULL) AS has_password
     FROM users WHERE id = ANY($1::uuid[])`,
    [apis.rows.map((r) => r.owner_id)],
  );
  console.log('OWNER USERS:', JSON.stringify(owners.rows, null, 2));

  const admins = await client.query(
    `SELECT id, email, role, status FROM users
     WHERE deleted_at IS NULL AND role IN ('ADMIN', 'MODERATOR')
     ORDER BY created_at LIMIT 10`,
  );
  console.log('ADMIN/MODERATOR USERS:', JSON.stringify(admins.rows, null, 2));

  const versions = await client.query(`SELECT count(*)::int AS n FROM api_versions`);
  console.log('API VERSION ROWS:', versions.rows[0].n);

  const currentVersions = await client.query(
    `SELECT a.slug, v.version, v.is_current, v.is_deprecated
     FROM api_versions v JOIN apis a ON a.id = v.api_id ORDER BY a.slug`,
  );
  console.log('API VERSIONS:', JSON.stringify(currentVersions.rows, null, 2));
}

void main()
  .catch((err) => { console.error('INSPECT FAILED:', err.message); process.exitCode = 1; })
  .finally(() => client.end());
