/* eslint-disable no-console */
// Read-only inspection of marketplace categories, tags and a full API row so a
// new listing can be inserted with the same shape as the existing seed data.
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

  const cats = await client.query('SELECT id, name, slug, is_active FROM categories ORDER BY sort_order, name');
  console.log('CATEGORIES:', JSON.stringify(cats.rows, null, 2));

  const tags = await client.query('SELECT DISTINCT unnest(tags) AS tag FROM apis ORDER BY tag');
  console.log('DISTINCT TAGS:', tags.rows.map((r) => r.tag).join(', '));

  const sample = await client.query(
    `SELECT a.*, c.name AS category_name, c.slug AS category_slug, u.email AS owner_email
     FROM apis a JOIN categories c ON c.id = a.category_id JOIN users u ON u.id = a.owner_id
     WHERE a.slug IN ('weather-api', 'openai-api')`,
  );
  console.log('SAMPLE APIS:', JSON.stringify(sample.rows, null, 2));

  const versions = await client.query(
    `SELECT count(*)::int AS n FROM api_versions`,
  );
  console.log('API VERSION ROWS:', versions.rows[0].n);

  const userApis = await client.query(
    `SELECT id, name, slug, status, is_public FROM apis WHERE owner_id = $1`,
    ['09bd6f3d-4ef2-4439-9fa1-06a54c3c4ffa'],
  );
  console.log('TARGET USER APIS:', JSON.stringify(userApis.rows, null, 2));
}

void main()
  .catch((err) => { console.error('INSPECT FAILED:', err.message); process.exitCode = 1; })
  .finally(() => client.end());