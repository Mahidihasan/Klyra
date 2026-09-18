import { pool } from '../../services/database.service';
import { generateRandomToken, sha256 } from '../auth/jwt.util';
import {
  ApiKeyServiceError,
  ApiKeySource,
  ApiKeyStats,
  ApiKeyStatus,
  ApiKeySummary,
  ApiKeyTarget,
  ApiKeyTargetVersion,
  CreateApiKeyInput,
  CreatedApiKey,
  RateLimitPeriod,
  ResolvedGatewayKeyResult,
  UpdateApiKeyInput,
} from './api-keys.types';

const KEY_PREFIX = 'kly_';
const DISPLAY_PREFIX_LENGTH = 10;
const RATE_LIMIT_PERIODS: RateLimitPeriod[] = ['SECOND', 'MINUTE', 'HOUR', 'DAY'];
const MAX_RATE_LIMIT = 100_000;
const MAX_EXPIRY_DAYS = 730;
const MAX_PERMISSIONS = 20;
const MAX_PERMISSION_LENGTH = 64;

const SUMMARY_COLUMNS = `
  k.id, k.name, k.key_prefix, k.status, k.is_active, k.created_at, k.last_used_at, k.revoked_at,
  k.rate_limit, k.rate_limit_period, k.expires_at, k.permissions, k.updated_at,
  k.api_id, k.api_version_id, k.project_id, k.project_version,
  a.name AS api_name, a.slug AS api_slug, a.owner_id AS api_owner_id,
  v.version AS api_version,
  p.project->>'name' AS project_name`;

const SUMMARY_JOINS = `
  FROM api_keys k
  LEFT JOIN apis a ON a.id = k.api_id
  LEFT JOIN api_versions v ON v.id = k.api_version_id
  LEFT JOIN api_build_projects p ON p.id = k.project_id`;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function resolveSource(row: Record<string, any>, userId: string): ApiKeySource {
  if (row.project_id) return 'PROJECT';
  if (row.api_id) return row.api_owner_id === userId ? 'OWNED' : 'SUBSCRIBED';
  return 'PERSONAL';
}

function toSummary(row: Record<string, any>, userId: string): ApiKeySummary {
  const permissions = Array.isArray(row.permissions)
    ? row.permissions.filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
    : [];
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    status: row.status as ApiKeyStatus,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    apiId: row.api_id,
    apiName: row.api_name,
    apiSlug: row.api_slug,
    apiVersionId: row.api_version_id,
    apiVersion: row.api_version,
    projectId: row.project_id,
    projectName: row.project_name,
    projectVersion: row.project_version,
    source: resolveSource(row, userId),
    rateLimit: row.rate_limit,
    rateLimitPeriod: row.rate_limit_period as RateLimitPeriod,
    expiresAt: row.expires_at,
    permissions,
    updatedAt: row.updated_at,
  };
}

function validateName(input: { name?: unknown }, required = true): string | undefined {
  const raw = asString(input.name);
  if (raw === null || raw === '') {
    if (required) throw new ApiKeyServiceError('API key name is required.', 400);
    return undefined;
  }
  if (raw.length > 100) {
    throw new ApiKeyServiceError('API key name must be between 1 and 100 characters.', 400);
  }
  return raw;
}

function validateRateLimit(input: { rateLimit?: unknown; rateLimitPeriod?: unknown }): {
  rateLimit?: number;
  rateLimitPeriod?: RateLimitPeriod;
} {
  let rateLimit: number | undefined;
  if (input.rateLimit !== undefined && input.rateLimit !== null && input.rateLimit !== '') {
    const parsed = Number(input.rateLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RATE_LIMIT) {
      throw new ApiKeyServiceError(`Rate limit must be an integer between 1 and ${MAX_RATE_LIMIT}.`, 400);
    }
    rateLimit = parsed;
  }

  let rateLimitPeriod: RateLimitPeriod | undefined;
  if (input.rateLimitPeriod !== undefined && input.rateLimitPeriod !== null && input.rateLimitPeriod !== '') {
    const period = String(input.rateLimitPeriod).toUpperCase() as RateLimitPeriod;
    if (!RATE_LIMIT_PERIODS.includes(period)) {
      throw new ApiKeyServiceError(`Rate limit period must be one of: ${RATE_LIMIT_PERIODS.join(', ')}.`, 400);
    }
    rateLimitPeriod = period;
  }

  return { rateLimit, rateLimitPeriod };
}

/** Normalizes an expiresAt ISO string / expiresInDays number into a DB timestamp. */
function validateExpiry(input: { expiresAt?: unknown; expiresInDays?: unknown }): string | null | undefined {
  const hasDays = input.expiresInDays !== undefined && input.expiresInDays !== null && input.expiresInDays !== '';

  if (input.expiresAt === undefined || input.expiresAt === null || input.expiresAt === '') {
    if (hasDays) return validateExpiry({ expiresInDays: input.expiresInDays });
    if (input.expiresAt === undefined) return undefined; // no change requested
    return null; // explicit "no expiry"
  }

  let date: Date;
  if (hasDays) {
    const days = Number(input.expiresInDays);
    if (!Number.isFinite(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
      throw new ApiKeyServiceError(`Expiration must be between 1 and ${MAX_EXPIRY_DAYS} days.`, 400);
    }
    date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  } else {
    date = new Date(String(input.expiresAt));
  }

  if (Number.isNaN(date.getTime())) {
    throw new ApiKeyServiceError('Expiration must be a valid date.', 400);
  }
  if (date.getTime() <= Date.now()) {
    throw new ApiKeyServiceError('Expiration must be in the future.', 400);
  }
  return date.toISOString();
}

function validatePermissions(input: { permissions?: unknown }): string[] | undefined {
  if (input.permissions === undefined) return undefined;
  if (input.permissions === null) return [];
  if (!Array.isArray(input.permissions)) {
    throw new ApiKeyServiceError('Permissions must be an array of scope strings.', 400);
  }
  const scopes = input.permissions
    .map((p) => String(p ?? '').trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (p.length > MAX_PERMISSION_LENGTH) {
        throw new ApiKeyServiceError(`Each scope must be ${MAX_PERMISSION_LENGTH} characters or fewer.`, 400);
      }
      return p;
    });
  const unique = Array.from(new Set(scopes));
  if (unique.length > MAX_PERMISSIONS) {
    throw new ApiKeyServiceError(`A key can carry at most ${MAX_PERMISSIONS} scopes.`, 400);
  }
  return unique;
}

async function writeAudit(
  userId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  keyId: string,
  values: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
     VALUES ($1, $2, 'api_keys', $3, $4::jsonb)`,
    [userId, action, keyId, JSON.stringify(values)],
  ).catch(() => undefined); // Auditing must never break key management.
}

/** Marks overdue keys as EXPIRED so lifecycle state is always accurate. */
async function expireOverdueKeys(): Promise<void> {
  await pool.query(
    `UPDATE api_keys
     SET status = 'EXPIRED', is_active = FALSE
     WHERE expires_at IS NOT NULL AND expires_at < NOW() AND status IN ('ACTIVE', 'SUSPENDED')`,
  );
}

export class ApiKeysService {
  static async list(userId: string): Promise<ApiKeySummary[]> {
    await expireOverdueKeys();
    const result = await pool.query(
      `SELECT ${SUMMARY_COLUMNS} ${SUMMARY_JOINS}
       WHERE k.user_id = $1
       ORDER BY k.created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => toSummary(row, userId));
  }

  static computeStats(keys: ApiKeySummary[]): ApiKeyStats {
    const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const stats: ApiKeyStats = {
      total: keys.length, active: 0, suspended: 0, revoked: 0, expired: 0, expiringIn30Days: 0,
    };
    for (const key of keys) {
      if (key.status === 'ACTIVE' || key.status === 'SUSPENDED') {
        if (key.expiresAt && new Date(key.expiresAt).getTime() < in30Days) stats.expiringIn30Days += 1;
      }
      if (key.status === 'ACTIVE') stats.active += 1;
      else if (key.status === 'SUSPENDED') stats.suspended += 1;
      else if (key.status === 'REVOKED') stats.revoked += 1;
      else if (key.status === 'EXPIRED') stats.expired += 1;
    }
    return stats;
  }

  /**
   * Every target a key may be created for:
   *  - marketplace APIs with an ACTIVE/TRIALING subscription (purchased)
   *  - marketplace APIs owned by the user (published via the marketplace)
   *  - API Build projects (with their semver versions)
   */
  static async listTargets(userId: string): Promise<ApiKeyTarget[]> {
    const [subscribed, owned, projects] = await Promise.all([
      pool.query(
        `SELECT a.id, a.name, a.slug, a.current_version, sp.name AS plan_name, s.status AS subscription_status
         FROM user_subscriptions s
         JOIN apis a ON a.id = s.api_id AND a.deleted_at IS NULL
         LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
         WHERE s.user_id = $1 AND s.status IN ('ACTIVE', 'TRIALING')
         ORDER BY a.name ASC`,
        [userId],
      ),
      pool.query(
        `SELECT id, name, slug, current_version
         FROM apis
         WHERE owner_id = $1 AND deleted_at IS NULL
         ORDER BY name ASC`,
        [userId],
      ),
      pool.query(
        `SELECT id, project->>'name' AS name, project->>'slug' AS slug, project->>'version' AS version
         FROM api_build_projects
         ORDER BY updated_at DESC`,
      ),
    ]);

    const targets: ApiKeyTarget[] = [];

    for (const row of owned.rows as Record<string, any>[]) {
      targets.push({
        apiId: row.id,
        projectId: null,
        name: row.name,
        slug: row.slug,
        source: 'OWNED',
        planName: null,
        subscriptionStatus: null,
        currentVersion: row.current_version,
        versions: [],
      });
    }

    for (const row of subscribed.rows as Record<string, any>[]) {
      if (targets.some((t) => t.apiId === row.id)) continue; // owned wins over subscribed
      targets.push({
        apiId: row.id,
        projectId: null,
        name: row.name,
        slug: row.slug,
        source: 'SUBSCRIBED',
        planName: row.plan_name,
        subscriptionStatus: row.subscription_status,
        currentVersion: row.current_version,
        versions: [],
      });
    }

    for (const row of projects.rows as Record<string, any>[]) {
      targets.push({
        apiId: null,
        projectId: row.id,
        name: row.name || row.slug || row.id,
        slug: row.slug || '',
        source: 'PROJECT',
        planName: null,
        subscriptionStatus: null,
        currentVersion: row.version,
        versions: [],
      });
    }

    // Attach marketplace API versions.
    const apiIds = targets.filter((t) => t.apiId).map((t) => t.apiId as string);
    if (apiIds.length > 0) {
      const versions = await pool.query(
        `SELECT id, api_id, version, is_current, is_deprecated
         FROM api_versions
         WHERE api_id = ANY($1::uuid[])
         ORDER BY released_at DESC`,
        [apiIds],
      );
      for (const v of versions.rows as Record<string, any>[]) {
        const target = targets.find((t) => t.apiId === v.api_id);
        target?.versions.push({
          id: v.id,
          version: v.version,
          isCurrent: v.is_current,
          isDeprecated: v.is_deprecated,
        } satisfies ApiKeyTargetVersion);
      }
    }

    // Attach API Build project versions.
    const projectIds = targets.filter((t) => t.projectId).map((t) => t.projectId as string);
    if (projectIds.length > 0) {
      const versions = await pool.query(
        `SELECT project_id, id, semver, status, is_default
         FROM api_build_versions
         WHERE project_id = ANY($1::text[])
         ORDER BY created_at DESC`,
        [projectIds],
      );
      for (const v of versions.rows as Record<string, any>[]) {
        const target = targets.find((t) => t.projectId === v.project_id);
        target?.versions.push({
          id: v.id,
          version: v.semver,
          isCurrent: Boolean(v.is_default) || v.status === 'published' || v.status === 'deployed',
          isDeprecated: v.status === 'deprecated',
        } satisfies ApiKeyTargetVersion);
      }
    }

    return targets;
  }

  /** Resolves a marketplace API target, enforcing ownership or an active subscription. */
  private static async resolveApiTarget(userId: string, apiId: string) {
    const result = await pool.query(
      `SELECT a.id, a.name, a.slug, a.owner_id,
              EXISTS (
                SELECT 1 FROM user_subscriptions s
                WHERE s.user_id = $1 AND s.api_id = a.id AND s.status IN ('ACTIVE', 'TRIALING')
              ) AS has_subscription
       FROM apis a
       WHERE a.id = $2 AND a.deleted_at IS NULL`,
      [userId, apiId],
    );
    const api = result.rows[0];
    if (!api) throw new ApiKeyServiceError('API not found.', 404);
    if (api.owner_id !== userId && !api.has_subscription) {
      throw new ApiKeyServiceError('You can only create keys for APIs you own or are subscribed to.', 403);
    }
    return api;
  }

  /** Resolves an API Build project target. */
  private static async resolveProjectTarget(projectId: string) {
    const result = await pool.query(
      `SELECT id, project->>'name' AS name, project->>'slug' AS slug
       FROM api_build_projects WHERE id = $1`,
      [projectId],
    );
    const project = result.rows[0];
    if (!project) throw new ApiKeyServiceError('API project not found.', 404);
    return project;
  }

  private static async resolveApiVersion(apiId: string, apiVersionId: string) {
    const result = await pool.query(
      `SELECT id, version FROM api_versions WHERE id = $1 AND api_id = $2`,
      [apiVersionId, apiId],
    );
    if (!result.rows[0]) {
      throw new ApiKeyServiceError('The selected version does not belong to this API.', 400);
    }
    return result.rows[0];
  }

  private static async getOwnedKey(userId: string, keyId: string): Promise<ApiKeySummary> {
    const result = await pool.query(
      `SELECT ${SUMMARY_COLUMNS} ${SUMMARY_JOINS} WHERE k.id = $1 AND k.user_id = $2`,
      [keyId, userId],
    );
    if (!result.rows[0]) throw new ApiKeyServiceError('API key not found.', 404);
    return toSummary(result.rows[0], userId);
  }

  /** Reads a key back after a write, refreshing EXPIRED state first so status is never stale. */
  private static async refreshOwnedKey(userId: string, keyId: string): Promise<ApiKeySummary> {
    await expireOverdueKeys();
    return this.getOwnedKey(userId, keyId);
  }

  static async create(userId: string, input: CreateApiKeyInput): Promise<CreatedApiKey> {
    await expireOverdueKeys();
    const name = validateName(input);

    const apiId = asString(input.apiId);
    const projectId = asString(input.projectId);
    if (apiId && projectId) {
      throw new ApiKeyServiceError('A key can target either a marketplace API or an API Build project, not both.', 400);
    }

    let apiVersionId: string | null = null;
    let projectVersion: string | null = null;
    let auditTarget: Record<string, unknown> = {};

    if (apiId) {
      const api = await this.resolveApiTarget(userId, apiId);
      const versionId = asString(input.apiVersionId);
      if (versionId) {
        const version = await this.resolveApiVersion(apiId, versionId);
        apiVersionId = version.id;
      }
      auditTarget = { api_id: apiId, api_name: api.name, api_version_id: apiVersionId };
    } else if (projectId) {
      const project = await this.resolveProjectTarget(projectId);
      const version = asString(input.projectVersion);
      if (version) {
        if (version.length > 20) throw new ApiKeyServiceError('Project version must be 20 characters or fewer.', 400);
        projectVersion = version;
      }
      auditTarget = { project_id: projectId, project_name: project.name, project_version: projectVersion };
    }

    const { rateLimit, rateLimitPeriod } = validateRateLimit(input);
    const permissions = validatePermissions(input);
    const expiresAt = validateExpiry(input);

    // A unique hash constraint handles the astronomically unlikely collision.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const secret = `${KEY_PREFIX}${generateRandomToken(32)}`;
      const keyHash = sha256(secret);
      const keyPrefix = secret.slice(0, DISPLAY_PREFIX_LENGTH);
      try {
        const inserted = await pool.query(
          `INSERT INTO api_keys
             (user_id, name, key_hash, key_prefix, api_id, api_version_id, project_id, project_version,
              permissions, rate_limit, rate_limit_period, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
           RETURNING id`,
          [
            userId, name, keyHash, keyPrefix, apiId || null, apiVersionId, projectId || null, projectVersion,
            JSON.stringify(permissions ?? []), rateLimit ?? 60, rateLimitPeriod ?? 'MINUTE', expiresAt ?? null,
          ],
        );
        const apiKey = await this.refreshOwnedKey(userId, inserted.rows[0].id);
        await writeAudit(userId, 'CREATE', apiKey.id, { name: apiKey.name, key_prefix: apiKey.keyPrefix, ...auditTarget });
        return { apiKey, secret };
      } catch (error: any) {
        if (error?.code === '23505' && attempt < 2) continue;
        throw error;
      }
    }
    throw new ApiKeyServiceError('Unable to generate a unique API key. Please try again.', 500);
  }

  static async revoke(userId: string, keyId: string): Promise<ApiKeySummary> {
    const result = await pool.query(
      `UPDATE api_keys
       SET status = 'REVOKED', is_active = FALSE, revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status <> 'REVOKED'
       RETURNING id`,
      [keyId, userId],
    );
    if (result.rows[0]) {
      const apiKey = await this.refreshOwnedKey(userId, result.rows[0].id);
      await writeAudit(userId, 'UPDATE', keyId, { action: 'revoked' });
      return apiKey;
    }

    const owned = await pool.query('SELECT status FROM api_keys WHERE id = $1 AND user_id = $2', [keyId, userId]);
    if (!owned.rows[0]) throw new ApiKeyServiceError('API key not found.', 404);
    throw new ApiKeyServiceError('This API key has already been revoked.', 400);
  }

  static async update(userId: string, keyId: string, input: UpdateApiKeyInput): Promise<ApiKeySummary> {
    const existing = await this.getOwnedKey(userId, keyId);
    if (existing.status === 'REVOKED') {
      throw new ApiKeyServiceError('A revoked API key cannot be modified.', 400);
    }

    const name = validateName(input, false);
    const { rateLimit, rateLimitPeriod } = validateRateLimit(input);
    const permissions = validatePermissions(input);
    // `validateExpiry` understands both expiresAt and expiresInDays; when neither is
    // supplied it returns undefined so the stored value is left untouched.
    const expiresProvided = input.expiresAt !== undefined
      || (input.expiresInDays !== undefined && input.expiresInDays !== null && input.expiresInDays !== '');
    const expiresAt = validateExpiry(input);

    let apiVersionId: string | null = null;
    let apiVersionProvided = false;
    if (input.apiVersionId !== undefined) {
      apiVersionProvided = true;
      const versionId = asString(input.apiVersionId);
      if (versionId) {
        if (!existing.apiId) {
          throw new ApiKeyServiceError('This key is not bound to a marketplace API.', 400);
        }
        const version = await this.resolveApiVersion(existing.apiId, versionId);
        apiVersionId = version.id;
      }
    }

    let projectVersion: string | null = null;
    let projectVersionProvided = false;
    if (input.projectVersion !== undefined) {
      projectVersionProvided = true;
      if (!existing.projectId) {
        throw new ApiKeyServiceError('This key is not bound to an API Build project.', 400);
      }
      const version = asString(input.projectVersion);
      if (version && version.length > 20) {
        throw new ApiKeyServiceError('Project version must be 20 characters or fewer.', 400);
      }
      projectVersion = version || null;
    }

    const result = await pool.query(
      `UPDATE api_keys SET
         name = COALESCE($3, name),
         api_version_id = CASE WHEN $4::boolean THEN $5::uuid ELSE api_version_id END,
         project_version = CASE WHEN $6::boolean THEN $7::text ELSE project_version END,
         rate_limit = COALESCE($8, rate_limit),
         rate_limit_period = COALESCE($9, rate_limit_period),
         expires_at = CASE WHEN $10::boolean THEN $11::timestamptz ELSE expires_at END,
         permissions = COALESCE($12::jsonb, permissions)
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [
        keyId,
        userId,
        name ?? null,
        apiVersionProvided, apiVersionId,
        projectVersionProvided, projectVersion,
        rateLimit ?? null,
        rateLimitPeriod ?? null,
        expiresProvided, expiresAt ?? null,
        permissions === undefined ? null : JSON.stringify(permissions),
      ],
    );
    if (!result.rows[0]) throw new ApiKeyServiceError('API key not found.', 404);
    const apiKey = await this.refreshOwnedKey(userId, result.rows[0].id);
    await writeAudit(userId, 'UPDATE', keyId, {
      name: name ?? undefined,
      rateLimit, rateLimitPeriod, expiresAt, permissions,
      apiVersionId: apiVersionProvided ? apiVersionId : undefined,
      projectVersion: projectVersionProvided ? projectVersion : undefined,
    });
    return apiKey;
  }

  static async suspend(userId: string, keyId: string): Promise<ApiKeySummary> {
    const result = await pool.query(
      `UPDATE api_keys
       SET status = 'SUSPENDED', is_active = FALSE
       WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
       RETURNING id`,
      [keyId, userId],
    );
    if (result.rows[0]) {
      const apiKey = await this.refreshOwnedKey(userId, result.rows[0].id);
      await writeAudit(userId, 'UPDATE', keyId, { action: 'suspended' });
      return apiKey;
    }
    const owned = await this.getOwnedKey(userId, keyId);
    throw new ApiKeyServiceError(
      owned.status === 'SUSPENDED'
        ? 'This API key is already suspended.'
        : `A ${owned.status.toLowerCase()} key cannot be suspended.`,
      400,
    );
  }

  static async activate(userId: string, keyId: string): Promise<ApiKeySummary> {
    await expireOverdueKeys();
    const result = await pool.query(
      `UPDATE api_keys
       SET status = 'ACTIVE', is_active = TRUE
       WHERE id = $1 AND user_id = $2 AND status = 'SUSPENDED'
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING id`,
      [keyId, userId],
    );
    if (result.rows[0]) {
      const apiKey = await this.refreshOwnedKey(userId, result.rows[0].id);
      await writeAudit(userId, 'UPDATE', keyId, { action: 'reactivated' });
      return apiKey;
    }
    const owned = await this.getOwnedKey(userId, keyId);
    if (owned.status === 'EXPIRED' || (owned.expiresAt && new Date(owned.expiresAt) <= new Date())) {
      throw new ApiKeyServiceError('An expired key cannot be reactivated. Create a new key instead.', 400);
    }
    throw new ApiKeyServiceError(
      owned.status === 'ACTIVE'
        ? 'This API key is already active.'
        : `A ${owned.status.toLowerCase()} key cannot be reactivated.`,
      400,
    );
  }

  static async delete(userId: string, keyId: string): Promise<{ id: string; name: string }> {
    const existing = await this.getOwnedKey(userId, keyId);
    await writeAudit(userId, 'DELETE', keyId, {
      name: existing.name,
      key_prefix: existing.keyPrefix,
      status: existing.status,
      api_id: existing.apiId,
      project_id: existing.projectId,
    });
    const result = await pool.query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [keyId, userId]);
    if ((result.rowCount ?? 0) === 0) throw new ApiKeyServiceError('API key not found.', 404);
    return { id: keyId, name: existing.name };
  }

  /**
   * Gateway authentication: resolves a presented key against consumer keys
   * (api_keys) and provider keys issued by API Build (api_build_api_keys).
   * Only the SHA-256 hash ever touches the database.
   */
  static async resolveGatewayKey(rawKey: string): Promise<ResolvedGatewayKeyResult> {
    const keyHash = sha256(rawKey.trim());

    const consumer = await pool.query(
      `SELECT k.id, k.name, k.user_id, k.status, k.expires_at, k.api_id, k.project_id, a.slug AS api_slug
       FROM api_keys k
       LEFT JOIN apis a ON a.id = k.api_id
       WHERE k.key_hash = $1`,
      [keyHash],
    );
    const row = consumer.rows[0];
    if (row) {
      if (row.status === 'REVOKED') return { ok: false, status: 403, reason: 'This API key has been revoked.' };
      if (row.status === 'SUSPENDED') return { ok: false, status: 403, reason: 'This API key is suspended.' };
      if (row.status === 'EXPIRED') return { ok: false, status: 403, reason: 'This API key has expired.' };
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        await pool.query(`UPDATE api_keys SET status = 'EXPIRED', is_active = FALSE WHERE id = $1`, [row.id]);
        return { ok: false, status: 403, reason: 'This API key has expired.' };
      }
      return {
        ok: true,
        key: {
          keyId: row.id,
          keyName: row.name,
          userId: row.user_id,
          apiId: row.api_id,
          apiSlug: row.api_slug,
          projectId: row.project_id,
        },
      };
    }

    // Provider keys minted in the API Build workspace (kly_live_/kly_test_).
    if (/^kly_(live|test)_/.test(rawKey)) {
      const provider = await pool.query(
        `SELECT id, label, project_id, revoked FROM api_build_api_keys WHERE secret_hash = $1`,
        [keyHash],
      );
      const p = provider.rows[0];
      if (p) {
        if (p.revoked) return { ok: false, status: 403, reason: 'This API key has been revoked.' };
        return {
          ok: true,
          key: { keyId: p.id, keyName: p.label, userId: null, apiId: null, apiSlug: null, projectId: p.project_id },
        };
      }
    }

    return { ok: false, status: 401, reason: 'Invalid API key.' };
  }
}
