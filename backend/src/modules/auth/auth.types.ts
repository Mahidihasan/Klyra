export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  avatar_url: string | null;
  avatar_public_id: string | null;
  avatar_metadata: any;
  bio: string | null;
  company: string | null;
  website: string | null;
  email_verified_at: string | null;
  status: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  metadata: UserMetadata;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface KnownDevice {
  deviceFingerprint: string;
  userAgent: string;
  ip: string;
  firstSeen: string;
  lastSeen: string;
}

export interface Pending2FA {
  codeHash: string;
  expiresAt: number;
  rememberMe: boolean;
  tempToken: string;
}

/** Theme options exposed in Profile → Preferences. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Delivery channel toggles from the existing notification_preferences table. */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  in_app: boolean;
}

/** User-editable preferences. Theme and timezone live in users.metadata. */
export interface UserPreferences {
  theme: ThemePreference;
  timezone: string;
  notifications: NotificationPreferences;
}

export interface UserMetadata {
  failed_attempts?: number;
  locked_until?: string | null;
  known_devices?: KnownDevice[];
  pending_2fa?: Pending2FA | null;
  preferences?: UserPreferences;
  [key: string]: any;
}

export interface UserPublicProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  email_verified_at: string | null;
  status: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  avatar_url: string | null;
  bio: string | null;
  company: string | null;
  website: string | null;
  preferences: UserPreferences;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Fields an authenticated user may update from their profile. */
export interface UpdateProfileInput {
  name?: unknown;
  bio?: unknown;
  company?: unknown;
  website?: unknown;
}

/**
 * Fields an authenticated user may update from Profile → Preferences.
 * All optional and typed unknown so the service validates each explicitly.
 */
export interface UpdatePreferencesInput {
  theme?: unknown;
  timezone?: unknown;
  notifications?: unknown;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  sessionId?: string;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DemoEmail {
  id: string;
  to: string;
  from: string;
  subject: string;
  category: 'VERIFY_EMAIL' | 'TWO_FACTOR_CODE' | 'RESET_PASSWORD' | 'REACTIVATE_ACCOUNT';
  previewText: string;
  htmlContent: string;
  actionUrl?: string;
  code?: string;
  createdAt: string;
  read: boolean;
  isInvalidated?: boolean;
}

export interface LoginHistoryItem {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  success: boolean;
  deviceSummary?: string;
}
