import type { RepoDetail, RepoSummary } from '../../types/repos';

// Deliberately kept at the API boundary so the repository screens can be
// developed without starting the Git service. This module is never used in a
// production build (see repos.ts).
const now = new Date().toISOString();
const sha = 'a84f2d91cb4e7f329e6c16f8b2e9d1a4c7f038be';

const repo: RepoDetail = {
  id: 'demo-payments-api', name: 'payments-api', owner_id: 0, owner_username: 'development',
  description: 'A resilient payments API with webhook processing and idempotent requests.',
  visibility: 'private', license: 'MIT', language: 'TypeScript', framework: 'Express',
  default_branch: 'main', deploy_status: 'success', member_count: 3,
  created_at: now, updated_at: now, role: 'owner',
  collaborators: [
    { user_id: 0, username: 'development', display_name: 'Development Access', avatar_color: '#8b5cf6', role: 'owner' },
    { user_id: 1, username: 'maya', display_name: 'Maya Chen', avatar_color: '#22c55e', role: 'maintainer' },
    { user_id: 2, username: 'sam', display_name: 'Sam Rivera', avatar_color: '#f59e0b', role: 'developer' },
  ],
  branches: [{ name: 'main', sha }, { name: 'feature/refunds', sha: 'c21e8a9df01b362f9bb3d9a7e6c0a1c5e4b8d2f7' }],
};

// Additional demo repositories so the list screen has content to show.
// They reuse the shared commits/tree fixtures below so every tab stays populated.
const extraRepos: RepoDetail[] = [
  {
    id: 'demo-inventory-service', name: 'inventory-service', owner_id: 0, owner_username: 'development',
    description: 'Stock tracking service with low-stock alerts and warehouse sync.',
    visibility: 'public', license: 'Apache-2.0', language: 'Go', framework: 'Gin',
    default_branch: 'main', deploy_status: 'running', member_count: 2,
    created_at: now, updated_at: now, role: 'owner',
    collaborators: [
      { user_id: 0, username: 'development', display_name: 'Development Access', avatar_color: '#8b5cf6', role: 'owner' },
      { user_id: 1, username: 'maya', display_name: 'Maya Chen', avatar_color: '#22c55e', role: 'developer' },
    ],
    branches: [{ name: 'main', sha }],
  },
  {
    id: 'demo-auth-gateway', name: 'auth-gateway', owner_id: 0, owner_username: 'development',
    description: 'Centralized auth gateway issuing short-lived JWTs with refresh rotation.',
    visibility: 'private', license: 'MIT', language: 'Python', framework: 'FastAPI',
    default_branch: 'main', deploy_status: 'failed', member_count: 4,
    created_at: now, updated_at: now, role: 'maintainer',
    collaborators: [
      { user_id: 0, username: 'development', display_name: 'Development Access', avatar_color: '#8b5cf6', role: 'owner' },
      { user_id: 2, username: 'sam', display_name: 'Sam Rivera', avatar_color: '#f59e0b', role: 'maintainer' },
      { user_id: 3, username: 'ana', display_name: 'Ana Petrova', avatar_color: '#ec4899', role: 'developer' },
    ],
    branches: [{ name: 'main', sha }, { name: 'feature/refresh-rotation', sha: '9d4b1c77aa02f5e8b3c1d6a4f0e7b9c2d5a8f134' }],
  },
];

const allRepos = [repo, ...extraRepos];
const findRepo = (id: string) => allRepos.find(r => r.id === id);

const commits = [
  { sha, message: 'Add idempotent payment creation', author: 'maya', email: 'maya@example.test', date: now },
  { sha: 'c21e8a9df01b362f9bb3d9a7e6c0a1c5e4b8d2f7', message: 'Document refund workflow', author: 'sam', email: 'sam@example.test', date: now },
];
const minutesAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();
const tree: Record<string, any[]> = {
  '': [
    { mode: '040000', type: 'tree', sha, path: 'src', last_commit_message: 'Add idempotent payment creation', last_commit_author: 'maya', last_updated: minutesAgo(35) },
    { mode: '040000', type: 'tree', sha, path: 'docs', last_commit_message: 'Document refund workflow', last_commit_author: 'sam', last_updated: minutesAgo(180) },
    { mode: '100644', type: 'blob', sha, path: 'README.md', size: 1280, last_commit_message: 'Update quick start guide', last_commit_author: 'maya', last_updated: minutesAgo(600) },
    { mode: '100644', type: 'blob', sha, path: 'package.json', size: 640, last_commit_message: 'Add zod request validation', last_commit_author: 'sam', last_updated: minutesAgo(1500) },
  ],
  src: [
    { mode: '100644', type: 'blob', sha, path: 'server.ts', size: 920, last_commit_message: 'Add /health readiness endpoint', last_commit_author: 'maya', last_updated: minutesAgo(35) },
    { mode: '100644', type: 'blob', sha, path: 'payments.ts', size: 1840, last_commit_message: 'Add idempotent payment creation', last_commit_author: 'maya', last_updated: minutesAgo(35) },
  ],
  docs: [
    { mode: '100644', type: 'blob', sha, path: 'api.md', size: 820, last_commit_message: 'Document refund workflow', last_commit_author: 'sam', last_updated: minutesAgo(180) },
    { mode: '100644', type: 'blob', sha, path: 'webhooks.md', size: 560, last_commit_message: 'Clarify signature verification', last_commit_author: 'sam', last_updated: minutesAgo(2400) },
  ],
};
const files: Record<string, string> = {
  'README.md': '# Payments API\n\nCreate payments, receive webhook events, and issue refunds.\n\n## Quick start\n\nSet `PAYMENTS_API_KEY`, then call `POST /v1/payments`.\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Endpoints\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | `/v1/health` | Service health check |\n| POST | `/v1/payments` | Create a payment |\n| POST | `/v1/refunds` | Issue a refund |\n\nAll requests require a `Authorization: Bearer <key>` header.',
  'src/server.ts': `import express from 'express';
import { createPayment, getPayment } from './payments';
import { requireAuth, verifyWebhookSignature } from './middleware';

const app = express();
app.use(express.json());

// Health probe used by the deploy pipeline.
app.get('/v1/health', (_, res) => {
  res.json({ ok: true, version: process.env.npm_package_version });
});

// Create a payment. Amount is in the smallest currency unit (cents).
app.post('/v1/payments', requireAuth, async (req, res) => {
  const { amount, currency, metadata } = req.body;

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive integer' });
  }

  try {
    const payment = await createPayment(amount, currency, metadata);
    return res.status(201).json(payment);
  } catch (err) {
    console.error('payment failed', err);
    return res.status(502).json({ error: 'payment provider unavailable' });
  }
});

// Webhooks are verified with the shared signing secret.
app.post('/v1/webhooks', verifyWebhookSignature, (req, res) => {
  const event = req.body;
  console.log('received event', event.type);
  res.status(202).json({ received: true });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(\`payments-api listening on \${port}\`));
`,
  'src/payments.ts': `import { randomUUID } from 'crypto';

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
  metadata?: Record<string, string>;
}

// In-memory store — swap for the real ledger in production.
const store = new Map<string, Payment>();

/**
 * Creates a payment. Idempotent: posting the same idempotency key
 * twice returns the original payment instead of double-charging.
 */
export async function createPayment(
  amount: number,
  currency: string,
  metadata?: Record<string, string>,
  idempotencyKey?: string,
): Promise<Payment> {
  if (idempotencyKey && store.has(idempotencyKey)) {
    return store.get(idempotencyKey)!;
  }

  const payment: Payment = {
    id: \`pay_\${randomUUID()}\`,
    amount,
    currency: currency.toLowerCase(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    metadata,
  };

  store.set(idempotencyKey ?? payment.id, payment);
  return payment;
}

export function getPayment(id: string): Payment | undefined {
  return store.get(id);
}
`,
  'docs/api.md': '# API reference\n\n## Create a payment\n\n`POST /v1/payments` creates an idempotent payment request.\n\n```json\n{\n  "amount": 1999,\n  "currency": "usd",\n  "metadata": { "orderId": "ord_42" }\n}\n```\n\nReturns `201` with the payment object, or `400` on validation errors.',
  'docs/webhooks.md': '# Webhooks\n\nVerify the `x-signature` header before processing events.\n\nEvents are signed with HMAC-SHA256 using your webhook secret. Reject any request whose timestamp is older than five minutes.',
  'package.json': `{
  "name": "payments-api",
  "version": "1.2.0",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "express": "^5.0.0",
    "zod": "^3.0.0"
  }
}`,
};
const pr: any = { id: 'pr-1', number: 12, title: 'Add refund endpoint', body: 'Adds a safe, idempotent refund operation.', source_branch: 'feature/refunds', target_branch: 'main', author_username: 'sam', status: 'open', created_at: now, ahead: 2, behind: 0, diff: '@@ -1,2 +1,6 @@\n+app.post(\'/v1/refunds\', createRefund);', reviews: [{ reviewer_username: 'maya', state: 'approved', body: 'Looks good.', created_at: now, avatar_color: '#22c55e' }], comments: [], secret_findings: [] };
const issue: any = { id: 'issue-1', number: 7, title: 'Add webhook retry guidance', body: 'Document retry timing and event de-duplication.', author_username: 'maya', status: 'open', created_at: now, comments: [{ author_username: 'sam', body: 'I can take this one.', created_at: now, avatar_color: '#f59e0b' }] };
const release: any = { id: 'release-1', tag_name: 'v1.2.0', name: 'Payments API 1.2', notes: 'Adds idempotent payment creation.', prerelease: false, status: 'published', latest: true, created_by_username: 'development', created_at: now };

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const idFrom = (path: string) => path.split('/')[2];

export async function developmentRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const clean = path.split('?')[0];
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(String(options.body)) : {};

  if (clean === '/repos' && method === 'GET') return copy(allRepos) as T;
  if (clean === '/repos' && method === 'POST') return { id: repo.id } as T;
  if (/^\/repos\/[^/]+$/.test(clean) && method === 'GET' && findRepo(clean.split('/')[2])) return copy(findRepo(clean.split('/')[2])!) as T;
  if (/^\/repos\/[^/]+$/.test(clean) && method === 'PATCH' && findRepo(clean.split('/')[2])) return copy(Object.assign(findRepo(clean.split('/')[2])!, body)) as T;
  if (clean.endsWith('/overview')) return copy({ readme: files['README.md'], latest_commit: commits[0], commit_count: 24, branch_count: 2, tag_count: 1, contributors: [{ id: 0, username: 'development', display_name: 'Development Access', avatar_color: '#8b5cf6', commits: 12 }, { id: 1, username: 'maya', display_name: 'Maya Chen', avatar_color: '#22c55e', commits: 8 }, { id: 2, username: 'sam', display_name: 'Sam Rivera', avatar_color: '#f59e0b', commits: 4 }], open_pull_requests: 1, open_issues: 1, endpoint_count: 4, releases_published: 1, latest_release: release, build_status: 'success', test_status: 'success', deploy_status: 'success', detect_updated_at: now }) as T;
  if (clean.endsWith('/branches')) return copy([{ name: 'main', sha, protected: true, ahead: 0, behind: 0, latest_commit: commits[0] }, { name: 'feature/refunds', sha: commits[1].sha, protected: false, ahead: 2, behind: 0, latest_commit: commits[1] }]) as T;
  if (clean.includes('/commits/') && !clean.endsWith('/commits')) return copy({ ...(commits.find(c => clean.endsWith(c.sha)) || commits[0]), patch: pr.diff }) as T;
  if (clean.endsWith('/commits')) return copy({ ref: 'main', commits, total: commits.length }) as T;
  if (clean.endsWith('/tree')) { const p = new URLSearchParams(path.split('?')[1]).get('path') || ''; return copy({ entries: tree[p] || [], latest_commit: commits[0] }) as T; }
  if (clean.endsWith('/file')) { const p = new URLSearchParams(path.split('?')[1]).get('path') || ''; return copy({ content: files[p] || '', history: commits, latest_commit: commits[0] }) as T; }
  if (clean.endsWith('/pulls')) return copy([pr]) as T;
  if (/\/pulls\/\d+$/.test(clean)) return copy(pr) as T;
  if (clean.endsWith('/issues')) return copy([{ ...issue, comments: undefined }]) as T;
  if (/\/issues\/\d+$/.test(clean)) return copy(issue) as T;
  if (clean.endsWith('/collaborators')) return copy(repo.collaborators) as T;
  if (clean.endsWith('/api') || clean.endsWith('/detect')) {
    const detection = { framework: 'Express', language: 'TypeScript', detectedAt: now, endpoints: [{ method: 'GET', path: '/health', sourceFile: 'src/server.ts', line: 5 }, { method: 'POST', path: '/v1/payments', sourceFile: 'src/payments.ts', line: 12 }], openapi: { file: 'docs/api.md', title: 'Payments API', version: '1.2.0' }, authRequirements: ['Bearer token', 'Webhook signature'], envVariables: [{ name: 'PAYMENTS_API_KEY', example: 'pk_test_…' }], dependencies: { express: '^5.0.0', zod: '^3.0.0' }, secrets: [], scannedFiles: 12 };
    return copy(clean.endsWith('/detect') ? detection : { detected: detection, manual: { framework: 'Express', language: 'TypeScript' } }) as T;
  }
  if (clean.endsWith('/ci/runs')) return copy([{ id: 'ci-1', type: 'test', status: 'success', log: 'Tests: 18 passed', summary: '18 tests passed', branch: 'main', commit_sha: sha, started_at: now, finished_at: now }]) as T;
  if (clean.includes('/ci/')) return copy({ id: 'ci-1', type: 'test', status: 'success', log: 'Tests: 18 passed', summary: '18 tests passed', started_at: now, finished_at: now }) as T;
  if (clean.endsWith('/releases')) return copy({ releases: [release], tags: [{ name: 'v1.2.0', sha, date: now }] }) as T;
  if (clean.endsWith('/deployments')) return copy([{ id: 'deployment-1', release_tag: 'v1.2.0', environment: 'production', status: 'success', log: 'Deployment complete', created_at: now }]) as T;
  if (clean.endsWith('/marketplace')) return copy([{ id: 'listing-1', release_id: release.id, release_tag: release.tag_name, name: 'Payments API', tagline: 'Reliable payment primitives', description: 'Create and manage payments.', category: 'payments', pricing_type: 'free', price_cents: 0, docs_url: '', requirements: '', status: 'published', created_at: now }]) as T;
  if (clean.endsWith('/tags')) return copy([{ name: 'v1.2.0', sha, date: now }]) as T;
  if (clean.endsWith('/activity')) return copy([
    { id: 'act-1', type: 'push', actor_username: 'maya', payload: { branch: 'main', message: 'Add idempotent payment creation' }, created_at: now },
    { id: 'act-2', type: 'pr_merged', actor_username: 'sam', payload: { title: 'Add refund endpoint' }, created_at: now },
    { id: 'act-3', type: 'release_published', actor_username: 'development', payload: { tag_name: 'v1.2.0', name: 'Payments API 1.2' }, created_at: now },
    { id: 'act-4', type: 'issue_opened', actor_username: 'maya', payload: { title: 'Add webhook retry guidance' }, created_at: now },
    { id: 'act-5', type: 'detection_run', actor_username: 'development', payload: { endpoints: 4, framework: 'Express' }, created_at: now },
  ]) as T;
  // Mutations intentionally resolve in dev so dialogs and status transitions are easy to exercise.
  return (method === 'POST' ? { id: `dev-${idFrom(clean)}`, ok: true, status: 'success' } : undefined) as T;
}
