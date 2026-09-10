import { AdminAuditLog } from '../../types/adminActivity';
import { AdminApiError } from './admin';

const API_BASE_URL = '/api/v1/admin/activity';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('klyra_access_token');
  if (token) headers['Authorization'] = \`Bearer \${token}\`;
  
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
    throw new AdminApiError(text || \`HTTP \${res.status}: \${res.statusText}\`, null, res.status);
  }

  const body = json as { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null;

  if (!res.ok || body?.success === false) {
    throw new AdminApiError(
      body?.error?.message || \`HTTP \${res.status}: \${res.statusText}\`,
      body?.error?.code ?? null,
      res.status,
    );
  }
  return body?.data as T;
}

export const adminActivityApi = {
  async getLogs(filters: { severity?: string; entity?: string; search?: string }, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.entity) params.append('entity', filters.entity);
    if (filters.search) params.append('search', filters.search);
    const qs = params.toString();
    const url = \`\${API_BASE_URL}/logs\${qs ? '?' + qs : ''}\`;

    const res = await fetch(url, { headers: authHeaders(), signal });
    return handleResponse<AdminAuditLog[]>(res);
  }
};
