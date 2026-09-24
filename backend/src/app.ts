import express from 'express';

import adminRouter from './modules/admin/admin.routes';
// The auth module's authOptional decodes the JWT only — no database round
// trip — so the admin dashboard can still serve its mock fallback when
// Postgres is unreachable. (repos/auth.service exports a same-named middleware
// that DOES hit the database; they are not interchangeable here.)
import { authOptional as authOptionalJwt } from './modules/auth/auth.middleware';
import billingRouter from './modules/billing/billing.routes';
import playgroundRouter from './modules/playground/playground.routes';
import { authOptional } from './modules/repos/auth.service';
import { gitHttpHandler } from './modules/repos/git.http';
import reposRouter from './modules/repos/repos.routes';
import apiBuildRouter from './modules/api-build/api-build.routes';
import providerApisRouter from './modules/provider/apis.routes';
import apiBuildGateway from './modules/api-build/api-build.gateway';
import apiKeysRouter from './modules/api-keys/api-keys.routes';
import walletRouter from './modules/wallet/wallet.routes';
import walletWebhookRouter from './modules/wallet/wallet.webhook';
import usageRouter from './modules/usage/usage.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';

const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Git-Protocol',
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Git Smart HTTP endpoints (git clone/push) — must be registered BEFORE the
// JSON body parser and use raw stream passthrough.
app.use(
  '/api/git/:repoId.git',
  express.raw({ type: '*/*', limit: '500mb' }),
  authOptional,
  (req, res, _next) => {
    void gitHttpHandler(req, res);
  },
);

// Stripe webhook — Stripe signs the unparsed payload, so this must sit above
// express.json(), like the Git Smart HTTP route does.
app.use('/api/wallet/webhook', express.raw({ type: 'application/json' }), walletWebhookRouter);

// The API gateway owns the request stream: it forwards bodies byte-for-byte, so
// Klyra's global body parsers must never read (or reject) a payload that belongs
// to a deployed API. express.json() in its default strict mode answered 400 for
// legal JSON that is not an object or array — which is exactly what a
// specification may declare as a request body — and express.urlencoded()
// rewrote form bodies into JSON. express.raw (mounted on the gateway below)
// reads the untouched stream instead.
const GATEWAY_MOUNT = '/api/gateway';
// Typed structurally: body-parser calls the `type` option with a raw
// IncomingMessage, while the gateway mount receives an express.Request.
const isGatewayRequest = (req: { originalUrl?: string; url?: string }): boolean => {
  const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
  return path === GATEWAY_MOUNT || path.startsWith(`${GATEWAY_MOUNT}/`);
};

app.use(express.json({ limit: '10mb', type: (req) => (isGatewayRequest(req) ? false : 'application/json') }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
    type: (req) => (isGatewayRequest(req) ? false : 'application/x-www-form-urlencoded'),
  }),
);

import authRouter from './modules/auth/auth.routes';
import { checkMaintenanceMode } from './middleware/maintenance.middleware';

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-marketplace-backend' });
});

// Apply Maintenance Gatekeeper globally for all /api routes
app.use('/api', checkMaintenanceMode);

// Authentication and Demo Email routes
app.use('/api/auth', authRouter);
app.use('/api/auth/profile/api-keys', apiKeysRouter);

// Playground routes
app.use('/api/playground', playgroundRouter);

// Billing routes
app.use('/api/billing', billingRouter);
app.use('/api/wallet', walletRouter);
// requireAuth is applied per route inside the router, as the wallet module
// does. authOptional would let an unauthenticated request through, and the
// router used to fall back to a ?userId= query parameter when it did.
app.use('/api/usage', usageRouter);

// API Build module (projects, endpoints, versions, …) and its dev gateway.
// The gateway answers /api/gateway/{slug}/* — the same path the project's
// gatewayUrl advertises — and forwards to the project's upstream origin.
//
// The gateway reads bodies as raw bytes (never as parsed JSON/urlencoded): a
// parsed body is re-encoded before forwarding, and express.json()'s strict mode
// rejected legal payloads (a JSON string body) with Klyra's own 400 before the
// request ever reached the API. express.raw keeps every content type intact —
// which is why the global parsers above skip this path entirely.
app.use('/api/api-build', apiBuildRouter);
app.use(GATEWAY_MOUNT, express.raw({ type: () => true, limit: '25mb' }), apiBuildGateway);

// Public Marketplace Catalog routes (curated rails, search, filters, API details, reviews, providers, publishing)
app.use('/api/v1/catalog', catalogRouter);

// Admin dashboard (platform overview). Registered before the `/api` catch-all
// below so the repos router can't shadow it.
app.use('/api/v1/admin', authOptionalJwt, adminRouter);
app.use('/api/v1/apis', authOptionalJwt, providerApisRouter);

// API Repository system (repos, branches, PRs, issues, releases, CI, marketplace)
app.use('/api', authOptional, reposRouter);

export default app;
