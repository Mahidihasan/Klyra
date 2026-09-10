export interface FeaturedApiRow {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerName: string;
  categoryName: string;
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

export interface SetFeaturedApisRequest {
  apiIds: string[];
}

export interface CategoryPayload {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}
