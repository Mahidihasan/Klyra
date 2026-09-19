/* eslint-disable no-console */
process.env.DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH || '../.env.development';

import { pool } from '../src/services/database.service';

const SEED_TAG = 'Klyra-Seed-Usage';

/**
 * Removes seeded usage rows.
 *
 * Scoped to one user by default. It used to delete every row carrying the seed
 * tag regardless of who it belonged to, which on a database shared with the
 * rest of the team meant one person's cleanup wiped everyone's test data.
 *
 * Pass --all to get the old behaviour deliberately rather than by accident.
 */
async function main() {
  const wantsAll = process.argv.includes('--all');
  const userId = process.env.SEED_USER_ID?.trim();

  if (!wantsAll && !userId) {
    console.error(
      '[clean:usage] Set SEED_USER_ID to the user whose seed data should go,\n' +
        '              or pass --all to clear seeded rows for every user.',
    );
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const result = wantsAll
    ? await pool.query('DELETE FROM api_analytics WHERE user_agent = $1', [SEED_TAG])
    : await pool.query(
        'DELETE FROM api_analytics WHERE user_agent = $1 AND user_id = $2',
        [SEED_TAG, userId],
      );

  console.log(
    `[clean:usage] Removed ${result.rowCount} seeded row(s)` +
      (wantsAll ? ' across all users.' : ` for user ${userId}.`),
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error('[clean:usage] Failed:', err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
