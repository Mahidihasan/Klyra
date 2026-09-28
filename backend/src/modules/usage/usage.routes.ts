// Usage HTTP layer.
//
// Every route is behind requireAuth and takes the user id from the JWT subject.
// There is no ?userId= fallback: this router previously accepted one whenever a
// token was absent, which meant anyone could read anyone else's API traffic —
// which endpoints they call, how often, and their error rates — by putting a
// uuid in the query string. The identity is not the caller's to choose.

import { Router, Request, Response } from 'express';

import { requireAuth } from '../auth/auth.middleware';

import { usageService, MAX_HISTORY_LIMIT } from './usage.service';
import { UsageErrorCode, UsagePeriod } from './usage.types';

const router = Router();

const STATUS_BY_CODE: Record<UsageErrorCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_QUERY: 400,
  INTERNAL_ERROR: 500,
};

function fail(res: Response, code: UsageErrorCode, message: string) {
  return res.status(STATUS_BY_CODE[code]).json({ success: false, error: { code, message } });
}

/**
 * Logs the real error and tells the client nothing about it.
 *
 * `err.message` used to go straight back in the response, which handed database
 * error strings to the browser.
 */
function handleError(res: Response, error: unknown, context: string) {
  console.error(`[usage] ${context}:`, error);
  return fail(res, 'INTERNAL_ERROR', 'Something went wrong loading your usage.');
}

/** requireAuth guarantees req.user; this keeps the assertion in one place. */
function userIdOf(req: Request): string {
  return req.user!.sub;
}

const isValidPeriod = (value: unknown): value is UsagePeriod =>
  value === '7d' || value === '30d' || value === '90d';

/**
 * An absent period defaults to 30d, but a *wrong* one is refused rather than
 * silently defaulted — a typo that quietly returns different numbers is worse
 * than an error.
 */
function readPeriod(req: Request): UsagePeriod | null {
  const raw = req.query.period;
  if (raw === undefined) return '30d';
  return isValidPeriod(raw) ? raw : null;
}

router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const period = readPeriod(req);
    if (!period) return fail(res, 'INVALID_QUERY', 'period must be 7d, 30d or 90d.');

    return res.json({ success: true, data: await usageService.getOverview(userIdOf(req), period) });
  } catch (error) {
    return handleError(res, error, 'GET /overview');
  }
});

router.get('/daily', requireAuth, async (req: Request, res: Response) => {
  try {
    const period = readPeriod(req);
    if (!period) return fail(res, 'INVALID_QUERY', 'period must be 7d, 30d or 90d.');

    return res.json({ success: true, data: await usageService.getDailyUsage(userIdOf(req), period) });
  } catch (error) {
    return handleError(res, error, 'GET /daily');
  }
});

router.get('/by-api', requireAuth, async (req: Request, res: Response) => {
  try {
    const period = readPeriod(req);
    if (!period) return fail(res, 'INVALID_QUERY', 'period must be 7d, 30d or 90d.');

    return res.json({ success: true, data: await usageService.getByApi(userIdOf(req), period) });
  } catch (error) {
    return handleError(res, error, 'GET /by-api');
  }
});

router.get('/top-endpoints', requireAuth, async (req: Request, res: Response) => {
  try {
    const period = readPeriod(req);
    if (!period) return fail(res, 'INVALID_QUERY', 'period must be 7d, 30d or 90d.');

    return res.json({
      success: true,
      data: await usageService.getTopEndpoints(userIdOf(req), period),
    });
  } catch (error) {
    return handleError(res, error, 'GET /top-endpoints');
  }
});

router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const period = readPeriod(req);
    if (!period) return fail(res, 'INVALID_QUERY', 'period must be 7d, 30d or 90d.');

    const { page, limit } = req.query;

    if (page !== undefined && (!Number.isFinite(Number(page)) || Number(page) < 1)) {
      return fail(res, 'INVALID_QUERY', 'page must be a positive number.');
    }
    // The service clamps too; this refuses rather than silently shrinking, so a
    // caller asking for 5,000 rows learns that it did not get them.
    if (limit !== undefined) {
      const asNumber = Number(limit);
      if (!Number.isFinite(asNumber) || asNumber < 1) {
        return fail(res, 'INVALID_QUERY', 'limit must be a positive number.');
      }
      if (asNumber > MAX_HISTORY_LIMIT) {
        return fail(res, 'INVALID_QUERY', `limit cannot exceed ${MAX_HISTORY_LIMIT}.`);
      }
    }

    const data = await usageService.getRequestLog(
      userIdOf(req),
      period,
      page === undefined ? 1 : Number(page),
      limit === undefined ? 20 : Number(limit),
    );

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'GET /history');
  }
});

export default router;
