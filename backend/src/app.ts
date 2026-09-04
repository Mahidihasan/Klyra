import express from 'express';

import billingRouter from './modules/billing/billing.routes';
import playgroundRouter from './modules/playground/playground.routes';
import { authOptional } from './modules/repos/auth.service';
import { gitHttpHandler } from './modules/repos/git.http';
import reposRouter from './modules/repos/repos.routes';

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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-marketplace-backend' });
});

// Playground routes
app.use('/api/playground', playgroundRouter);

// Billing routes
app.use('/api/billing', billingRouter);

// API Repository system (repos, branches, PRs, issues, releases, CI, marketplace)
app.use('/api', authOptional, reposRouter);

export default app;
