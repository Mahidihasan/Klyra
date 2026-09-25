import { Router, Request, Response } from 'express';
import {
  AdminApiListQuery,
  ApiSortField,
  ApiStatusValue,
  isApiSortField,
  isApiStatus,
  ModerateAction,
} from './admin.apis.types';
import { listApis, moderateApi } from './admin.apis.service';
import { getMockReports } from './admin.moderation.mock';
import { PolicyActor } from './admin.users.policy';
import { GuardrailError, DatabaseUnavailableError } from './admin.users.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router({ mergeParams: true });

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 160;

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function parseListQuery(req: Request, res: Response): AdminApiListQuery | null {
  const { search, status, categoryId, sort, direction } = req.query;

  if (status !== undefined && status !== '' && !isApiStatus(status)) {
    fail(res, 400, 'INVALID_STATUS', 'Invalid status filter provided');
    return null;
  }

  let sortField: ApiSortField = 'created';
  if (sort !== undefined && sort !== '') {
    if (!isApiSortField(sort)) {
      fail(res, 400, 'INVALID_SORT', 'Invalid sort field');
      return null;
    }
    sortField = sort;
  }

  const rawSearch = typeof search === 'string' ? search.trim() : '';

  return {
    page: parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER),
    limit: parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    search: rawSearch ? rawSearch.slice(0, MAX_SEARCH_LENGTH) : null,
    status: status ? (status as ApiStatusValue) : null,
    categoryId: typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : null,
    sort: sortField,
    direction: direction === 'asc' ? 'asc' : 'desc',
  };
}

function requireActor(req: Request, res: Response): PolicyActor | null {
  const actorId = req.user?.sub;
  const actorRole = req.user?.role;

  if (!actorId || !actorRole) {
    fail(
      res,
      401,
      'WRITE_REQUIRES_REAL_SESSION',
      'Changing an API requires a signed-in admin.',
    );
    return null;
  }

  if (req.user?.impersonatedBy) {
    fail(
      res,
      403,
      'WRITE_REQUIRES_REAL_SESSION',
      'Account changes cannot be made from an impersonated session.',
    );
    return null;
  }

  return { id: actorId, role: actorRole.toUpperCase() as any };
}

function auditContext(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
  };
}

function handleError(res: Response, label: string, err: unknown) {
  if (err instanceof GuardrailError) {
    return fail(res, 403, err.code, err.message);
  }
  if (err instanceof DatabaseUnavailableError) {
    return fail(res, 503, 'DATABASE_UNAVAILABLE', err.message);
  }
  if (err instanceof Error && err.message === 'API not found') {
    return fail(res, 404, 'NOT_FOUND', 'API not found');
  }

  console.error(`[admin] ${label} failed:`, err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong handling that request.');
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const apis = await prisma.apis.findMany({
      include: {
        users: true,
        categories: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: apis });
  } catch (err) {
    return handleError(res, 'GET /apis', err);
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const { status } = req.body;
    if (!status) {
      return fail(res, 400, 'MISSING_STATUS', 'Status is required');
    }

    const updatedApi = await prisma.apis.update({
      where: { id: req.params.id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'UPDATE',
        entity_type: 'apis',
        entity_id: req.params.id,
        ip_address: req.ip || 'unknown',
        new_values: { status }
      }
    });

    return res.json({ success: true, data: updatedApi });
  } catch (err) {
    return handleError(res, 'PATCH /apis/:id/status', err);
  }
});

router.post('/api-keys/:id/revoke', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const updatedKey = await prisma.api_keys.update({
      where: { id: req.params.id },
      data: { 
        status: 'REVOKED',
        is_active: false,
        revoked_at: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'UPDATE',
        entity_type: 'api_keys',
        entity_id: req.params.id,
        ip_address: req.ip || 'unknown',
        new_values: { status: 'REVOKED' }
      }
    });

    return res.json({ success: true, data: updatedKey });
  } catch (err) {
    return handleError(res, 'POST /api-keys/:id/revoke', err);
  }
});

router.get('/moderation/reports', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    const reports = getMockReports();
    return res.json({ success: true, data: { reports } });
  } catch (err) {
    return handleError(res, 'GET /apis/moderation/reports', err);
  }
});

router.post('/:id/moderate', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const { action, reason } = req.body ?? {};

    if (!['APPROVED', 'REJECTED', 'DEPRECATED', 'CHANGES_REQUESTED', 'WARN', 'QUARANTINE', 'SUSPEND', 'DISMISS'].includes(action)) {
      return fail(res, 400, 'INVALID_ACTION', 'Action must be a valid ModerateAction');
    }

    if (reason !== undefined && typeof reason !== 'string') {
      return fail(res, 400, 'INVALID_REASON', 'reason must be a string when provided.');
    }

    const data = await moderateApi(
      actor,
      req.params.id,
      action as ModerateAction,
      typeof reason === 'string' ? reason.trim().slice(0, 500) || undefined : undefined,
      auditContext(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'POST /apis/:id/moderate', err);
  }
});

export default router;
