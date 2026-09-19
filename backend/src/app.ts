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
import apiBuildGateway from './modules/api-build/api-build.gateway';
import apiKeysRouter from './modules/api-keys/api-keys.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import certificatesRouter from './modules/certificates/certificates.routes';

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

import authRouter from './modules/auth/auth.routes';

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-marketplace-backend' });
});

// Authentication and Demo Email routes
app.use('/api/auth', authRouter);
app.use('/api/auth/profile/api-keys', apiKeysRouter);

// Playground routes
app.use('/api/playground', playgroundRouter);

// Billing routes
app.use('/api/billing', billingRouter);

// API Build module (projects, endpoints, versions, …) and its dev gateway.
// The gateway answers /api/gateway/{slug}/* — the same path the project's
// gatewayUrl advertises — and forwards to the project's upstream origin.
app.use('/api/api-build', apiBuildRouter);
app.use('/api/gateway', express.json({ limit: '10mb' }), express.urlencoded({ extended: true, limit: '10mb' }), apiBuildGateway);

// Public Marketplace Catalog routes (curated rails, search, filters, API details, reviews, providers, publishing)
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/certificates', certificatesRouter);

// Admin dashboard (platform overview). Registered before the `/api` catch-all
// below so the repos router can't shadow it.
app.use('/api/v1/admin', authOptionalJwt, adminRouter);

// API Repository system (repos, branches, PRs, issues, releases, CI, marketplace)
app.use('/api', authOptional, reposRouter);

export default app;
