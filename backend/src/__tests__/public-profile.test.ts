process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/database.service');
const { PublicProfileService } = require('../modules/users/public-profile.service');
const { CertificatesService } = require('../modules/certificates/certificates.service');

test('public profile resolves usernames case-insensitively and returns only the safe DTO', async () => {
  const originalQuery = pool.query;
  const originalCertificates = CertificatesService.getPublicIssuedCertificates;
  const queries = [];
  const values = [];
  pool.query = async (query, queryValues) => {
    queries.push(query);
    values.push(queryValues);
    if (query.includes('FROM users u')) return { rows: [{
      id: 'private-user-id', name: 'Ada Lovelace', username: 'Ada_Dev', avatar_url: null,
      bio: 'Builder', company: 'Klyra', website: 'https://example.test',
      metadata: { personal_info: { job_title: 'Engineer', github_url: 'https://github.com/ada' }, skills: ['TypeScript'] },
      created_at: '2026-01-01T00:00:00.000Z', email_verified_at: null, two_factor_enabled: false,
    }] };
    if (query.includes('COUNT(DISTINCT a.id)')) return { rows: [{ published_api_count: 1, active_subscriber_count: 0, api_version_count: 0 }] };
    if (query.includes('FROM apis a')) return { rows: [{
      id: 'private-api-id', slug: 'weather', name: 'Weather API', description: 'Forecasts', current_version: '2.0.0',
      docs_url: 'https://example.test/docs', category_name: 'Data', category_slug: 'data', pricing_model: 'FREE',
      tags: ['weather'], api_spec: { paths: { '/forecast': { get: {}, post: {} }, '/alerts': { get: {}, delete: {} } } },
      last_published_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
    }] };
    if (query.includes('FROM subscription_plans')) return { rows: [{
      api_id: 'private-api-id', name: 'Free', slug: 'free', description: null, price: '0', currency: 'USD',
      billing_interval: 'MONTHLY', features: ['100 requests'], rate_limit: 10,
    }] };
    if (query.includes('FROM api_build_activity')) return { rows: [{
      id: 'public-activity-id', label: 'Published an API Build project', kind: 'ok', at: '2026-01-03T00:00:00.000Z',
    }] };
    throw new Error(`Unexpected query: ${query}`);
  };
  CertificatesService.getPublicIssuedCertificates = async () => [{
    certificate_type: 'MARKETPLACE_IMPACT', title: 'Marketplace Impact', description: 'Awarded', issued_at: '2026-01-01',
    published_api_count: 1, active_subscriber_count: 5, api_version_count: 2, criteria_version: 1,
  }];

  try {
    const result = await PublicProfileService.getByUsername('ADA_DEV');
    assert.equal(result.profile.username, 'Ada_Dev');
    assert.deepEqual(values[0], ['ADA_DEV']);
    assert.deepEqual(result.activity, [{
      id: 'public-activity-id', label: 'Published an API Build project', kind: 'ok', at: '2026-01-03T00:00:00.000Z',
    }]);
    assert.ok(Array.isArray(result.achievements));
    assert.ok(result.achievements.length > 0);
    for (const achievement of result.achievements) {
      assert.deepEqual(Object.keys(achievement).sort(), ['description', 'detail', 'id', 'name']);
    }
    assert.equal(result.published_apis.length, 1);
    assert.equal(result.published_apis[0].slug, 'weather');
    assert.equal(result.published_apis[0].endpoint_count, 4);
    assert.equal('id' in result.certificates[0], false);
    assert.equal('verification_token' in result.certificates[0], false);
    const serialized = JSON.stringify(result);
    for (const privateField of [
      'email', 'private-user-id', 'role', 'status', 'two_factor_enabled', 'api_key',
      'verification_token', 'private-api-id',
    ]) {
      assert.doesNotMatch(serialized, new RegExp(privateField, 'i'));
    }
    const apiQuery = queries.find((query) => query.includes('a.slug, a.name'));
    assert.match(apiQuery, /a\.status = 'PUBLISHED'/);
    assert.match(apiQuery, /a\.is_public = true/);
    assert.match(apiQuery, /a\.deleted_at IS NULL/);
    assert.doesNotMatch(apiQuery, /a\.endpoints_count/);
    const activityQuery = queries.find((query) => query.includes('FROM api_build_activity'));
    assert.match(activityQuery, /project\.project->>'ownerId' = \$1/);
    assert.match(activityQuery, /"published": true, "visibility": "public"/);
    assert.match(activityQuery, /INTERVAL '12 months'/);
  } finally {
    pool.query = originalQuery;
    CertificatesService.getPublicIssuedCertificates = originalCertificates;
  }
});

test('malformed usernames do not perform a database user lookup', async () => {
  const originalQuery = pool.query;
  let calls = 0;
  pool.query = async () => { calls += 1; return { rows: [] }; };
  try {
    assert.equal(await PublicProfileService.getByUsername('not valid'), null);
    assert.equal(calls, 0);
  } finally {
    pool.query = originalQuery;
  }
});

test('public username search only queries usernames and returns safe fields', async () => {
  const originalQuery = pool.query;
  let receivedQuery;
  let receivedValues;
  pool.query = async (query, values) => {
    receivedQuery = query;
    receivedValues = values;
    return { rows: [{ username: 'Ada_Dev', name: 'Ada Lovelace', avatar_url: null }] };
  };
  try {
    const results = await PublicProfileService.searchUsernames('ADA');
    assert.deepEqual(results, [{ username: 'Ada_Dev', name: 'Ada Lovelace', avatar_url: null }]);
    assert.match(receivedQuery, /u\.username ILIKE \$1/);
    assert.doesNotMatch(receivedQuery, /email|role|metadata|two_factor|status/i);
    assert.deepEqual(receivedValues, ['%ADA%']);
    assert.equal(await PublicProfileService.searchUsernames('   ').then((rows) => rows.length), 0);
  } finally {
    pool.query = originalQuery;
  }
});

test('public username search excludes only the authenticated user by ID', async () => {
  const originalQuery = pool.query;
  let receivedQuery;
  let receivedValues;
  pool.query = async (query, values) => {
    receivedQuery = query;
    receivedValues = values;
    return { rows: [{ username: 'another-nullpointer', name: 'Another User', avatar_url: null }] };
  };
  try {
    const results = await PublicProfileService.searchUsernames('nullpointer', 'current-user-id');
    assert.deepEqual(results, [{ username: 'another-nullpointer', name: 'Another User', avatar_url: null }]);
    assert.match(receivedQuery, /u\.id <> \$2/);
    assert.deepEqual(receivedValues, ['%nullpointer%', 'current-user-id']);
  } finally {
    pool.query = originalQuery;
  }
});

test('unknown canonical usernames return null without requiring an authenticated user context', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (query, values) => {
    calls.push({ query, values });
    return { rows: [] };
  };
  try {
    assert.equal(await PublicProfileService.getByUsername('unknown_user'), null);
    assert.equal(calls.length, 1);
    assert.match(calls[0].query, /LOWER\(u\.username\) = LOWER\(\$1\)/);
  } finally {
    pool.query = originalQuery;
  }
});
