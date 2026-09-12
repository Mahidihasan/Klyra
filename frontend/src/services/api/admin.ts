/**
 * Admin platform-overview API client.
 *
 * Follows the same shape as services/api/billing.ts: the backend wraps every
 * response in { success, data } and reports failures as
 * { success: false, error: { code, message } }, so this unwraps `data` and
 * surfaces `error.message` as a typed error.
 */

import { AdminOverviewStats, PlatformMetric, TrafficRange, TrafficSeries } from '../../types/admin';
import {
  AdminUserList,
  AdminUserListQuery,
  AdminUserMutationResult,
  AdminUserProfile,
  AdminUserDetails,
  ImpersonationGrant,
  UserRoleValue,
  UserStatusValue,
} from '../../types/adminUsers';
import {
  AdminApiList,
  AdminApiListQuery,
  AdminApiMutationResult,
  ModerateAction,
} from '../../types/adminApis';

const API_BASE_URL = '/api/v1/admin';

/**
 * Thrown so callers can distinguish "you're not an admin" (403) from a real
 * outage, and render the right empty state instead of a generic error.
 */
export class AdminApiError extends Error {
  code: string | null;

  status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
  }

  /** True when the caller is authenticated but lacks the admin role. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** True when there's no usable session at all. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const token = localStorage.getItem('klyra_access_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Dev-only: the backend accepts an x-klyra-role header when no JWT is
  // present, matching the escape hatches already used by billing and repos.
  // Set via the browser console: localStorage.setItem('klyra-dev-role', 'ADMIN')
  const devRole = localStorage.getItem('klyra-dev-role');
  if (!token && devRole) headers['x-klyra-role'] = devRole;

  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new AdminApiError(text || `HTTP ${res.status}: ${res.statusText}`, null, res.status);
  }

  const body = json as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || body?.success === false) {
    throw new AdminApiError(
      body?.error?.message || `HTTP ${res.status}: ${res.statusText}`,
      body?.error?.code ?? null,
      res.status,
    );
  }

  return body?.data as T;
}

/**
 * `signal` lets the caller abort a request that's been superseded — the range
 * switcher fires a new fetch on every click, and without this a slow earlier
 * response could land last and overwrite the newer one.
 */
interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * Build the users query string, omitting anything unset.
 *
 * Empty values are dropped rather than sent as blanks: the backend treats an
 * unrecognised role or status as a 400, and `role=` would otherwise be one.
 */
function userListParams(query: AdminUserListQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.role) params.set('role', query.role);
  if (query.status) params.set('status', query.status);
  if (query.subscriptionTier) params.set('subscriptionTier', query.subscriptionTier);
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

function apiListParams(query: AdminApiListQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export const adminApi = {
  /** Everything the overview screen needs, in one round trip. */
  async getOverviewStats(
    range: TrafficRange = '24h',
    options: RequestOptions = {},
  ): Promise<AdminOverviewStats> {
    const res = await fetch(`${API_BASE_URL}/overview/stats?range=${encodeURIComponent(range)}`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<AdminOverviewStats>(res);
  },

  /** Traffic series alone — a lighter poll when only the chart needs updating. */
  async getTraffic(
    range: TrafficRange = '24h',
    options: RequestOptions = {},
  ): Promise<TrafficSeries> {
    const res = await fetch(`${API_BASE_URL}/overview/traffic?range=${encodeURIComponent(range)}`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<TrafficSeries>(res);
  },

  /** KPI metrics alone. */
  async getMetrics(
    range: TrafficRange = '24h',
    options: RequestOptions = {},
  ): Promise<PlatformMetric[]> {
    const res = await fetch(`${API_BASE_URL}/overview/metrics?range=${encodeURIComponent(range)}`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<PlatformMetric[]>(res);
  },

  // ========================== User management ==========================

  /** One page of the users table, with filters applied server-side. */
  async listUsers(query: AdminUserListQuery = {}, options: RequestOptions = {}) {
    const res = await fetch(`${API_BASE_URL}/users${userListParams(query)}`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<AdminUserList>(res);
  },

  /** Full profile plus recent audit activity, for the detail drawer. */
  async getUser(userId: string, options: RequestOptions = {}) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<AdminUserProfile>(res);
  },

  /** Comprehensive user details including telemetry, APIs, and subscriptions. */
  async getUserDetails(userId: string, options: RequestOptions = {}) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/details`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<AdminUserDetails>(res);
  },

  /** Suspend, ban, deactivate or reactivate. `reason` lands on the audit row. */
  async updateUserStatus(userId: string, status: UserStatusValue, reason?: string) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    return handleResponse<AdminUserMutationResult>(res);
  },

  /** Suspend a user account. */
  async suspendUser(userId: string, reason: string, duration?: string) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/suspend`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason, duration }),
    });
    return handleResponse<AdminUserMutationResult>(res);
  },

  /** Reactivate a suspended user account. */
  async activateUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/activate`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleResponse<AdminUserMutationResult>(res);
  },

  /** Update user profile details. */
  async updateUserDetails(userId: string, data: { name: string; email: string; company?: string | null; customRateLimit?: number | null }) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<AdminUserMutationResult>(res);
  },

  /** Soft-delete a user, revoking their API keys and subscriptions. */
  async deleteUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async updateUserRole(userId: string, role: UserRoleValue) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse<AdminUserMutationResult>(res);
  },

  /** Mint a short-lived token that acts as the target user. Audit-logged. */
  async impersonateUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/impersonate`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleResponse<ImpersonationGrant>(res);
  },

  // ========================== API management ==========================

  async listApis(query: AdminApiListQuery = {}, options: RequestOptions = {}) {
    const res = await fetch(`${API_BASE_URL}/apis${apiListParams(query)}`, {
      headers: authHeaders(),
      signal: options.signal,
    });
    return handleResponse<AdminApiList>(res);
  },

  async moderateApi(apiId: string, action: ModerateAction, reason?: string) {
    const res = await fetch(`${API_BASE_URL}/apis/${encodeURIComponent(apiId)}/moderate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action, reason }),
    });
    return handleResponse<AdminApiMutationResult>(res);
  },
};
