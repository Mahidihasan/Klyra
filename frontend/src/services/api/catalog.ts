import { ApiItem } from '../../types/api';

export interface CatalogEndpoint {
  id?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: Array<{ name: string; type: string; required: boolean; description: string }>;
  sampleRequest?: string;
  sampleResponse?: string;
}

export interface CatalogPricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: string;
  features: string[];
  rateLimit?: number;
}

export interface CatalogPayAsYouGoPricing {
  includedRequests: number;
  ratePerRequest: number;
}

export function calculateMarketplacePaygo(
  requests: number,
  pricing: CatalogPayAsYouGoPricing,
): number {
  return Number((Math.max(0, requests - pricing.includedRequests) * pricing.ratePerRequest).toFixed(2));
}

export interface CatalogApi {
  id: string;
  studioProjectId?: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  currentVersion: string;
  baseUrl: string;
  docsUrl?: string;
  logoUrl?: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryIcon?: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl?: string;
  ownerCompany?: string;
  pricingModel: 'FREE' | 'FREEMIUM' | 'PAID' | 'ENTERPRISE';
  status: string;
  isPublic: boolean;
  rating: number;
  totalReviews: number;
  totalSubscribers: number;
  totalRequests: number;
  latencyMs: number;
  uptimePercentage: number;
  tags: string[];
  endpointsCount: number;
  endpoints?: CatalogEndpoint[];
  pricingPlans?: CatalogPricingPlan[];
  payAsYouGo?: CatalogPayAsYouGoPricing;
  lastPublishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName: string;
  iconUrl?: string;
  sortOrder: number;
  apiCount: number;
}

export interface CuratedRailsResponse {
  featured: CatalogApi[];
  trending: CatalogApi[];
  popular: CatalogApi[];
  newlyLaunched: CatalogApi[];
  recommended: CatalogApi[];
}

export interface BrowseApisQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  pricingModel?: string;
  minRating?: number;
  maxLatency?: number;
  sort?: 'trending' | 'popular' | 'rating' | 'newest' | 'latency' | 'name';
  order?: 'asc' | 'desc';
}

export interface BrowseApisResponse {
  apis: CatalogApi[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiReviewItem {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  rating: number;
  title?: string;
  content?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface ApiReviewsResponse {
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingBreakdown: Record<number, number>;
  };
  reviews: ApiReviewItem[];
}

export interface ProviderProfileResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  company?: string;
  website?: string;
  role: string;
  isVerified: boolean;
  memberSince: string;
  totalPublishedApis: number;
  totalSubscribers: number;
  averageRating: number;
  apis: CatalogApi[];
}

export interface PublishApiPayload {
  name: string;
  slug?: string;
  description: string;
  categoryId: string;
  baseUrl: string;
  docsUrl?: string;
  logoUrl?: string;
  pricingModel: 'FREE' | 'FREEMIUM' | 'PAID' | 'ENTERPRISE';
  apiSpec?: Record<string, any>;
  tags?: string[];
  plans?: Array<{
    name: string;
    slug: string;
    description: string;
    price: number;
    billingInterval: 'MONTHLY' | 'YEARLY';
    features: string[];
    rateLimit?: number;
  }>;
  requireApproval?: boolean;
  studioProjectId?: string;
  proposedStudioChanges?: {
    plans?: Array<{
      id: string;
      name: string;
      priceMonthly: number;
      requestsPerMonth?: number;
      rateLimitPerMin?: number;
      isFree?: boolean;
    }>;
    isVersionFree?: boolean;
    semver?: string;
  };
  marketplaceAvailability?: {
    versions?: string[];
    plans?: string[];
  };
  media?: {
    bannerUrl?: string;
    videoUrl?: string;
    screenshots?: string[];
  };
  documentationMarkdown?: string;
}

const API_BASE = '/api/v1/catalog';
let categoriesCache: CatalogCategory[] | null = null;
let categoriesRequest: Promise<CatalogCategory[]> | null = null;
const browseCache = new Map<string, { expiresAt: number; response: BrowseApisResponse }>();
const browseRequests = new Map<string, Promise<BrowseApisResponse>>();

const DEMO_PRICING: Record<string, CatalogApi['pricingModel']> = {
  'openai-api': 'FREEMIUM',
  'weather-api': 'FREE',
  'stripe-api': 'PAID',
  'github-api': 'FREE',
  'claude-api': 'PAID',
  'google-maps-api': 'PAID',
  'huggingface-api': 'FREEMIUM',
  'slack-api': 'FREEMIUM',
  'twilio-api': 'PAID',
  'sendgrid-api': 'FREEMIUM',
  'supabase-api': 'FREEMIUM',
  'resend-api': 'FREEMIUM',
  'perplexity-api': 'PAID',
  'elevenlabs-api': 'PAID',
  'pinecone-api': 'FREEMIUM',
  'mapbox-api': 'FREEMIUM',
  'coingecko-api': 'FREEMIUM',
  'news-api': 'FREEMIUM',
  'ip-geo-api': 'FREE',
  'whatsapp-api': 'PAID',
  'paypal-api': 'PAID',
};

export function getApiCartPrice(api: {
  id?: string;
  slug?: string;
  pricingModel?: string;
  pricingPlans?: Array<{ price: number }>;
}): number {
  if (api.pricingPlans && api.pricingPlans.length > 0) {
    const paid = api.pricingPlans.find((p) => p.price > 0);
    if (paid && paid.price > 0) return paid.price;
  }
  const slug = (api.slug || api.id || '').toLowerCase();
  if (slug.includes('claude')) return 49;
  if (slug.includes('openai')) return 20;
  if (slug.includes('stripe')) return 29;
  if (slug.includes('google-maps')) return 29;
  if (slug.includes('twilio')) return 25;
  if (slug.includes('supabase')) return 25;
  if (slug.includes('resend')) return 20;
  if (slug.includes('elevenlabs')) return 45;
  if (slug.includes('pinecone')) return 30;
  if (slug.includes('perplexity')) return 40;
  if (slug.includes('mapbox')) return 35;
  if (slug.includes('whatsapp') || slug.includes('paypal')) return 39;
  if (slug.includes('weather') || slug.includes('github') || slug.includes('ip-geo')) return 0;

  if (api.pricingModel === 'FREE') return 0;
  if (api.pricingModel === 'PAID') return 49;
  if (api.pricingModel === 'FREEMIUM') return 29;
  if (api.pricingModel === 'ENTERPRISE') return 199;
  return 29;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('klyra_access_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** Converts a backend CatalogApi to existing frontend ApiItem format for backward-compatibility. */
export function toApiItem(api: CatalogApi): ApiItem {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    longDescription: api.longDescription || api.description,
    category: api.categoryName,
    rating: api.rating,
    requestCount:
      api.totalRequests > 1_000_000
        ? `${(api.totalRequests / 1_000_000).toFixed(1)}M`
        : api.totalRequests > 1_000
        ? `${Math.round(api.totalRequests / 1000)}k`
        : `${api.totalRequests}`,
    isTrending: true,
    status: (api.status === 'PUBLISHED'
      ? 'Active'
      : api.status === 'PENDING'
      ? 'Beta'
      : 'Active') as any,
    icon: api.slug.includes('openai')
      ? 'openai'
      : api.slug.includes('weather')
      ? 'weather'
      : api.slug.includes('stripe')
      ? 'stripe'
      : api.slug.includes('github')
      ? 'github'
      : 'default',
    accentColor: '#8b5cf6',
    provider: api.ownerName,
    latencyMs: api.latencyMs || 110,
    uptime: `${api.uptimePercentage || 99.9}%`,
    endpointsCount: api.endpointsCount || (api.endpoints?.length ?? 1),
    baseUrl: api.baseUrl,
    version: api.currentVersion,
    authType: 'API Key',
    endpoints: api.endpoints?.map((ep, idx) => ({
      id: ep.id || `ep-${idx}`,
      method: ep.method,
      path: ep.path,
      description: ep.description,
      parameters: ep.parameters,
      sampleRequest: ep.sampleRequest,
      sampleResponse: ep.sampleResponse,
    })),
  };
}

export const catalogApi = {
  /** Fetch all curated rails for the homepage */
  async getCuratedRails(signal?: AbortSignal): Promise<CuratedRailsResponse> {
    try {
      const res = await fetch(`${API_BASE}/curated`, { headers: authHeaders(), signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch {
      return { featured: [], trending: [], popular: [], newlyLaunched: [], recommended: [] };
    }
  },

  /** Browse/search APIs with full multi-facet filtering */
  async browseApis(query: BrowseApisQuery = {}, signal?: AbortSignal): Promise<BrowseApisResponse> {
    const cacheKey = JSON.stringify(query);
    const cached = browseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    const inFlight = browseRequests.get(cacheKey);
    if (inFlight && !signal) return inFlight;

    const request = this.fetchBrowseApis(query, signal);
    if (!signal) browseRequests.set(cacheKey, request);
    try {
      const response = await request;
      browseCache.set(cacheKey, { expiresAt: Date.now() + 15_000, response });
      return response;
    } finally {
      if (!signal) browseRequests.delete(cacheKey);
    }
  },

  async fetchBrowseApis(
    query: BrowseApisQuery = {},
    signal?: AbortSignal,
  ): Promise<BrowseApisResponse> {
    try {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.search) params.set('search', query.search);
      if (query.category && query.category !== 'all' && query.category !== 'All Categories') {
        params.set('category', query.category);
      }
      if (query.pricingModel && query.pricingModel !== 'all') {
        params.set('pricingModel', query.pricingModel);
      }
      if (query.minRating) params.set('minRating', String(query.minRating));
      if (query.maxLatency) params.set('maxLatency', String(query.maxLatency));
      if (query.sort) params.set('sort', query.sort);
      if (query.order) params.set('order', query.order);

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 3500);
      const abortRequest = () => timeoutController.abort();
      signal?.addEventListener('abort', abortRequest, { once: true });
      const res = await fetch(`${API_BASE}/apis?${params.toString()}`, {
        headers: authHeaders(),
        signal: timeoutController.signal,
      });
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortRequest);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        apis: [],
        meta: { page: query.page || 1, limit: query.limit || 16, total: 0, totalPages: 0 },
      };
    }
  },

  async fetchOwnedApis(): Promise<CatalogApi[]> {
    const res = await fetch(`${API_BASE}/apis/mine`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load owned APIs (${res.status})`);
    const json = await res.json();
    return json.data;
  },

  async setApiVisibility(apiId: string, isPublic: boolean): Promise<void> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/visibility`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isPublic }),
    });
    if (!res.ok) throw new Error('Failed to update Marketplace visibility');
    browseCache.clear();
  },

  async removeFromMarketplace(apiId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/remove-from-marketplace`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove API from Marketplace');
    browseCache.clear();
  },

  async deleteOwnedApi(apiId: string, deleteStudioProject: boolean, studioProjectId?: string): Promise<void> {
    const params = new URLSearchParams();
    if (deleteStudioProject) params.set('deleteStudioProject', 'true');
    if (studioProjectId) params.set('studioProjectId', studioProjectId);
    const query = params.toString();
    const suffix = query ? `?${query}` : '';
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}${suffix}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete API');
    browseCache.clear();
  },

  /** Fetch full API details */
  async getApiBySlugOrId(idOrSlug: string, signal?: AbortSignal): Promise<CatalogApi> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(idOrSlug)}`, {
      headers: authHeaders(),
      signal,
    });
    if (!res.ok) throw new Error(`API not found (${res.status})`);
    const json = await res.json();
    return json.data;
  },

  /** Fetch active categories with real-time API counts */
  async getCategories(signal?: AbortSignal): Promise<CatalogCategory[]> {
    if (!signal && categoriesCache) return categoriesCache;
    if (!signal && categoriesRequest) return categoriesRequest;

    const request = (async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`, { headers: authHeaders(), signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const categories = json.data.categories as CatalogCategory[];
        if (!signal) categoriesCache = categories;
        return categories;
      } catch {
        return [
          { id: '1', name: 'AI & ML', slug: 'ai-ml', iconName: 'Brain', sortOrder: 1, apiCount: 6 },
          {
            id: '2',
            name: 'Finance',
            slug: 'finance',
            iconName: 'Wallet',
            sortOrder: 2,
            apiCount: 4,
          },
          {
            id: '3',
            name: 'Weather',
            slug: 'weather',
            iconName: 'CloudSun',
            sortOrder: 3,
            apiCount: 3,
          },
          {
            id: '4',
            name: 'Developer Tools',
            slug: 'developer-tools',
            iconName: 'Terminal',
            sortOrder: 4,
            apiCount: 8,
          },
          {
            id: '5',
            name: 'Communication',
            slug: 'communication',
            iconName: 'MessageSquare',
            sortOrder: 5,
            apiCount: 5,
          },
          {
            id: '6',
            name: 'E-commerce',
            slug: 'ecommerce',
            iconName: 'ShoppingBag',
            sortOrder: 6,
            apiCount: 2,
          },
          {
            id: '7',
            name: 'Security & Auth',
            slug: 'security',
            iconName: 'Shield',
            sortOrder: 7,
            apiCount: 3,
          },
        ];
      }
    })();

    if (!signal) {
      categoriesRequest = request;
      request.finally(() => {
        categoriesRequest = null;
      });
    }
    return request;
  },

  /** Fetch reviews for an API */
  async getApiReviews(apiId: string, signal?: AbortSignal): Promise<ApiReviewsResponse> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/reviews`, {
      headers: authHeaders(),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.data;
  },

  /** Submit an API review */
  async submitApiReview(
    apiId: string,
    payload: { rating: number; title?: string; content?: string },
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/reviews`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to submit review');
    }
    const json = await res.json();
    return json.data;
  },

  /** Fetch public provider profile */
  async getProviderProfile(
    providerId: string,
    signal?: AbortSignal,
  ): Promise<ProviderProfileResponse> {
    const res = await fetch(`${API_BASE}/providers/${encodeURIComponent(providerId)}`, {
      headers: authHeaders(),
      signal,
    });
    if (!res.ok) throw new Error(`Provider not found (${res.status})`);
    const json = await res.json();
    return json.data;
  },

  /** Self-serve API publishing */
  async publishApi(payload: PublishApiPayload): Promise<CatalogApi> {
    const res = await fetch(`${API_BASE}/apis`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to publish API');
    }
    const json = await res.json();
    return json.data;
  },

  /** Subscribe user to an API tier */
  async subscribeToPlan(
    apiId: string,
    planId: string,
    options: { includePaygo?: boolean; monthlyRequests?: number } = {},
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/subscribe`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ planId, ...options }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to subscribe to plan');
    }
    const json = await res.json();
    return json.data;
  },

  async createMarketplacePurchaseSession(
    apiId: string,
    input: { planId: string; includePaygo: boolean; monthlyRequests: number; returnUrl: string },
  ): Promise<{ url?: string; completed?: boolean; amount: number }> {
    const res = await fetch(`${API_BASE}/apis/${encodeURIComponent(apiId)}/purchase-session`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to start Marketplace payment');
    }
    const json = await res.json();
    return json.data;
  },

  async confirmMarketplacePurchase(sessionId: string): Promise<{ apiId: string; planId: string; amount: number }> {
    const res = await fetch(`${API_BASE}/purchase-session/${encodeURIComponent(sessionId)}/confirm`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to confirm Marketplace payment');
    }
    const json = await res.json();
    return json.data;
  },
};
