export interface FeaturedApiRow {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerName: string;
  categoryName: string;
  rating: number;
  slotType: string;
  orderIndex: number;
  expiresAt: string | null;
  promoTag: string | null;
}

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  apiCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface AdminReviewRow {
  id: string;
  apiId: string;
  apiName: string;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number;
  title: string | null;
  content: string | null;
  isApproved: boolean;
  isVerified: boolean;
  createdAt: Date;
}

export interface FeaturedApiConfig {
  apiId: string;
  slotType: string;
  orderIndex: number;
  expiresAt?: string;
  promoTag?: string;
}

export interface SetFeaturedApisRequest {
  configs: FeaturedApiConfig[];
}

export interface AddFeaturedApiPayload {
  apiId: string;
  slotType: string;
  orderIndex: number;
  expiresAt?: string;
  promoTag?: string;
}

export interface CategoryPayload {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TrendingWeights {
  requestWeight: number;
  subWeight: number;
  ratingWeight: number;
  errorPenalty: number;
}

export interface TrendingOverride {
  apiId: string;
  action: 'BOOST' | 'EXCLUDE';
  boostValue?: number;
  expiresAt?: string;
}

export interface TrendingApiRow {
  id: string;
  name: string;
  logoUrl: string | null;
  categoryName: string;
  totalRequests: number;
  totalSubscribers: number;
  rating: number;
  dynamicScore: number;
  overrideStatus: 'ALGORITHMIC' | 'BOOSTED' | 'EXCLUDED';
}
