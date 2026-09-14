import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';

// The service constructs its pool at module-load time. A placeholder URL is
// enough here because every database operation below is mocked.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/klyra_test';

const { AuthService, AccountDeactivationError } = require('../modules/auth/auth.service') as typeof import('../modules/auth/auth.service');
const { pool } = require('../services/database.service') as typeof import('../services/database.service');
const { isActiveAuthenticatedUser } = require('../modules/auth/auth.middleware') as typeof import('../modules/auth/auth.middleware');
const { userFromToken } = require('../modules/repos/auth.service') as typeof import('../modules/repos/auth.service');
const { signJwt } = require('../modules/auth/jwt.util') as typeof import('../modules/auth/jwt.util');
const { OtpEmailService } = require('../modules/auth/email.service') as typeof import('../modules/auth/email.service');

function installDeactivationTransaction(passwordHash: string) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.includes('SELECT id, password_hash, status, is_active')) {
        return { rows: [{ id: 'user-1', password_hash: passwordHash, status: 'ACTIVE', is_active: true }], rowCount: 1 };
      }
      if (sql.includes('UPDATE user_sessions')) return { rows: [], rowCount: 2 };
      if (sql.includes('UPDATE api_keys')) return { rows: [], rowCount: 3 };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const originalConnect = (pool as any).connect;
  (pool as any).connect = async () => client;
  return {
    queries,
    restore: () => { (pool as any).connect = originalConnect; },
  };
}

test('deactivation rejects an incorrect current password without updating account data', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const mock = installDeactivationTransaction(passwordHash);
  try {
    await assert.rejects(
      () => AuthService.deactivateAccount('user-1', 'wrong-password'),
      (error: unknown) => error instanceof AccountDeactivationError && error.status === 401,
    );
    assert.equal(mock.queries.some(({ sql }) => sql.includes("SET status = 'INACTIVE'")), false);
    assert.equal(mock.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
  } finally {
    mock.restore();
  }
});

test('deactivation atomically disables the user and revokes sessions and API keys', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const mock = installDeactivationTransaction(passwordHash);
  try {
    const result = await AuthService.deactivateAccount('user-1', 'correct-password');
    assert.equal(result.success, true);
    assert.equal(mock.queries.some(({ sql }) => sql.includes("SET status = 'INACTIVE', is_active = FALSE")), true);
    assert.equal(mock.queries.some(({ sql }) => sql.includes('UPDATE user_sessions SET revoked_at = NOW()')), true);
    assert.equal(mock.queries.some(({ sql }) => sql.includes("UPDATE api_keys") && sql.includes("status = 'REVOKED'")), true);
    const audit = mock.queries.find(({ sql }) => sql.includes('INSERT INTO audit_logs'));
    assert.ok(audit);
    assert.equal(audit?.values?.[0], 'user-1');
    assert.match(String(audit?.values?.[1]), /account_deactivated/);
    assert.equal(mock.queries.some(({ sql }) => sql === 'COMMIT'), true);
  } finally {
    mock.restore();
  }
});

test('inactive accounts are rejected by login and refresh-token authentication', async () => {
  const originalQuery = (pool as any).query;
  (pool as any).query = async (sql: string) => {
    if (sql.includes('SELECT * FROM users WHERE email')) {
      return { rows: [{ id: 'user-1', status: 'INACTIVE', is_active: false, metadata: {} }] };
    }
    return {
      rows: [{
        session_id: 'session-1', user_id: 'user-1', expires_at: new Date(Date.now() + 60_000), revoked_at: null,
        email: 'user@example.com', name: 'User', role: 'USER', status: 'INACTIVE', is_active: false, deleted_at: null,
      }],
    };
  };
  try {
    await assert.rejects(() => AuthService.login('user@example.com', 'password'), /inactive or suspended/);
    await assert.rejects(() => AuthService.refreshAccessToken('refresh-token'), /inactive or suspended/);
  } finally {
    (pool as any).query = originalQuery;
  }
});

test('inactive accounts cannot use core Bearer or repository JWT authentication', async () => {
  const token = signJwt({ sub: 'user-1', email: 'user@example.com', name: 'User', role: 'USER', sessionId: 'session-1' }, 60);
  const originalQuery = (pool as any).query;
  (pool as any).query = async () => ({ rows: [] });
  try {
    const payload = { sub: 'user-1', email: 'user@example.com', name: 'User', role: 'USER', sessionId: 'session-1', iat: 0, exp: 1 };
    assert.equal(await isActiveAuthenticatedUser(payload), false);
    assert.equal(await userFromToken(token), null);
  } finally {
    (pool as any).query = originalQuery;
  }
});

test('reactivation restores only an inactive account and leaves revoked sessions and API keys untouched', async () => {
  const otpHash = await bcrypt.hash('123456', 4);
  const originalQuery = (pool as any).query;
  const originalConnect = (pool as any).connect;
  const queries: string[] = [];
  (pool as any).query = async (sql: string) => {
    queries.push(sql);
    if (sql.includes('SELECT id\n       FROM users')) return { rows: [{ id: 'user-1' }] };
    if (sql.includes('SELECT id, token_hash, expires_at, used_at, attempts')) {
      return { rows: [{ id: 'otp-1', token_hash: otpHash, expires_at: new Date(Date.now() + 60_000), used_at: null, attempts: 0 }] };
    }
    return { rows: [] };
  };
  const transactionQueries: string[] = [];
  (pool as any).connect = async () => ({
    query: async (sql: string) => {
      transactionQueries.push(sql);
      if (sql.includes("SET status = 'ACTIVE', is_active = TRUE")) return { rows: [{ id: 'user-1' }] };
      return { rows: [] };
    },
    release: () => undefined,
  });
  try {
    const result = await AuthService.confirmAccountReactivation('user@example.com', '123456');
    assert.equal(result.success, true);
    assert.equal(transactionQueries.some((sql) => sql.includes("SET status = 'ACTIVE', is_active = TRUE")), true);
    assert.equal(transactionQueries.some((sql) => sql.includes('INSERT INTO audit_logs')), true);
    assert.equal([...queries, ...transactionQueries].some((sql) => sql.includes('UPDATE user_sessions')), false);
    assert.equal([...queries, ...transactionQueries].some((sql) => sql.includes('UPDATE api_keys')), false);
  } finally {
    (pool as any).query = originalQuery;
    (pool as any).connect = originalConnect;
  }
});

test('reactivation requests are enumeration-safe and issue an OTP only for eligible inactive accounts', async () => {
  const originalQuery = (pool as any).query;
  const originalSend = OtpEmailService.sendAccountReactivationOTP;
  let eligible = false;
  let delivered = 0;
  (pool as any).query = async (sql: string) => {
    if (sql.includes('SELECT id, email')) {
      return { rows: eligible ? [{ id: 'user-1', email: 'user@example.com' }] : [] };
    }
    if (sql.includes('EXTRACT(EPOCH')) return { rows: [{ seconds_since_last: null, sends_last_hour: 0 }] };
    return { rows: [] };
  };
  (OtpEmailService as any).sendAccountReactivationOTP = async () => { delivered += 1; };
  try {
    const absent = await AuthService.requestAccountReactivation('nobody@example.com');
    eligible = true;
    const inactive = await AuthService.requestAccountReactivation('user@example.com');
    assert.deepEqual(absent, inactive);
    assert.equal(delivered, 1);
  } finally {
    (pool as any).query = originalQuery;
    (OtpEmailService as any).sendAccountReactivationOTP = originalSend;
  }
});

test('reactivation rejects non-inactive, suspended, banned, and deleted accounts before OTP verification', async () => {
  const originalQuery = (pool as any).query;
  (pool as any).query = async () => ({ rows: [] });
  try {
    await assert.rejects(
      () => AuthService.confirmAccountReactivation('user@example.com', '123456'),
      /incorrect or no longer valid/,
    );
  } finally {
    (pool as any).query = originalQuery;
  }
});
