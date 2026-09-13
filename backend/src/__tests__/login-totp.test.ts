/* eslint-disable @typescript-eslint/no-var-requires */
export {};
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';
process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || Buffer.alloc(32, 7).toString('base64url');

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { generateSecret, generateSync } = require('otplib');
const { pool } = require('../services/database.service');
const { AuthService } = require('../modules/auth/auth.service');
const { EmailService } = require('../modules/auth/email.service');
const { encryptTotpSecret } = require('../modules/auth/totp.service');

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1', email: 'ada@example.test', name: 'Ada', role: 'USER', password_hash: '',
    email_verified_at: new Date().toISOString(), status: 'ACTIVE', is_active: true,
    two_factor_enabled: false, two_factor_secret: null, metadata: {}, ...overrides,
  };
}

function installDatabase(user: any) {
  const queries: string[] = [];
  const originalQuery = pool.query;
  pool.query = async (query: string) => {
    queries.push(query);
    if (query.includes('FROM users WHERE email')) return { rows: [user] };
    if (query.includes("metadata->'pending_2fa'->>'tempToken'")) return { rows: [user] };
    if (query.includes('INSERT INTO user_sessions')) return { rows: [{ id: 'session-1' }] };
    return { rows: [] };
  };
  return { queries, restore: () => { pool.query = originalQuery; } };
}

test('known device with TOTP returns only a TOTP challenge and sends no email', async () => {
  const passwordHash = await bcrypt.hash('correct horse battery staple', 4);
  const user = makeUser({ password_hash: passwordHash, two_factor_enabled: true, two_factor_secret: encryptTotpSecret(generateSecret({ length: 20 })) });
  const userAgent = 'Known Browser'; const ip = '203.0.113.10';
  const { generateDeviceFingerprint } = require('../modules/auth/jwt.util');
  (user.metadata as any).known_devices = [{ deviceFingerprint: generateDeviceFingerprint(userAgent, ip), userAgent, ip }];
  const db = installDatabase(user);
  const originalSend = EmailService.send2FAEmail; let sent = 0;
  EmailService.send2FAEmail = async () => { sent += 1; };
  try {
    const result = await AuthService.login(user.email, 'correct horse battery staple', false, ip, userAgent);
    assert.deepEqual(Object.keys(result).sort(), ['challengeType', 'requires2FA', 'tempToken']);
    assert.equal(result.requires2FA, true);
    assert.equal(result.challengeType, 'totp');
    assert.equal(sent, 0);
    assert.equal(db.queries.some((query) => query.includes('INSERT INTO user_sessions')), false);
  } finally { EmailService.send2FAEmail = originalSend; db.restore(); }
});

test('unknown device returns the email challenge before issuing a session', async () => {
  const user = makeUser({ password_hash: await bcrypt.hash('password', 4) });
  const db = installDatabase(user);
  const originalSend = EmailService.send2FAEmail; let sent = 0;
  EmailService.send2FAEmail = async () => { sent += 1; };
  try {
    const result = await AuthService.login(user.email, 'password', false, '203.0.113.11', 'New Browser');
    assert.equal(result.requires2FA, true);
    assert.equal(result.challengeType, 'email');
    assert.equal(sent, 1);
    assert.equal(db.queries.some((query) => query.includes('INSERT INTO user_sessions')), false);
  } finally { EmailService.send2FAEmail = originalSend; db.restore(); }
});

test('valid TOTP verification issues a session only after successful verification', async () => {
  const secret = generateSecret({ length: 20 });
  const user = makeUser({ two_factor_enabled: true, two_factor_secret: encryptTotpSecret(secret), metadata: { pending_2fa: { tempToken: 'pending-token', expiresAt: Date.now() + 60_000, rememberMe: false, emailVerified: true, requiresTotp: true } } });
  const db = installDatabase(user);
  try {
    const result = await AuthService.verifyLoginTotp('pending-token', generateSync({ secret }), '203.0.113.12', 'Browser');
    assert.ok(result.tokens.accessToken);
    assert.ok(result.tokens.refreshToken);
    assert.equal(db.queries.filter((query) => query.includes('INSERT INTO user_sessions')).length, 1);
  } finally { db.restore(); }
});

test('invalid TOTP is rejected and never issues a session', async () => {
  const user = makeUser({ two_factor_enabled: true, two_factor_secret: encryptTotpSecret(generateSecret({ length: 20 })), metadata: { pending_2fa: { tempToken: 'pending-token', expiresAt: Date.now() + 60_000, rememberMe: false, emailVerified: true, requiresTotp: true } } });
  const db = installDatabase(user);
  try {
    await assert.rejects(() => AuthService.verifyLoginTotp('pending-token', '000000'), /Invalid authenticator code/);
    assert.equal(db.queries.some((query) => query.includes('INSERT INTO user_sessions')), false);
  } finally { db.restore(); }
});
