/**
 * Admin platform-overview routes.
 *
 * Mounted at /api/v1/admin (see app.ts). The /v1 prefix follows the documented
 * base URL in docs/architecture/api-design.md; the older modules predate it.
 *
 * Response envelope matches the rest of the backend:
 *   success -> { success: true, data }
 *   failure -> { success: false, error: { code, message } }
 */

import { Router, Request, Response, NextFunction } from 'express';

import { getOverviewStats, getPlatformMetrics, getTrafficSeries } from './admin.service';
import { isTrafficRange, TrafficRange } from './admin.types';
import adminUsersRouter from './admin.users.routes';
import adminApisRouter from './admin.apis.routes';
import { adminMarketplaceRouter } from './admin.marketplace.routes';
import { adminRevenueRouter } from './admin.revenue.routes';
import { adminSubscriptionsRouter } from './admin.subscriptions.routes';
import { adminUsageRouter } from './admin.usage.routes';
import { PlatformController } from './controllers/PlatformController';
import { QueueController } from './controllers/QueueController';

const router = Router();

/** Roles permitted to read platform-wide admin data. */
const ADMIN_ROLES = new Set(['ADMIN', 'MODERATOR']);

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

/**
 * Require an admin caller.
 *
 * `req.user` is the decoded JWT (see modules/auth/auth.middleware.ts), which
 * carries `role` from the `users.role` enum. It is only populated when a valid
 * bearer token was sent, so this denies by default and offers a dev-only
 * escape hatch — the same shape as the existing hatch in billing.routes.ts.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;

  if (role) {
    if (!ADMIN_ROLES.has(role.toUpperCase())) {
      return fail(res, 403, 'FORBIDDEN', 'Admin role required');
    }
    return next();
  }

  if (process.env.NODE_ENV !== 'production') {
    const devRole =
      (req.query.role as string | undefined) ?? (req.header('x-klyra-role') || undefined);

    if (devRole && ADMIN_ROLES.has(devRole.toUpperCase())) {
      return next();
    }

    return fail(
      res,
      401,
      'UNAUTHORIZED',
      'Not authenticated. In development, pass ?role=ADMIN or an x-klyra-role header.',
    );
  }

  return fail(res, 401, 'UNAUTHORIZED', 'Not authenticated');
}

/** Shared range parsing so all three endpoints reject bad input identically. */
function parseRange(req: Request, res: Response): TrafficRange | null {
  const raw = req.query.range;
  if (raw === undefined) return '24h';

  if (!isTrafficRange(raw)) {
    fail(res, 400, 'INVALID_RANGE', 'range must be one of: 24h, 7d, 30d');
    return null;
  }

  return raw;
}

router.use(requireAdmin);

// ============ User management (/api/v1/admin/users/...) ============
// Mounted below requireAdmin so the users routes inherit the same gate.
router.use('/users', adminUsersRouter);

// ============ API management (/api/v1/admin/apis/...) ============
import apisRouter from './admin.apis.routes';
router.use('/apis', apisRouter);

import { adminActivityRouter } from './admin.activity.routes';

router.use('/marketplace', adminMarketplaceRouter);
router.use('/revenue', adminRevenueRouter);
router.use('/subscriptions', adminSubscriptionsRouter);
router.use('/usage', adminUsageRouter);
router.use('/activity', adminActivityRouter);

import { adminSettingsRouter } from './admin.settings.routes';
router.use('/settings', adminSettingsRouter);

import { adminSecurityRouter } from './admin.security.routes';
router.use('/security', adminSecurityRouter);

import { adminFinancesRouter } from './admin.finances.routes';
router.use('/finances', adminFinancesRouter);

// ============ Platform Overview (everything the screen needs) ============
router.post('/platform/acknowledge-alerts', PlatformController.acknowledgeAlerts);
router.get('/platform/export-metrics', PlatformController.exportMetrics);
router.post('/platform/toggle-maintenance', PlatformController.toggleMaintenance);
router.get('/platform/top-apis', PlatformController.getTopApis);

// ============ Job Queue (/api/v1/admin/queue/...) ============
router.get('/queue/active-tasks', QueueController.getActiveTasks);

// GET /api/v1/admin/overview/stats?range=24h
router.get('/overview/stats', async (req: Request, res: Response) => {
  try {
    const range = parseRange(req, res);
    if (!range) return;

    const data = await getOverviewStats(range);

    // The payload is a point-in-time snapshot; caching it would defeat the
    // dashboard's background refresh.
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] GET /overview/stats failed:', err);
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load platform overview');
  }
});

// ============ Traffic series only (lighter poll for the chart) ============
// GET /api/v1/admin/overview/traffic?range=7d
router.get('/overview/traffic', async (req: Request, res: Response) => {
  try {
    const range = parseRange(req, res);
    if (!range) return;

    const data = await getTrafficSeries(range);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] GET /overview/traffic failed:', err);
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load traffic series');
  }
});

// ============ KPI metrics only ============
// GET /api/v1/admin/overview/metrics?range=24h
router.get('/overview/metrics', async (req: Request, res: Response) => {
  try {
    const range = parseRange(req, res);
    if (!range) return;

    const data = await getPlatformMetrics(range);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[admin] GET /overview/metrics failed:', err);
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load platform metrics');
  }
});

export default router;
