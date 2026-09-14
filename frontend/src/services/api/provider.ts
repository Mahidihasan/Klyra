export class ProviderApiError extends Error {
  code: string | null;
  status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'ProviderApiError';
    this.code = code;
    this.status = status;
  }
}

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
    throw new ProviderApiError(text || `HTTP ${res.status}: ${res.statusText}`, null, res.status);
  }

  const body = json as { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null;

  if (!res.ok || body?.success === false) {
    throw new ProviderApiError(
      body?.error?.message || `HTTP ${res.status}: ${res.statusText}`,
      body?.error?.code ?? null,
      res.status,
    );
  }
  return body?.data as T;
}

export interface PublishApiPayload {
  name: string;
  version: string;
  categoryId: string;
  baseUrl: string;
  pricingModel: 'FREE' | 'FREEMIUM' | 'PAID';
}

export interface PublishApiResponse {
  id: string;
  slug: string;
}

export const providerApi = {
  async publishApi(payload: PublishApiPayload) {
    const res = await fetch('/api/v1/apis', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<PublishApiResponse>(res);
  }
};
