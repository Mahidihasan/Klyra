/**
 * Usage API client.
 *
 * The user id is never sent. It used to be appended to every request as
 * `?userId=` from config/devAuth, which the backend honoured whenever the token
 * was missing — so the browser was choosing whose data to read. The JWT is now
 * the only identity these endpoints accept.
 */

import {
  UsageOverview,
  DailyUsagePoint,
  ApiUsageRow,
  EndpointUsageRow,
  RequestLogResult,
  UsageErrorCode,
  UsagePeriod,
} from '../../types/usage';

const BASE_URL = '/api/usage';

/**
 * Thrown so screens can tell an expired session from a real outage — they
 * previously received a plain Error and had to show the same message for both.
 */
export class UsageApiError extends Error {
  code: UsageErrorCode | null;

  status: number;

  constructor(message: string, code: UsageErrorCode | null, status: number) {
    super(message);
    this.name = 'UsageApiError';
    this.code = code;
    this.status = status;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('klyra_access_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new UsageApiError(
      text || `HTTP ${response.status}: ${response.statusText}`,
      null,
      response.status,
    );
  }

  const body = json as {
    success?: boolean;
    data?: T;
    error?: { code?: UsageErrorCode; message?: string };
  } | null;

  if (!response.ok || body?.success === false) {
    throw new UsageApiError(
      body?.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      body?.error?.code ?? null,
      response.status,
    );
  }

  return body?.data as T;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  return handleResponse<T>(response);
}

export const usageApi = {
  fetchOverview: (period: UsagePeriod): Promise<UsageOverview> =>
    get<UsageOverview>(`/overview?period=${period}`),

  fetchDaily: (period: UsagePeriod): Promise<DailyUsagePoint[]> =>
    get<DailyUsagePoint[]>(`/daily?period=${period}`),

  fetchByApi: (period: UsagePeriod): Promise<ApiUsageRow[]> =>
    get<ApiUsageRow[]>(`/by-api?period=${period}`),

  fetchTopEndpoints: (period: UsagePeriod): Promise<EndpointUsageRow[]> =>
    get<EndpointUsageRow[]>(`/top-endpoints?period=${period}`),

  /** Scoped to the same period as every other call, so the selector applies here too. */
  fetchHistory: (period: UsagePeriod, page: number, limit = 20): Promise<RequestLogResult> =>
    get<RequestLogResult>(`/history?period=${period}&page=${page}&limit=${limit}`),
};
