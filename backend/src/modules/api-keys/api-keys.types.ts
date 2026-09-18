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
  /** Marketplace API id — mutually exclusive with projectId. */
  apiId: string | null;
  /** API Build project id — mutually exclusive with apiId. */
  projectId: string | null;
  name: string;
  slug: string;
  source: ApiKeySource;
  /** Subscription plan name when the target comes from a subscription. */
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

/** Metadata safe to return after an API key has been created. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  status: ApiKeyStatus;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  // Target binding — null for personal (API-less) keys.
  apiId: string | null;
  apiName: string | null;
  apiSlug: string | null;
  apiVersionId: string | null;
  apiVersion: string | null;
  projectId: string | null;
  projectName: string | null;
  projectVersion: string | null;
  source: ApiKeySource;
  // Limits & lifecycle
  rateLimit: number;
  rateLimitPeriod: RateLimitPeriod;
  expiresAt: string | null;
  permissions: string[];
  updatedAt: string;
}

export interface CreateApiKeyInput {
  name?: unknown;
  apiId?: unknown;
  projectId?: unknown;
  apiVersionId?: unknown;
  projectVersion?: unknown;
  expiresAt?: unknown;
  expiresInDays?: unknown;
  rateLimit?: unknown;
  rateLimitPeriod?: unknown;
  permissions?: unknown;
}

export interface UpdateApiKeyInput {
  name?: unknown;
  apiVersionId?: unknown;
  projectVersion?: unknown;
  expiresAt?: unknown;
  expiresInDays?: unknown;
  rateLimit?: unknown;
  rateLimitPeriod?: unknown;
  permissions?: unknown;
}

export interface CreatedApiKey {
  apiKey: ApiKeySummary;
  /** Delivered in the creation response only; never retained by the service. */
  secret: string;
}

/** Result of resolving a raw gateway key against the api_keys table. */
export interface ResolvedGatewayKey {
  keyId: string;
  keyName: string;
  /** Platform user the consumer key belongs to; provider (API Build) keys have none. */
  userId: string | null;
  apiId: string | null;
  apiSlug: string | null;
  projectId: string | null;
}

export type ResolvedGatewayKeyResult =
  | { ok: true; key: ResolvedGatewayKey }
  | { ok: false; status: number; reason: string };

export class ApiKeyServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiKeyServiceError';
  }
}
