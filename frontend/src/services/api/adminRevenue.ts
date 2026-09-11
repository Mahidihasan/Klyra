import { RevenueAnalytics, ProviderPayoutRow } from '../../types/adminRevenue';
import { AdminApiError } from './admin';

const API_BASE_URL = '/api/v1/admin/revenue';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('klyra_access_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
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

  const body = json as { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null;

  if (!res.ok || body?.success === false) {
    throw new AdminApiError(
      body?.error?.message || `HTTP ${res.status}: ${res.statusText}`,
      body?.error?.code ?? null,
      res.status,
    );
  }
  return body?.data as T;
}

export const adminRevenueApi = {
  async getAnalytics(range: '7d' | '30d' | '1y', signal?: AbortSignal) {
    const res = await fetch(`${API_BASE_URL}/analytics?range=${range}`, { headers: authHeaders(), signal });
    return handleResponse<RevenueAnalytics>(res);
  },

  async getPayouts(signal?: AbortSignal) {
    const res = await fetch(`${API_BASE_URL}/payouts`, { headers: authHeaders(), signal });
    return handleResponse<ProviderPayoutRow[]>(res);
  },

  async approvePayout(id: string) {
    const res = await fetch(`${API_BASE_URL}/payouts/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleResponse<void>(res);
  },
};
