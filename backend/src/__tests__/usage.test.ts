/* eslint-disable @typescript-eslint/no-var-requires */
export {};
// Usage — the two things that break silently.
//
// 1. Authorisation. These endpoints once answered 200 to an unauthenticated
//    request carrying ?userId=<uuid>, handing over another account's API
//    traffic. Nothing about that failure is visible on screen.
// 2. Agreement between the figures. The five endpoints report the same traffic
//    from five queries; when their time windows drifted apart the chart summed
//    to 455 against a headline of 462, and no error was raised anywhere.
//
// The service tests need a real database — the questions are about what
// Postgres returns, so a stubbed pool would test the stub. They read only:
// nothing here writes, so they are safe to run against any account. Seed first
// (pnpm seed:usage) or they skip for want of data.
//
// Run from backend/:
//   node --require ts-node/register/transpile-only --test src/__tests__/usage.test.ts

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env.development'),
});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { pool } = require('../services/database.service');
const { usageService } = require('../modules/usage/usage.service');
const usageRouter = require('../modules/usage/usage.routes').default;

const USER_ID = '6241905a-f51f-4ab2-81d7-e554836c7090';
const PERIODS: ('7d' | '30d' | '90d')[] = ['7d', '30d', '90d'];
const EXPECTED_POINTS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

const sum = (rows: any[], key: string) =>
  rows.reduce((total: number, row: any) => total + (row[key] || 0), 0);

// ---------------------------------------------------------------------------
// Authorisation — the identity is not the caller's to choose
// ---------------------------------------------------------------------------

test('no route answers without a token, with or without a userId parameter', async () => {
  const app = express();
  app.use('/api/usage', usageRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  const paths = ['overview', 'daily', 'by-api', 'top-endpoints', 'history'];

  try {
    for (const route of paths) {
      for (const query of [
        'period=30d',
        `period=30d&userId=${USER_ID}`,
        `period=30d&devUserId=${USER_ID}`,
      ]) {
        const res = await fetch(`http://127.0.0.1:${port}/api/usage/${route}?${query}`);
        assert.equal(
          res.status,
          401,
          `/${route}?${query} answered ${res.status}; it must refuse without a token`,
        );
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// The figures agree with each other
// ---------------------------------------------------------------------------

test('every endpoint reports the same traffic for the same period', async (t: any) => {
  const probe = await usageService.getOverview(USER_ID, '30d');
  if (probe.totalRequests === 0) {
    t.skip('no analytics rows for this user — run pnpm seed:usage first');
    return;
  }

  for (const period of PERIODS) {
    const [overview, daily, byApi, history] = await Promise.all([
      usageService.getOverview(USER_ID, period),
      usageService.getDailyUsage(USER_ID, period),
      usageService.getByApi(USER_ID, period),
      usageService.getRequestLog(USER_ID, period, 1, 1),
    ]);

    assert.equal(
      sum(daily, 'requests'),
      overview.totalRequests,
      `${period}: daily chart sums to ${sum(daily, 'requests')} but the headline says ${overview.totalRequests}`,
    );
    assert.equal(
      sum(byApi, 'requests'),
      overview.totalRequests,
      `${period}: per-API rows sum to ${sum(byApi, 'requests')} but the headline says ${overview.totalRequests}`,
    );
    assert.equal(
      history.meta.total,
      overview.totalRequests,
      `${period}: history counts ${history.meta.total} but the headline says ${overview.totalRequests}`,
    );

    assert.equal(sum(daily, 'errors'), overview.totalErrors, `${period}: daily errors disagree`);
    assert.equal(sum(byApi, 'errors'), overview.totalErrors, `${period}: per-API errors disagree`);
  }
});

test('the daily series covers the whole period, including quiet days', async (t: any) => {
  const probe = await usageService.getOverview(USER_ID, '30d');
  if (probe.totalRequests === 0) {
    t.skip('no analytics rows for this user — run pnpm seed:usage first');
    return;
  }

  for (const period of PERIODS) {
    const daily = await usageService.getDailyUsage(USER_ID, period);

    assert.equal(
      daily.length,
      EXPECTED_POINTS[period],
      `${period} should give ${EXPECTED_POINTS[period]} points, got ${daily.length}`,
    );

    // Ascending, one calendar day apart, no gaps and no duplicates — the chart
    // draws them evenly spaced and would otherwise lie about when traffic ran.
    for (let i = 1; i < daily.length; i += 1) {
      const previous = Date.parse(`${daily[i - 1].date}T00:00:00Z`);
      const current = Date.parse(`${daily[i].date}T00:00:00Z`);
      assert.equal(
        current - previous,
        86400000,
        `${period}: ${daily[i - 1].date} to ${daily[i].date} is not one day`,
      );
    }
  }
});

test('nothing is dated in the future', async (t: any) => {
  const page = await usageService.getRequestLog(USER_ID, '90d', 1, 100);
  if (page.entries.length === 0) {
    t.skip('no analytics rows for this user — run pnpm seed:usage first');
    return;
  }

  const now = Date.now();
  const ahead = page.entries.filter((entry: any) => Date.parse(entry.createdAt) > now);

  // The seed once wrote up to 23 hours ahead, which the totals counted and the
  // chart could not show.
  assert.equal(ahead.length, 0, `${ahead.length} rows are dated after now, newest ${ahead[0]?.createdAt}`);
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

test('errorRate is a percentage, not a fraction', async (t: any) => {
  const overview = await usageService.getOverview(USER_ID, '30d');
  if (overview.totalRequests === 0) {
    t.skip('no analytics rows for this user — run pnpm seed:usage first');
    return;
  }

  const expected = (overview.totalErrors / overview.totalRequests) * 100;
  assert.ok(
    Math.abs(overview.errorRate - expected) < 0.01,
    `errorRate ${overview.errorRate} should be ${expected.toFixed(2)} (a percentage, 0-100)`,
  );

  const byApi = await usageService.getByApi(USER_ID, '30d');
  for (const row of byApi) {
    const rowExpected = row.requests > 0 ? (row.errors / row.requests) * 100 : 0;
    assert.ok(
      Math.abs(row.errorRate - rowExpected) < 0.01,
      `${row.apiName}: errorRate ${row.errorRate} should be ${rowExpected.toFixed(2)}`,
    );
  }
});

test('a rate limit is reported as a rate, never as a period allowance', async () => {
  const byApi = await usageService.getByApi(USER_ID, '30d');

  for (const row of byApi) {
    // Either both or neither: a number with no unit cannot be displayed
    // honestly, which is what the old quota bar tried to do.
    if (row.rateLimit !== null) {
      assert.ok(
        row.rateLimitPeriod !== null,
        `${row.apiName}: a rate limit of ${row.rateLimit} with no period is meaningless`,
      );
      assert.ok(
        ['SECOND', 'MINUTE', 'HOUR', 'DAY'].includes(row.rateLimitPeriod),
        `${row.apiName}: unexpected rate limit period ${row.rateLimitPeriod}`,
      );
    }
    assert.ok(row.requestsThisPeriod >= 0);
  }
});

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

test('the request log clamps its page size', async () => {
  const page = await usageService.getRequestLog(USER_ID, '30d', 1, 100000);
  assert.ok(
    page.meta.limit <= 100,
    `limit came back as ${page.meta.limit}; an unbounded page size is a denial-of-service waiting to happen`,
  );
  assert.ok(page.entries.length <= page.meta.limit);
});

test.after(async () => {
  await pool.end();
});
