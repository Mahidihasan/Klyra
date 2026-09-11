/**
 * Wire contract for the admin Users module.
 *
 * The role and status vocabularies below are the real Postgres enums from
 * infrastructure/database/schema.sql (`user_role`, `user_status`) — not the
 * ones named in the original brief. There is no organizations table, so there
 * is no ORG_OWNER, and 'PENDING' is not a stored status: it is derived from
 * `email_verified_at IS NULL` and offered as a filter only.
 */

import { AdminDataSource } from './admin.types';

/** Mirrors the `user_role` enum. Order is least → most privileged. */
export const USER_ROLES = ['USER', 'PROVIDER', 'MODERATOR', 'ADMIN'] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

export interface ViewerIdentity {
  id: string;
  role: UserRoleValue;
}

/** Mirrors the `user_status` enum. */
export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

/**
 * Filterable statuses = the stored ones plus a derived pseudo-status.
 *
 * 'PENDING' means "signed up but never verified their email". It is a real and
 * useful thing to filter on, but it lives in `email_verified_at`, not in the
 * status column, so it can never be a value you *set*.
 */
export const USER_STATUS_FILTERS = [...USER_STATUSES, 'PENDING'] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

/** Roles that may reach any admin endpoint at all. */
export const ADMIN_READ_ROLES: readonly UserRoleValue[] = ['ADMIN', 'MODERATOR'];

/** Roles that may mutate another account. Deliberately narrower than the above. */
export const ADMIN_WRITE_ROLES: readonly UserRoleValue[] = ['ADMIN'];

export function isUserRole(value: unknown): value is UserRoleValue {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function isUserStatus(value: unknown): value is UserStatusValue {
  return typeof value === 'string' && (USER_STATUSES as readonly string[]).includes(value);
}

export function isUserStatusFilter(value: unknown): value is UserStatusFilter {
  return typeof value === 'string' && (USER_STATUS_FILTERS as readonly string[]).includes(value);
}

// ============================== List ==============================

export const USER_SORT_FIELDS = ['joined', 'name', 'email', 'role', 'status', 'apisOwned'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export function isUserSortField(value: unknown): value is UserSortField {
  return typeof value === 'string' && (USER_SORT_FIELDS as readonly string[]).includes(value);
}

/** One row of the users table. Deliberately free of anything secret. */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRoleValue;
  status: UserStatusValue;
  /** Derived from `email_verified_at IS NULL`; drives the "Pending" chip. */
  isPendingVerification: boolean;
  apisOwned: number;
  apisSubscribed: number;
  joinedAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserListQuery {
  page: number;
  limit: number;
  search: string | null;
  role: UserRoleValue | null;
  status: UserStatusFilter | null;
  sort: UserSortField;
  direction: SortDirection;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUserList {
  users: AdminUserRow[];
  meta: PaginationMeta;
  /** 'live' when Postgres answered; 'mock' when the list fell back to samples. */
  source: AdminDataSource;
  degradedReason?: string;
}

// ============================ Profile =============================

/** One audit_logs entry, flattened for the profile drawer. */
export interface AdminUserActivity {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  ipAddress: string | null;
}

export interface AdminUserProfile extends AdminUserRow {
  bio: string | null;
  company: string | null;
  website: string | null;
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
  updatedAt: string;
  recentActivity: AdminUserActivity[];
  source: AdminDataSource;
}

// =========================== Mutations ============================

export interface UpdateUserStatusRequest {
  status: UserStatusValue;
  /** Free-text justification, stored on the audit row rather than the user. */
  reason?: string;
}

export interface UpdateUserRoleRequest {
  role: UserRoleValue;
}

export interface AdminUserMutationResult {
  user: AdminUserRow;
  /** False when the write landed but the audit insert did not — surfaced, not swallowed. */
  auditLogged: boolean;
}

// ========================= Impersonation ==========================

/**
 * A short-lived token that lets an admin act as another user.
 *
 * The token carries an `impersonatedBy` claim so every downstream request is
 * attributable to the admin who started it — an impersonated session is never
 * indistinguishable from a real one.
 */
export interface ImpersonationGrant {
  accessToken: string;
  expiresAt: string;
  expiresInSeconds: number;
  target: {
    id: string;
    name: string;
    email: string;
    role: UserRoleValue;
  };
  issuedBy: {
    id: string;
    name: string;
  };
}

// ============================ Policy ==============================

/** Why a particular action was refused. Shared so the UI can pre-disable it. */
export type GuardrailCode =
  | 'SELF_ROLE_CHANGE'
  | 'SELF_STATUS_CHANGE'
  | 'SELF_IMPERSONATION'
  | 'ADMIN_TARGET_STATUS'
  | 'IMPERSONATE_PRIVILEGED'
  | 'LAST_ADMIN'
  | 'WRITE_REQUIRES_ADMIN'
  | 'WRITE_REQUIRES_REAL_SESSION';

export interface GuardrailFailure {
  code: GuardrailCode;
  message: string;
}

export interface AuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}
