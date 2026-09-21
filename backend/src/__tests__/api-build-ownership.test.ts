process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/database.service');
const { listProjects, projectIsOwnedBy } = require('../modules/api-build/api-build.service');

test('API Build project reads are scoped to the authenticated owner', async () => {
  const originalQuery = pool.query;
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  pool.query = async (sql: string, values: unknown[]) => {
    calls.push({ sql, values });
    return { rows: [{ project: { id: 'owned-project' } }], rowCount: 1 };
  };

  try {
    assert.deepEqual(await listProjects('owner-a'), [{ id: 'owned-project' }]);
    assert.equal(await projectIsOwnedBy('owned-project', 'owner-a'), true);
    assert.match(calls[0].sql, /WHERE owner_id = \$1/);
    assert.deepEqual(calls[0].values, ['owner-a']);
    assert.match(calls[1].sql, /WHERE id = \$1 AND owner_id = \$2/);
    assert.deepEqual(calls[1].values, ['owned-project', 'owner-a']);
  } finally {
    pool.query = originalQuery;
  }
});
