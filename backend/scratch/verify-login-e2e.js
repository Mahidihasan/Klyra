/**
 * End-to-end verification of POST /api/auth/login (the route that was returning
 * 401). Creates a throwaway user with a known password + a known device, hits
 * the real HTTP endpoint, asserts a 200 token response, then removes every row
 * it created. Nothing belonging to a real account is touched.
 *
 * Usage (from backend/): node scratch/verify-login-e2e.js
 */
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../', process.env.ENV_FILE || '.env.development') });

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' },
});

const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:4000';
const EMAIL = `klyra-login-check-${Date.now()}@example.com`;
const PASSWORD = 'KlyraVerify!2026';
const IP = '203.0.113.7';
const USER_AGENT = 'klyra-login-verify/1.0';
const fingerprint = crypto.createHash('sha256').update(`${USER_AGENT}:::${IP}`).digest('hex').slice(0, 16);

let userId = null;

(async () => {
  try {
    const hash = await bcrypt.hash(PASSWORD, 12);
    const inserted = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, status, is_active, email_verified_at, two_factor_enabled, metadata)
       VALUES ($1, $2, 'Login Verify', 'USER', 'ACTIVE', TRUE, NOW(), FALSE, $3::jsonb)
       RETURNING id`,
      [
        EMAIL,
        hash,
        JSON.stringify({
          failed_attempts: 0,
          locked_until: null,
          known_devices: [{ ip: IP, userAgent: USER_AGENT, deviceFingerprint: fingerprint, firstSeenAt: new Date().toISOString() }],
        }),
      ],
    );
    userId = inserted.rows[0].id;
    console.log('temp user created:', EMAIL, userId);

    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': IP, 'user-agent': USER_AGENT },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, rememberMe: false }),
    });
    const body = await res.json().catch(() => null);
    console.log('POST /api/auth/login ->', res.status);
    console.log('  requires2FA :', body?.requires2FA);
    console.log('  accessToken :', body?.tokens?.accessToken ? 'issued (hidden)' : '(none)');
    console.log('  user.email  :', body?.user?.email ?? '(none)');
    console.log('  error       :', body?.error ?? '(none)');

    if (res.status === 200 && body?.tokens?.accessToken && !body?.requires2FA) {
      console.log('\nRESULT: login success path works (200 + tokens).');
    } else {
      console.log('\nRESULT: unexpected response — login still broken.');
      process.exitCode = 1;
    }

    // Sanity check: an incorrect password must still be rejected as 401.
    const bad = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': IP, 'user-agent': USER_AGENT },
      body: JSON.stringify({ email: EMAIL, password: 'definitely-not-it' }),
    });
    const badBody = await bad.json().catch(() => null);
    console.log(`\nwrong password -> ${bad.status} ${JSON.stringify(badBody)}`);
  } catch (err) {
    console.error('VERIFY FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (userId) {
      await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM "Session" WHERE user_id = $1', [userId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
      const left = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [userId]).catch(() => ({ rows: [{ n: '?' }] }));
      console.log('\ncleanup done — temp rows remaining:', left.rows[0].n);
    }
    await pool.end();
  }
})();
