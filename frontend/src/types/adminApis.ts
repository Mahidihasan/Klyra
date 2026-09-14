import { AdminDataSource } from './admin';

export type ApiStatusValue = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'UNPUBLISHED' | 'REJECTED' | 'DEPRECATED' | 'ARCHIVED';
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

export type SeverityLevel = 'Low' | 'Medium' | 'Critical';
export type ReportStatus = 'Open' | 'Investigating' | 'Resolved' | 'Dismissed';

export interface ApiAbuseReport {
  id: string;
  apiId: string;
  apiName: string;
  apiLogoUrl: string | null;
  reporterId: string;
  reporterName: string;
  reasonTag: string; // e.g. Malicious Payload, Terms Violation
  description: string;
  reportCount: number;
  status: ReportStatus;
  severity: SeverityLevel;
  createdAt: string;
}
