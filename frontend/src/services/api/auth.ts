export interface UserProfile {
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
  first_name: string;
  last_name: string;
  handle: string | null;
  job_title: string | null;
  github_url: string | null;
  preferences: UserPreferences;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string | null;
}

export type ThemePreference = 'dark' | 'light' | 'system';
export type ApiResponseFormat = 'json' | 'xml';
export type CodeSnippetPreference = 'curl' | 'javascript-fetch' | 'javascript-axios' | 'python' | 'go';

export interface UserPreferences {
  theme: ThemePreference;
  timezone: string;
  notifications: { email: boolean; push: boolean; in_app: boolean };
  api_response_format: ApiResponseFormat;
  code_snippet_preference: CodeSnippetPreference;
  email_notifications: {
    api_downtime_alerts: boolean;
    monthly_usage_quota_warnings: boolean;
    product_announcements: boolean;
  };
}

export interface UpdatePreferencesInput extends UserPreferences {}

export interface UpdateProfileInput {
  name: string;
  company: string | null;
  bio: string | null;
  website: string | null;
  first_name: string;
  last_name: string;
  handle: string;
  job_title: string;
  github_url: string;
}

export type ManagedApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

/** Safe API-key metadata. List responses never include a key hash or secret. */
export interface ManagedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: ManagedApiKeyStatus;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DirectLoginResponse {
  requires2FA: false;
  tokens: AuthTokens;
  user: UserProfile;
}

export type LoginChallengeResponse = {
  requires2FA: true;
  challengeType: 'email';
  tempToken: string;
  maskedEmail: string;
} | {
  requires2FA: true;
  challengeType: 'totp';
  tempToken: string;
};

export type LoginResponse = DirectLoginResponse | LoginChallengeResponse;

export interface SecuritySession {
  id: string; device: string; os: string; browser: string; ip: string | null; location: null;
  created_at: string; last_active_at: string; expires_at: string; revoked_at: string | null; is_current: boolean;
}

export interface DemoEmailItem {
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

const BASE_URL = '/api/auth';
export const AUTH_TOKENS_REFRESHED_EVENT = 'klyra:auth-tokens-refreshed';
export const AUTH_SESSION_EXPIRED_EVENT = 'klyra:auth-session-expired';

let refreshPromise: Promise<AuthTokens> | null = null;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class ProfileApiError extends Error {
  constructor(message: string, readonly status?: number, readonly backendMessage?: string) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('klyra_access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function notifyAuthEvent(type: string, detail?: AuthTokens): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export function refreshAccessToken(storedRefreshToken?: string): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = storedRefreshToken || localStorage.getItem('klyra_refresh_token');
  if (!refreshToken) {
    notifyAuthEvent(AUTH_SESSION_EXPIRED_EVENT);
    return Promise.reject(new ApiRequestError('Refresh token is unavailable.', 401));
  }

  refreshPromise = request<AuthTokens>(
    '/refresh-token',
    { method: 'POST', body: JSON.stringify({ refreshToken }) },
    false,
  ).then((tokens) => {
    localStorage.setItem('klyra_access_token', tokens.accessToken);
    localStorage.setItem('klyra_refresh_token', tokens.refreshToken);
    notifyAuthEvent(AUTH_TOKENS_REFRESHED_EVENT, tokens);
    return tokens;
  }).catch((error) => {
    notifyAuthEvent(AUTH_SESSION_EXPIRED_EVENT);
    throw error;
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(endpoint: string, options: RequestInit = {}, retryOnUnauthorized = false): Promise<T> {
  const headers = { ...getAuthHeaders(), ...(options.headers as Record<string, string>) };
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const error = new ApiRequestError(data?.error || `Request failed with status ${res.status}`, res.status, data?.code);
    if (retryOnUnauthorized && error.status === 401) {
      try {
        await refreshAccessToken();
        return request<T>(endpoint, options, false);
      } catch {
        // Keep the original protected-request failure for the caller.
      }
    }
    throw error;
  }

  return data as T;
}

function authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return request<T>(endpoint, options, true);
}

async function uploadAvatarRequest<T>(file: File, retryOnUnauthorized = true): Promise<T> {
  const token = localStorage.getItem('klyra_access_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const body = new FormData();
  body.append('avatar', file);
  const res = await fetch(`${BASE_URL}/profile/avatar`, { method: 'POST', headers, body });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }
  if (!res.ok) {
    const error = new ApiRequestError(data?.error || `Request failed with status ${res.status}`, res.status, data?.code);
    if (retryOnUnauthorized && error.status === 401) {
      try {
        await refreshAccessToken();
        return uploadAvatarRequest<T>(file, false);
      } catch {
        // Keep the original protected-request failure for the caller.
      }
    }
    throw error;
  }
  return data as T;
}

export const authApi = {
  // Register
  register: (name: string, email: string, password: string) =>
    request<{ success: boolean; message: string; email: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  // Email verification (6-digit OTP)
  verifyEmail: (email: string, otp: string) =>
    request<{ success: boolean; message: string }>('/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  // Resend verification
  resendVerification: (email: string) =>
    request<{ success: boolean; message: string }>('/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Login
  login: (email: string, password: string, rememberMe = false) =>
    request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    }),

  // 2FA verification
  verify2FA: (tempToken: string, code: string) =>
    request<DirectLoginResponse | Extract<LoginChallengeResponse, { challengeType: 'totp' }>>('/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    }),

  // Resend 2FA
  resend2FA: (tempToken: string) =>
    request<{ success: boolean; message: string }>('/resend-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken }),
    }),

  // Forgot password
  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Verify password reset OTP -> returns short-lived single-use reset token
  verifyResetOtp: (email: string, otp: string) =>
    request<{ success: boolean; message: string; resetToken: string }>('/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  // Reset password
  resetPassword: (token: string, password: string) =>
    request<{ success: boolean; message: string }>('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  verifyTotp: (tempToken: string, code: string) => request<{ tokens: AuthTokens; user: UserProfile }>('/verify-totp', { method: 'POST', body: JSON.stringify({ tempToken, code }) }),

  requestAccountReactivation: (email: string) =>
    request<{ success: boolean; message: string }>('/account/reactivation/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  confirmAccountReactivation: (email: string, otp: string) =>
    request<{ success: boolean; message: string }>('/account/reactivation/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  // Refresh token
  refreshToken: (refreshToken?: string) => refreshAccessToken(refreshToken),

  // Current user
  me: () => authenticatedRequest<{ user: UserProfile }>('/me'),

  // Login history
  loginHistory: () => authenticatedRequest<{ history: LoginHistoryItem[] }>('/login-history'),

  // Logout
  logout: () =>
    authenticatedRequest<{ success: boolean; message: string }>('/logout', {
      method: 'POST',
    }),

  // Demo emails
  getDemoEmails: () => request<{ emails: DemoEmailItem[] }>('/demo-emails'),
  getDemoEmail: (id: string) => request<{ email: DemoEmailItem }>(`/demo-emails/${id}`),
  clearDemoEmails: () => request<{ success: boolean }>('/demo-emails', { method: 'DELETE' }),

  // Helper to open Demo Inbox in a new browser tab
  openDemoInbox: () => {
    if (typeof window !== 'undefined') {
      window.open('/demo-inbox', '_blank');
    }
  },
};

function profileError(error: unknown, operation: string): ProfileApiError {
  if (error instanceof ProfileApiError) return error;
  if (error instanceof ApiRequestError) {
    const prefix: Record<number, string> = {
      400: 'Please review the submitted profile information.',
      401: 'Your session has expired. Please sign in again.',
      403: 'You do not have permission to perform this profile action.',
      422: 'Some profile information needs attention.',
      500: 'Klyra could not complete this request right now.',
    };
    const detail = error.message;
    return new ProfileApiError(`${prefix[error.status] || `Unable to ${operation}.`} ${detail}`, error.status, detail);
  }
  const detail = error instanceof Error ? error.message : '';
  return new ProfileApiError(`Unable to ${operation}. ${detail || 'Please check your connection and try again.'}`, undefined, detail);
}

async function profileRequest<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw profileError(error, operation);
  }
}

/** Dedicated Profile API surface, sharing Klyra's established auth transport. */
export const profileApi = {
  getProfile: () => profileRequest('load your profile', () => authenticatedRequest<{ user: UserProfile }>('/profile')),
  updatePersonalInfo: (profile: UpdateProfileInput) => profileRequest('save your profile', () =>
    authenticatedRequest<{ user: UserProfile; message: string }>('/profile', { method: 'PUT', body: JSON.stringify(profile) })),
  uploadAvatar: (file: File) => profileRequest('upload your profile picture', () =>
    uploadAvatarRequest<{ user: UserProfile; message: string }>(file)),
  removeAvatar: () => profileRequest('remove your profile picture', () =>
    authenticatedRequest<{ user: UserProfile; message: string }>('/profile/avatar', { method: 'DELETE' })),
  changePassword: (currentPassword: string, newPassword: string) => profileRequest('change your password', () =>
    authenticatedRequest<{ success: boolean; message: string }>('/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) })),
  updatePreferences: (preferences: UpdatePreferencesInput) => profileRequest('save your preferences', () =>
    authenticatedRequest<{ user: UserProfile; message: string }>('/profile/preferences', { method: 'PUT', body: JSON.stringify(preferences) })),
  listApiKeys: () => profileRequest('load your API keys', () =>
    authenticatedRequest<{ apiKeys: ManagedApiKey[] }>('/profile/api-keys')),
  createApiKey: (name: string) => profileRequest('create your API key', () =>
    authenticatedRequest<{ apiKey: ManagedApiKey; secret: string; message: string }>('/profile/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })),
  revokeApiKey: (keyId: string) => profileRequest('revoke this API key', () =>
    authenticatedRequest<{ apiKey: ManagedApiKey; message: string }>(`/profile/api-keys/${keyId}/revoke`, { method: 'POST' })),
  deactivateAccount: (currentPassword: string) => profileRequest('deactivate your account', () =>
    authenticatedRequest<{ success: boolean; message: string }>('/account/deactivate', {
      method: 'POST',
      body: JSON.stringify({ currentPassword }),
    })),
  startTotpSetup: () => profileRequest('start authenticator setup', () => authenticatedRequest<{ secret: string; qrCodeDataUrl: string }>('/security/totp/setup', { method: 'POST' })),
  confirmTotpSetup: (code: string) => profileRequest('confirm authenticator setup', () => authenticatedRequest<{ success: boolean; message: string }>('/security/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) })),
  disableTotp: (currentPassword: string, code: string) => profileRequest('disable authenticator app 2FA', () => authenticatedRequest<{ success: boolean; message: string }>('/security/totp/disable', { method: 'POST', body: JSON.stringify({ currentPassword, code }) })),
  listSecuritySessions: () => profileRequest('load active sessions', () => authenticatedRequest<{ sessions: SecuritySession[] }>('/security/sessions')),
  revokeSecuritySession: (sessionId: string) => profileRequest('revoke this session', () => authenticatedRequest<{ revokedCurrent: boolean }>(`/security/sessions/${sessionId}`, { method: 'DELETE' })),
  revokeOtherSecuritySessions: () => profileRequest('revoke other sessions', () => authenticatedRequest<{ revoked: number }>('/security/sessions/revoke-others', { method: 'POST' })),
};
