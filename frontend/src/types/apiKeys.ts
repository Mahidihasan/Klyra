/** Mirrors backend `api-keys.types.ts` (backend/src/modules/api-keys). */
export type ApiKeyStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

/** Where a key's target API comes from — drives the "Source" column and badges. */
export type ApiKeySource = 'SUBSCRIBED' | 'OWNED' | 'PROJECT' | 'PERSONAL';

export type RateLimitPeriod = 'SECOND' | 'MINUTE' | 'HOUR' | 'DAY';

/** A version entry offered when pinning a key to a specific API version. */
export interface ApiKeyTargetVersion {
  id: string;
  version: string;
  isCurrent: boolean;
  isDeprecated: boolean;
}

/** An API or API Build project the user may create keys for. */
export interface ApiKeyTarget {
  apiId: string | null;
  projectId: string | null;
  name: string;
  slug: string;
  source: ApiKeySource;
  planName?: string | null;
  subscriptionStatus?: string | null;
  currentVersion: string | null;
  versions: ApiKeyTargetVersion[];
}

/** Aggregate counters for the API Keys page KPI cards. */
export interface ApiKeyStats {
  total: number;
  active: number;
  suspended: number;
  revoked: number;
  expired: number;
  expiringIn30Days: number;
}

/** Safe API-key metadata — never contains the key hash or secret. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  status: ApiKeyStatus;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  apiId: string | null;
  apiName: string | null;
  apiSlug: string | null;
  apiVersionId: string | null;
  apiVersion: string | null;
  projectId: string | null;
  projectName: string | null;
  projectVersion: string | null;
  source: ApiKeySource;
  rateLimit: number;
  rateLimitPeriod: RateLimitPeriod;
  expiresAt: string | null;
  permissions: string[];
  updatedAt: string;
}

export interface CreateApiKeyPayload {
  name: string;
  apiId?: string | null;
  projectId?: string | null;
  apiVersionId?: string | null;
  projectVersion?: string | null;
  expiresInDays?: number | null;
  rateLimit?: number;
  rateLimitPeriod?: RateLimitPeriod;
  permissions?: string[];
}

export interface UpdateApiKeyPayload {
  name?: string;
  apiVersionId?: string | null;
  projectVersion?: string | null;
  /** Absolute expiry; `null` clears the expiration entirely. */
  expiresAt?: string | null;
  expiresInDays?: number | null;
  rateLimit?: number;
  rateLimitPeriod?: RateLimitPeriod;
  permissions?: string[];
}