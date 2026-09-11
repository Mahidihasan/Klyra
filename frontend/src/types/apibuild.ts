export type ProviderProjectStatus =
  | 'healthy'
  | 'deploying'
  | 'failed'
  | 'paused'
  | 'degraded'
  | 'draft'
  | 'published';

export type ApiSourceKind = 'existing' | 'github' | 'docker';

export type DeployPhase = 'queued' | 'building' | 'deploying' | 'healthy' | 'failed';

/** User-defined categories created in the "New project" wizard + used by the marketplace. */
export interface ApiCategory {
  name: string;
  slug: string;
  projectCount: number;
  isCustom?: boolean;
}

export type ProjectEnvironment = 'development' | 'staging' | 'production';

export type AuthKind = 'bearer' | 'apiKey' | 'oauth2' | 'none';

export interface DetectedEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
}

export interface DetectionResult {
  openApiVersion: string | null;
  endpointCount: number;
  schemaCount: number;
  authKind: string | null;
  baseUrl: string;
  endpoints: DetectedEndpoint[];
  found: boolean;
  /** true when the upstream base URL answered (live connectivity check). */
  reachable?: boolean;
  latencyMs?: number | null;
  foundAt?: string | null;
  title?: string | null;
  description?: string | null;
  servers?: string[];
  securitySchemes?: string[];
  reason?: string;
}

export interface DeploymentInfo {
  kind: 'external' | 'klyra';
  status: DeployPhase | 'healthy-external' | 'paused';
  providerUrl: string;
  source?: string;
  branch?: string;
  environment: ProjectEnvironment;
  version: string;
  lastHealthCheck: string;
  log: string[];
}

export interface PricingPlan {
  id: string;
  name: string;
  requestsPerMonth: number;
  priceMonthly: number;
  rateLimitPerMin: number;
  overagePer1k: number;
  trialDays: number;
  subscribers: number;
}

export interface ApiConsumer {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  requests: number;
  joinedAt: string;
}

export interface ProviderApiKey {
  id: string;
  label: string;
  prefix: string;
  consumer: string;
  plan: string;
  createdAt: string;
  lastUsed: string;
  revoked: boolean;
}

export interface ProjectVersion {
  id: string;
  semver: string;
  status: 'draft' | 'deployed' | 'published' | 'deprecated';
  notes: string;
  createdAt: string;
  endpoints: number;
}

export interface ProviderProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: ProviderProjectStatus;
  environment: ProjectEnvironment;
  version: string;
  sourceKind: ApiSourceKind;
  baseUrl: string;
  openApiUrl?: string;
  gatewayUrl: string;
  authKind: AuthKind;
  rateLimitPerMin: number;
  healthCheckPath: string;
  requests: number;
  requestsLabel: string;
  successRate: number;
  latencyMs: number;
  consumers: number;
  revenue: number;
  endpointCount: number;
  schemaCount: number;
  visibility: 'private' | 'unlisted' | 'public';
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deployment: DeploymentInfo;
  detection: DetectionResult | null;
  plans: PricingPlan[];
  consumersList: ApiConsumer[];
  apiKeys: ProviderApiKey[];
  versions: ProjectVersion[];
  activity: { id: string; label: string; at: string; kind: string }[];
  /** Reason captured when the gateway is paused/suspended (industry-standard audit). */
  pausedReason?: string;
  pausedAt?: string;
  /** Advanced gateway configuration captured by the Configure step. */
  corsOrigins?: string;
  cacheTtlSeconds?: number;
  retryStrategy?: string;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  stripBasePath?: boolean;
  authHeaderName?: string;
  ipAllowlist?: string;
  tags?: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  category: string;
}

export interface SourceConfig {
  kind: ApiSourceKind;
  baseUrl?: string;
  openApiUrl?: string;
  upstreamAuth?: string;
  repository?: string;
  branch?: string;
  dockerImage?: string;
  dockerPort?: number;
  envVars?: { key: string; value: string }[];
}

export interface ConfigureInput {
  apiName: string;
  version: string;
  baseUrl: string;
  authKind: AuthKind;
  rateLimitPerMin: number;
  healthCheckPath: string;
  environment: ProjectEnvironment;
  corsOrigins: string;
  cacheTtlSeconds: number;
  retryStrategy: string;
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  stripBasePath: boolean;
  authHeaderName: string;
  tags: string;
}

export type ProjectTab =
  | 'overview'
  | 'api'
  | 'deployments'
  | 'versions'
  | 'plans'
  | 'consumers'
  | 'keys'
  | 'usage'
  | 'analytics'
  | 'logs'
  | 'monitoring'
  | 'settings';

export const PROJECT_TABS: { id: ProjectTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'api', label: 'API' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'versions', label: 'Versions' },
  { id: 'plans', label: 'Plans' },
  { id: 'consumers', label: 'Consumers' },
  { id: 'keys', label: 'API Keys' },
  { id: 'usage', label: 'Usage' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'logs', label: 'Logs' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'settings', label: 'Settings' },
];
