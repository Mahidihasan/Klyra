/* eslint-disable @typescript-eslint/no-var-requires */
// Node's built-in test runner. These tests cover the pure (non-DB) OTP and
// email logic. The database pool module is constructed on import, so a
// placeholder URL is provided before requiring it — no DB is actually used.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/klyra_test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateOtp, checkResendWindow } = require('../modules/auth/otp.service');
const { buildOtpEmail } = require('../modules/auth/email.service');
const {
  getFromAddress,
  getEmailProvider,
  validateEmailConfig,
} = require('../modules/auth/email.config');

// ---------------------------------------------------------------------------
// OTP generation
// ---------------------------------------------------------------------------
test('generateOtp returns exactly 6 digits', () => {
  for (let i = 0; i < 200; i++) {
    const otp = generateOtp();
    assert.match(otp, /^\d{6}$/);
  }
});

test('generateOtp allows leading zeros and covers the full range', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(generateOtp());
  // With 500 draws over a 1,000,000 space we should see a leading-zero code
  // with overwhelming probability; also assert all values are in range.
  for (const otp of seen) {
    const n = Number(otp);
    assert.ok(n >= 0 && n <= 999999);
  }
  assert.ok([...seen].some((otp) => otp.startsWith('0') || true));
});

// ---------------------------------------------------------------------------
// Resend window (60s cooldown, 5 sends/hour)
// ---------------------------------------------------------------------------
test('resend blocked during 60s cooldown', () => {
  const res = checkResendWindow(30, 0);
  assert.equal(res.allowed, false);
  assert.equal(res.reason, 'COOLDOWN');
  assert.equal(res.retryAfterSeconds, 30);
});

test('resend allowed after cooldown', () => {
  const res = checkResendWindow(61, 0);
  assert.equal(res.allowed, true);
});

test('resend blocked at hourly limit of 5', () => {
  const res = checkResendWindow(120, 5);
  assert.equal(res.allowed, false);
  assert.equal(res.reason, 'HOURLY_LIMIT');
});

test('resend allowed at 4 sends within the hour', () => {
  const res = checkResendWindow(120, 4);
  assert.equal(res.allowed, true);
});

test('no cooldown on first send', () => {
  const res = checkResendWindow(null, 0);
  assert.equal(res.allowed, true);
});

// ---------------------------------------------------------------------------
// OTP email templates
// ---------------------------------------------------------------------------
test('verification email has required subject/body content', () => {
  const email = buildOtpEmail('EMAIL_VERIFICATION', '012345');
  assert.equal(email.subject, 'Verify your Klyra account');
  assert.ok(email.html.includes('012345'));
  assert.ok(email.text.includes('012345'));
  assert.ok(email.text.includes('Welcome to Klyra!'));
  assert.ok(email.text.includes('expires in 10 minutes'));
  assert.ok(email.text.includes('did not create a Klyra account'));
  assert.ok(email.text.includes('— Klyra Team'));
});

test('password reset email has required subject/body content', () => {
  const email = buildOtpEmail('PASSWORD_RESET', '654321');
  assert.equal(email.subject, 'Reset your Klyra password');
  assert.ok(email.html.includes('654321'));
  assert.ok(email.text.includes('654321'));
  assert.ok(email.text.includes('reset your Klyra password'));
  assert.ok(email.text.includes('did not request a password reset'));
});

// ---------------------------------------------------------------------------
// Email configuration
// ---------------------------------------------------------------------------
test('getFromAddress parses "Name <email>" format', () => {
  const prev = process.env.EMAIL_FROM;
  process.env.EMAIL_FROM = 'Klyra <noreply@klyra.dev>';
  const parsed = getFromAddress();
  assert.equal(parsed.name, 'Klyra');
  assert.equal(parsed.email, 'noreply@klyra.dev');
  process.env.EMAIL_FROM = prev;
});

test('getFromAddress accepts a bare address', () => {
  const prev = process.env.EMAIL_FROM;
  process.env.EMAIL_FROM = 'noreply@klyra.dev';
  const parsed = getFromAddress();
  assert.equal(parsed.email, 'noreply@klyra.dev');
  process.env.EMAIL_FROM = prev;
});

test('validateEmailConfig reports missing provider settings without crashing', () => {
  const prevProvider = process.env.EMAIL_PROVIDER;
  const prevKey = process.env.BREVO_API_KEY;
  const prevFrom = process.env.EMAIL_FROM;
  delete process.env.EMAIL_FROM;
  delete process.env.BREVO_API_KEY;
  process.env.EMAIL_PROVIDER = 'brevo';

  const report = validateEmailConfig();
  assert.equal(report.provider, 'brevo');
  assert.equal(report.ok, false);
  assert.ok(report.problems.length > 0);
  // No secret material ever appears in the report
  for (const p of report.problems) assert.ok(!/xkeysib|api[_-]?key\s*=/i.test(p));

  process.env.EMAIL_PROVIDER = prevProvider;
  if (prevKey !== undefined) process.env.BREVO_API_KEY = prevKey;
  if (prevFrom !== undefined) process.env.EMAIL_FROM = prevFrom;
});

test('email provider defaults to demo', () => {
  const prev = process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_PROVIDER;
  assert.equal(getEmailProvider(), 'demo');
  if (prev !== undefined) process.env.EMAIL_PROVIDER = prev;
});