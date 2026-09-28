/* eslint-disable no-console */
process.env.DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH || '../.env.development';

import { pool } from '../src/services/database.service';

const SEED_TAG = 'Klyra-Seed-Usage';

/**
 * Decides whose account gets the fake traffic.
 *
 * SEED_USER_ID is required unless --first-user is passed. This used to fall
 * back silently to the oldest active account, which on a database shared with
 * the team meant seeding somebody else's usage screens while your own stayed
 * empty — and leaving hundreds of invented rows in their account.
 *
 * The chosen user is always printed, so it is never a guess.
 */
async function resolveUserId(): Promise<string> {
  const explicit = process.env.SEED_USER_ID?.trim();

  if (explicit) {
    const found = await pool.query('SELECT id, email FROM users WHERE id = $1', [explicit]);
    if (found.rows.length === 0) {
      throw new Error(`SEED_USER_ID ${explicit} does not match any user.`);
    }
    console.log(`[seed:usage] Target user: ${found.rows[0].email} (${found.rows[0].id})`);
    return found.rows[0].id;
  }

  if (!process.argv.includes('--first-user')) {
    throw new Error(
      'Set SEED_USER_ID to the account you sign in with, e.g.\n' +
        '  set SEED_USER_ID=<your uuid>  (cmd)\n' +
        '  $env:SEED_USER_ID="<your uuid>"  (PowerShell)\n' +
        'Or pass --first-user to deliberately seed the oldest account.',
    );
  }

  const fallback = await pool.query(
    `SELECT id, email FROM users 
     WHERE status = 'ACTIVE' AND deleted_at IS NULL 
     ORDER BY created_at ASC 
     LIMIT 1`
  );
  if (fallback.rows.length > 0) {
    console.log(`[seed:usage] Target user (--first-user): ${fallback.rows[0].email} (${fallback.rows[0].id})`);
    return fallback.rows[0].id;
  }

  throw new Error('No user found in database to seed usage for. Please create or login a user first.');
}

async function resolveApis(userId: string): Promise<{ id: string; name: string }[]> {
  const existing = await pool.query('SELECT id, name FROM apis LIMIT 5');
  if (existing.rows.length > 0) {
    return existing.rows;
  }

  let catId: string;
  const catRes = await pool.query('SELECT id FROM categories LIMIT 1');
  if (catRes.rows.length > 0) {
    catId = catRes.rows[0].id;
  } else {
    const newCat = await pool.query(
      `INSERT INTO categories (name, slug, description) 
       VALUES ('Developer Tools', 'dev-tools', 'APIs for developers') 
       RETURNING id`
    );
    catId = newCat.rows[0].id;
  }

  const apis = [
    { name: 'Weather Data API', slug: 'weather-data-api' },
    { name: 'Currency Exchange API', slug: 'currency-exchange-api' },
    { name: 'AI Image Synthesis API', slug: 'ai-image-synthesis-api' }
  ];

  const createdApis: { id: string; name: string }[] = [];
  for (const api of apis) {
    const res = await pool.query(
      `INSERT INTO apis (name, slug, description, category_id, provider_id, base_url, status)
       VALUES ($1, $2, 'Demo API for usage testing', $3, $4, 'https://api.example.com', 'PUBLISHED')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [api.name, api.slug, catId, userId]
    );
    createdApis.push(res.rows[0]);
  }

  return createdApis;
}

const SAMPLE_ENDPOINTS = [
  { method: 'GET', path: '/v1/forecast/daily' },
  { method: 'GET', path: '/v1/rates/live' },
  { method: 'POST', path: '/v1/models/generate' },
  { method: 'GET', path: '/v1/history/aggregate' },
  { method: 'POST', path: '/v1/convert' },
  { method: 'GET', path: '/v1/status' },
];

async function main() {
  console.log('[seed:usage] Starting usage telemetry seed...');

  const userId = await resolveUserId();
  const apis = await resolveApis(userId);

  await pool.query('DELETE FROM api_analytics WHERE user_id = $1 AND user_agent = $2', [userId, SEED_TAG]);

  console.log(`[seed:usage] Generating 30 days of activity for ${apis.length} APIs...`);

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // Anchor to UTC midnight and place each request inside its own day.
  //
  // This used to be `now - day * ONE_DAY + hourOffset`, where hourOffset was up
  // to 23 hours — so day 0 landed up to 23 hours in the FUTURE. Twelve of 462
  // rows were dated tomorrow, which the totals counted and the daily chart
  // could not show, and the two disagreed by exactly those rows.
  const todayUtcMidnight = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
  );

  // Build every row first, then insert them in batches. One INSERT per row was
  // 400-750 separate round trips to a hosted database and took minutes; this
  // takes about a second for the same data.
  type Row = [string, string, string, string, number, number, string, boolean, Date];
  const rows: Row[] = [];

  for (let day = 29; day >= 0; day--) {
    const dayStart = todayUtcMidnight - day * ONE_DAY;
    // Today is only partly over, so today's requests stop at the current time.
    const dayLength = day === 0 ? Math.max(now - todayUtcMidnight, 60 * 1000) : ONE_DAY;
    const count = Math.floor(Math.random() * 18) + 8;

    for (let i = 0; i < count; i++) {
      const api = apis[Math.floor(Math.random() * apis.length)];
      const ep = SAMPLE_ENDPOINTS[Math.floor(Math.random() * SAMPLE_ENDPOINTS.length)];
      const createdAt = new Date(dayStart + Math.floor(Math.random() * dayLength));

      const rand = Math.random();
      let statusCode = 200;
      let isError = false;

      if (rand > 0.96) {
        statusCode = 500;
        isError = true;
      } else if (rand > 0.90) {
        statusCode = 429;
        isError = true;
      } else if (ep.method === 'POST') {
        statusCode = 201;
      }

      const latency = Math.floor(Math.random() * 120) + 25;

      rows.push([
        api.id, userId, ep.method, ep.path,
        statusCode, latency, SEED_TAG, isError, createdAt,
      ]);
    }
  }

  const COLUMNS = 9;
  // Postgres caps a statement at 65535 bound parameters; 500 rows x 9 is well
  // inside that and keeps each statement small enough to be quick.
  const BATCH = 500;
  let totalInserted = 0;

  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const values = batch
      .map((_, rowIndex) => {
        const base = rowIndex * COLUMNS;
        return `($${base + 1}, $${base + 2}, $${base + 3}::request_method, $${base + 4}, ` +
               `$${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
      })
      .join(', ');

    await pool.query(
      `INSERT INTO api_analytics (
         api_id, user_id, request_method, endpoint,
         status_code, latency_ms, user_agent, is_error, created_at
       ) VALUES ${values}`,
      batch.flat(),
    );
    totalInserted += batch.length;
  }

  console.log(`[seed:usage] ✅ Successfully inserted ${totalInserted} request records across the last 30 days!`);
  console.log('[seed:usage] You can now open your browser and view the Usage dashboard.');
  console.log('[seed:usage] To delete this test data later, run: npm run clean:usage');

  await pool.end();
}

main().catch((err) => {
  console.error('[seed:usage] Failed:', err);
  process.exit(1);
});
