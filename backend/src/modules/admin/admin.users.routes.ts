/**
 * Admin user-management routes.
 *
 * Mounted at /api/v1/admin/users by admin.routes.ts, *after* its `requireAdmin`
 * middleware, so every handler here is already known to be SUPER_ADMIN or ADMIN.
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
  getUserSubscriptionDetails,
  overrideUserSubscription,
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
    fail(res, 400, 'INVALID_ROLE', 'role must be one of: SUPER_ADMIN, ADMIN, USER');
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

// ============================ POST /users ===========================
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log("INCOMING PAYLOAD:", req.body);
    const actor = requireActor(req, res);
    if (!actor) return;

    const { name, email, password, role } = req.body ?? {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'name, email, password, and role are required' });
    }

    if (!isUserRole(role)) {
      return fail(res, 400, 'INVALID_ROLE', 'role must be one of: SUPER_ADMIN, ADMIN, USER');
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Hash password with bcrypt
    const bcrypt = require('bcryptjs');
    const BCRYPT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user in Prisma (using PrismaClient)
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' });
    }

    // Insert user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash: passwordHash,
        role: role.toUpperCase(),
        status: 'ACTIVE',
        isActive: true,
        metadata: {}
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'CREATE',
        entity_type: 'users',
        entity_id: user.id,
        ip_address: req.ip || 'unknown',
        new_values: { name: user.name, email: user.email, role: user.role }
      }
    });

    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    console.error("🚨 CRITICAL API ERROR:", err);
    return res.status(500).json({ 
      error: err instanceof Error ? err.message : String(err), 
      details: err 
    });
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

// ===================== GET /users/:id/details ======================
router.get('/:id/details', async (req: Request, res: Response) => {
  try {
    const data = await getUserDetails(req.params.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'GET /users/:id/details', err);
  }
});

// ===================== GET /users/:id/api-keys =====================
router.get('/:id/api-keys', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const apiKeys = await prisma.api_keys.findMany({
      where: { user_id: req.params.id, status: 'ACTIVE' },
      orderBy: { created_at: 'desc' }
    });
    
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: apiKeys });
  } catch (err) {
    return handleError(res, 'GET /users/:id/api-keys', err);
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
    console.log("INCOMING PAYLOAD:", req.body);
    const actor = requireActor(req, res);
    if (!actor) return;

    let { role } = req.body ?? {};
    const formattedRole = role ? (typeof role === 'string' ? role.toUpperCase() : role) : undefined;
    role = formattedRole;

    if (!isUserRole(role)) {
      return res.status(400).json({
        error: 'INVALID_ROLE',
        message: 'role must be one of: SUPER_ADMIN, ADMIN, USER',
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const data = await prisma.user.update({
      where: { id: req.params.id },
      data: { role }
    });

    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'UPDATE',
        entity_type: 'users',
        entity_id: req.params.id,
        ip_address: req.ip || 'unknown',
        new_values: { action: 'USER_ROLE_CHANGED', role }
      }
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("🚨 CRITICAL API ERROR:", err);
    return res.status(500).json({ 
      error: err instanceof Error ? err.message : String(err), 
      details: err 
    });
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

// =================== GET /users/:id/subscription ====================
router.get('/:id/subscription', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    
    const data = await getUserSubscriptionDetails(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'GET /users/:id/subscription', err);
  }
});

// =================== POST /users/:id/subscription/override ====================
router.post('/:id/subscription/override', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;
    
    const { tier, expiresAt, reason } = req.body ?? {};
    if (!tier || !['FREE', 'PRO', 'ENTERPRISE'].includes(tier)) {
      return fail(res, 400, 'INVALID_TIER', 'Tier must be FREE, PRO, or ENTERPRISE');
    }
    if (!reason || typeof reason !== 'string') {
      return fail(res, 400, 'INVALID_REASON', 'A reason is required');
    }

    const data = await overrideUserSubscription(
      actor, 
      req.params.id, 
      { tier, expiresAt, reason }, 
      auditContext(req)
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'POST /users/:id/subscription/override', err);
  }
});

// =================== POST /users/:id/reset-key ====================
// Revokes all existing API keys for the user and issues a fresh one.
// This is a high-friction, admin-only action logged in audit_logs.
router.post('/:id/reset-key', async (req: Request, res: Response) => {
  try {
    const actor = requireActor(req, res);
    if (!actor) return;

    const userId = req.params.id;

    // 1. Revoke all existing active keys for this user
    await (await import('../../services/database.service')).pool.query(
      `UPDATE api_keys
         SET status = 'revoked', is_active = false, revoked_at = NOW()
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );

    // 2. Create a fresh key named "Admin Reset Key"
    const { ApiKeysService } = await import('../api-keys/api-keys.service');
    const { apiKey, secret } = await ApiKeysService.create(userId, { name: 'Admin Reset Key' });

    // 3. Audit the admin action
    await (await import('../../services/database.service')).pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'ADMIN_KEY_RESET', 'api_keys', $2, $3::jsonb)`,
      [actor.id, apiKey.id, JSON.stringify({ targetUserId: userId, resetBy: actor.id })],
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        keyPrefix: apiKey.keyPrefix,
        message: `All previous API keys revoked. New key issued with prefix ${apiKey.keyPrefix}`,
      },
    });
  } catch (err) {
    return handleError(res, 'POST /users/:id/reset-key', err);
  }
});

export default router;
