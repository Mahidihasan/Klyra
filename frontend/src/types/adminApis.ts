import { AdminDataSource } from './admin';

export type ApiStatusValue = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
export type ApiSortField = 'created' | 'name' | 'rating' | 'totalRequests' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface AdminApiRow {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  currentVersion: string;
  categoryId: string;
  categoryName: string;
  endpointsCount: number;
  dailyRequestCount: number;
  healthScore: number;
  status: ApiStatusValue;
  isPublic: boolean;
  isDeprecated: boolean;
  rating: number;
  totalSubscribers: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminApiListQuery {
  page?: number;
  limit?: number;
  search?: string | null;
  status?: ApiStatusValue | null;
  categoryId?: string | null;
  sort?: ApiSortField;
  direction?: SortDirection;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminApiList {
  apis: AdminApiRow[];
  meta: PaginationMeta;
  source: AdminDataSource;
  degradedReason?: string;
}

export type ModerateAction = 'APPROVED' | 'REJECTED' | 'DEPRECATED';

export interface AdminApiMutationResult {
  api: AdminApiRow;
  auditLogged: boolean;
  notification?: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    actionUrl?: string;
  };
}

