/**
 * Admin "Users" module types.
 *
 * Mirrors backend/src/modules/admin/admin.users.types.ts — the two files are
 * the same wire contract from opposite ends. Change one, change the other.
 *
 * The role and status vocabularies are the real Postgres enums (`user_role`,
 * `user_status`). `USER` is labelled "Consumer" in the UI because that is what
 * the product calls it, but the value on the wire is always `USER`.
 */

import { AdminDataSource } from './admin';

export const USER_ROLES = ['USER', 'PROVIDER', 'MODERATOR', 'ADMIN'] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

export const USER_SUBSCRIPTION_TIERS = ['FREE', 'PRO', 'ENTERPRISE'] as const;
export type UserSubscriptionTier = (typeof USER_SUBSCRIPTION_TIERS)[number];

/**
 * 'PENDING' is filterable but not settable: it is derived from
 * `email_verified_at IS NULL` rather than stored in the status column.
 */
export const USER_STATUS_FILTERS = [...USER_STATUSES, 'PENDING'] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export const USER_SORT_FIELDS = ['joined', 'name', 'email', 'role', 'status', 'apisOwned'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRoleValue;
  status: UserStatusValue;
  subscriptionTier: UserSubscriptionTier;
  isPendingVerification: boolean;
  apisOwned: number;
  apisSubscribed: number;
  joinedAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  search?: string | null;
  role?: UserRoleValue | null;
  status?: UserStatusFilter | null;
  subscriptionTier?: UserSubscriptionTier | null;
  sort?: UserSortField;
  direction?: SortDirection;
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
  source: AdminDataSource;
  degradedReason?: string;
}

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

export interface AdminUserMutationResult {
  user: AdminUserRow;
  auditLogged: boolean;
}

export interface ImpersonationGrant {
  accessToken: string;
  expiresAt: string;
  expiresInSeconds: number;
  target: { id: string; name: string; email: string; role: UserRoleValue };
  issuedBy: { id: string; name: string };
}

export interface ApiDetail {
  id: string;
  name: string;
  status: string;
  subscribers: number;
  avgLatencyMs: number | null;
}

export interface SubscriptionDetail {
  id: string;
  apiName: string;
  planName: string;
  status: string;
  periodStart: string;
  periodEnd: string | null;
}

export interface ApiKeyDetail {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  rateLimit: number;
  rateLimitPeriod: string;
  lastUsedAt: string | null;
}

export interface UserTelemetryStats {
  totalRequests30d: number;
  errorQuotaViolations30d: number;
}

export interface AdminUserDetails extends AdminUserProfile {
  apis: ApiDetail[];
  subscriptions: SubscriptionDetail[];
  apiKeys: ApiKeyDetail[];
  telemetry: UserTelemetryStats;
}

// ============================================================================
// Display vocabulary
// ============================================================================

/** UI label for each role. `USER` reads as "Consumer" everywhere on screen. */
export const ROLE_LABELS: Record<UserRoleValue, string> = {
  USER: 'Consumer / Developer',
  PROVIDER: 'Provider',
  MODERATOR: 'Moderator',
  ADMIN: 'Admin',
};

export const STATUS_LABELS: Record<UserStatusFilter, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  BANNED: 'Banned',
  PENDING: 'Pending verification',
};

export const SUBSCRIPTION_TIER_LABELS: Record<UserSubscriptionTier, string> = {
  FREE: 'Free',
  PRO: 'Developer',
  ENTERPRISE: 'Enterprise',
};

/** Filter pills, in the order they appear in the drawer. */
export const ROLE_FILTER_OPTIONS: { id: UserRoleValue; label: string }[] = USER_ROLES.map((id) => ({
  id,
  label: ROLE_LABELS[id],
}));

export const STATUS_FILTER_OPTIONS: { id: UserStatusFilter; label: string }[] =
  USER_STATUS_FILTERS.map((id) => ({ id, label: STATUS_LABELS[id] }));

export const SUBSCRIPTION_TIER_FILTER_OPTIONS: { id: UserSubscriptionTier; label: string }[] =
  USER_SUBSCRIPTION_TIERS.map((id) => ({ id, label: SUBSCRIPTION_TIER_LABELS[id] }));

/** Statuses an admin can actually set, i.e. everything except derived PENDING. */
export const SETTABLE_STATUS_OPTIONS: { id: UserStatusValue; label: string }[] = USER_STATUSES.map(
  (id) => ({ id, label: STATUS_LABELS[id] }),
);

// ============================================================================
// Client-side mirror of the server guardrails
// ============================================================================

/**
 * These mirror backend/src/modules/admin/admin.users.policy.ts so menu items
 * can be disabled with a reason instead of failing on click. The server is
 * still the enforcement point — this is a courtesy, never a security boundary.
 */

export interface GuardCheck {
  allowed: boolean;
  reason?: string;
}

const ALLOWED: GuardCheck = { allowed: true };

function denied(reason: string): GuardCheck {
  return { allowed: false, reason };
}

export interface ViewerIdentity {
  id: string | null;
  role: UserRoleValue | null;
}

/**
 * Shared precondition for every mutation.
 *
 * The no-session case is called out separately because it is what a local
 * developer previewing the screen through the `klyra-dev-role` hatch will hit:
 * the server refuses those writes too (there is no actor to put in the audit
 * log), and "sign in properly" is far more actionable than "you aren't an
 * admin" when the hatch has just told them they are.
 */
function canWrite(viewer: ViewerIdentity): GuardCheck | null {
  if (viewer.id === null) {
    return denied('Sign in with a real admin account to modify users.');
  }
  if (viewer.role !== 'ADMIN') {
    return denied('Only an admin can modify accounts. Moderator access is read-only.');
  }
  return null;
}

export function canChangeRole(viewer: ViewerIdentity, target: AdminUserRow): GuardCheck {
  const gate = canWrite(viewer);
  if (gate) return gate;
  if (viewer.id && viewer.id === target.id) {
    return denied('You cannot change your own role.');
  }
  return ALLOWED;
}

export function canChangeStatus(
  viewer: ViewerIdentity,
  target: AdminUserRow,
  nextStatus: UserStatusValue,
): GuardCheck {
  const gate = canWrite(viewer);
  if (gate) return gate;
  if (viewer.id && viewer.id === target.id) {
    return denied('You cannot change your own status.');
  }
  if (target.role === 'ADMIN' && nextStatus !== 'ACTIVE') {
    return denied('Admin accounts cannot be deactivated. Change their role first.');
  }
  return ALLOWED;
}

export function canImpersonate(viewer: ViewerIdentity, target: AdminUserRow): GuardCheck {
  const gate = canWrite(viewer);
  if (gate) return gate;
  if (viewer.id && viewer.id === target.id) {
    return denied('You are already signed in as this account.');
  }
  if (target.role === 'ADMIN' || target.role === 'MODERATOR') {
    return denied('Privileged accounts cannot be impersonated.');
  }
  if (target.status !== 'ACTIVE') {
    return denied(`This account is ${STATUS_LABELS[target.status].toLowerCase()}.`);
  }
  return ALLOWED;
}

export interface PlatformSubscriptionDetails {
  tier: UserSubscriptionTier;
  status: 'ACTIVE' | 'PAST_DUE' | 'TRIALING' | 'CANCELED';
  renewalDate: string | null;
  billingCycle: 'MONTHLY' | 'ANNUAL' | null;
  paymentMethod: string | null;
  quota: {
    used: number;
    limit: number;
  };
  override: {
    active: boolean;
    tier: UserSubscriptionTier;
    expiresAt: string | null;
    reason: string | null;
  } | null;
}

export interface SubscriptionOverridePayload {
  tier: UserSubscriptionTier;
  expiresAt?: string | null;
  reason: string;
}
