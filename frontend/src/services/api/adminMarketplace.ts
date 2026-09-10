import {
  FeaturedApiRow,
  AdminCategoryRow,
  AdminReviewRow,
  CategoryPayload,
} from '../../types/adminMarketplace';
import { AdminApiError } from './admin';

const API_BASE_URL = '/api/v1/admin/marketplace';

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

export const adminMarketplaceApi = {
  // ===================== FEATURED APIs =====================
  async getFeaturedApis(signal?: AbortSignal) {
    const res = await fetch(\`\${API_BASE_URL}/featured\`, { headers: authHeaders(), signal });
    return handleResponse<FeaturedApiRow[]>(res);
  },

  async setFeaturedApis(apiIds: string[]) {
    const res = await fetch(\`\${API_BASE_URL}/featured\`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ apiIds }),
    });
    return handleResponse<void>(res);
  },

  // ===================== CATEGORIES =====================
  async getCategories(signal?: AbortSignal) {
    const res = await fetch(\`\${API_BASE_URL}/categories\`, { headers: authHeaders(), signal });
    return handleResponse<AdminCategoryRow[]>(res);
  },

  async createCategory(payload: CategoryPayload) {
    const res = await fetch(\`\${API_BASE_URL}/categories\`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AdminCategoryRow>(res);
  },

  async updateCategory(id: string, payload: CategoryPayload) {
    const res = await fetch(\`\${API_BASE_URL}/categories/\${encodeURIComponent(id)}\`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AdminCategoryRow>(res);
  },

  async deleteCategory(id: string) {
    const res = await fetch(\`\${API_BASE_URL}/categories/\${encodeURIComponent(id)}\`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse<void>(res);
  },

  // ===================== REVIEWS =====================
  async getReviews(signal?: AbortSignal) {
    const res = await fetch(\`\${API_BASE_URL}/reviews\`, { headers: authHeaders(), signal });
    return handleResponse<AdminReviewRow[]>(res);
  },

  async toggleReviewApproval(id: string, isApproved: boolean) {
    const res = await fetch(\`\${API_BASE_URL}/reviews/\${encodeURIComponent(id)}/status\`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isApproved }),
    });
    return handleResponse<void>(res);
  },

  async deleteReview(id: string) {
    const res = await fetch(\`\${API_BASE_URL}/reviews/\${encodeURIComponent(id)}\`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse<void>(res);
  },
};
