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

export interface CatalogApi {
  id: string;
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
    ratingBreakdown: Record<number, number>; // 1: count, 2: count, etc.
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

