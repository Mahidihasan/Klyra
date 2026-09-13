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
  preferences: UserPreferences;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string | null;
}

export type ThemePreference = 'dark' | 'light' | 'system';

export interface UserPreferences {
  theme: ThemePreference;
  timezone: string;
  notifications: { email: boolean; push: boolean; in_app: boolean };
}

export interface UpdatePreferencesInput extends UserPreferences {}

export interface UpdateProfileInput {
  name: string;
  company: string | null;
  bio: string | null;
  website: string | null;
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

export interface LoginResponse {
  requires2FA?: boolean;
  tempToken?: string;
  maskedEmail?: string;
  tokens?: AuthTokens;
  user?: UserProfile;
}

export interface DemoEmailItem {
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

class ApiRequestError extends Error {
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    throw new ApiRequestError(data?.error || `Request failed with status ${res.status}`, res.status, data?.code);
  }

  return data as T;
}

async function uploadAvatarRequest<T>(file: File): Promise<T> {
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
    throw new ApiRequestError(data?.error || `Request failed with status ${res.status}`, res.status, data?.code);
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
    request<{ tokens: AuthTokens; user: UserProfile }>('/verify-2fa', {
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

  // Refresh token
  refreshToken: (refreshToken: string) =>
    request<AuthTokens>('/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  // Current user
  me: () => request<{ user: UserProfile }>('/me'),

  // Login history
  loginHistory: () => request<{ history: LoginHistoryItem[] }>('/login-history'),

  // Logout
  logout: () =>
    request<{ success: boolean; message: string }>('/logout', {
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
  getProfile: () => profileRequest('load your profile', () => request<{ user: UserProfile }>('/profile')),
  updatePersonalInfo: (profile: UpdateProfileInput) => profileRequest('save your profile', () =>
    request<{ user: UserProfile; message: string }>('/profile', { method: 'PUT', body: JSON.stringify(profile) })),
  uploadAvatar: (file: File) => profileRequest('upload your profile picture', () =>
    uploadAvatarRequest<{ user: UserProfile; message: string }>(file)),
  removeAvatar: () => profileRequest('remove your profile picture', () =>
    request<{ user: UserProfile; message: string }>('/profile/avatar', { method: 'DELETE' })),
  changePassword: (currentPassword: string, newPassword: string) => profileRequest('change your password', () =>
    request<{ success: boolean; message: string }>('/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) })),
  updatePreferences: (preferences: UpdatePreferencesInput) => profileRequest('save your preferences', () =>
    request<{ user: UserProfile; message: string }>('/profile/preferences', { method: 'PUT', body: JSON.stringify(preferences) })),
  listApiKeys: () => profileRequest('load your API keys', () =>
    request<{ apiKeys: ManagedApiKey[] }>('/profile/api-keys')),
  createApiKey: (name: string) => profileRequest('create your API key', () =>
    request<{ apiKey: ManagedApiKey; secret: string; message: string }>('/profile/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })),
  revokeApiKey: (keyId: string) => profileRequest('revoke this API key', () =>
    request<{ apiKey: ManagedApiKey; message: string }>(`/profile/api-keys/${keyId}/revoke`, { method: 'POST' })),
};
