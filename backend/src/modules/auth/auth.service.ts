import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { pool } from '../../services/database.service';
import { CLOUDINARY_FOLDERS, deleteFile, uploadFile } from '../../services/storage.service';
import {
  UserRecord,
  UserMetadata,
  UserPublicProfile,
  ProfileAchievement,
  AuthTokens,
  LoginResult,
  LoginHistoryItem,
  UpdateProfileInput,
  UpdatePreferencesInput,
  UserPreferences,
  ProfileExperience,
  ProfileEducation,
  ProfileCertificate,
} from './auth.types';
import { CertificatesService } from '../certificates/certificates.service';
import {
  signJwt,
  sha256,
  generateRandomToken,
  generate2FACode,
  generateDeviceFingerprint,
} from './jwt.util';
import { EmailService, OtpEmailService, EmailDeliveryError } from './email.service';
import { issueOtp, verifyOtp, OtpError, OTP_ERROR_MESSAGES } from './otp.service';
import { createTotpSetup, decryptTotpSecret, encryptTotpSecret, verifyTotp } from './totp.service';

const BCRYPT_ROUNDS = 12;
const ACCEPTED_TIMEZONES = new Set([
  'UTC', 'Africa/Cairo', 'Africa/Johannesburg', 'America/Anchorage', 'America/Argentina/Buenos_Aires',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/New_York',
  'America/Phoenix', 'America/Sao_Paulo', 'America/Toronto', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai',
  'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Seoul',
  'Asia/Tokyo', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam',
  'Europe/Berlin', 'Europe/Istanbul', 'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Pacific/Auckland',
]);

export class PasswordChangeError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'PasswordChangeError';
  }
}

export class AccountDeactivationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AccountDeactivationError';
  }
}

function sanitizeUser(user: any, achievements: ProfileAchievement[] = [], certificates: ProfileCertificate[] = []): UserPublicProfile {
  const metadata: UserMetadata = user.metadata || {};
  const storedPreferences: Partial<UserPreferences> = metadata.preferences || {};
  const personalInfo = metadata.personal_info || {};
  const nameParts = user.name.trim().split(/\s+/);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    email_verified_at: user.email_verified_at,
    status: user.status,
    is_active: user.is_active,
    two_factor_enabled: user.two_factor_enabled,
    avatar_url: user.avatar_url,
    bio: user.bio,
    company: user.company,
    website: user.website,
    username: user.username,
    first_name: personalInfo.first_name || nameParts[0] || '',
    last_name: personalInfo.last_name || nameParts.slice(1).join(' ') || '',
    handle: user.username || null,
    job_title: personalInfo.job_title || null,
    github_url: personalInfo.github_url || null,
    skills: sanitizeSkills(metadata.skills),
    experience: sanitizeExperience(metadata.experience),
    education: sanitizeEducation(metadata.education),
    preferences: {
      theme: storedPreferences.theme === 'light' || storedPreferences.theme === 'system' ? storedPreferences.theme : 'dark',
      timezone: typeof storedPreferences.timezone === 'string' ? storedPreferences.timezone : 'UTC',
      notifications: {
        email: user.email_enabled ?? true,
        push: user.push_enabled ?? true,
        in_app: user.in_app_enabled ?? true,
      },
      api_response_format: storedPreferences.api_response_format === 'xml' ? 'xml' : 'json',
      code_snippet_preference: ['curl', 'javascript-fetch', 'javascript-axios', 'python', 'go'].includes(storedPreferences.code_snippet_preference as string)
        ? storedPreferences.code_snippet_preference as UserPreferences['code_snippet_preference'] : 'curl',
      email_notifications: {
        api_downtime_alerts: storedPreferences.email_notifications?.api_downtime_alerts ?? true,
        monthly_usage_quota_warnings: storedPreferences.email_notifications?.monthly_usage_quota_warnings ?? true,
        product_announcements: storedPreferences.email_notifications?.product_announcements ?? false,
      },
    },
    last_login_at: user.last_login_at,
    last_login_ip: user.last_login_ip,
    created_at: user.created_at,
    updated_at: user.updated_at,
    achievements,
    certificates,
  };
}

const PUBLIC_PROFILE_FIELDS = `u.id, u.email, u.name, u.role, u.email_verified_at, u.status,
  u.is_active, u.two_factor_enabled, u.avatar_url, u.bio, u.company, u.website,
  u.metadata, u.username, u.last_login_at, u.last_login_ip::text, u.created_at, u.updated_at,
  np.email_enabled, np.push_enabled, np.in_app_enabled`;

interface AchievementMetrics {
  published_api_count: number | string;
  active_subscriber_count: number | string;
  api_version_count: number | string;
}

const PROFILE_ACHIEVEMENTS: Record<ProfileAchievement['id'], Omit<ProfileAchievement, 'id'>> = {
  origin: {
    name: 'Origin',
    description: 'Published your first API.',
    detail: 'Earned by publishing your first marketplace API.',
  },
  momentum: {
    name: 'Momentum',
    description: 'Reached 5 active subscribers.',
    detail: 'Earned when your APIs reach five active subscribers.',
  },
  ascendant: {
    name: 'Ascendant',
    description: 'Evolved an API through multiple versions.',
    detail: 'Earned by publishing multiple versions of your APIs.',
  },
  legacy: {
    name: 'Legacy',
    description: 'One year on Klyra.',
    detail: 'Earned after one year of building on Klyra.',
  },
  distinction: {
    name: 'Distinction',
    description: 'Verified account.',
    detail: 'Earned when your Klyra account is verified.',
  },
  vanguard: {
    name: 'Vanguard',
    description: 'Two-factor protection enabled.',
    detail: 'Earned by securing your account with two-factor authentication.',
  },
};

function achievement(id: ProfileAchievement['id']): ProfileAchievement {
  return { id, ...PROFILE_ACHIEVEMENTS[id] };
}

/** Build the dynamic achievement set from trusted user data and aggregate metrics. */
export function buildProfileAchievements(
  user: Pick<UserPublicProfile, 'created_at' | 'email_verified_at' | 'two_factor_enabled'>,
  metrics: AchievementMetrics,
  now = Date.now(),
): ProfileAchievement[] {
  const createdAt = new Date(user.created_at).getTime();
  const isLegacy = Number.isFinite(createdAt) && createdAt <= now - 365 * 24 * 60 * 60 * 1000;
  const achievements: ProfileAchievement[] = [];

  if (Number(metrics.published_api_count) >= 1) achievements.push(achievement('origin'));
  if (Number(metrics.active_subscriber_count) >= 5) achievements.push(achievement('momentum'));
  if (Number(metrics.api_version_count) >= 2) achievements.push(achievement('ascendant'));
  if (isLegacy) achievements.push(achievement('legacy'));
  if (user.email_verified_at !== null) achievements.push(achievement('distinction'));
  if (user.two_factor_enabled) achievements.push(achievement('vanguard'));

  return achievements;
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

async function availableUsername(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const candidate = suffix === 1 ? base.slice(0, 30) : `${base.slice(0, 30 - String(suffix).length - 1)}-${suffix}`;
    if (!/^[a-z][a-z0-9_-]{1,28}[a-z0-9]$/.test(candidate)) continue;
    const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [candidate]);
    if (!existing.rows[0]) return candidate;
  }
  throw new Error('Could not allocate a username.');
}

export class AuthService {
  /** Return the safe, authenticated-user profile shape used by the client. */
  static async getProfile(userId: string): Promise<UserPublicProfile | null> {
    const result = await pool.query(
      `SELECT ${PUBLIC_PROFILE_FIELDS}
       FROM users u
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId],
    );

    const profile = result.rows[0];
    if (!profile) return null;

    const metrics = await pool.query<AchievementMetrics>(
      `SELECT
         COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'PUBLISHED') AS published_api_count,
         COUNT(DISTINCT us.id) AS active_subscriber_count,
         COUNT(DISTINCT av.id) AS api_version_count
       FROM apis a
       LEFT JOIN user_subscriptions us ON us.api_id = a.id AND us.status = 'ACTIVE'
       LEFT JOIN api_versions av ON av.api_id = a.id
       WHERE a.owner_id = $1 AND a.deleted_at IS NULL`,
      [userId],
    );

    await CertificatesService.ensureMarketplaceImpactCertificate(userId);
    await CertificatesService.ensureSecurityVerifiedCertificate(userId);
    const certificates = await CertificatesService.getIssuedCertificates(userId);
    const safeProfile = sanitizeUser(profile, [], certificates);
    return {
      ...safeProfile,
      achievements: buildProfileAchievements(safeProfile, metrics.rows[0] ?? {
        published_api_count: 0,
        active_subscriber_count: 0,
        api_version_count: 0,
      }),
    };
  }

  /**
   * Update the profile fields that are already represented in the users table.
   * Passwords, email, roles, session data and 2FA state deliberately cannot be
   * changed through this path.
   */
  static async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserPublicProfile> {
    const fields: string[] = [];
    const values: Array<string | null> = [];
    const metadataPatch: Record<string, unknown> = {};

    const add = (column: string, value: string | null) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    const personalInfoPatch: Record<string, string> = {};
    const hasFirstName = input.first_name !== undefined;
    const hasLastName = input.last_name !== undefined;
    const requestedUsername = input.username ?? input.handle;

    if (input.name !== undefined && !hasFirstName && !hasLastName) {
      if (typeof input.name !== 'string') throw new Error('Name must be a string.');
      const name = input.name.trim();
      if (name.length < 2 || name.length > 100) {
        throw new Error('Name must be between 2 and 100 characters.');
      }
      add('name', name);
    }

    if (hasFirstName !== hasLastName) {
      throw new Error('First name and last name must be provided together.');
    }

    if (hasFirstName) {
      const firstName = normalizeRequiredProfileText(input.first_name, 'First name', 50);
      const lastName = normalizeRequiredProfileText(input.last_name, 'Last name', 50);
      const fullName = `${firstName} ${lastName}`;
      if (fullName.length > 100) throw new Error('First and last name together must be 100 characters or fewer.');
      add('name', fullName);
      personalInfoPatch.first_name = firstName;
      personalInfoPatch.last_name = lastName;
    }

    if (requestedUsername !== undefined) {
      const handle = normalizeRequiredProfileText(requestedUsername, 'Username', 30).toLowerCase();
      if (!/^[a-z][a-z0-9_-]{1,28}[a-z0-9]$/.test(handle)) {
        throw new Error('Username must be 3–30 characters, start with a lowercase letter, end with a lowercase letter or number, and use only lowercase letters, numbers, underscores, or hyphens.');
      }
      add('username', handle);
      personalInfoPatch.handle = handle;
    }

    if (input.job_title !== undefined) {
      const jobTitle = normalizeOptionalProfileText(input.job_title, 'Job title', 100);
      if (!jobTitle) throw new Error('Job title is required.');
      personalInfoPatch.job_title = jobTitle;
    }

    if (input.github_url !== undefined) {
      const githubUrl = normalizeOptionalProfileText(input.github_url, 'GitHub profile URL', 500);
      validateGithubUrl(githubUrl);
      personalInfoPatch.github_url = githubUrl!;
    }

    if (Object.keys(personalInfoPatch).length > 0) {
      metadataPatch.personal_info = personalInfoPatch;
    }

    if (input.company !== undefined) {
      add('company', normalizeOptionalProfileText(input.company, 'Company', 255));
    }

    if (input.bio !== undefined) {
      add('bio', normalizeOptionalProfileText(input.bio, 'Bio', 2000));
    }

    if (input.website !== undefined) {
      const website = normalizeOptionalProfileText(input.website, 'Website', 500);
      if (website) {
        let url: URL;
        try {
          url = new URL(website);
        } catch {
          throw new Error('Website must be a valid URL.');
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Website must use http:// or https://.');
        }
      }
      add('website', website);
    }

    if (input.skills !== undefined) {
      metadataPatch.skills = normalizeSkills(input.skills);
    }

    if (input.experience !== undefined) {
      metadataPatch.experience = normalizeExperience(input.experience);
    }

    if (input.education !== undefined) {
      metadataPatch.education = normalizeEducation(input.education);
    }

    if (Object.keys(metadataPatch).length > 0) {
      values.push(JSON.stringify(metadataPatch));
      fields.push(metadataPatch.personal_info
        ? `metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{personal_info}', COALESCE(metadata -> 'personal_info', '{}'::jsonb) || ($${values.length}::jsonb -> 'personal_info'), true)`
        : `metadata = COALESCE(metadata, '{}'::jsonb) || $${values.length}::jsonb`);
    }

    if (fields.length === 0) {
      throw new Error('Provide at least one profile field to update.');
    }

    values.push(userId);
    const result = await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING id`,
      values,
    );

    const user = result.rows[0];
    if (!user) throw new Error('User not found.');

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'UPDATE', 'users', $1, $2::jsonb)`,
      [userId, JSON.stringify({ profile_fields: fields.map((field) => field.split(' ')[0]) })],
    );

    return (await this.getProfile(userId))!;
  }

  static async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<UserPublicProfile> {
    const current = await this.getProfile(userId);
    if (!current) throw new Error('User not found.');

    const theme = input.theme === undefined ? current.preferences.theme : input.theme;
    const timezone = input.timezone === undefined ? current.preferences.timezone : input.timezone;
    const notifications = input.notifications === undefined ? current.preferences.notifications : input.notifications;
    const apiResponseFormat = input.api_response_format === undefined ? current.preferences.api_response_format : input.api_response_format;
    const codeSnippetPreference = input.code_snippet_preference === undefined ? current.preferences.code_snippet_preference : input.code_snippet_preference;
    const emailNotifications = input.email_notifications === undefined ? current.preferences.email_notifications : input.email_notifications;

    if (theme !== 'dark' && theme !== 'light' && theme !== 'system') throw new Error('Theme must be dark, light, or system.');
    if (typeof timezone !== 'string' || !ACCEPTED_TIMEZONES.has(timezone)) throw new Error('Timezone must be selected from the supported timezone list.');
    if (!notifications || typeof notifications !== 'object' || typeof (notifications as any).email !== 'boolean' || typeof (notifications as any).push !== 'boolean' || typeof (notifications as any).in_app !== 'boolean') {
      throw new Error('Notification preferences must include Email, Push, and In-app settings.');
    }
    if (apiResponseFormat !== 'json' && apiResponseFormat !== 'xml') throw new Error('API response format must be JSON or XML.');
    if (!['curl', 'javascript-fetch', 'javascript-axios', 'python', 'go'].includes(codeSnippetPreference as string)) throw new Error('Code snippet preference must be a supported language.');
    if (!emailNotifications || typeof emailNotifications !== 'object' || typeof (emailNotifications as any).api_downtime_alerts !== 'boolean' || typeof (emailNotifications as any).monthly_usage_quota_warnings !== 'boolean' || typeof (emailNotifications as any).product_announcements !== 'boolean') {
      throw new Error('Email notification preferences must include all supported alert categories.');
    }

    const metadataPreferences = { theme, timezone, api_response_format: apiResponseFormat, code_snippet_preference: codeSnippetPreference, email_notifications: emailNotifications };
    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE users
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{preferences}',
           (COALESCE(metadata -> 'preferences', '{}'::jsonb) - 'language') || $1::jsonb, true),
           updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL`,
        [JSON.stringify(metadataPreferences), userId],
      );
      await pool.query(
        `INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, in_app_enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET email_enabled = EXCLUDED.email_enabled,
           push_enabled = EXCLUDED.push_enabled, in_app_enabled = EXCLUDED.in_app_enabled, updated_at = NOW()`,
        [userId, (notifications as any).email, (notifications as any).push, (notifications as any).in_app],
      );
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'UPDATE', 'users', $1, '{"profile_fields":["preferences"]}'::jsonb)`, [userId],
      );
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    return (await this.getProfile(userId))!;
  }

  /**
   * Disable an account without deleting its retained records. Password
   * re-authentication prevents a stolen browser session from disabling a user.
   */
  static async deactivateAccount(userId: string, currentPassword: unknown): Promise<{ success: boolean; message: string }> {
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 256) {
      throw new AccountDeactivationError('Current password is required.', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `SELECT id, password_hash, status, is_active
         FROM users
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [userId],
      );
      const user = userResult.rows[0];
      if (!user) throw new AccountDeactivationError('Account not found.', 404);
      if (user.status !== 'ACTIVE' || !user.is_active) {
        throw new AccountDeactivationError('This account is already inactive.', 400);
      }

      const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
      if (!passwordMatches) {
        throw new AccountDeactivationError('Current password is incorrect.', 401);
      }

      await client.query(
        `UPDATE users
         SET status = 'INACTIVE', is_active = FALSE, updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
      const sessionResult = await client.query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
      const keyResult = await client.query(
        `UPDATE api_keys
         SET status = 'REVOKED', is_active = FALSE, revoked_at = NOW()
         WHERE user_id = $1 AND status = 'ACTIVE' AND is_active = TRUE`,
        [userId],
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'SUSPEND', 'users', $1, $2::jsonb)`,
        [userId, JSON.stringify({ action: 'account_deactivated', sessions_revoked: sessionResult.rowCount, api_keys_revoked: keyResult.rowCount })],
      );
      await client.query('COMMIT');
      return { success: true, message: 'Your account has been deactivated and you have been signed out.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** Upload a replacement avatar and persist only its Cloudinary references. */
  static async updateAvatar(userId: string, file: Express.Multer.File): Promise<UserPublicProfile> {
    const existing = await pool.query(
      'SELECT avatar_public_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    if (!existing.rows[0]) throw new Error('User not found.');

    const previousPublicId = existing.rows[0].avatar_public_id as string | null;
    const asset = await uploadFile(file, {
      folder: CLOUDINARY_FOLDERS.AVATARS,
      resourceType: 'image',
      publicId: userId,
    });

    const updated = await pool.query(
      `UPDATE users
       SET avatar_url = $1, avatar_public_id = $2, avatar_metadata = $3::jsonb, updated_at = NOW()
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, email, name, role, email_verified_at, status, avatar_url,
                 bio, company, website, created_at`,
      [asset.secure_url, asset.public_id, JSON.stringify(asset), userId],
    );
    const user = updated.rows[0];
    if (!user) throw new Error('User not found.');

    if (previousPublicId && previousPublicId !== asset.public_id) {
      try {
        await deleteFile(previousPublicId);
      } catch {
        // The new avatar is already persisted; a failed cleanup must not undo it.
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'UPDATE', 'users', $1, '{"profile_fields":["avatar"]}'::jsonb)`,
      [userId],
    );

    return (await this.getProfile(userId))!;
  }

  /** Remove the avatar reference and clean up its Cloudinary asset. */
  static async removeAvatar(userId: string): Promise<UserPublicProfile> {
    const existing = await pool.query(
      'SELECT avatar_public_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    const previousPublicId = existing.rows[0]?.avatar_public_id as string | null | undefined;
    if (previousPublicId === undefined) throw new Error('User not found.');

    const updated = await pool.query(
      `UPDATE users
       SET avatar_url = NULL, avatar_public_id = NULL, avatar_metadata = NULL, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email, name, role, email_verified_at, status, avatar_url,
                 bio, company, website, created_at`,
      [userId],
    );
    const user = updated.rows[0];
    if (!user) throw new Error('User not found.');

    if (previousPublicId) {
      try {
        await deleteFile(previousPublicId);
      } catch {
        // The user record has already been safely cleared.
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'UPDATE', 'users', $1, '{"profile_fields":["avatar"]}'::jsonb)`,
      [userId],
    );

    return (await this.getProfile(userId))!;
  }

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
        name, username, email, password_hash, role, status, is_active, metadata
      ) VALUES ($1, $2, $3, $4, 'USER', 'ACTIVE', TRUE, '{}')
      RETURNING id, email, name, role, email_verified_at, status, created_at`,
      [cleanName, await availableUsername(cleanName), cleanEmail, passwordHash]
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
  ): Promise<LoginResult> {
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

    if (user.status !== 'ACTIVE' || !user.is_active) {
      const err = new Error('Account is inactive or suspended.') as any;
      if (user.status === 'INACTIVE' && !user.is_active) err.code = 'ACCOUNT_INACTIVE';
      throw err;
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

    // 2. Check if email is verified — if not, re-issue and send a fresh
    //    verification OTP so the user can verify and then log in. If the resend
    //    is on cooldown / rate-limited / undeliverable we still return
    //    EMAIL_NOT_VERIFIED but surface the relevant guidance to the client.
    if (!user.email_verified_at) {
      let verificationNote =
        'Please verify your email address before logging in. A new verification code has been sent to your email.';

      try {
        const otp = await issueOtp(user.id, 'EMAIL_VERIFICATION');
        await OtpEmailService.sendVerificationOTP(user.email, otp);
      } catch (err: any) {
        if (err instanceof OtpError || err instanceof EmailDeliveryError) {
          verificationNote = `Please verify your email address before logging in. ${err.message}`;
        } else {
          verificationNote = 'Please verify your email address before logging in. A verification link was sent to your inbox.';
        }
      }

      const err = new Error(verificationNote) as any;
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
        emailVerified: false,
        requiresTotp: !!user.two_factor_enabled,
      };

      await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
      await EmailService.send2FAEmail(user.email, user.name, code, ip, userAgent);

      return {
        requires2FA: true,
        challengeType: 'email',
        tempToken,
        maskedEmail: maskEmail(user.email),
      };
    }

    if (user.two_factor_enabled) {
      const tempToken = generateRandomToken(24);
      metadata.pending_2fa = { expiresAt: Date.now() + 10 * 60 * 1000, rememberMe: !!rememberMe, tempToken, emailVerified: true, requiresTotp: true };
      await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
      return { requires2FA: true, challengeType: 'totp', tempToken };
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
  ): Promise<LoginResult> {
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

    if (user.status !== 'ACTIVE' || !user.is_active) {
      throw new Error('Account is inactive or suspended.');
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
    if (!pending2FA.codeHash || inputCodeHash !== pending2FA.codeHash) {
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
    if (pending2FA.requiresTotp || user.two_factor_enabled) {
      metadata.pending_2fa = { ...pending2FA, emailVerified: true, codeHash: undefined };
      await pool.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), user.id]);
      return { requires2FA: true, challengeType: 'totp', tempToken: pending2FA.tempToken };
    }
    metadata.pending_2fa = null;
    const loginResult = await this.completeLogin(user, metadata, currentFingerprint, ip, userAgent, rememberMe);
    return { requires2FA: false, ...loginResult };
  }

  static async verifyLoginTotp(tempToken: string, code: string, ip = '127.0.0.1', userAgent = 'Unknown Device'): Promise<{ tokens: AuthTokens; user: UserPublicProfile }> {
    if (!tempToken || !code) throw new Error('Authenticator code and session token are required.');
    const result = await pool.query(`SELECT * FROM users WHERE metadata->'pending_2fa'->>'tempToken' = $1 AND deleted_at IS NULL`, [tempToken]);
    const user: UserRecord = result.rows[0]; const pending = user?.metadata?.pending_2fa;
    if (!user || !pending || !pending.requiresTotp || Date.now() > pending.expiresAt) throw new Error('Invalid or expired authentication session. Please log in again.');
    if (!pending.emailVerified || !user.two_factor_enabled || !user.two_factor_secret) throw new Error('Complete the required email verification first.');
    let valid = false; try { valid = await verifyTotp(decryptTotpSecret(user.two_factor_secret), code); } catch { throw new Error('Authenticator configuration is unavailable.'); }
    if (!valid) throw new Error('Invalid authenticator code.');
    const metadata: UserMetadata = { ...user.metadata, pending_2fa: null };
    return this.completeLogin(user, metadata, generateDeviceFingerprint(userAgent, ip), ip, userAgent, pending.rememberMe);
  }

  static async startTotpSetup(userId: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const result = await pool.query('SELECT email, two_factor_enabled, metadata FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]); const user = result.rows[0];
    if (!user) throw new Error('User not found.'); if (user.two_factor_enabled) throw new Error('Authenticator app 2FA is already enabled.');
    const setup = await createTotpSetup(user.email);
    await pool.query('UPDATE users SET metadata = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify({ ...(user.metadata || {}), pending_2fa_setup: { secret: encryptTotpSecret(setup.secret), expiresAt: Date.now() + 600000 } }), userId]);
    return setup;
  }

  static async confirmTotpSetup(userId: string, code: string): Promise<{ success: boolean; message: string }> {
    const result = await pool.query('SELECT metadata FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]); const user = result.rows[0]; const pending = user?.metadata?.pending_2fa_setup;
    if (!pending || Date.now() > pending.expiresAt) throw new Error('Authenticator setup has expired. Start setup again.');
    let secret: string; try { secret = decryptTotpSecret(pending.secret); } catch { throw new Error('Authenticator setup is unavailable.'); }
    if (!await verifyTotp(secret, code)) throw new Error('Invalid authenticator code.');
    const metadata = { ...user.metadata }; delete metadata.pending_2fa_setup;
    await pool.query('UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = $1, metadata = $2, updated_at = NOW() WHERE id = $3', [encryptTotpSecret(secret), JSON.stringify(metadata), userId]);
    await pool.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values) VALUES ($1, 'UPDATE', 'users', $1, '{"action":"totp_enabled"}'::jsonb)`, [userId]);
    return { success: true, message: 'Authenticator app 2FA is enabled.' };
  }

  static async disableTotp(userId: string, currentPassword: string, code: string): Promise<{ success: boolean; message: string }> {
    const result = await pool.query('SELECT password_hash, two_factor_enabled, two_factor_secret FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]); const user = result.rows[0];
    if (!user || !user.two_factor_enabled || !user.two_factor_secret) throw new Error('Authenticator app 2FA is not enabled.');
    if (!await bcrypt.compare(currentPassword || '', user.password_hash)) throw new Error('Current password is incorrect.');
    let secret: string;
    try {
      secret = decryptTotpSecret(user.two_factor_secret);
    } catch {
      throw new Error('Authenticator configuration is unavailable.');
    }
    if (!await verifyTotp(secret, code || '')) throw new Error('Invalid authenticator code.');

    // One statement makes the state transition and audit record atomic. It
    // intentionally does not touch user_sessions: disabling a login factor
    // must not sign out otherwise valid authenticated sessions.
    const update = await pool.query(
      `WITH disabled AS (
         UPDATE users
         SET two_factor_enabled = FALSE, two_factor_secret = NULL, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL AND two_factor_enabled = TRUE AND two_factor_secret IS NOT NULL
         RETURNING id
       )
       INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       SELECT id, 'UPDATE', 'users', id, '{"action":"totp_disabled"}'::jsonb FROM disabled
       RETURNING user_id`,
      [userId],
    );
    if (update.rowCount !== 1) throw new Error('Authenticator app 2FA is not enabled.');
    return { success: true, message: 'Authenticator app 2FA is disabled.' };
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
              u.id, u.email, u.name, u.role, u.status, u.is_active, u.deleted_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1`,
      [tokenHash]
    );

    const session = sessionRes.rows[0];
    if (!session) throw new Error('Invalid refresh token.');
    if (session.revoked_at) throw new Error('Session has been revoked.');
    if (new Date(session.expires_at) < new Date()) throw new Error('Session has expired.');
    if (session.status !== 'ACTIVE' || !session.is_active || session.deleted_at) {
      throw new Error('Account is inactive or suspended.');
    }

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
    await pool.query('UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [session.session_id]);

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

  static async listSecuritySessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const result = await pool.query(`SELECT id, user_agent, ip_address::text, created_at, last_active_at, expires_at, revoked_at FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC`, [userId]);
    return result.rows.map((session) => ({ id: session.id, ...parseSessionUserAgent(session.user_agent), ip: session.ip_address, location: null, created_at: session.created_at, last_active_at: session.last_active_at, expires_at: session.expires_at, revoked_at: session.revoked_at, is_current: session.id === currentSessionId }));
  }

  static async revokeSecuritySession(userId: string, sessionId: string, currentSessionId?: string): Promise<{ revokedCurrent: boolean }> {
    const result = await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id', [sessionId, userId]);
    if (!result.rows[0]) throw new Error('Active session not found.');
    await pool.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values) VALUES ($1, 'UPDATE', 'user_sessions', $2, '{"action":"session_revoked"}'::jsonb)`, [userId, sessionId]);
    return { revokedCurrent: sessionId === currentSessionId };
  }

  static async revokeOtherSecuritySessions(userId: string, currentSessionId?: string): Promise<{ revoked: number }> {
    const result = await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id <> $2::uuid AND revoked_at IS NULL RETURNING id', [userId, currentSessionId || '00000000-0000-0000-0000-000000000000']);
    await pool.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values) VALUES ($1, 'UPDATE', 'user_sessions', $1, $2::jsonb)`, [userId, JSON.stringify({ action: 'other_sessions_revoked', count: result.rowCount || 0 })]);
    return { revoked: result.rowCount || 0 };
  }

  /**
   * Request proof-of-email before restoring a voluntarily deactivated account.
   * This response is deliberately identical for every email/status combination
   * so callers cannot use it to discover which accounts exist or are inactive.
   */
  static async requestAccountReactivation(email: string): Promise<{ success: boolean; message: string }> {
    const genericResponse = {
      success: true,
      message: 'If an eligible inactive account exists for this email address, a verification code has been sent.',
    };
    if (typeof email !== 'string' || !email.trim()) return genericResponse;

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query(
      `SELECT id, email
       FROM users
       WHERE email = $1 AND status = 'INACTIVE' AND is_active = FALSE AND deleted_at IS NULL`,
      [cleanEmail],
    );
    const user = userRes.rows[0];
    if (!user) return genericResponse;

    try {
      const otp = await issueOtp(user.id, 'ACCOUNT_REACTIVATION');
      await OtpEmailService.sendAccountReactivationOTP(user.email, otp);
    } catch (err) {
      // Preserve the enumeration-safe response even if delivery or resend
      // policy prevents issuance. The provider internals remain server-only.
      // eslint-disable-next-line no-console
      console.error('[auth] Account reactivation OTP could not be issued.');
    }
    return genericResponse;
  }

  /**
   * Restore only a voluntarily deactivated account after email-OTP ownership
   * proof. SUSPENDED, BANNED, deleted, and already-active accounts never match
   * this transition. Revoked sessions and API keys are intentionally untouched.
   */
  static async confirmAccountReactivation(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    if (typeof email !== 'string' || !email.trim() || typeof otp !== 'string' || !otp.trim()) {
      throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query(
      `SELECT id
       FROM users
       WHERE email = $1 AND status = 'INACTIVE' AND is_active = FALSE AND deleted_at IS NULL`,
      [cleanEmail],
    );
    const user = userRes.rows[0];
    if (!user) throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);

    await verifyOtp(user.id, 'ACCOUNT_REACTIVATION', otp);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE users
         SET status = 'ACTIVE', is_active = TRUE, updated_at = NOW()
         WHERE id = $1 AND status = 'INACTIVE' AND is_active = FALSE AND deleted_at IS NULL
         RETURNING id`,
        [user.id],
      );
      if (!result.rows[0]) {
        throw new OtpError('OTP_INVALID', OTP_ERROR_MESSAGES.OTP_INVALID);
      }
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'UPDATE', 'users', $1, $2::jsonb)`,
        [user.id, JSON.stringify({ action: 'account_reactivated' })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { success: true, message: 'Your account has been reactivated. Please sign in to continue.' };
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
   * Change an authenticated user's password after verifying the current one.
   * Other refresh-token sessions are revoked so an active password change does
   * not leave previously signed-in devices able to obtain new access tokens.
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    sessionId?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      throw new PasswordChangeError('Current password and new password are required.', 400);
    }
    if (newPassword.length < 8 || newPassword.length > 256) {
      throw new PasswordChangeError('New password must be between 8 and 256 characters.', 400);
    }
    if (currentPassword === newPassword) {
      throw new PasswordChangeError('New password must be different from your current password.', 400);
    }

    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new PasswordChangeError('User not found.', 404);
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentPasswordMatches) {
      throw new PasswordChangeError('Current password is incorrect.', 401);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await pool.query('BEGIN');
    try {
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId],
      );

      if (sessionId) {
        await pool.query(
          'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL',
          [userId, sessionId],
        );
      } else {
        await pool.query(
          'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
          [userId],
        );
      }

      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'UPDATE', 'users', $1, '{"action": "password_changed"}')`,
        [userId],
      );

      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    return {
      success: true,
      message: 'Password updated. Other signed-in devices have been signed out.',
    };
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

export function sanitizeSkills(value: unknown): string[] {
  try {
    return value === undefined ? [] : normalizeSkills(value);
  } catch {
    return [];
  }
}

export function sanitizeExperience(value: unknown): ProfileExperience[] {
  try {
    return value === undefined ? [] : normalizeExperience(value);
  } catch {
    return [];
  }
}

export function sanitizeEducation(value: unknown): ProfileEducation[] {
  try {
    return value === undefined ? [] : normalizeEducation(value);
  } catch {
    return [];
  }
}

function normalizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Skills must be an array.');
  if (value.length > 50) throw new Error('Skills must include 50 items or fewer.');
  return value.map((skill) => normalizeRequiredProfileText(skill, 'Skill', 80));
}

function normalizeExperience(value: unknown): ProfileExperience[] {
  return normalizeProfileEntries(value, 'Experience', (entry) => {
    const startDate = normalizeProfileDate(entry.start_date, 'Experience start date');
    const isCurrent = normalizeCurrentStatus(entry.is_current, 'Experience current status');
    const endDate = normalizeEndDate(entry.end_date, 'Experience end date', startDate, isCurrent);
    return {
      title: normalizeRequiredProfileText(entry.title, 'Experience title', 100),
      company: normalizeRequiredProfileText(entry.company, 'Experience company', 255),
      start_date: startDate,
      end_date: endDate,
      is_current: isCurrent,
      description: normalizeEntryDescription(entry.description, 'Experience description'),
    };
  });
}

function normalizeEducation(value: unknown): ProfileEducation[] {
  return normalizeProfileEntries(value, 'Education', (entry) => {
    const startDate = normalizeProfileDate(entry.start_date, 'Education start date');
    const isCurrent = normalizeCurrentStatus(entry.is_current, 'Education current status');
    const endDate = normalizeEndDate(entry.end_date, 'Education end date', startDate, isCurrent);
    return {
      institution: normalizeRequiredProfileText(entry.institution, 'Education institution', 255),
      program: normalizeRequiredProfileText(entry.program, 'Education program', 150),
      start_date: startDate,
      end_date: endDate,
      is_current: isCurrent,
      description: normalizeEntryDescription(entry.description, 'Education description'),
    };
  });
}

function normalizeProfileEntries<T>(
  value: unknown,
  label: string,
  normalize: (entry: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > 25) throw new Error(`${label} must include 25 entries or fewer.`);
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${label} entry ${index + 1} must be an object.`);
    }
    return normalize(item as Record<string, unknown>);
  });
}

function normalizeCurrentStatus(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false.`);
  return value;
}

function normalizeProfileDate(value: unknown, field: string): string {
  const date = normalizeRequiredProfileText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${field} must use YYYY-MM-DD.`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${field} must be a valid date.`);
  }
  return date;
}

function normalizeEndDate(
  value: unknown,
  field: string,
  startDate: string,
  isCurrent: boolean,
): string | null {
  if (value === undefined || value === null || value === '') {
    if (!isCurrent) throw new Error(`${field} is required when the entry is not current.`);
    return null;
  }
  if (isCurrent) throw new Error(`${field} must be empty when the entry is current.`);
  const endDate = normalizeProfileDate(value, field);
  if (endDate < startDate) throw new Error(`${field} cannot be before the start date.`);
  return endDate;
}

function normalizeEntryDescription(value: unknown, field: string): string | null {
  return value === undefined ? null : normalizeOptionalProfileText(value, field, 2000);
}

function normalizeOptionalProfileText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }
  return normalized || null;
}

function normalizeRequiredProfileText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  if (normalized.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  return normalized;
}

function validateGithubUrl(url: string | null): void {
  if (!url) throw new Error('GitHub profile URL is required.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('GitHub profile URL must be a valid URL.'); }
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(parsed.hostname.toLowerCase()) || pathParts.length !== 1) {
    throw new Error('GitHub profile URL must be an https://github.com/username profile URL.');
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

function parseSessionUserAgent(userAgent: string | null): { device: string; os: string; browser: string } {
  const ua = userAgent || '';
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Mac OS|Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//i.test(ua) ? 'Microsoft Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Unknown browser';
  const device = /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Android/i.test(ua) ? 'Android device' : 'Desktop';
  return { device, os, browser };
}
