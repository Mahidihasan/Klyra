import { Project, ApiVersion, Deployment, Consumer, Plan, ApiKey, LogEntry, EndpointHealth, Insight } from '../types/provider';

export const MOCK_PROJECT: Project = {
  id: 'proj_123',
  name: 'Kickon Ass API',
  description: 'A powerful image generation and AI processing API.',
  status: 'Operational',
  category: 'AI',
};

export const MOCK_VERSIONS: ApiVersion[] = [
  { id: 'v3', projectId: 'proj_123', version: 'v3.0.0', status: 'Beta', isDefault: false, releasedAt: '2026-09-01T10:00:00Z', trafficPercentage: 0 },
  { id: 'v2', projectId: 'proj_123', version: 'v2.4.1', status: 'Current', isDefault: true, releasedAt: '2026-07-15T14:30:00Z', trafficPercentage: 74 },
  { id: 'v2_dep', projectId: 'proj_123', version: 'v2.3.0', status: 'Deprecated', isDefault: false, releasedAt: '2026-02-10T09:15:00Z', trafficPercentage: 21 },
  { id: 'v1', projectId: 'proj_123', version: 'v1.9.0', status: 'Legacy', isDefault: false, releasedAt: '2025-11-05T11:20:00Z', trafficPercentage: 5 },
];

export const MOCK_DEPLOYMENTS: Deployment[] = [
  { id: 'dep_1', versionId: 'v2', environment: 'Production', source: 'External API', region: 'Singapore', status: 'Healthy', url: 'https://api.kickonass.com', deployedAt: new Date(Date.now() - 22 * 60000).toISOString() },
  { id: 'dep_2', versionId: 'v3', environment: 'Staging', source: 'GitHub', region: 'Singapore', status: 'Building', url: 'https://staging.kickonass.com', deployedAt: new Date(Date.now() - 5 * 60000).toISOString() },
];

export const MOCK_ENDPOINT_HEALTH: EndpointHealth[] = [
  { method: 'GET', path: '/users', latencyMs: 98, isHealthy: true, requests: 312000, trend: 12 },
  { method: 'POST', path: '/generate', latencyMs: 184, isHealthy: true, requests: 482000, trend: 24 },
  { method: 'POST', path: '/refunds', latencyMs: 421, isHealthy: false, requests: 120000, trend: -8 },
  { method: 'GET', path: '/users/{id}', latencyMs: 103, isHealthy: true, requests: 98000, trend: 3 },
];

export const MOCK_INSIGHTS: Insight[] = [
  { id: 'ins_1', type: 'Performance', severity: 'Warning', message: '"/generate latency increased 18% in the last 24h."', actionText: 'Investigate endpoint' },
  { id: 'ins_2', type: 'Usage', severity: 'Info', message: '"3 consumers are approaching their monthly quota."', actionText: 'View consumers' },
  { id: 'ins_3', type: 'Version', severity: 'Warning', message: '"1,284 consumers are still using v2.3.0."', actionText: 'Start migration' },
];

export const MOCK_PLANS: Plan[] = [
  { id: 'plan_free', projectId: 'proj_123', name: 'FREE', price: 0, requestsPerMonth: 1000, requestsPerMinute: 20, subscribers: 1980 },
  { id: 'plan_pro', projectId: 'proj_123', name: 'PRO', price: 19, requestsPerMonth: 50000, requestsPerMinute: 300, subscribers: 372 },
  { id: 'plan_biz', projectId: 'proj_123', name: 'BUSINESS', price: 79, requestsPerMonth: 500000, requestsPerMinute: 2000, subscribers: 79 },
];

export const MOCK_CONSUMERS: Consumer[] = [
  { id: 'cons_1', projectId: 'proj_123', name: 'Acme Robotics', planId: 'plan_biz', versionId: 'v2', requests: 182440, spend: 79, status: 'Active', lastActiveAt: new Date().toISOString() },
  { id: 'cons_2', projectId: 'proj_123', name: 'Lumen Labs', planId: 'plan_pro', versionId: 'v2', requests: 12000, spend: 19, status: 'Active', lastActiveAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: 'cons_3', projectId: 'proj_123', name: 'Northwind', planId: 'plan_free', versionId: 'v2_dep', requests: 8000, spend: 0, status: 'Active', lastActiveAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
];

export const MOCK_LOGS: LogEntry[] = [
  { id: 'log_1', timestamp: new Date(Date.now() - 12000).toISOString(), method: 'GET', endpoint: '/users', status: 200, latency: 42, consumerName: 'Acme Robotics', versionId: 'v2', region: 'Singapore' },
  { id: 'log_2', timestamp: new Date(Date.now() - 14000).toISOString(), method: 'POST', endpoint: '/generate', status: 500, latency: 1250, consumerName: 'Lumen Labs', versionId: 'v2', region: 'Singapore' },
  { id: 'log_3', timestamp: new Date(Date.now() - 18000).toISOString(), method: 'POST', endpoint: '/refunds', status: 201, latency: 310, consumerName: 'Northwind', versionId: 'v2_dep', region: 'Singapore' },
];
