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

export interface UserMetadata {
  failed_attempts?: number;
  locked_until?: string | null;
  known_devices?: KnownDevice[];
  pending_2fa?: Pending2FA | null;
  [key: string]: any;
}

export interface UserPublicProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  email_verified_at: string | null;
  status: string;
  avatar_url: string | null;
  created_at: string;
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
  category: 'VERIFY_EMAIL' | 'TWO_FACTOR_CODE' | 'RESET_PASSWORD';
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
