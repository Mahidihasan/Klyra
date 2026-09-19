/* eslint-disable @typescript-eslint/no-var-requires */
export {};

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfileAchievements } = require('../modules/auth/auth.service');
const { AuthService } = require('../modules/auth/auth.service');
const { pool } = require('../services/database.service');

const NOW = Date.parse('2026-09-19T00:00:00.000Z');
const recentUser = {
  created_at: '2026-09-18T00:00:00.000Z',
  email_verified_at: null,
  two_factor_enabled: false,
};
const zeroMetrics = {
  published_api_count: 0,
  active_subscriber_count: 0,
  api_version_count: 0,
};
const ids = (user = recentUser, metrics = zeroMetrics) =>
  buildProfileAchievements(user, metrics, NOW).map((item: { id: string }) => item.id);

test('profile achievements are empty without qualifying data', () => {
  assert.deepEqual(ids(), []);
});

test('Origin requires one published, non-deleted owned API aggregate', () => {
  assert.deepEqual(ids(recentUser, { ...zeroMetrics, published_api_count: 1 }), ['origin']);
  assert.deepEqual(ids(recentUser, zeroMetrics), []);
});

test('Momentum requires five ACTIVE subscription rows, not TRIALING rows', () => {
  assert.deepEqual(ids(recentUser, { ...zeroMetrics, active_subscriber_count: 5 }), ['momentum']);
  assert.deepEqual(ids(recentUser, { ...zeroMetrics, active_subscriber_count: 0 }), []);
});

test('Ascendant requires at least two versions across owned APIs', () => {
  assert.deepEqual(ids(recentUser, { ...zeroMetrics, api_version_count: 2 }), ['ascendant']);
  assert.deepEqual(ids(recentUser, { ...zeroMetrics, api_version_count: 1 }), []);
});

test('Legacy, Distinction, and Vanguard use live account fields', () => {
  assert.deepEqual(
    ids(
      {
        created_at: '2025-09-19T00:00:00.000Z',
        email_verified_at: '2025-09-19T00:00:00.000Z',
        two_factor_enabled: true,
      },
      zeroMetrics,
    ),
    ['legacy', 'distinction', 'vanguard'],
  );
});

test('all qualifying conditions produce the locked achievement set', () => {
  assert.deepEqual(
    ids(
      {
        created_at: '2025-09-19T00:00:00.000Z',
        email_verified_at: '2025-09-19T00:00:00.000Z',
        two_factor_enabled: true,
      },
      { published_api_count: 1, active_subscriber_count: 5, api_version_count: 2 },
    ),
    ['origin', 'momentum', 'ascendant', 'legacy', 'distinction', 'vanguard'],
  );
});

test('profile achievement query uses only owned marketplace APIs and exact ACTIVE subscriptions', async () => {
  const originalQuery = pool.query;
  const queries: string[] = [];
  pool.query = async (query: string) => {
    queries.push(query);
    if (query.includes('FROM users u')) {
      return {
        rows: [{
          ...recentUser,
          id: 'user-1', email: 'ada@example.test', name: 'Ada Lovelace', role: 'USER',
          status: 'ACTIVE', is_active: true, avatar_url: null, bio: null, company: null,
          website: null, metadata: {}, last_login_at: null, last_login_ip: null,
          updated_at: null, email_enabled: true, push_enabled: true, in_app_enabled: true,
        }],
      };
    }
    if (query.includes('FROM apis a')) {
      return { rows: [{ published_api_count: 0, active_subscriber_count: 0, api_version_count: 0 }] };
    }
    return { rows: [] };
  };

  try {
    const profile = await AuthService.getProfile('user-1');
    assert.deepEqual(profile.achievements, []);
    const metricsQuery = queries.find((query) => query.includes('FROM apis a'));
    assert.ok(metricsQuery);
    assert.match(metricsQuery, /a\.owner_id = \$1 AND a\.deleted_at IS NULL/);
    assert.match(metricsQuery, /a\.status = 'PUBLISHED'/);
    assert.match(metricsQuery, /us\.status = 'ACTIVE'/);
    assert.match(metricsQuery, /COUNT\(DISTINCT av\.id\)/);
    assert.doesNotMatch(metricsQuery, /TRIALING|api_build|total_subscribers/i);
  } finally {
    pool.query = originalQuery;
  }
});
