/**
 * Admin user-management service.
 *
 * Reads degrade to deterministic sample data when Postgres is unreachable, the
 * same as the platform overview. Writes never do: you cannot pretend to suspend
 * someone, so a mutation against a dead database fails loudly instead.
 *
 * Every mutation writes an `audit_logs` row in the same transaction as the
 * change itself. The schema was built for this — `audit_action` already has
 * SUSPEND and BAN values and the table is commented "Immutable audit trail of
 * all admin and system actions for compliance" — so a status change that
 * committed without its audit row would be a silent compliance hole.
 */

import {
  loadPool,
  PoolClient,
  QUERY_TIMEOUT_MS,
  QueryablePool,
  toIso,
  toIsoOrNull,
  toNumber,
  withTimeout,
  withTransaction,
} from './admin.db';
import { buildMockUserList, findMockUser } from './admin.users.mock';
import {
  canChangeRole,
  canChangeStatus,
  canImpersonate,
  guardLastAdmin,
  PolicyActor,
  canDeleteUser,
  canEditUser,
} from './admin.users.policy';
import {
  AdminUserActivity,
  AdminUserList,
  AdminUserListQuery,
  AdminUserMutationResult,
  AdminUserProfile,
  AdminUserDetails,
  ApiDetail,
  SubscriptionDetail,
  ApiKeyDetail,
  UserTelemetryStats,
  AdminUserRow,
  GuardrailFailure,
  UserRoleValue,
  UserStatusValue,
  UserSubscriptionTier,
} from './admin.users.types';

/** Thrown when a guardrail refuses the action. The route maps this to 403. */
export class GuardrailError extends Error {
  readonly code: GuardrailFailure['code'];

  constructor(failure: GuardrailFailure) {
    super(failure.message);
    this.name = 'GuardrailError';
    this.code = failure.code;
  }
}

/** Thrown when the target account doesn't exist. The route maps this to 404. */
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`No user with id ${id}`);
    this.name = 'UserNotFoundError';
  }
}

/** Thrown when a write is attempted with no database. The route maps this to 503. */
export class DatabaseUnavailableError extends Error {
  constructor() {
    super('The database is unavailable, so this change cannot be saved.');
    this.name = 'DatabaseUnavailableError';
  }
}

/**
 * ORDER BY cannot be parameterised, so the sort field maps through a fixed
 * lookup. Anything not in this table never reaches the query string.
 */
const SORT_COLUMN: Record<AdminUserListQuery['sort'], string> = {
  joined: 'u.created_at',
  name: 'u.name',
  email: 'u.email',
  role: 'u.role',
  status: 'u.status',
  apisOwned: 'apis_owned',
};

/** Columns shared by the list and the single-user lookup. */
const USER_SELECT = `
  u.id,
  u.name,
  u.email,
  u.avatar_url,
  u.role,
  u.status,
  u.email_verified_at,
  u.created_at,
  u.last_login_at,
  (
    SELECT COUNT(*) FROM apis a
    WHERE a.owner_id = u.id AND a.deleted_at IS NULL
  ) AS apis_owned,
  (
    SELECT COUNT(*) FROM user_subscriptions s
    WHERE s.user_id = u.id AND s.status = 'ACTIVE'
  ) AS apis_subscribed,
  CASE 
    WHEN u.metadata->'platformSubscription'->>'overrideTier' IS NOT NULL 
         AND (
           u.metadata->'platformSubscription'->>'expiresAt' IS NULL 
           OR (u.metadata->'platformSubscription'->>'expiresAt')::timestamptz > NOW()
         )
    THEN u.metadata->'platformSubscription'->>'overrideTier'
    WHEN (SELECT COUNT(*) FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'ACTIVE') >= 5 THEN 'ENTERPRISE'
    WHEN (SELECT COUNT(*) FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'ACTIVE') > 0 THEN 'PRO'
    ELSE 'FREE'
  END AS subscription_tier
`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `users.id` is a uuid column, so a malformed id makes Postgres raise
 * "invalid input syntax for type uuid" — a 500 for what is really a 404. The
 * ids handed out by the mock generator are not uuids either, so a stale link
 * from a degraded session would hit exactly that. Reject early instead.
 */
function assertLookupableId(id: string): void {
  if (!UUID_PATTERN.test(id)) throw new UserNotFoundError(id);
}

function mapUserRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    role: row.role as UserRoleValue,
    status: row.status as UserStatusValue,
    subscriptionTier: row.subscription_tier as UserSubscriptionTier,
    isPendingVerification: row.email_verified_at === null || row.email_verified_at === undefined,
    apisOwned: toNumber(row.apis_owned),
    apisSubscribed: toNumber(row.apis_subscribed),
    joinedAt: toIso(row.created_at),
    lastLoginAt: toIsoOrNull(row.last_login_at),
  };
}

// ============================================================================
// List
// ============================================================================

interface WhereClause {
  sql: string;
  values: unknown[];
}

/**
 * Build the WHERE fragment for the list query.
 *
 * Every user-supplied value goes in as a bind parameter; only the column names
 * are interpolated, and those come from constants in this file.
 */
export function buildUserWhere(query: AdminUserListQuery): WhereClause {
  const conditions: string[] = ['u.deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    const like = `$${values.length}`;
    // id is a uuid, so it needs an explicit cast before ILIKE will touch it.
    conditions.push(`(u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.id::text ILIKE ${like})`);
  }

  if (query.role) {
    values.push(query.role);
    conditions.push(`u.role = $${values.length}::user_role`);
  }

  if (query.status === 'PENDING') {
    // Derived, not stored: "signed up but never verified".
    conditions.push('u.email_verified_at IS NULL');
  } else if (query.status) {
    values.push(query.status);
    conditions.push(`u.status = $${values.length}::user_status`);
  }

  if (query.subscriptionTier) {
    values.push(query.subscriptionTier);
    conditions.push(`(CASE WHEN (SELECT COUNT(*) FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'ACTIVE') >= 5 THEN 'ENTERPRISE' WHEN (SELECT COUNT(*) FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'ACTIVE') > 0 THEN 'PRO' ELSE 'FREE' END) = $${values.length}`);
  }

  return { sql: conditions.join(' AND '), values };
}

async function queryUserList(
  pool: QueryablePool,
  query: AdminUserListQuery,
): Promise<AdminUserList> {
  const where = buildUserWhere(query);
  const orderColumn = SORT_COLUMN[query.sort];
  const orderDirection = query.direction === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const values = [...where.values, query.limit, offset];
  const limitPlaceholder = `$${where.values.length + 1}`;
  const offsetPlaceholder = `$${where.values.length + 2}`;

  // COUNT(*) OVER () gives the unpaginated total in the same round trip, so the
  // count can't disagree with the page under concurrent writes.
  const { rows } = await withTimeout(
    pool.query<Record<string, unknown>>(
      `
      SELECT ${USER_SELECT}, COUNT(*) OVER () AS total_count
      FROM users u
      WHERE ${where.sql}
      ORDER BY ${orderColumn} ${orderDirection} NULLS LAST, u.id ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
      `,
      values,
    ),
    QUERY_TIMEOUT_MS,
    'admin user list',
  );

  const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;

  return {
    users: rows.map(mapUserRow),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    source: 'live',
  };
}

export async function listUsers(query: AdminUserListQuery): Promise<AdminUserList> {
  const pool = loadPool();
  if (!pool) {
    return buildMockUserList(query, 'No database connection is configured.');
  }

  try {
    return await queryUserList(pool, query);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[admin] user list query failed, serving sample data:', reason);
    return buildMockUserList(query, `Live user data is unavailable (${reason}).`);
  }
}

// ============================================================================
// Single user
// ============================================================================

async function fetchUserRow(db: QueryablePool | PoolClient, id: string): Promise<AdminUserRow> {
  assertLookupableId(id);

  const { rows } = await withTimeout(
    db.query<Record<string, unknown>>(
      `SELECT ${USER_SELECT} FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id],
    ),
    QUERY_TIMEOUT_MS,
    'admin user lookup',
  );

  if (rows.length === 0) throw new UserNotFoundError(id);
  return mapUserRow(rows[0]);
}

export async function getUserProfile(id: string): Promise<AdminUserProfile> {
  const pool = loadPool();

  if (!pool) {
    const mock = findMockUser(id);
    if (!mock) throw new UserNotFoundError(id);
    return {
      ...mock,
      bio: null,
      company: null,
      website: null,
      emailVerifiedAt: mock.isPendingVerification ? null : mock.joinedAt,
      twoFactorEnabled: false,
      updatedAt: mock.joinedAt,
      recentActivity: [],
      source: 'mock',
    };
  }

  assertLookupableId(id);

  const { rows } = await withTimeout(
    pool.query<Record<string, unknown>>(
      `
      SELECT ${USER_SELECT},
             u.bio,
             u.company,
             u.website,
             u.two_factor_enabled,
             u.updated_at
      FROM users u
      WHERE u.id = $1 AND u.deleted_at IS NULL
      `,
      [id],
    ),
    QUERY_TIMEOUT_MS,
    'admin user profile',
  );
  if (rows.length === 0) throw new UserNotFoundError(id);
  const row = rows[0];

  return {
    ...mapUserRow(row),
    bio: (row.bio as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    emailVerifiedAt: toIsoOrNull(row.email_verified_at),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    updatedAt: toIso(row.updated_at),
    recentActivity: await queryRecentActivity(pool, id),
    source: 'live',
  };
}

export async function getUserDetails(id: string): Promise<AdminUserDetails> {
  const pool = loadPool();

  if (!pool) {
    const profile = await getUserProfile(id);
    return {
      ...profile,
      apis: [],
      subscriptions: [],
      apiKeys: [],
      telemetry: { totalRequests30d: 0, errorQuotaViolations30d: 0 },
    };
  }

  assertLookupableId(id);

  // We reuse the basic profile query to get the base user
  const profile = await getUserProfile(id);

  // Parallel fetch for the tabs
  const [apisResult, subsResult, keysResult, telemetryResult] = await Promise.all([
    // APIs Owned
    pool.query<Record<string, unknown>>(
      `
      SELECT a.id, a.name, a.status,
        (SELECT COUNT(*) FROM user_subscriptions us WHERE us.api_id = a.id AND us.status = 'ACTIVE') as subscribers,
        (SELECT AVG(latency_ms) FROM api_analytics aa WHERE aa.api_id = a.id AND aa.created_at > NOW() - INTERVAL '7 days') as avg_latency
      FROM apis a
      WHERE a.owner_id = $1 AND a.deleted_at IS NULL
      ORDER BY a.name ASC
      `,
      [id]
    ),
    // Subscriptions
    pool.query<Record<string, unknown>>(
      `
      SELECT us.id, a.name as api_name, sp.name as plan_name, us.status, us.period_start, us.period_end
      FROM user_subscriptions us
      JOIN apis a ON us.api_id = a.id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1
      ORDER BY us.created_at DESC
      `,
      [id]
    ),
    // API Keys
    pool.query<Record<string, unknown>>(
      `
      SELECT id, name, key_prefix, status, rate_limit, rate_limit_period, last_used_at
      FROM api_keys
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [id]
    ),
    // Telemetry
    pool.query<Record<string, unknown>>(
      `
      SELECT 
        COUNT(*) as total_reqs,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_reqs
      FROM api_analytics
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      `,
      [id]
    )
  ]);

  const apis: ApiDetail[] = apisResult.rows.map(row => ({
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    subscribers: toNumber(row.subscribers),
    avgLatencyMs: row.avg_latency != null ? toNumber(row.avg_latency) : null,
  }));

  const subscriptions: SubscriptionDetail[] = subsResult.rows.map(row => ({
    id: String(row.id),
    apiName: String(row.api_name),
    planName: String(row.plan_name),
    status: String(row.status),
    periodStart: toIso(row.period_start),
    periodEnd: toIsoOrNull(row.period_end),
  }));

  const apiKeys: ApiKeyDetail[] = keysResult.rows.map(row => ({
    id: String(row.id),
    name: String(row.name),
    keyPrefix: String(row.key_prefix),
    status: String(row.status),
    rateLimit: toNumber(row.rate_limit),
    rateLimitPeriod: String(row.rate_limit_period),
    lastUsedAt: toIsoOrNull(row.last_used_at),
  }));

  let telemetry: UserTelemetryStats = { totalRequests30d: 0, errorQuotaViolations30d: 0 };
  if (telemetryResult.rows.length > 0) {
    const row = telemetryResult.rows[0];
    telemetry = {
      totalRequests30d: toNumber(row.total_reqs),
      errorQuotaViolations30d: toNumber(row.error_reqs),
    };
  }

  return {
    ...profile,
    apis,
    subscriptions,
    apiKeys,
    telemetry,
  };
}

/** Best-effort: the drawer is still useful if the audit trail can't be read. */
async function queryRecentActivity(
  pool: QueryablePool,
  userId: string,
): Promise<AdminUserActivity[]> {
  try {
    const { rows } = await withTimeout(
      pool.query<Record<string, unknown>>(
        `
        SELECT id, action, entity_type, created_at, ip_address
        FROM audit_logs
        WHERE user_id = $1 OR entity_id = $1
        ORDER BY created_at DESC
        LIMIT 8
        `,
        [userId],
      ),
      QUERY_TIMEOUT_MS,
      'admin user activity',
    );

    return rows.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      entityType: String(row.entity_type),
      createdAt: toIso(row.created_at),
      ipAddress: (row.ip_address as string | null) ?? null,
    }));
  } catch (err) {
    console.warn('[admin] could not read audit history:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ============================================================================
// Audit
// ============================================================================

export interface AuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Map a status change to the closest `audit_action` enum value.
 *
 * The enum has no IMPERSONATE, so impersonation is logged as LOGIN — which is
 * what it functionally is — with the detail carried in new_values.
 */
function auditActionForStatus(status: UserStatusValue): string {
  if (status === 'SUSPENDED') return 'SUSPEND';
  if (status === 'BANNED') return 'BAN';
  return 'UPDATE';
}

async function writeAuditRow(
  client: PoolClient,
  params: {
    actorId: string;
    action: string;
    entityId: string;
    oldValues: Record<string, unknown> | null;
    newValues: Record<string, unknown> | null;
    context: AuditContext;
  },
): Promise<void> {
  await client.query(
    `
    INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
    VALUES ($1, $2::audit_action, 'user', $3, $4::jsonb, $5::jsonb, $6::inet, $7)
    `,
    [
      params.actorId,
      params.action,
      params.entityId,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
      params.context.ipAddress,
      params.context.userAgent,
    ],
  );
}

// ============================================================================
// Mutations
// ============================================================================

export async function updateUserStatus(
  actor: PolicyActor,
  targetId: string,
  nextStatus: UserStatusValue,
  reason: string | undefined,
  context: AuditContext,
): Promise<AdminUserMutationResult> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const target = await fetchUserRow(pool, targetId);

  const refusal = canChangeStatus(actor, { id: target.id, role: target.role }, nextStatus);
  if (refusal) throw new GuardrailError(refusal);

  return withTransaction(pool, async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `
      UPDATE users
      SET status = $1::user_status,
          -- is_active is a denormalised mirror of status; keep them in step.
          is_active = ($1 = 'ACTIVE'),
          updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id
      `,
      [nextStatus, targetId],
    );

    if (rows.length === 0) throw new UserNotFoundError(targetId);

    await writeAuditRow(client, {
      actorId: actor.id,
      action: auditActionForStatus(nextStatus),
      entityId: targetId,
      oldValues: { status: target.status },
      newValues: { status: nextStatus, reason: reason ?? null },
      context,
    });

    const updated = await fetchUserRow(client, targetId);
    return { user: updated, auditLogged: true };
  });
}

export async function updateUserRole(
  actor: PolicyActor,
  targetId: string,
  nextRole: UserRoleValue,
  context: AuditContext,
): Promise<AdminUserMutationResult> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const target = await fetchUserRow(pool, targetId);

  const refusal = canChangeRole(actor, { id: target.id, role: target.role });
  if (refusal) throw new GuardrailError(refusal);

  // No-op changes short-circuit so they don't pollute the audit trail.
  if (target.role === nextRole) {
    return { user: target, auditLogged: false };
  }

  const activeAdmins = await countActiveAdmins(pool);
  const lockout = guardLastAdmin({ id: target.id, role: target.role }, nextRole, activeAdmins);
  if (lockout) throw new GuardrailError(lockout);

  return withTransaction(pool, async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `
      UPDATE users
      SET role = $1::user_role, 
          metadata = jsonb_set(metadata, '{tokenVersion}', to_jsonb(COALESCE((metadata->>'tokenVersion')::int, 0) + 1)),
          updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id
      `,
      [nextRole, targetId],
    );

    if (rows.length === 0) throw new UserNotFoundError(targetId);

    await writeAuditRow(client, {
      actorId: actor.id,
      action: 'UPDATE',
      entityId: targetId,
      oldValues: { role: target.role },
      newValues: { role: nextRole },
      context,
    });

    const updated = await fetchUserRow(client, targetId);
    return { user: updated, auditLogged: true };
  });
}

async function countActiveAdmins(pool: QueryablePool): Promise<number> {
  const { rows } = await withTimeout(
    pool.query<Record<string, unknown>>(
      `SELECT COUNT(*) AS n FROM users
       WHERE role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'ACTIVE' AND deleted_at IS NULL`,
    ),
    QUERY_TIMEOUT_MS,
    'active admin count',
  );

  return rows.length > 0 ? toNumber(rows[0].n) : 0;
}

// ============================================================================
// Impersonation
// ============================================================================

/** Deliberately short: long enough for a support task, short enough to expire. */
export const IMPERSONATION_TTL_SECONDS = 600;

/**
 * Check the guardrails and return the target, ready for the route to mint a
 * token. Token signing lives in the route so this module stays free of auth
 * imports and remains easy to test.
 */
export async function prepareImpersonation(
  actor: PolicyActor,
  targetId: string,
  context: AuditContext,
): Promise<AdminUserRow> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const target = await fetchUserRow(pool, targetId);

  const refusal = canImpersonate(actor, { id: target.id, role: target.role });
  if (refusal) throw new GuardrailError(refusal);

  if (target.status !== 'ACTIVE') {
    throw new GuardrailError({
      code: 'IMPERSONATE_PRIVILEGED',
      message: `This account is ${target.status.toLowerCase()} and cannot be impersonated.`,
    });
  }

  await withTransaction(pool, async (client) => {
    await writeAuditRow(client, {
      actorId: actor.id,
      action: 'LOGIN',
      entityId: targetId,
      oldValues: null,
      newValues: {
        impersonation: true,
        targetEmail: target.email,
        ttlSeconds: IMPERSONATION_TTL_SECONDS,
      },
      context,
    });
  });

  return target;
}

// ============================================================================
// Edit & Delete
// ============================================================================

export async function updateUserDetails(
  actor: PolicyActor,
  targetId: string,
  updates: { name: string; email: string; company?: string | null; customRateLimit?: number | null },
  context: AuditContext,
): Promise<AdminUserMutationResult> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const target = await fetchUserRow(pool, targetId);

  const refusal = canEditUser(actor);
  if (refusal) throw new GuardrailError(refusal);

  // Re-fetch current metadata to avoid dropping other fields
  const { rows: metadataRows } = await pool.query<{ metadata: any }>(
    `SELECT metadata FROM users WHERE id = $1`, [targetId]
  );
  const metadata = metadataRows[0]?.metadata || {};
  
  if (updates.customRateLimit !== undefined) {
    if (updates.customRateLimit === null) {
      delete metadata.customRateLimit;
    } else {
      metadata.customRateLimit = updates.customRateLimit;
    }
  }

  return withTransaction(pool, async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `
      UPDATE users
      SET name = $1, email = $2, company = $3, metadata = $4::jsonb, updated_at = NOW()
      WHERE id = $5 AND deleted_at IS NULL
      RETURNING id
      `,
      [updates.name, updates.email, updates.company ?? null, JSON.stringify(metadata), targetId],
    );

    if (rows.length === 0) throw new UserNotFoundError(targetId);

    await writeAuditRow(client, {
      actorId: actor.id,
      action: 'UPDATE',
      entityId: targetId,
      oldValues: { name: target.name, email: target.email },
      newValues: { name: updates.name, email: updates.email, company: updates.company, customRateLimit: updates.customRateLimit },
      context,
    });

    const updated = await fetchUserRow(client, targetId);
    return { user: updated, auditLogged: true };
  });
}

export async function softDeleteUser(
  actor: PolicyActor,
  targetId: string,
  context: AuditContext,
): Promise<void> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const target = await fetchUserRow(pool, targetId);

  const refusal = canDeleteUser(actor, { id: target.id, role: target.role });
  if (refusal) throw new GuardrailError(refusal);

  await withTransaction(pool, async (client) => {
    // 1. Mark user as deleted
    const { rows } = await client.query(
      `UPDATE users SET deleted_at = NOW(), updated_at = NOW(), is_active = FALSE WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [targetId],
    );
    if (rows.length === 0) throw new UserNotFoundError(targetId);

    // 2. Revoke API Keys
    await client.query(
      `UPDATE api_keys SET status = 'REVOKED', is_active = FALSE, updated_at = NOW() WHERE user_id = $1`,
      [targetId]
    );

    // 3. Cancel Subscriptions
    await client.query(
      `UPDATE user_subscriptions SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND status = 'ACTIVE'`,
      [targetId]
    );

    // 4. Soft-delete their APIs
    await client.query(
      `UPDATE apis SET deleted_at = NOW() WHERE owner_id = $1 AND deleted_at IS NULL`,
      [targetId]
    );

    await writeAuditRow(client, {
      actorId: actor.id,
      action: 'DELETE',
      entityId: targetId,
      oldValues: { status: target.status, role: target.role },
      newValues: null,
      context,
    });
  });
}

export async function getUserSubscriptionDetails(
  targetId: string,
): Promise<any> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const user = await fetchUserRow(pool, targetId);
  const { rows: telemetryRows } = await pool.query<{ total_requests_30d: string | number }>(
    `SELECT total_requests_30d FROM user_telemetry_stats WHERE user_id = $1`, [targetId]
  ).catch(() => ({ rows: [] }));
  const totalRequests30d = telemetryRows[0]?.total_requests_30d || 0;

  const { rows: userRows } = await pool.query(
    `SELECT metadata FROM users WHERE id = $1`, [targetId]
  );
  const metadataRaw = userRows[0]?.metadata || {};
  const metadata = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
  const override = metadata.platformSubscription;

  let limit = 10000;
  if (user.subscriptionTier === 'PRO') limit = 100000;
  if (user.subscriptionTier === 'ENTERPRISE') limit = 1000000;

  return {
    tier: user.subscriptionTier,
    status: 'ACTIVE',
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    billingCycle: 'MONTHLY',
    paymentMethod: 'Visa ending in 4242',
    quota: {
      used: Number(totalRequests30d),
      limit,
    },
    override: override ? {
      active: true,
      tier: override.overrideTier,
      expiresAt: override.expiresAt,
      reason: override.reason
    } : null
  };
}

export async function overrideUserSubscription(
  actor: PolicyActor,
  targetId: string,
  payload: { tier: UserSubscriptionTier; expiresAt?: string | null; reason: string },
  context: AuditContext
): Promise<AdminUserMutationResult> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  const target = await fetchUserRow(pool, targetId);

  return withTransaction(pool, async (client) => {
    const { rows } = await client.query(
      `
      UPDATE users 
      SET metadata = jsonb_set(
            metadata, 
            '{platformSubscription}', 
            $1::jsonb
          ),
          updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id
      `,
      [JSON.stringify({
        overrideTier: payload.tier,
        expiresAt: payload.expiresAt || null,
        reason: payload.reason,
        grantedAt: new Date().toISOString(),
        grantedBy: actor.id
      }), targetId]
    );

    if (rows.length === 0) throw new UserNotFoundError(targetId);

    await writeAuditRow(client, {
      actorId: actor.id,
      action: 'MANUAL_BILLING_OVERRIDE',
      entityId: targetId,
      oldValues: null,
      newValues: { tier: payload.tier, expiresAt: payload.expiresAt, reason: payload.reason },
      context,
    });

    const updated = await fetchUserRow(client, targetId);
    return { user: updated, auditLogged: true };
  });
}
