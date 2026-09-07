export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  email_verified_at: string | null;
  status: string;
  avatar_url: string | null;
  created_at: string;
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
    const error = new Error(data?.error || `Request failed with status ${res.status}`) as any;
    error.status = res.status;
    error.code = data?.code;
    error.retryAfter = data?.retryAfter;
    throw error;
  }

  return data as T;
}

export const authApi = {
  // Register
  register: (name: string, email: string, password: string) =>
    request<{ message: string; email: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  // Email verification
  verifyEmail: (token: string) =>
    request<{ success: boolean; message: string }>('/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
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
