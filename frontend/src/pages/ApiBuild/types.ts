import { ProviderProject, ProjectTab } from '../../types/apibuild';

export interface EndpointParam {
  name: string;
  in: 'query' | 'path' | 'header';
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface EndpointResponse {
  statusCode: number;
  description: string;
  schema: string;
  sampleBody: string;
}

export interface DetailedEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  category: string;
  authRequired: boolean;
  rateLimitPerMin: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalRequests: number;
  errorRate: number;
  isHealthy: boolean;
  status: 'active' | 'deprecated' | 'beta';
  parameters: EndpointParam[];
  requestBody?: {
    contentType: string;
    schema: string;
    sampleBody: string;
  };
  responses: EndpointResponse[];
}

export interface DeploymentRecord {
  id: string;
  version: string;
  environment: 'production' | 'staging' | 'development';
  source: 'External API' | 'GitHub' | 'Docker' | 'Klyra Hosted';
  branch?: string;
  commitHash?: string;
  commitMessage?: string;
  region: string;
  status: 'healthy' | 'building' | 'failed' | 'paused';
  url: string;
  deployedAt: string;
  durationSec: number;
  author: string;
  logs: string[];
  envVars: { key: string; value: string; isSecret: boolean }[];
}

export interface ExtendedVersion {
  id: string;
  semver: string;
  status: 'Current' | 'Beta' | 'Deprecated' | 'Legacy';
  isDefault: boolean;
  releasedAt: string;
  endpointsCount: number;
  consumersCount: number;
  trafficPercentage: number;
  successRate: number;
  avgLatencyMs: number;
  changelog: {
    added: string[];
    modified: string[];
    deprecated: string[];
    breaking: string[];
  };
}

export interface ExtendedLogEntry {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  statusCode: number;
  latencyMs: number;
  consumerName: string;
  keyPrefix: string;
  version: string;
  region: string;
  ipAddress: string;
  requestHeaders: Record<string, string>;
  queryParams: Record<string, string>;
  requestBody: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  trace: {
    stage: string;
    durationMs: number;
  }[];
}

export interface MonitoringIncident {
  id: string;
  title: string;
  severity: 'Critical' | 'Major' | 'Minor';
  status: 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved';
  startedAt: string;
  resolvedAt?: string;
  durationMinutes?: number;
  affectedEndpoints: string[];
  summary: string;
  postmortem?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: 'p95_latency' | 'error_rate' | 'uptime' | 'rate_limit';
  condition: '>' | '<';
  threshold: number;
  unit: string;
  durationSec: number;
  channels: string[];
  enabled: boolean;
  lastTriggered?: string;
}

export interface KlyraInsightItem {
  id: string;
  category: 'Performance' | 'Usage' | 'Business' | 'Version' | 'Security' | 'Revenue';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  description: string;
  actionText: string;
  actionType: 'navigate_tab' | 'open_drawer' | 'open_modal';
  targetTab?: ProjectTab;
  meta?: any;
}
