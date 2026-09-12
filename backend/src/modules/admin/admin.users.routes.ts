/**
 * Admin user-management routes.
 *
 * Mounted at /api/v1/admin/users by admin.routes.ts, *after* its `requireAdmin`
 * middleware, so every handler here is already known to be ADMIN or MODERATOR.
 * The finer-grained "may this specific actor do this specific thing" question
 * is answered by admin.users.policy.ts, not here.
 *
 * Reads accept the dev role hatch that requireAdmin allows. Writes do not: that
 * hatch produces a role with no user behind it, so there would be no actor to
 * record in the audit log and no identity to check self-mutation against. An
 * unattributable suspension is worse than a rejected one.
 */

import { Router, Request, Response } from 'express';

import { signJwt } from '../auth/jwt.util';

import { PolicyActor } from './admin.users.policy';
import {
  AuditContext,
  DatabaseUnavailableError,
  getUserProfile,
  getUserDetails,
  updateUserDetails,
  softDeleteUser,
  GuardrailError,
  IMPERSONATION_TTL_SECONDS,
  listUsers,
  prepareImpersonation,
  updateUserRole,
  updateUserStatus,
  UserNotFoundError,
} from './admin.users.service';
import {
  AdminUserListQuery,
  ImpersonationGrant,
  isUserRole,
  isUserSortField,
  isUserStatus,
  isUserStatusFilter,
  isUserSubscriptionTier,
  UserRoleValue,
  UserSortField,
  UserSubscriptionTier,
} from './admin.users.types';

const router = Router({ mergeParams: true });

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
/** Long enough for an email address, short enough that it can't become a payload. */
const MAX_SEARCH_LENGTH = 160;

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

/** Clamp rather than reject: a nonsense page number is a bad link, not an attack. */
function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/**
 * Parse and validate the list query.
 *
 * Returns null after writing a 400 when a value is present but not a member of
 * its vocabulary — silently ignoring an unknown role would show the caller an
 * unfiltered list while their UI insists a filter is on.
 */
function parseListQuery(req: Request, res: Response): AdminUserListQuery | null {
  const { search, role, status, subscriptionTier, sort, direction } = req.query;

  if (role !== undefined && role !== '' && !isUserRole(role)) {
    fail(res, 400, 'INVALID_ROLE', 'role must be one of: USER, PROVIDER, MODERATOR, ADMIN');
    return null;
  }

  if (status !== undefined && status !== '' && !isUserStatusFilter(status)) {
    fail(
      res,
      400,
      'INVALID_STATUS',
      'status must be one of: ACTIVE, INACTIVE, SUSPENDED, BANNED, PENDING',
    );
    return null;
  }

  if (subscriptionTier !== undefined && subscriptionTier !== '' && !isUserSubscriptionTier(subscriptionTier)) {
    fail(
      res,
      400,
      'INVALID_SUBSCRIPTION_TIER',
      'subscriptionTier must be one of: FREE, PRO, ENTERPRISE',
    );
    return null;
  }

  let sortField: UserSortField = 'joined';
  if (sort !== undefined && sort !== '') {
    if (!isUserSortField(sort)) {
      fail(
        res,
        400,
        'INVALID_SORT',
        'sort must be one of: joined, name, email, role, status, apisOwned',
      );
      return null;
    }
    sortField = sort;
  }

  const rawSearch = typeof search === 'string' ? search.trim() : '';

  return {
    page: parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER),
    limit: parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    search: rawSearch ? rawSearch.slice(0, MAX_SEARCH_LENGTH) : null,
    role: role ? (role as UserRoleValue) : null,
    status: status ? (status as AdminUserListQuery['status']) : null,
    subscriptionTier: subscriptionTier ? (subscriptionTier as UserSubscriptionTier) : null,
    sort: sortField,
    direction: direction === 'asc' ? 'asc' : 'desc',
  };
}

/**
 * Resolve the acting admin for a write.
 *
 * `requireAdmin` has already let the request through, but it accepts a
 * development role header that carries no identity. Writes need a real one.
 */
function requireActor(req: Request, res: Response): PolicyActor | null {
  const actorId = req.user?.sub;
  const actorRole = req.user?.role;

  if (!actorId || !actorRole) {
    fail(
      res,
      401,
      'WRITE_REQUIRES_REAL_SESSION',
      'Changing an account requires a signed-in admin. The development role header is read-only.',
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

  const normalised = actorRole.toUpperCase();
  if (!isUserRole(normalised)) {
    fail(res, 403, 'FORBIDDEN', 'Your account role is not recognised.');
    return null;
  }

  return { id: actorId, role: normalised };
}

function auditContext(req: Request): AuditContext {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
  };
}

/** One place to turn a service error into the right status code. */
function handleError(res: Response, label: string, err: unknown) {
  if (err instanceof GuardrailError) {
    return fail(res, 403, err.code, err.message);
  }
  if (err instanceof UserNotFoundError) {
    return fail(res, 404, 'USER_NOT_FOUND', 'That account no longer exists.');
  }
  if (err instanceof DatabaseUnavailableError) {
    return fail(res, 503, 'DATABASE_UNAVAILABLE', err.message);
  }

  console.error(`[admin] ${label} failed:`, err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong handling that request.');
}

// ============================ GET /users ============================
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = parseListQuery(req, res);
    if (!query) return;

    const data = await listUsers(query);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'GET /users', err);
  }
});

// ========================== GET /users/:id ==========================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const data = await getUserProfile(req.params.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'GET /users/:id', err);
  }
});

// ====================== GET /users/:id/details ======================
router.get('/:id/details', async (req: Request, res: Response) => {
  try {
    const data = await getUserDetails(req.params.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'GET /users/:id/details', err);
  }
});

// ===================== PATCH /users/:id/status ======================
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const { status, reason } = req.body ?? {};

    if (!isUserStatus(status)) {
      return fail(
        res,
        400,
        'INVALID_STATUS',
        'status must be one of: ACTIVE, INACTIVE, SUSPENDED, BANNED. ' +
          'PENDING is derived from email verification and cannot be set.',
      );
    }

    if (reason !== undefined && typeof reason !== 'string') {
      return fail(res, 400, 'INVALID_REASON', 'reason must be a string when provided.');
    }

    const data = await updateUserStatus(
      actor,
      req.params.id,
      status,
      typeof reason === 'string' ? reason.trim().slice(0, 500) || undefined : undefined,
      auditContext(req),
    );

    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'PATCH /users/:id/status', err);
  }
});

// ===================== PATCH /users/:id ======================
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const { name, email, company, customRateLimit } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      return fail(res, 400, 'INVALID_NAME', 'Name is required.');
    }
    if (!email || typeof email !== 'string') {
      return fail(res, 400, 'INVALID_EMAIL', 'Email is required.');
    }

    const data = await updateUserDetails(
      actor,
      req.params.id,
      {
        name: name.trim(),
        email: email.trim(),
        company: typeof company === 'string' ? company.trim() : company,
        customRateLimit: typeof customRateLimit === 'number' ? customRateLimit : (customRateLimit === null ? null : undefined),
      },
      auditContext(req)
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'PATCH /users/:id', err);
  }
});

// ===================== POST /users/:id/suspend ======================
router.post('/:id/suspend', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    const { reason, duration } = req.body ?? {};
    // Optional: parse duration if needed.
    const fullReason = duration ? `${reason} (Duration: ${duration})` : reason;
    const data = await updateUserStatus(actor, req.params.id, 'SUSPENDED', fullReason, auditContext(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'POST /users/:id/suspend', err);
  }
});

// ===================== POST /users/:id/activate ======================
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    const data = await updateUserStatus(actor, req.params.id, 'ACTIVE', 'Reactivated by admin', auditContext(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'POST /users/:id/activate', err);
  }
});

// ===================== DELETE /users/:id ======================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    
    await softDeleteUser(actor, req.params.id, auditContext(req));
    return res.json({ success: true });
  } catch (err) {
    return handleError(res, 'DELETE /users/:id', err);
  }
});

// ====================== PATCH /users/:id/role =======================
router.patch('/:id/role', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const { role } = req.body ?? {};

    if (!isUserRole(role)) {
      return fail(
        res,
        400,
        'INVALID_ROLE',
        'role must be one of: USER, PROVIDER, MODERATOR, ADMIN',
      );
    }

    const data = await updateUserRole(actor, req.params.id, role, auditContext(req));
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'PATCH /users/:id/role', err);
  }
});

// =================== POST /users/:id/impersonate ====================
router.post('/:id/impersonate', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const target = await prepareImpersonation(actor, req.params.id, auditContext(req));

    // The token deliberately reuses the normal session shape so existing auth
    // middleware accepts it — with `impersonatedBy` set, which is what makes an
    // impersonated request traceable back to the admin who started it.
    const accessToken = signJwt(
      {
        sub: target.id,
        email: target.email,
        role: target.role,
        name: target.name,
        impersonatedBy: actor.id,
      },
      IMPERSONATION_TTL_SECONDS,
    );

    const grant: ImpersonationGrant = {
      accessToken,
      expiresAt: new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000).toISOString(),
      expiresInSeconds: IMPERSONATION_TTL_SECONDS,
      target: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
      },
      issuedBy: { id: actor.id, name: req.user?.name ?? 'Administrator' },
    };

    // Never let a bearer token land in a shared cache.
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: grant });
  } catch (err) {
    return handleError(res, 'POST /users/:id/impersonate', err);
  }
});

export default router;
