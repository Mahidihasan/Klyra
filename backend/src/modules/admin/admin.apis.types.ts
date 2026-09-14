import { AdminDataSource } from './admin.types';
import { UserRoleValue } from './admin.users.types';

export const API_STATUSES = ['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const;
export type ApiStatusValue = (typeof API_STATUSES)[number];

export const API_SORT_FIELDS = ['created', 'name', 'rating', 'totalRequests', 'status'] as const;
export type ApiSortField = (typeof API_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export function isApiStatus(value: unknown): value is ApiStatusValue {
  return typeof value === 'string' && (API_STATUSES as readonly string[]).includes(value);
}

export function isApiSortField(value: unknown): value is ApiSortField {
  return typeof value === 'string' && (API_SORT_FIELDS as readonly string[]).includes(value);
}

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
  page: number;
  limit: number;
  search: string | null;
  status: ApiStatusValue | null;
  categoryId: string | null;
  sort: ApiSortField;
  direction: SortDirection;
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

export type ModerateAction = 'APPROVED' | 'REJECTED' | 'DEPRECATED' | 'CHANGES_REQUESTED' | 'WARN' | 'QUARANTINE' | 'SUSPEND' | 'DISMISS';

export interface AdminApiMutationResult {
  api: AdminApiRow;
  auditLogged: boolean;
}

export type ApiLifecycleStatus = 'PUBLISHED' | 'UNPUBLISHED' | 'DEPRECATED' | 'ARCHIVED';

export interface ApiLifecyclePayload {
  status: ApiLifecycleStatus;
  sunsetDate?: string;
  migrationApiId?: string;
  reason?: string;
}
