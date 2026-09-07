import bcrypt from 'bcryptjs';
import { pool } from '../../services/database.service';
import {
  UserRecord,
  UserMetadata,
  UserPublicProfile,
  AuthTokens,
  LoginHistoryItem,
} from './auth.types';
import {
  signJwt,
  sha256,
  generateRandomToken,
  generate2FACode,
  generateDeviceFingerprint,
} from './jwt.util';
import { EmailService, OtpEmailService, EmailDeliveryError } from './email.service';
import { issueOtp, verifyOtp, OtpError, OTP_ERROR_MESSAGES } from './otp.service';

const BCRYPT_ROUNDS = 12;

function sanitizeUser(user: any): UserPublicProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    email_verified_at: user.email_verified_at,
    status: user.status,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

export class AuthService {
  /**
   * Register a new platform user (unverified) and email an OTP for
   * email verification. On email delivery failure the created user is
   * rolled back so the database never contains an unnotified account.
   */
  static async register(
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string; email: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Name must be at least 2 characters long.');
    }

    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Please provide a valid email address.');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id, email_verified_at FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      throw new Error('An account with this email address already exists.');
    }

    // Hash password with bcrypt using 12 rounds
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user in users table (unverified state — email_verified_at is NULL)
    const userRes = await pool.query(
      `INSERT INTO users (
        name, email, password_hash, role, status, is_active, metadata
      ) VALUES ($1, $2, $3, 'USER', 'ACTIVE', TRUE, '{}')
      RETURNING id, email, name, role, email_verified_at, status, created_at`,
      [cleanName, cleanEmail, passwordHash]
    );

    const user = userRes.rows[0];

    try {
      const otp = await issueOtp(user.id, 'EMAIL_VERIFICATION');
      await OtpEmailService.sendVerificationOTP(cleanEmail, otp);
    } catch (err) {
      // Keep the database consistent: remove the just-created user + OTP.
      await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

      if (err instanceof OtpError) throw err;
      if (err instanceof EmailDeliveryError) throw err;
      // eslint-disable-next-line no-console
      console.error('[auth] Registration email delivery failed unexpectedly.');
      throw new EmailDeliveryError();
    }

    return {
      success: true,
      message: 'Verification code sent to your email.',
      email: cleanEmail,
    };
  }

  /**
   * Verify a registration email using a 6-digit OTP.
   */
  static async verifyEmail(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    if (!email || !otp) {
      throw new Error('Email address and verification code are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query(
      'SELECT id, email_verified_at FROM users WHERE email = $1 AND deleted_at IS NULL',
      [cleanEmail]
    );
    const user = userRes.rows[0];
    if (!user) {
      throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);
    }

    if (user.email_verified_at) {
      return { success: true, message: 'This email address is already verified. Please sign in.' };
    }

    await verifyOtp(user.id, 'EMAIL_VERIFICATION', otp);

    // Mark user verified and record audit trail
    await pool.query('BEGIN');
    try {
      await pool.query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [user.id]);
      await pool.query(
        `INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, new_values
        ) VALUES ($1, 'UPDATE', 'users', $1, '{"email_verified": true}')`,
        [user.id]
      );
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    return { success: true, message: 'Email verified successfully.' };
  }

  /**
   * Resend the email-verification OTP.
   */
  static async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query('SELECT id, name, email, email_verified_at FROM users WHERE email = $1', [cleanEmail]);
    const user = userRes.rows[0];

    if (!user) {
      // Return success to avoid email discovery
      return { success: true, message: 'If an account exists, a new verification code has been sent.' };
    }

    if (user.email_verified_at) {
      return { success: true, message: 'Your email address is already verified. You can log in directly.' };
    }

    const otp = await issueOtp(user.id, 'EMAIL_VERIFICATION');
    await OtpEmailService.sendVerificationOTP(user.email, otp);
    return { success: true, message: 'A new verification code has been sent to your email.' };
  }

  /**
   * Primary Login handler.
   */
  static async login(
    email: string,
    password: string,
    rememberMe = false,
    ip = '127.0.0.1',
    userAgent = 'Unknown Device'
  ): Promise<{
    requires2FA?: boolean;
    tempToken?: string;
    maskedEmail?: string;
    tokens?: AuthTokens;
    user?: UserPublicProfile;
  }> {
    const cleanEmail = email.trim().toLowerCase();

    // Query user
    const userRes = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [cleanEmail]
    );
    const user: UserRecord = userRes.rows[0];

    if (!user) {
      // Record failed attempt in audit log
      await pool.query(
        `INSERT INTO audit_logs (action, entity_type, new_values, ip_address, user_agent)
         VALUES ('LOGIN', 'users', $1, $2::inet, $3)`,
        [JSON.stringify({ success: false, reason: 'user_not_found', email: cleanEmail }), ip.replace(/[^0-9.:]/g, '') || '127.0.0.1', userAgent]
      );
      throw new Error('Invalid email or password.');
    }

    const metadata: UserMetadata = user.metadata || {};

    // 1. Check account lockout
    if (metadata.locked_until) {
      const lockedUntilDate = new Date(metadata.locked_until);
      const now = new Date();
      if (lockedUntilDate > now) {
        const remainingMs = lockedUntilDate.getTime() - now.getTime();
        const mins = Math.ceil(remainingMs / 60000);
        throw new Error(
          `Account is locked due to 3 failed attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`
        );
      } else {
        // Lockout expired, reset counters
        metadata.locked_until = null;
        metadata.failed_attempts = 0;
      }
    }

    // 2. Check if email is verified
    if (!user.email_verified_at) {
      const err = new Error('Please verify your email address before logging in. A verification link was sent to your inbox.') as any;
      err.code = 'EMAIL_NOT_VERIFIED';
      throw err;
    }

    // 3. Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const failedAttempts = (metadata.failed_attempts || 0) + 1;
      metadata.failed_attempts = failedAttempts;

      if (failedAttempts >= 3) {
        // Lock account for 20 minutes
        const lockUntil = new Date(Date.now() + 20 * 60 * 1000).toISOString();
        metadata.locked_until = lockUntil;
        metadata.failed_attempts = 0;

        await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
        await pool.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
           VALUES ($1, 'LOGIN', 'users', $1, $2, $3::inet, $4)`,
          [user.id, JSON.stringify({ success: false, reason: 'locked_3_attempts' }), ip.replace(/[^0-9.:]/g, '') || '127.0.0.1', userAgent]
        );

        throw new Error('Account locked for 20 minutes due to 3 failed login attempts.');
      } else {
        const remaining = 3 - failedAttempts;
        await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
        await pool.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
           VALUES ($1, 'LOGIN', 'users', $1, $2, $3::inet, $4)`,
          [user.id, JSON.stringify({ success: false, reason: 'invalid_password', failedAttempts }), ip.replace(/[^0-9.:]/g, '') || '127.0.0.1', userAgent]
        );

        throw new Error(`Invalid email or password. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before a 20-minute account lockout.`);
      }
    }

    // Password is correct: clear failed attempts
    metadata.failed_attempts = 0;
    metadata.locked_until = null;

    // 4. New-Device 2FA Check
    const currentFingerprint = generateDeviceFingerprint(userAgent, ip);
    const knownDevices: any[] = metadata.known_devices || [];

    const isKnownDevice = knownDevices.some(
      (d) => d.deviceFingerprint === currentFingerprint || (d.ip === ip && d.userAgent === userAgent)
    );

    if (!isKnownDevice) {
      // Trigger new device 2FA email
      const code = generate2FACode();
      const tempToken = generateRandomToken(24);

      metadata.pending_2fa = {
        codeHash: sha256(code),
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        rememberMe: !!rememberMe,
        tempToken,
      };

      await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
      await EmailService.send2FAEmail(user.email, user.name, code, ip, userAgent);

      return {
        requires2FA: true,
        tempToken,
        maskedEmail: maskEmail(user.email),
      };
    }

    // 5. Known Device: Complete Login immediately
    const loginResult = await this.completeLogin(user, metadata, currentFingerprint, ip, userAgent, rememberMe);
    return {
      requires2FA: false,
      tokens: loginResult.tokens,
      user: loginResult.user,
    };
  }

  /**
   * Verify New-Device 2FA code.
   */
  static async verify2FA(
    tempToken: string,
    code: string,
    ip = '127.0.0.1',
    userAgent = 'Unknown Device'
  ): Promise<{ tokens: AuthTokens; user: UserPublicProfile }> {
    if (!tempToken || !code) {
      throw new Error('Security code and session token are required.');
    }

    // Query user by tempToken in metadata
    const userRes = await pool.query(
      `SELECT * FROM users WHERE metadata->'pending_2fa'->>'tempToken' = $1 AND deleted_at IS NULL`,
      [tempToken]
    );

    const user: UserRecord = userRes.rows[0];
    if (!user) {
      throw new Error('Invalid or expired 2FA session. Please log in again.');
    }

    const metadata: UserMetadata = user.metadata || {};
    const pending2FA = metadata.pending_2fa;

    if (!pending2FA) {
      throw new Error('No pending 2FA verification found.');
    }

    if (Date.now() > pending2FA.expiresAt) {
      metadata.pending_2fa = null;
      await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
      throw new Error('Security code has expired. Please request a new code.');
    }

    const inputCodeHash = sha256(code.trim());
    if (inputCodeHash !== pending2FA.codeHash) {
      throw new Error('Invalid verification code. Please check the code sent to your email.');
    }

    // Code verified: mark device as known
    const currentFingerprint = generateDeviceFingerprint(userAgent, ip);
    const knownDevices = metadata.known_devices || [];
    knownDevices.push({
      deviceFingerprint: currentFingerprint,
      userAgent,
      ip,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
    metadata.known_devices = knownDevices;
    const rememberMe = pending2FA.rememberMe;
    metadata.pending_2fa = null;

    return this.completeLogin(user, metadata, currentFingerprint, ip, userAgent, rememberMe);
  }

  /**
   * Resend 2FA security code.
   */
  static async resend2FA(tempToken: string, ip = '127.0.0.1', userAgent = 'Unknown Device'): Promise<{ success: boolean; message: string }> {
    if (!tempToken) {
      throw new Error('Session token is required.');
    }

    const userRes = await pool.query(
      `SELECT * FROM users WHERE metadata->'pending_2fa'->>'tempToken' = $1 AND deleted_at IS NULL`,
      [tempToken]
    );

    const user: UserRecord = userRes.rows[0];
    if (!user || !user.metadata?.pending_2fa) {
      throw new Error('Session has expired. Please start login again.');
    }

    const code = generate2FACode();
    user.metadata.pending_2fa.codeHash = sha256(code);
    user.metadata.pending_2fa.expiresAt = Date.now() + 10 * 60 * 1000;

    await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(user.metadata), user.id]);
    await EmailService.send2FAEmail(user.email, user.name, code, ip, userAgent);

    return { success: true, message: 'New security code sent to your email.' };
  }

  /**
   * Complete login: establish user_sessions row and issue JWT tokens.
   */
  private static async completeLogin(
    user: UserRecord,
    metadata: UserMetadata,
    fingerprint: string,
    ip: string,
    userAgent: string,
    rememberMe: boolean
  ): Promise<{ tokens: AuthTokens; user: UserPublicProfile }> {
    // Refresh token expiry: 30 days if remember me, 7 days otherwise
    const refreshExpiryMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const refreshExpiresAt = new Date(Date.now() + refreshExpiryMs);

    const rawRefreshToken = generateRandomToken(48);
    const refreshTokenHash = sha256(rawRefreshToken);

    const sessionRes = await pool.query(
      `INSERT INTO user_sessions (
        user_id, refresh_token_hash, user_agent, ip_address, expires_at
      ) VALUES ($1, $2, $3, $4::inet, $5)
      RETURNING id`,
      [user.id, refreshTokenHash, userAgent, ip.replace(/[^0-9.:]/g, '') || '127.0.0.1', refreshExpiresAt]
    );

    const sessionId = sessionRes.rows[0].id;

    // Access token valid for 15 minutes (900s)
    const accessToken = signJwt(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sessionId,
      },
      15 * 60
    );

    // Update user login timestamp & IP
    await pool.query(
      `UPDATE users
       SET last_login_at = NOW(), last_login_ip = $1::inet, metadata = $2
       WHERE id = $3`,
      [ip.replace(/[^0-9.:]/g, '') || '127.0.0.1', JSON.stringify(metadata), user.id]
    );

    // Record successful login in audit_logs
    await pool.query(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, new_values, ip_address, user_agent
      ) VALUES ($1, 'LOGIN', 'users', $1, $2, $3::inet, $4)`,
      [user.id, JSON.stringify({ success: true, rememberMe, sessionId }), ip.replace(/[^0-9.:]/g, '') || '127.0.0.1', userAgent]
    );

    return {
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: 900,
      },
      user: sanitizeUser(user),
    };
  }

  /**
   * Refresh JWT access token using valid refresh token.
   */
  static async refreshAccessToken(rawRefreshToken: string): Promise<AuthTokens> {
    if (!rawRefreshToken) throw new Error('Refresh token is required.');

    const tokenHash = sha256(rawRefreshToken);
    const sessionRes = await pool.query(
      `SELECT s.id as session_id, s.user_id, s.expires_at, s.revoked_at,
              u.id, u.email, u.name, u.role, u.status
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1`,
      [tokenHash]
    );

    const session = sessionRes.rows[0];
    if (!session) throw new Error('Invalid refresh token.');
    if (session.revoked_at) throw new Error('Session has been revoked.');
    if (new Date(session.expires_at) < new Date()) throw new Error('Session has expired.');
    if (session.status !== 'ACTIVE') throw new Error('Account is inactive or suspended.');

    // Issue new 15-minute access token
    const newAccessToken = signJwt(
      {
        sub: session.user_id,
        email: session.email,
        name: session.name,
        role: session.role,
        sessionId: session.session_id,
      },
      15 * 60
    );

    return {
      accessToken: newAccessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Request a password-reset OTP. The response never reveals whether the
   * email exists (no email enumeration).
   */
  static async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1 AND deleted_at IS NULL',
      [cleanEmail]
    );
    const user = userRes.rows[0];

    // Generic response prevents email enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email address, a verification code has been sent.',
    };

    if (!user) return genericResponse;

    try {
      const otp = await issueOtp(user.id, 'PASSWORD_RESET');
      await OtpEmailService.sendPasswordResetOTP(user.email, otp);
    } catch (err) {
      if (err instanceof OtpError) throw err;
      if (err instanceof EmailDeliveryError) throw err;
      // eslint-disable-next-line no-console
      console.error('[auth] Password reset email delivery failed unexpectedly.');
      throw new EmailDeliveryError();
    }

    return genericResponse;
  }

  /**
   * Verify a PASSWORD_RESET OTP and issue a short-lived, single-use reset
   * authorization token. The reset token reuses the existing RESET_PASSWORD
   * token flow consumed by resetPassword() below.
   */
  static async verifyResetOtp(
    email: string,
    otp: string
  ): Promise<{ success: boolean; message: string; resetToken: string }> {
    if (!email || !otp) {
      throw new Error('Email address and verification code are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [cleanEmail]
    );
    const user = userRes.rows[0];
    if (!user) {
      throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);
    }

    await verifyOtp(user.id, 'PASSWORD_RESET', otp);

    // Issue a short-lived (10 min), single-use reset authorization token.
    const rawResetToken = generateRandomToken(32);
    const tokenHash = sha256(rawResetToken);

    await pool.query(
      `INSERT INTO email_verifications (
        user_id, token_hash, type, expires_at
      ) VALUES ($1, $2, 'RESET_PASSWORD', NOW() + INTERVAL '10 minutes')`,
      [user.id, tokenHash]
    );

    return {
      success: true,
      message: 'Code verified. You can now set a new password.',
      resetToken: rawResetToken,
    };
  }

  /**
   * Reset password with single-use token.
   */
  static async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!token || !newPassword) {
      throw new Error('Reset token and new password are required.');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const tokenHash = sha256(token.trim());

    const verifRes = await pool.query(
      `SELECT id, user_id, expires_at, used_at
       FROM email_verifications
       WHERE token_hash = $1 AND type = 'RESET_PASSWORD'`,
      [tokenHash]
    );

    const record = verifRes.rows[0];
    if (!record || record.used_at) {
      throw new Error('This password reset link is invalid or has already been used.');
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new Error('This password reset link has expired. Please request a new one.');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.query('BEGIN');
    try {
      // 1. Update password
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, record.user_id]);

      // 2. Mark token used
      await pool.query('UPDATE email_verifications SET used_at = NOW() WHERE id = $1', [record.id]);

      // 3. Invalidate all existing sessions for this user for security
      await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [record.user_id]);

      // 4. Log to audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'UPDATE', 'users', $1, '{"action": "password_reset"}')`,
        [record.user_id]
      );

      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    return { success: true, message: 'Your password has been reset successfully. Please log in with your new password.' };
  }

  /**
   * Logout and revoke active session.
   */
  static async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1', [sessionId]);
    } else if (userId) {
      await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    }

    if (userId) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'LOGOUT', 'users', $1, '{"action": "user_logout"}')`,
        [userId]
      );
    }
  }

  /**
   * Get user login history from audit_logs.
   */
  static async getLoginHistory(userId: string): Promise<LoginHistoryItem[]> {
    const res = await pool.query(
      `SELECT id, action, ip_address::text, user_agent, new_values, created_at
       FROM audit_logs
       WHERE user_id = $1 AND action = 'LOGIN'
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId]
    );

    return res.rows.map((row) => {
      const newVals = typeof row.new_values === 'string' ? JSON.parse(row.new_values) : (row.new_values || {});
      const isSuccess = newVals.success === true;
      return {
        id: row.id,
        action: row.action,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        timestamp: row.created_at,
        success: isSuccess,
        deviceSummary: row.user_agent ? summarizeUserAgent(row.user_agent) : 'Unknown Device',
      };
    });
  }
}

function summarizeUserAgent(ua: string): string {
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    if (/iPhone/i.test(ua)) return 'iPhone (Mobile Safari)';
    if (/iPad/i.test(ua)) return 'iPad (Mobile Safari)';
    if (/Android/i.test(ua)) return 'Android Device';
    return 'Mobile Browser';
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Windows (Chrome)';
    if (/Edg/i.test(ua)) return 'Windows (Edge)';
    if (/Firefox/i.test(ua)) return 'Windows (Firefox)';
    return 'Windows PC';
  }
  if (/Macintosh|Mac OS/i.test(ua)) {
    if (/Chrome/i.test(ua)) return 'macOS (Chrome)';
    if (/Safari/i.test(ua)) return 'macOS (Safari)';
    if (/Firefox/i.test(ua)) return 'macOS (Firefox)';
    return 'Macintosh';
  }
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Desktop Browser';
}
