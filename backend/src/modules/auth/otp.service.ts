import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../../services/database.service';

/**
 * Email OTP lifecycle: generation, secure storage, verification, resend
 * protection. OTPs are never stored in plaintext and never returned by APIs.
 */

export type OtpPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

/** DB `type` column values on email_verifications. */
function purposeToType(purpose: OtpPurpose): 'VERIFY_EMAIL' | 'RESET_PASSWORD' {
  return purpose === 'EMAIL_VERIFICATION' ? 'VERIFY_EMAIL' : 'RESET_PASSWORD';
}

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_HOUR = 5;
const OTP_HASH_ROUNDS = 10;

export class OtpError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const OTP_ERROR_MESSAGES = {
  OTP_INVALID: 'The verification code is incorrect or no longer valid. Please request a new one.',
  OTP_EXPIRED: 'This verification code has expired. Please request a new one.',
  OTP_ALREADY_USED: 'This verification code has already been used. Please request a new one.',
  OTP_MAX_ATTEMPTS: 'Too many incorrect attempts. This code has been invalidated — please request a new one.',
  OTP_COOLDOWN: 'Please wait a minute before requesting another code.',
  OTP_RATE_LIMIT: 'Too many codes have been sent to this address. Please try again later.',
} as const;

/**
 * Cryptographically secure 6-digit OTP with leading-zero support.
 * Uses crypto.randomInt over the full 0..999999 space (never Math.random).
 */
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface OtpWindowCheck {
  allowed: boolean;
  reason?: 'COOLDOWN' | 'HOURLY_LIMIT';
  retryAfterSeconds?: number;
}

/**
 * Pure resend-window decision (unit-testable). Given the seconds elapsed since
 * the last send and the number of sends in the current hour window.
 */
export function checkResendWindow(
  secondsSinceLastSend: number | null,
  sendsLastHour: number
): OtpWindowCheck {
  if (secondsSinceLastSend !== null && secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS) {
    return {
      allowed: false,
      reason: 'COOLDOWN',
      retryAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend),
    };
  }
  if (sendsLastHour >= OTP_MAX_SENDS_PER_HOUR) {
    return { allowed: false, reason: 'HOURLY_LIMIT', retryAfterSeconds: 3600 };
  }
  return { allowed: true };
}

/**
 * Invalidate previous active OTPs and issue a fresh one for user + purpose.
 * Enforces the resend cooldown and hourly send limit.
 *
 * @returns the plaintext OTP (caller must only pass it to the email service).
 */
export async function issueOtp(userId: string, purpose: OtpPurpose): Promise<string> {
  const type = purposeToType(purpose);

  const statsRes = await pool.query(
    `SELECT
       EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) AS seconds_since_last,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS sends_last_hour
     FROM email_verifications
     WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '1 day'`,
    [userId, type]
  );

  const stats = statsRes.rows[0] || {};
  const secondsSinceLast = stats.seconds_since_last != null ? Number(stats.seconds_since_last) : null;
  const sendsLastHour = Number(stats.sends_last_hour || 0);

  const window = checkResendWindow(secondsSinceLast, sendsLastHour);
  if (!window.allowed) {
    throw new OtpError(
      window.reason === 'COOLDOWN' ? 'OTP_COOLDOWN' : 'OTP_RATE_LIMIT',
      window.reason === 'COOLDOWN' ? OTP_ERROR_MESSAGES.OTP_COOLDOWN : OTP_ERROR_MESSAGES.OTP_RATE_LIMIT,
      429
    );
  }

  // Only one active OTP per user + purpose: invalidate previous ones.
  await pool.query(
    `UPDATE email_verifications SET used_at = NOW()
     WHERE user_id = $1 AND type = $2 AND used_at IS NULL`,
    [userId, type]
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, OTP_HASH_ROUNDS);

  await pool.query(
    `INSERT INTO email_verifications (user_id, token_hash, type, expires_at, attempts)
     VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval, 0)`,
    [userId, otpHash, type, String(OTP_TTL_MINUTES)]
  );

  return otp;
}

export interface VerifyOtpResult {
  recordId: string;
  userId: string;
}

/**
 * Verify a supplied OTP for user + purpose. On failure increments attempts
 * (invalidating the OTP after OTP_MAX_ATTEMPTS) and throws a coded OtpError.
 * On success marks the OTP used (preventing reuse).
 */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  otp: string
): Promise<VerifyOtpResult> {
  const type = purposeToType(purpose);
  const cleanOtp = (otp || '').trim();

  const res = await pool.query(
    `SELECT id, token_hash, expires_at, used_at, attempts
     FROM email_verifications
     WHERE user_id = $1 AND type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, type]
  );

  const record = res.rows[0];
  if (!record) {
    throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);
  }

  if (Number(record.attempts) >= OTP_MAX_ATTEMPTS) {
    throw new OtpError('OTP_MAX_ATTEMPTS', OTP_ERROR_MESSAGES.OTP_MAX_ATTEMPTS);
  }

  if (record.used_at) {
    throw new OtpError('OTP_ALREADY_USED', OTP_ERROR_MESSAGES.OTP_ALREADY_USED);
  }

  if (new Date(record.expires_at) < new Date()) {
    throw new OtpError('OTP_EXPIRED', OTP_ERROR_MESSAGES.OTP_EXPIRED);
  }

  if (!/^\d{6}$/.test(cleanOtp) || !(await bcrypt.compare(cleanOtp, record.token_hash))) {
    const attempts = Number(record.attempts) + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      // Invalidate immediately so further tries are rejected outright.
      await pool.query('UPDATE email_verifications SET attempts = $2, used_at = NOW() WHERE id = $1', [
        record.id,
        attempts,
      ]);
      throw new OtpError('OTP_MAX_ATTEMPTS', OTP_ERROR_MESSAGES.OTP_MAX_ATTEMPTS);
    }

    await pool.query('UPDATE email_verifications SET attempts = $2 WHERE id = $1', [record.id, attempts]);
    throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);
  }

  await pool.query('UPDATE email_verifications SET used_at = NOW() WHERE id = $1', [record.id]);
  return { recordId: record.id, userId };
}

/**
 * Delete expired OTP records. Safe to call periodically / opportunistically.
 */
export async function purgeExpiredOtps(): Promise<void> {
  await pool.query("DELETE FROM email_verifications WHERE expires_at < NOW() - INTERVAL '1 day'");
}