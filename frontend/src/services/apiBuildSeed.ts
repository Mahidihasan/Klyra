import { ProviderProject } from '../types/apibuild';
const EPS = [
  { id: 'e1', method: 'GET' as const, path: '/users', description: 'List users' },
  { id: 'e2', method: 'POST' as const, path: '/users', description: 'Create a user' },
  { id: 'e3', method: 'GET' as const, path: '/users/{id}', description: 'Get user by id' },
  { id: 'e4', method: 'POST' as const, path: '/generate', description: 'Generate an image' },
  { id: 'e5', method: 'POST' as const, path: '/refunds', description: 'Issue a refund' },
];
export function seedProjects(): ProviderProject[] {
  const now = new Date().toISOString();
  const a: ProviderProject = {
    id: 'proj-kickon-ass', name: 'Kickon Ass API', slug: 'kickon-ass',
    description: 'High-performance image generation API', category: 'AI / Developer Tools',
    status: 'healthy', environment: 'production', version: 'v2.4.1', sourceKind: 'existing',
    baseUrl: 'https://api.kickonass.com', openApiUrl: 'https://api.kickonass.com/openapi.json',
    gatewayUrl: 'https://api.klyra.com/kickon-ass', authKind: 'apiKey', rateLimitPerMin: 100,
    healthCheckPath: '/health', requests: 1240000, requestsLabel: '1.24M requests',
    successRate: 99.8, latencyMs: 142, consumers: 2431, revenue: 4820,
    endpointCount: 42, schemaCount: 18, visibility: 'public', published: true,
    createdAt: now, updatedAt: now,
    deployment: { kind: 'external', status: 'healthy-external', providerUrl: 'https://api.kickonass.com', environment: 'production', version: 'v2.4.1', lastHealthCheck: '12 seconds ago', log: ['Health check GET /health -> 200 in 142ms', 'TLS certificate valid'] },
    detection: { openApiVersion: 'OpenAPI 3.1', endpointCount: 42, schemaCount: 18, authKind: 'Bearer authentication', baseUrl: 'https://api.kickonass.com', endpoints: EPS, found: true },
    plans: [
      { id: 'plan-free', name: 'Free', requestsPerMonth: 1000, priceMonthly: 0, rateLimitPerMin: 20, overagePer1k: 0, trialDays: 0, subscribers: 1980 },
      { id: 'plan-pro', name: 'Pro', requestsPerMonth: 50000, priceMonthly: 19, rateLimitPerMin: 300, overagePer1k: 0.4, trialDays: 14, subscribers: 372 },
      { id: 'plan-biz', name: 'Business', requestsPerMonth: 500000, priceMonthly: 79, rateLimitPerMin: 2000, overagePer1k: 0.25, trialDays: 14, subscribers: 79 },
    ],
    consumersList: [
      { id: 'c1', name: 'Acme Robotics', email: 'dev@acme.dev', plan: 'Business', status: 'active', requests: 182440, joinedAt: '2026-03-02' },
      { id: 'c2', name: 'Lumen Labs', email: 'api@lumenlabs.io', plan: 'Pro', status: 'trialing', requests: 12480, joinedAt: '2026-08-19' },
      { id: 'c3', name: 'Northwind', email: 'eng@northwind.com', plan: 'Free', status: 'active', requests: 842, joinedAt: '2026-07-11' },
    ],
    apiKeys: [
      { id: 'k1', label: 'Acme production', prefix: 'kly_live_8f2a', consumer: 'Acme Robotics', plan: 'Business', createdAt: '2026-03-02', lastUsed: '2 min ago', revoked: false },
      { id: 'k2', label: 'Lumen staging', prefix: 'kly_test_d1b3', consumer: 'Lumen Labs', plan: 'Pro', createdAt: '2026-08-19', lastUsed: '1 hour ago', revoked: false },
    ],
    versions: [
      { id: 'vv1', semver: 'v2.4.1', status: 'published', notes: 'Faster generation queue', createdAt: '2026-08-28', endpoints: 42 },
      { id: 'vv2', semver: 'v2.4.0', status: 'deployed', notes: 'Refund endpoint GA', createdAt: '2026-08-02', endpoints: 41 },
    ],
    activity: [
      { id: 'a1', label: 'Health check passing (GET /health -> 200)', at: '12s ago', kind: 'ok' },
      { id: 'a2', label: 'v2.4.1 published to marketplace', at: '2d ago', kind: 'info' },
    ],
  };
  const b: ProviderProject = {
    id: 'proj-image-processing', name: 'Image Processing API', slug: 'image-processing',
    description: 'Resize, compress and transform images at the edge', category: 'Media',
    status: 'deploying', environment: 'staging', version: 'v1.8.2', sourceKind: 'github',
    baseUrl: 'https://image-processing.klyra.dev', gatewayUrl: 'https://api.klyra.com/image-processing',
    authKind: 'bearer', rateLimitPerMin: 200, healthCheckPath: '/health',
    requests: 842000, requestsLabel: '842K requests', successRate: 99.1, latencyMs: 210,
    consumers: 1204, revenue: 1960, endpointCount: 24, schemaCount: 9,
    visibility: 'unlisted', published: false, createdAt: now, updatedAt: now,
    deployment: { kind: 'klyra', status: 'building', providerUrl: 'https://image-processing.klyra.dev', source: 'GitHub', branch: 'main', environment: 'staging', version: 'v1.8.2', lastHealthCheck: 'building...', log: ['Queued build #482', 'Installing dependencies...'] },
    detection: { openApiVersion: 'OpenAPI 3.0', endpointCount: 24, schemaCount: 9, authKind: 'Bearer authentication', baseUrl: 'https://image-processing.klyra.dev', endpoints: EPS.slice(0, 4), found: true },
    plans: [
      { id: 'p2-free', name: 'Free', requestsPerMonth: 1000, priceMonthly: 0, rateLimitPerMin: 20, overagePer1k: 0, trialDays: 0, subscribers: 1042 },
      { id: 'p2-pro', name: 'Pro', requestsPerMonth: 50000, priceMonthly: 19, rateLimitPerMin: 300, overagePer1k: 0.4, trialDays: 14, subscribers: 162 },
    ],
    consumersList: [{ id: 'c4', name: 'Pixel & Co', email: 'hello@pixel.co', plan: 'Pro', status: 'active', requests: 40210, joinedAt: '2026-06-21' }],
    apiKeys: [{ id: 'k3', label: 'Pixel production', prefix: 'kly_live_99aa', consumer: 'Pixel & Co', plan: 'Pro', createdAt: '2026-06-21', lastUsed: '9 min ago', revoked: false }],
    versions: [{ id: 'v1', semver: 'v1.8.2', status: 'deployed', notes: 'Staging deploy', createdAt: '2026-09-08', endpoints: 24 }],
    activity: [{ id: 'b1', label: 'Build #482 started from branch main', at: '4 min ago', kind: 'info' }],
  };
  return [a, b];
}
