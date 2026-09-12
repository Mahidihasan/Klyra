export type Environment = 'Development' | 'Staging' | 'Production';
export type ApiStatus = 'Operational' | 'Degraded' | 'Down';
export type DeploymentStatus = 'Healthy' | 'Building' | 'Failed' | 'Paused';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ApiStatus;
  category: string;
}

export interface ApiVersion {
  id: string;
  projectId: string;
  version: string;
  status: 'Current' | 'Beta' | 'Deprecated' | 'Legacy';
  isDefault: boolean;
  releasedAt: string;
  trafficPercentage: number;
}

export interface Deployment {
  id: string;
  versionId: string;
  environment: Environment;
  source: string;
  region: string;
  status: DeploymentStatus;
  url: string;
  deployedAt: string;
}

export interface Consumer {
  id: string;
  projectId: string;
  name: string;
  planId: string;
  versionId: string;
  requests: number;
  spend: number;
  status: 'Active' | 'Suspended';
  lastActiveAt: string;
}

export interface Plan {
  id: string;
  projectId: string;
  name: string;
  price: number;
  requestsPerMonth: number;
  requestsPerMinute: number;
  subscribers: number;
}

export interface ApiKey {
  id: string;
  consumerId: string;
  label: string;
  prefix: string;
  environment: Environment;
  scopes: string[];
  lastUsedAt: string;
  status: 'Active' | 'Revoked' | 'Expired';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  latency: number;
  consumerName: string;
  versionId: string;
  region: string;
}

export interface EndpointHealth {
  method: string;
  path: string;
  latencyMs: number;
  isHealthy: boolean;
  requests: number;
  trend: number; // percentage change
}

export interface Insight {
  id: string;
  type: 'Performance' | 'Usage' | 'Business' | 'Version' | 'Security';
  severity: 'Info' | 'Warning' | 'Critical';
  message: string;
  actionText: string;
}
