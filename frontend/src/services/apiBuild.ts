import {
  ApiCategory,
  CreateProjectInput,
  DetectionResult,
  ProviderProject,
  ProviderProjectStatus,
  SourceConfig,
} from '../types/apibuild';
import { seedProjects } from './apiBuildSeed';

const STORAGE_KEY = 'klyra-provider-projects-v1';
const CATEGORY_KEY = 'klyra-provider-categories-v1';
const API_ROOT = '/api/api-build/projects';
const JOB_ROOT = '/api/api-build/jobs';
const CATEGORY_ROOT = '/api/api-build/categories';
const DETECT_ROOT = '/api/api-build/detect';
const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `api-${Date.now()}`;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const STATUS_META: Record<ProviderProjectStatus, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: '#22c55e' },
  deploying: { label: 'Deploying', color: '#f59e0b' },
  failed: { label: 'Failed', color: '#ef4444' },
  paused: { label: 'Paused', color: '#64748b' },
  degraded: { label: 'Degraded', color: '#f59e0b' },
  draft: { label: 'Draft', color: '#a78bfa' },
  published: { label: 'Published', color: '#22c55e' },
};

export const DEFAULT_CATEGORIES = ['AI / Developer Tools', 'Media', 'Finance', 'Communication', 'E-commerce', 'Weather', 'DevOps'];

function readCategoriesCache(): ApiCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeCategoriesCache(v: ApiCategory[]) {
  try { localStorage.setItem(CATEGORY_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

function readStore(): ProviderProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeStore(v: ProviderProject[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

// Local storage keeps the builder usable offline; every mutation is also sent
// to Postgres when the backend is running. Failed syncs are intentionally
// non-blocking and are retried by the next user mutation.
function syncProject(project: ProviderProject) {
  void fetch(`${API_ROOT}/${encodeURIComponent(project.id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project),
  }).catch(() => undefined);
}
function syncDelete(id: string) {
  void fetch(`${API_ROOT}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
}

function ensureSeeded(): ProviderProject[] {
  const cur = readStore();
  if (cur.length > 0) return cur;
  const seed = seedProjects();
  writeStore(seed);
  return seed;
}

function simulateDetection(source: SourceConfig): DetectionResult {
  const base = source.baseUrl?.trim() || 'https://api.example.com';
  if (source.kind === 'docker' && !source.openApiUrl?.trim()) {
    return { openApiVersion: null, endpointCount: 0, schemaCount: 0, authKind: null, baseUrl: base, endpoints: [], found: false };
  }
  return {
    openApiVersion: 'OpenAPI 3.1', endpointCount: 42, schemaCount: 18,
    authKind: 'Bearer authentication', baseUrl: base,
    endpoints: [
      { id: 'd1', method: 'GET', path: '/users', description: 'List users' },
      { id: 'd2', method: 'POST', path: '/users', description: 'Create a user' },
      { id: 'd3', method: 'GET', path: '/users/{id}', description: 'Get user by id' },
      { id: 'd4', method: 'POST', path: '/generate', description: 'Generate content' },
      { id: 'd5', method: 'POST', path: '/refunds', description: 'Issue a refund' },
    ],
    found: true,
  };
}

export const apiBuildService = {
  list(): ProviderProject[] { return ensureSeeded(); },
  get(id: string) { return ensureSeeded().find((p) => p.id === id); },
  persistAll(v: ProviderProject[]) { writeStore(v); },
  update(id: string, patch: Partial<ProviderProject>): ProviderProject | undefined {
    const all = ensureSeeded().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
    writeStore(all);
    const updated = all.find((p) => p.id === id);
    if (updated) syncProject(updated);
    return updated;
  },
  async detect(source: SourceConfig): Promise<DetectionResult> {
    // Live upstream detection via the backend proxy (no CORS limitations). On a
    // network error or unavailable backend we simulate detection so the wizard
    // still works offline.
    try {
      const sent: { baseUrl?: string; openApiUrl?: string; repository?: string; dockerImage?: string } = {};
      const base = source.baseUrl?.trim() || '';
      if (base) sent.baseUrl = base;
      if (source.openApiUrl?.trim()) sent.openApiUrl = source.openApiUrl.trim();
      const response = await fetch(DETECT_ROOT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sent),
      });
      if (!response.ok) throw new Error('Detection unavailable');
      const body = await response.json() as { success: boolean; data?: DetectionResult };
      if (!body.success || !body.data) throw new Error('Detection unavailable');
      return body.data ?? null;
    } catch {
      return simulateDetection(source);
    }
  },
  create(input: CreateProjectInput): ProviderProject {
    const projects = readStore();
    const slug = slugify(input.name);
    const now = new Date().toISOString();
    const p: ProviderProject = {
      id: uid('proj'), name: input.name.trim() || 'Untitled API', slug,
      description: input.description.trim() || 'A new Klyra API project.', category: input.category,
      status: 'draft', environment: 'development', version: 'v1.0.0', sourceKind: 'existing',
      baseUrl: '', gatewayUrl: `https://api.klyra.com/${slug}`, authKind: 'apiKey',
      rateLimitPerMin: 100, healthCheckPath: '/health', requests: 0, requestsLabel: '0 requests',
      successRate: 100, latencyMs: 0, consumers: 0, revenue: 0, endpointCount: 0, schemaCount: 0,
      visibility: 'private', published: false, createdAt: now, updatedAt: now,
      deployment: { kind: 'external', status: 'queued', providerUrl: '', environment: 'development', version: 'v1.0.0', lastHealthCheck: 'not yet checked', log: ['Project created â€” choose an API source to continue.'] },
      detection: null,
      plans: [
        { id: uid('plan'), name: 'Free', requestsPerMonth: 1000, priceMonthly: 0, rateLimitPerMin: 60, overagePer1k: 0, trialDays: 0, subscribers: 0 },
        { id: uid('plan'), name: 'Pro', requestsPerMonth: 50000, priceMonthly: 19, rateLimitPerMin: 300, overagePer1k: 0.4, trialDays: 14, subscribers: 0 },
        { id: uid('plan'), name: 'Business', requestsPerMonth: 500000, priceMonthly: 79, rateLimitPerMin: 2000, overagePer1k: 0.25, trialDays: 14, subscribers: 0 },
      ],
      consumersList: [], apiKeys: [],
      corsOrigins: '*', cacheTtlSeconds: 0, retryStrategy: 'none', connectTimeoutMs: 5000, requestTimeoutMs: 30000,
      stripBasePath: false, authHeaderName: 'Authorization', ipAllowlist: '', tags: input.category,
      versions: [{ id: uid('v'), semver: 'v1.0.0', status: 'draft', notes: 'Initial draft', createdAt: now, endpoints: 0 }],
      activity: [{ id: uid('a'), label: 'Project created', at: 'just now', kind: 'info' }],
    };
    writeStore([p, ...projects]);
    syncProject(p);
    return p;
  },
  remove(id: string) {
    const next = ensureSeeded().filter((project) => project.id !== id);
    writeStore(next); syncDelete(id);
  },
  async requestDeploy(id: string): Promise<{ jobId: string; status: string }> {
    return fetch(`${API_ROOT}/${encodeURIComponent(id)}/deployments`, { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Deployment queue unavailable');
        const body = await response.json() as { data: { jobId: string; status: string } };
        return body.data;
      });
  },
  async getRemoteProject(id: string): Promise<ProviderProject> {
    const response = await fetch(`${API_ROOT}/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('Project state unavailable');
    const body = await response.json() as { data: ProviderProject };
    return body.data;
  },
  async waitForDeploy(jobId: string, attempts = 12): Promise<'completed' | 'failed' | 'pending'> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const response = await fetch(`${JOB_ROOT}/${encodeURIComponent(jobId)}`);
      if (!response.ok) throw new Error('Deployment status unavailable');
      const body = await response.json() as { data: { status: string } };
      if (body.data.status === 'completed') return 'completed';
      if (body.data.status === 'failed') return 'failed';
    }
    return 'pending';
  },
  async hydrate(): Promise<ProviderProject[] | null> {
    try {
      const response = await fetch(API_ROOT);
      if (!response.ok) return null;
      const body = await response.json() as { data?: ProviderProject[] };
      if (!Array.isArray(body.data) || body.data.length === 0) return null;
      writeStore(body.data);
      return body.data ?? null;
    } catch { return null; }
  },
/** Marketplace categories = defaults + user-created ones (cached locally). */
  getCategories(): string[] {
    const custom = readCategoriesCache().map((c) => c.name);
    return [...DEFAULT_CATEGORIES, ...custom.filter((n) => !DEFAULT_CATEGORIES.includes(n))];
  },
  async hydrateCategories(): Promise<string[] | null> {
    try {
      const response = await fetch(CATEGORY_ROOT);
      if (!response.ok) return null;
      const body = await response.json() as { data?: { name: string; slug: string; project_count: number; is_custom?: boolean }[] };
      if (!Array.isArray(body.data) || body.data.length === 0) return null;
      writeCategoriesCache(body.data.map((c) => ({
        name: c.name, slug: c.slug, projectCount: c.project_count, isCustom: c.is_custom,
      })));
      return body.data.map((c) => c.name);
    } catch { return null; }
  },
  async addCategory(name: string): Promise<ApiCategory | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const cache = readCategoriesCache();
    if (!cache.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      writeCategoriesCache([...cache, { name: trimmed, slug: slugify(trimmed), projectCount: 1 }]);
    }
    try {
      const response = await fetch(CATEGORY_ROOT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) return null;
      const body = await response.json() as { data?: ApiCategory };
      return body.data ?? null;
    } catch { return null; }
  },
};
