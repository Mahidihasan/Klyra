/* eslint-disable no-console */
// Read-only inspection helper: reports the tables/columns relevant to the
// marketplace + API management surfaces and resolves the given user id.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../');
dotenv.config({ path: path.resolve(repoRoot, '.env.development') });
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log('TABLES:', tables.rows.map((r) => r.table_name).join(', '));

  for (const t of ['apis', 'api_build_projects', 'users']) {
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t],
    );
    console.log(`\n${t.toUpperCase()} COLUMNS:`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default}`);
    }
  }

  const enums = await client.query(
    `SELECT t.typname, e.enumlabel FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid ORDER BY t.typname, e.enumsortorder`,
  );
  console.log('\nENUMS:');
  for (const e of enums.rows) console.log(`  ${e.typname}.${e.enumlabel}`);

  const user = await client.query(
    'SELECT id, email, name, role, status FROM users WHERE id = $1',
    ['09bd6f3d-4ef2-4439-9fa1-06a54c3c4ffa'],
  );
  console.log('\nTARGET USER:', JSON.stringify(user.rows, null, 2));

  const apiCount = await client.query('SELECT COUNT(*)::int AS n FROM apis');
  console.log('APIS ROW COUNT:', apiCount.rows[0].n);
  const apiRows = await client.query(
    'SELECT id, name, slug, owner_id, status, is_public FROM apis ORDER BY created_at DESC LIMIT 20',
  );
  console.log('APIS SAMPLE:', JSON.stringify(apiRows.rows, null, 2));

  const projects = await client.query(
    'SELECT id, project->>\'name\' AS name, project->>\'visibility\' AS visibility, project->>\'status\' AS status FROM api_build_projects ORDER BY updated_at DESC LIMIT 20',
  );
  console.log('API BUILD PROJECTS:', JSON.stringify(projects.rows, null, 2));
}

void main()
  .catch((err) => { console.error('INSPECT FAILED:', err.message); process.exitCode = 1; })
  .finally(() => client.end());