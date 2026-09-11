import {
  DetailedEndpoint,
  ExtendedVersion,
  DeploymentRecord,
  ExtendedLogEntry,
  MonitoringIncident,
  AlertRule,
  KlyraInsightItem,
} from './types';
import { ProviderProject } from '../../types/apibuild';

export function getMockEndpoints(project: ProviderProject, version?: string): DetailedEndpoint[] {
  return [
    {
      id: 'ep-1',
      method: 'POST',
      path: '/generate',
      summary: 'Generate AI Images with prompt & style',
      description: 'Generates high-definition images using fine-tuned latent diffusion models with prompt weighting, negative prompts, seed control, and optional upscaling.',
      category: 'Generation',
      authRequired: true,
      rateLimitPerMin: 120,
      avgLatencyMs: 184,
      p95LatencyMs: 421,
      totalRequests: 482400,
      errorRate: 0.18,
      isHealthy: true,
      status: 'active',
      parameters: [
        { name: 'X-Async-Webhook', in: 'header', type: 'string', required: false, description: 'Optional callback URL for long-running asynchronous rendering jobs.' },
        { name: 'quality', in: 'query', type: 'string', required: false, description: 'Output quality: standard | hd | ultra (defaults to standard).' },
      ],
      requestBody: {
        contentType: 'application/json',
        schema: `{
  "type": "object",
  "required": ["prompt"],
  "properties": {
    "prompt": { "type": "string", "maxLength": 1000 },
    "negative_prompt": { "type": "string" },
    "aspect_ratio": { "type": "string", "enum": ["1:1", "16:9", "9:16", "4:3"] },
    "steps": { "type": "integer", "minimum": 10, "maximum": 50, "default": 30 },
    "seed": { "type": "integer" }
  }
}`,
        sampleBody: JSON.stringify({
          prompt: "Cyberpunk neon street market in rain, cinematic lighting, 8k octane render",
          negative_prompt: "blurry, low quality, deformed",
          aspect_ratio: "16:9",
          steps: 30,
          seed: 428912
        }, null, 2),
      },
      responses: [
        {
          statusCode: 200,
          description: 'Image generated successfully',
          schema: '{"type": "object", "properties": {"id": {"type": "string"}, "url": {"type": "string"}, "created_at": {"type": "integer"}}}',
          sampleBody: JSON.stringify({
            id: "img_99f2b84a",
            url: "https://cdn.kickonass.com/renders/cyberpunk-neon-market.webp",
            width: 1920,
            height: 1080,
            seed: 428912,
            processing_time_ms: 184,
            created_at: 1725900000
          }, null, 2)
        },
        {
          statusCode: 400,
          description: 'Invalid prompt or unsupported aspect ratio',
          schema: '{"type": "object", "properties": {"error": {"type": "string"}, "code": {"type": "string"}}}',
          sampleBody: JSON.stringify({ error: "Invalid aspect_ratio. Supported values are 1:1, 16:9, 9:16, 4:3", code: "INVALID_PARAMETERS" }, null, 2)
        },
        {
          statusCode: 429,
          description: 'Rate limit quota exceeded for current plan',
          schema: '{"type": "object", "properties": {"error": {"type": "string"}, "retry_after": {"type": "integer"}}}',
          sampleBody: JSON.stringify({ error: "Plan quota exceeded (300 req/min). Upgrade plan or retry after 14s", retry_after: 14 }, null, 2)
        }
      ]
    },
    {
      id: 'ep-2',
      method: 'GET',
      path: '/users',
      summary: 'List project consumers and team members',
      description: 'Fetches paginated list of registered consumers, billing tiers, and usage quotas.',
      category: 'Users & Org',
      authRequired: true,
      rateLimitPerMin: 300,
      avgLatencyMs: 98,
      p95LatencyMs: 140,
      totalRequests: 312000,
      errorRate: 0.05,
      isHealthy: true,
      status: 'active',
      parameters: [
        { name: 'page', in: 'query', type: 'integer', required: false, description: 'Page number (defaults to 1)' },
        { name: 'limit', in: 'query', type: 'integer', required: false, description: 'Items per page (max 100)' },
        { name: 'status', in: 'query', type: 'string', required: false, description: 'Filter by active | suspended | trialing' }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'List of consumers retrieved successfully',
          schema: '{"type": "object", "properties": {"data": {"type": "array"}, "total": {"type": "integer"}}}',
          sampleBody: JSON.stringify({
            data: [
              { id: "usr_1", name: "Acme Robotics", plan: "Business", status: "active", requests_this_month: 182440 },
              { id: "usr_2", name: "Lumen Labs", plan: "Pro", status: "trialing", requests_this_month: 12480 }
            ],
            total: 2431,
            page: 1,
            limit: 20
          }, null, 2)
        }
      ]
    },
    {
      id: 'ep-3',
      method: 'GET',
      path: '/users/{id}',
      summary: 'Retrieve single consumer profile and quotas',
      description: 'Fetches deep telemetry, issued API keys, and plan tier limits for a consumer.',
      category: 'Users & Org',
      authRequired: true,
      rateLimitPerMin: 300,
      avgLatencyMs: 103,
      p95LatencyMs: 155,
      totalRequests: 98000,
      errorRate: 0.08,
      isHealthy: true,
      status: 'active',
      parameters: [
        { name: 'id', in: 'path', type: 'string', required: true, description: 'Unique consumer identifier' }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Consumer profile record',
          schema: '{"type": "object"}',
          sampleBody: JSON.stringify({
            id: "usr_acme_01",
            name: "Acme Robotics",
            email: "dev@acme.dev",
            plan: "Business",
            mrr: 79,
            monthly_quota: 500000,
            consumed: 182440,
            created_at: "2026-03-02"
          }, null, 2)
        }
      ]
    },
    {
      id: 'ep-4',
      method: 'POST',
      path: '/refunds',
      summary: 'Process automatic consumer refund & ledger adjustment',
      description: 'Executes dispute resolution or customer credit adjustment with upstream payment processor.',
      category: 'Billing & Ledger',
      authRequired: true,
      rateLimitPerMin: 60,
      avgLatencyMs: 421,
      p95LatencyMs: 820,
      totalRequests: 120000,
      errorRate: 1.84,
      isHealthy: false,
      status: 'active',
      parameters: [],
      requestBody: {
        contentType: 'application/json',
        schema: '{"type": "object", "required": ["charge_id", "amount_cents"]}',
        sampleBody: JSON.stringify({
          charge_id: "ch_live_89123891",
          amount_cents: 4900,
          reason: "customer_request"
        }, null, 2)
      },
      responses: [
        {
          statusCode: 201,
          description: 'Refund transaction created',
          schema: '{"type": "object"}',
          sampleBody: JSON.stringify({
            refund_id: "rf_99012a",
            status: "succeeded",
            amount_refunded: 4900,
            created_at: 1725901200
          }, null, 2)
        }
      ]
    },
    {
      id: 'ep-5',
      method: 'GET',
      path: '/health',
      summary: 'Service heartbeat probe and upstream status',
      description: 'Returns real-time gateway health, database connectivity, and upstream worker pool latency.',
      category: 'Diagnostics',
      authRequired: false,
      rateLimitPerMin: 1000,
      avgLatencyMs: 14,
      p95LatencyMs: 22,
      totalRequests: 1140000,
      errorRate: 0.0,
      isHealthy: true,
      status: 'active',
      parameters: [],
      responses: [
        {
          statusCode: 200,
          description: 'Healthy heartbeat',
          schema: '{"type": "object"}',
          sampleBody: JSON.stringify({ status: "healthy", uptime_sec: 1489201, version: "v2.4.1", region: "ap-southeast-1" }, null, 2)
        }
      ]
    }
  ];
}

export function getMockVersions(project: ProviderProject): ExtendedVersion[] {
  return [
    {
      id: 'v-300',
      semver: 'v3.0.0',
      status: 'Beta',
      isDefault: false,
      releasedAt: '2026-09-01T10:00:00Z',
      endpointsCount: 46,
      consumersCount: 14,
      trafficPercentage: 0,
      successRate: 98.4,
      avgLatencyMs: 120,
      changelog: {
        added: ['POST /v3/generate-batch', 'POST /v3/upscale', 'GET /v3/models'],
        modified: ['POST /generate (supports FLUX.1 models)'],
        deprecated: ['POST /v1/legacy-render'],
        breaking: ['Removed basic auth in favor of strictly scoped bearer tokens']
      }
    },
    {
      id: 'v-241',
      semver: 'v2.4.1',
      status: 'Current',
      isDefault: true,
      releasedAt: '2026-08-28T14:30:00Z',
      endpointsCount: 42,
      consumersCount: 2431,
      trafficPercentage: 74,
      successRate: 99.8,
      avgLatencyMs: 142,
      changelog: {
        added: ['POST /refunds endpoint GA', 'GET /usage real-time telemetry'],
        modified: ['POST /generate latency reduced by 18% with tensor caching'],
        deprecated: [],
        breaking: []
      }
    },
    {
      id: 'v-230',
      semver: 'v2.3.0',
      status: 'Deprecated',
      isDefault: false,
      releasedAt: '2026-05-10T09:15:00Z',
      endpointsCount: 38,
      consumersCount: 1284,
      trafficPercentage: 21,
      successRate: 97.4,
      avgLatencyMs: 198,
      changelog: {
        added: ['GET /users pagination', 'Webhook dispatching'],
        modified: ['GET /users/{id} response format'],
        deprecated: ['Legacy header X-Auth-Key'],
        breaking: []
      }
    },
    {
      id: 'v-190',
      semver: 'v1.9.0',
      status: 'Legacy',
      isDefault: false,
      releasedAt: '2025-11-05T11:20:00Z',
      endpointsCount: 22,
      consumersCount: 142,
      trafficPercentage: 5,
      successRate: 95.2,
      avgLatencyMs: 280,
      changelog: {
        added: ['Initial v1 schema endpoints'],
        modified: [],
        deprecated: ['Sunset scheduled for Dec 2026'],
        breaking: []
      }
    }
  ];
}

export function getMockDeployments(project: ProviderProject): DeploymentRecord[] {
  return [
    {
      id: 'dep-101',
      version: 'v2.4.1',
      environment: 'production',
      source: 'External API',
      region: 'Singapore (ap-southeast-1)',
      status: 'healthy',
      url: project.baseUrl || 'https://api.kickonass.com',
      deployedAt: '22 minutes ago',
      durationSec: 18,
      author: 'Mahidi Hasan (Lead)',
      logs: [
        'Connecting to upstream origin https://api.kickonass.com...',
        'TLS handshake verified (TLS 1.3 / ECDHE-RSA-AES128-GCM-SHA256)',
        'Route rules mapped: 42 endpoints into Klyra Envoy Edge',
        'Health check probe GET /health returned HTTP 200 (14ms)',
        'Routing 100% production traffic to healthy cluster [sg-edge-pool-01]',
        'Deployment marked ACTIVE & HEALTHY'
      ],
      envVars: [
        { key: 'NODE_ENV', value: 'production', isSecret: false },
        { key: 'GATEWAY_CACHE_ENABLED', value: 'true', isSecret: false },
        { key: 'UPSTREAM_API_SECRET', value: 'kly_sec_99481a74e92', isSecret: true },
        { key: 'RATE_LIMIT_REDIS_URL', value: 'redis://default:***@cache.internal:6379', isSecret: true },
      ]
    },
    {
      id: 'dep-102',
      version: 'v3.0.0',
      environment: 'staging',
      source: 'GitHub',
      branch: 'feature/v3-diffusion',
      commitHash: '7b8f9a2',
      commitMessage: 'feat: add batch generation endpoint & worker scale policy',
      region: 'Singapore (ap-southeast-1)',
      status: 'building',
      url: 'https://staging.kickonass.klyra.dev',
      deployedAt: '4 minutes ago',
      durationSec: 42,
      author: 'GitHub Action #849',
      logs: [
        'Cloning repository github.com/kickon/image-api@7b8f9a2',
        'Building Dockerfile with buildx cache mount...',
        'Running test suite: 124 passed, 0 failed (3.4s)',
        'Pushing image to klyra-registry.cr/img-api:v3.0.0-beta',
        'Provisioning container replicas [0/3 ready]...'
      ],
      envVars: [
        { key: 'NODE_ENV', value: 'staging', isSecret: false },
        { key: 'ENABLE_BETA_ENDPOINTS', value: 'true', isSecret: false },
      ]
    },
    {
      id: 'dep-103',
      version: 'v2.4.0',
      environment: 'production',
      source: 'External API',
      region: 'Singapore (ap-southeast-1)',
      status: 'paused',
      url: 'https://api-v240.kickonass.com',
      deployedAt: '12 days ago',
      durationSec: 24,
      author: 'Mahidi Hasan',
      logs: [
        'Origin verified',
        'Traffic smoothly drained to v2.4.1',
        'Cluster put on standby'
      ],
      envVars: []
    }
  ];
}

export function getMockLogs(project: ProviderProject): ExtendedLogEntry[] {
  const now = Date.now();
  return [
    {
      id: 'req-88912',
      timestamp: new Date(now - 8000).toISOString(),
      method: 'POST',
      path: '/generate',
      statusCode: 200,
      latencyMs: 184,
      consumerName: 'Acme Robotics',
      keyPrefix: 'kly_live_8f2a',
      version: 'v2.4.1',
      region: 'Singapore',
      ipAddress: '103.24.182.11',
      requestHeaders: {
        'Host': 'api.klyra.com',
        'Authorization': 'Bearer kly_live_8f2a... [masked]',
        'Content-Type': 'application/json',
        'User-Agent': 'Acme-Bot-Worker/3.2'
      },
      queryParams: { 'quality': 'hd' },
      requestBody: JSON.stringify({ prompt: 'Cyberpunk neon market in rain', aspect_ratio: '16:9', steps: 30 }, null, 2),
      responseHeaders: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Klyra-Latency': '184ms',
        'X-Klyra-Trace-Id': 'trc_88912_sg'
      },
      responseBody: JSON.stringify({ id: 'img_99f2b84a', status: 'completed', render_time_ms: 184 }, null, 2),
      trace: [
        { stage: 'Gateway Ingress & TLS', durationMs: 6 },
        { stage: 'Authentication & Scope Check', durationMs: 4 },
        { stage: 'Rate Limit Token Bucket', durationMs: 2 },
        { stage: 'Upstream Proxy to Origin', durationMs: 164 },
        { stage: 'Response Serialization & Egress', durationMs: 8 }
      ]
    },
    {
      id: 'req-88913',
      timestamp: new Date(now - 14000).toISOString(),
      method: 'GET',
      path: '/users',
      statusCode: 200,
      latencyMs: 92,
      consumerName: 'Lumen Labs',
      keyPrefix: 'kly_test_d1b3',
      version: 'v2.4.1',
      region: 'Singapore',
      ipAddress: '49.207.19.4',
      requestHeaders: {
        'Host': 'api.klyra.com',
        'Authorization': 'Bearer kly_test_d1b3...',
        'Accept': 'application/json'
      },
      queryParams: { 'limit': '20', 'page': '1' },
      requestBody: '',
      responseHeaders: { 'Content-Type': 'application/json' },
      responseBody: JSON.stringify({ data: [{ id: 'usr_1' }], total: 2431 }, null, 2),
      trace: [
        { stage: 'Gateway Ingress', durationMs: 4 },
        { stage: 'Auth Validation', durationMs: 3 },
        { stage: 'Upstream Proxy', durationMs: 80 },
        { stage: 'Egress', durationMs: 5 }
      ]
    },
    {
      id: 'req-88914',
      timestamp: new Date(now - 32000).toISOString(),
      method: 'POST',
      path: '/refunds',
      statusCode: 429,
      latencyMs: 18,
      consumerName: 'Northwind',
      keyPrefix: 'kly_live_free01',
      version: 'v2.3.0',
      region: 'Tokyo',
      ipAddress: '133.242.18.9',
      requestHeaders: {
        'Authorization': 'Bearer kly_live_free01...'
      },
      queryParams: {},
      requestBody: JSON.stringify({ charge_id: 'ch_8819', amount_cents: 1200 }),
      responseHeaders: { 'Retry-After': '12', 'Content-Type': 'application/json' },
      responseBody: JSON.stringify({ error: 'Rate limit quota exceeded for Free plan (20 req/min)', retry_after: 12 }),
      trace: [
        { stage: 'Gateway Ingress', durationMs: 5 },
        { stage: 'Auth & Quota Inspection', durationMs: 12 },
        { stage: 'Rate Limit Blocked (429)', durationMs: 1 }
      ]
    },
    {
      id: 'req-88915',
      timestamp: new Date(now - 48000).toISOString(),
      method: 'POST',
      path: '/generate',
      statusCode: 500,
      latencyMs: 1240,
      consumerName: 'Acme Robotics',
      keyPrefix: 'kly_live_8f2a',
      version: 'v2.4.1',
      region: 'Singapore',
      ipAddress: '103.24.182.11',
      requestHeaders: { 'Authorization': 'Bearer kly_live_8f2a...' },
      queryParams: {},
      requestBody: JSON.stringify({ prompt: 'Ultra wide panorama 32k render complex scene' }),
      responseHeaders: { 'Content-Type': 'application/json' },
      responseBody: JSON.stringify({ error: 'Upstream GPU worker timeout after 1200ms', code: 'CUDA_OOM' }),
      trace: [
        { stage: 'Gateway Ingress', durationMs: 8 },
        { stage: 'Upstream Proxy', durationMs: 1224 },
        { stage: 'Gateway 500 Handler', durationMs: 8 }
      ]
    },
    {
      id: 'req-88916',
      timestamp: new Date(now - 62000).toISOString(),
      method: 'GET',
      path: '/health',
      statusCode: 200,
      latencyMs: 14,
      consumerName: 'Synthetic Probe (Klyra Edge)',
      keyPrefix: 'internal',
      version: 'v2.4.1',
      region: 'Singapore',
      ipAddress: '127.0.0.1',
      requestHeaders: { 'User-Agent': 'Klyra-Health-Daemon/2.0' },
      queryParams: {},
      requestBody: '',
      responseHeaders: { 'Content-Type': 'application/json' },
      responseBody: JSON.stringify({ status: 'healthy' }),
      trace: [
        { stage: 'Direct Probe', durationMs: 14 }
      ]
    }
  ];
}

export function getMockInsights(project: ProviderProject): KlyraInsightItem[] {
  return [
    {
      id: 'ins-1',
      category: 'Performance',
      severity: 'warning',
      title: 'Latency Spike on POST /generate',
      description: 'Average latency increased by +18% over the last 24 hours (184ms → 421ms p95). Upstream GPU inference queue is showing contention.',
      actionText: 'Investigate endpoint',
      actionType: 'navigate_tab',
      targetTab: 'api'
    },
    {
      id: 'ins-2',
      category: 'Usage',
      severity: 'warning',
      title: '3 Consumers Approaching Quota Limits',
      description: 'Acme Robotics and 2 other consumers have utilized >85% of their monthly request ceiling. They are prime candidates for plan upgrades.',
      actionText: 'View consumers',
      actionType: 'navigate_tab',
      targetTab: 'consumers'
    },
    {
      id: 'ins-3',
      category: 'Business',
      severity: 'info',
      title: 'Pro & Business Tiers Drive 84% of Revenue',
      description: 'Subscribers on paid plans account for $4,041 of your $4,820 MRR with 99.4% retention over 60 days.',
      actionText: 'View analytics',
      actionType: 'navigate_tab',
      targetTab: 'analytics'
    },
    {
      id: 'ins-4',
      category: 'Version',
      severity: 'warning',
      title: '1,284 Consumers Still Active on Deprecated v2.3.0',
      description: 'v2.4.1 has 14% fewer client errors and 30% faster execution. Trigger the automated consumer migration workflow to transition them.',
      actionText: 'Start migration',
      actionType: 'open_modal',
      targetTab: 'versions'
    },
    {
      id: 'ins-5',
      category: 'Security',
      severity: 'critical',
      title: 'Spike in 429 Rate Limit Hits from Key Prefix kly_live_free01',
      description: 'Over 4,200 requests throttled in the last 2 hours. Ensure this consumer is not stuck in an infinite retry loop.',
      actionText: 'Audit API key',
      actionType: 'navigate_tab',
      targetTab: 'keys'
    },
    {
      id: 'ins-6',
      category: 'Revenue',
      severity: 'success',
      title: 'API Revenue Increased +8.7% This Month',
      description: 'New subscriptions from AI startups boosted Monthly Recurring Revenue to $4,820 with an ARPU of $12.40.',
      actionText: 'Inspect plans',
      actionType: 'navigate_tab',
      targetTab: 'plans'
    }
  ];
}

export function getMockIncidents(project: ProviderProject): MonitoringIncident[] {
  return [
    {
      id: 'inc-01',
      title: 'Elevated Latency on POST /generate',
      severity: 'Minor',
      status: 'Resolved',
      startedAt: 'Today, 14:32 SGT',
      resolvedAt: 'Today, 14:47 SGT',
      durationMinutes: 15,
      affectedEndpoints: ['POST /generate'],
      summary: 'GPU cluster auto-scaling delay caused queued image generation requests to experience temporary latency spikes up to 820ms.',
      postmortem: 'Worker pre-warming threshold lowered from 80% to 65% capacity. Zero requests dropped.'
    },
    {
      id: 'inc-02',
      title: 'Upstream Origin Gateway 502 Errors',
      severity: 'Major',
      status: 'Resolved',
      startedAt: '3 days ago, 02:15 SGT',
      resolvedAt: '3 days ago, 02:29 SGT',
      durationMinutes: 14,
      affectedEndpoints: ['ALL'],
      summary: 'Upstream cloud provider network maintenance caused intermittent connection timeouts.',
      postmortem: 'Failover edge caching policy deployed.'
    }
  ];
}

export function getMockAlertRules(): AlertRule[] {
  return [
    {
      id: 'alt-1',
      name: 'High P95 Latency Alert',
      metric: 'p95_latency',
      condition: '>',
      threshold: 500,
      unit: 'ms',
      durationSec: 300,
      channels: ['Slack (#api-alerts)', 'Email (dev@acme.dev)'],
      enabled: true,
      lastTriggered: '3 hours ago'
    },
    {
      id: 'alt-2',
      name: 'Error Rate Spike > 2%',
      metric: 'error_rate',
      condition: '>',
      threshold: 2.0,
      unit: '%',
      durationSec: 120,
      channels: ['PagerDuty', 'Slack (#ops-critical)'],
      enabled: true
    },
    {
      id: 'alt-3',
      name: 'Uptime SLA Breach < 99.9%',
      metric: 'uptime',
      condition: '<',
      threshold: 99.9,
      unit: '%',
      durationSec: 600,
      channels: ['Email (lead@klyra.com)'],
      enabled: true
    }
  ];
}
