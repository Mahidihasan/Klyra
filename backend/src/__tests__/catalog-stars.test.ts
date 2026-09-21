process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/database.service');
const { CatalogService, CatalogStarError } = require('../modules/catalog/catalog.service');

test('stars only eligible public published APIs and returns an accurate count', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (query, values) => {
    calls.push({ query, values });
    if (query.includes('SELECT 1 FROM apis')) return { rows: [{ '?column?': 1 }] };
    if (query.includes('INSERT INTO api_stars')) return { rows: [{ id: 'star-id' }] };
    if (query.includes('SELECT COUNT(*) AS count')) return { rows: [{ count: '3' }] };
    throw new Error(`Unexpected query: ${query}`);
  };
  try {
    const result = await new CatalogService().starApi('api-id', 'viewer-id');
    assert.deepEqual(result, { starCount: 3, viewerHasStarred: true });
    assert.match(calls[0].query, /status = 'PUBLISHED' AND is_public = true/);
    assert.deepEqual(calls[1].values, ['api-id', 'viewer-id']);
  } finally {
    pool.query = originalQuery;
  }
});

test('star rejects ineligible APIs and duplicate stars', async () => {
  const originalQuery = pool.query;
  pool.query = async (query) => {
    if (query.includes('SELECT 1 FROM apis')) return { rows: [] };
    throw new Error('star insert must not run for an ineligible API');
  };
  try {
    await assert.rejects(() => new CatalogService().starApi('private-api', 'viewer-id'), (error) =>
      error instanceof CatalogStarError && error.status === 404,
    );
    pool.query = async (query) => {
      if (query.includes('SELECT 1 FROM apis')) return { rows: [{}] };
      if (query.includes('INSERT INTO api_stars')) return { rows: [] };
      throw new Error(`Unexpected query: ${query}`);
    };
    await assert.rejects(() => new CatalogService().starApi('api-id', 'viewer-id'), (error) =>
      error instanceof CatalogStarError && error.status === 409,
    );
  } finally {
    pool.query = originalQuery;
  }
});

test('unstar rejects an absent star and returns the post-delete count', async () => {
  const originalQuery = pool.query;
  pool.query = async (query) => {
    if (query.includes('SELECT 1 FROM apis')) return { rows: [{}] };
    if (query.includes('DELETE FROM api_stars')) return { rows: [{ id: 'star-id' }] };
    if (query.includes('SELECT COUNT(*) AS count')) return { rows: [{ count: '2' }] };
    throw new Error(`Unexpected query: ${query}`);
  };
  try {
    assert.deepEqual(await new CatalogService().unstarApi('api-id', 'viewer-id'), { starCount: 2, viewerHasStarred: false });
    pool.query = async (query) => {
      if (query.includes('SELECT 1 FROM apis')) return { rows: [{}] };
      if (query.includes('DELETE FROM api_stars')) return { rows: [] };
      throw new Error(`Unexpected query: ${query}`);
    };
    await assert.rejects(() => new CatalogService().unstarApi('api-id', 'viewer-id'), (error) =>
      error instanceof CatalogStarError && error.status === 404,
    );
  } finally {
    pool.query = originalQuery;
  }
});

test('viewer star lookup is scoped to the authenticated viewer', async () => {
  const originalQuery = pool.query;
  let values;
  pool.query = async (query, queryValues) => {
    if (query.includes('FROM api_stars WHERE user_id')) {
      values = queryValues;
      return { rows: [{ api_id: 'api-2' }] };
    }
    throw new Error(`Unexpected query: ${query}`);
  };
  try {
    const result = await new CatalogService().applyViewerStarState([
      { id: 'api-1', viewerHasStarred: false }, { id: 'api-2', viewerHasStarred: false },
    ], 'viewer-id');
    assert.deepEqual(values, ['viewer-id', ['api-1', 'api-2']]);
    assert.deepEqual(result.map((api) => api.viewerHasStarred), [false, true]);
  } finally {
    pool.query = originalQuery;
  }
});
