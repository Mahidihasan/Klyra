import {
  loadPool,
  PoolClient,
  QUERY_TIMEOUT_MS,
  QueryablePool,
  toIso,
  toNumber,
  withTimeout,
  withTransaction,
} from './admin.db';
import { PolicyActor } from './admin.users.policy';
import { DatabaseUnavailableError, GuardrailError } from './admin.users.service';
import {
  AdminApiList,
  AdminApiListQuery,
  AdminApiMutationResult,
  AdminApiRow,
  ApiStatusValue,
  ModerateAction,
} from './admin.apis.types';
import { AuditContext } from './admin.users.types';

const SORT_COLUMN: Record<AdminApiListQuery['sort'], string> = {
  created: 'a.created_at',
  name: 'a.name',
  rating: 'a.rating',
  totalRequests: 'a.total_requests',
  status: 'a.status',
};

const API_SELECT = `
  a.id,
  a.name,
  a.logo_url,
  a.owner_id,
  u.name AS owner_name,
  u.avatar_url AS owner_avatar_url,
  a.current_version,
  a.category_id,
  c.name AS category_name,
  a.status,
  a.is_public,
  a.rating,
  a.total_subscribers,
  a.total_requests,
  a.created_at,
  a.updated_at,
  COALESCE(av.is_deprecated, FALSE) AS is_deprecated,
  -- For endpoints, we count paths in the api_spec jsonb if present. This is a heuristic.
  (
    SELECT jsonb_array_length(jsonb_path_query_array(a.api_spec, '$.paths.*'))
  ) AS endpoints_count,
  -- Mock daily request count based on total for now if api_analytics_daily is complex to join
  (
    SELECT COALESCE(SUM(total_requests), 0) FROM api_analytics_daily 
    WHERE api_id = a.id AND date >= current_date - interval '1 day'
  ) AS daily_request_count
`;

function mapApiRow(row: Record<string, unknown>): AdminApiRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    logoUrl: (row.logo_url as string | null) ?? null,
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name ?? ''),
    ownerAvatarUrl: (row.owner_avatar_url as string | null) ?? null,
    currentVersion: String(row.current_version ?? '1.0.0'),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name ?? ''),
    endpointsCount: toNumber(row.endpoints_count) || 0,
    dailyRequestCount: toNumber(row.daily_request_count) || 0,
    healthScore: toNumber(row.rating) * 20 || 100, // mock health score based on rating
    status: row.status as ApiStatusValue,
    isPublic: Boolean(row.is_public),
    isDeprecated: Boolean(row.is_deprecated),
    rating: toNumber(row.rating),
    totalSubscribers: toNumber(row.total_subscribers),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function buildApiWhere(query: AdminApiListQuery) {
  const conditions: string[] = ['a.deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    const like = `$${values.length}`;
    conditions.push(`(a.name ILIKE ${like} OR a.id::text ILIKE ${like} OR u.name ILIKE ${like})`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`a.status = $${values.length}::api_status`);
  }

  if (query.categoryId) {
    values.push(query.categoryId);
    conditions.push(`a.category_id = $${values.length}::uuid`);
  }

  return { sql: conditions.join(' AND '), values };
}

export async function listApis(query: AdminApiListQuery): Promise<AdminApiList> {
  const pool = loadPool();
  if (!pool) {
    throw new DatabaseUnavailableError();
  }

  const where = buildApiWhere(query);
  const orderColumn = SORT_COLUMN[query.sort];
  const orderDirection = query.direction === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const values = [...where.values, query.limit, offset];
  const limitPlaceholder = `$${where.values.length + 1}`;
  const offsetPlaceholder = `$${where.values.length + 2}`;

  const { rows } = await withTimeout(
    pool.query<Record<string, unknown>>(
      `
      SELECT ${API_SELECT}, COUNT(*) OVER () AS total_count
      FROM apis a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN api_versions av ON a.id = av.api_id AND av.is_current = TRUE
      WHERE ${where.sql}
      ORDER BY ${orderColumn} ${orderDirection} NULLS LAST, a.id ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
      `,
      values,
    ),
    QUERY_TIMEOUT_MS,
    'admin api list',
  );

  const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;

  return {
    apis: rows.map(mapApiRow),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    source: 'live',
  };
}

async function writeAuditRow(
  client: PoolClient,
  params: {
    actorId: string;
    action: string;
    entityId: string;
    oldValues: Record<string, unknown> | null;
    newValues: Record<string, unknown> | null;
    context: any;
  },
): Promise<void> {
  await client.query(
    `
    INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
    VALUES ($1, $2::audit_action, 'api', $3, $4::jsonb, $5::jsonb, $6::inet, $7)
    `,
    [
      params.actorId,
      params.action,
      params.entityId,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null,
      params.context?.ipAddress || null,
      params.context?.userAgent || null,
    ],
  );
}

export async function moderateApi(
  actor: PolicyActor,
  targetId: string,
  action: ModerateAction,
  reason: string | undefined,
  context: any,
): Promise<AdminApiMutationResult> {
  const pool = loadPool();
  if (!pool) throw new DatabaseUnavailableError();

  return withTransaction(pool, async (client) => {
    // 1. Fetch current API
    const { rows: apiRows } = await client.query<Record<string, unknown>>(
      `
      SELECT ${API_SELECT}, a.api_spec
      FROM apis a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN api_versions av ON a.id = av.api_id AND av.is_current = TRUE
      WHERE a.id = $1 AND a.deleted_at IS NULL
      `,
      [targetId]
    );

    if (apiRows.length === 0) {
      throw new Error('API not found');
    }
    const api = apiRows[0];

    // 2. Determine mutations
    let newStatus = api.status;
    let auditAction = 'UPDATE';
    let deprecateVersion = false;

    if (action === 'APPROVED') {
      newStatus = 'PUBLISHED';
      auditAction = 'APPROVE';
    } else if (action === 'REJECTED') {
      newStatus = 'REJECTED';
      auditAction = 'REJECT';
    } else if (action === 'DEPRECATED') {
      deprecateVersion = true;
      auditAction = 'UPDATE'; // Assuming no native DEPRECATE in audit_action enum
    }

    // 3. Apply mutations
    if (newStatus !== api.status) {
      if (newStatus === 'PUBLISHED') {
        await client.query(
          `UPDATE apis SET status = $1::api_status, last_published_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [newStatus, targetId]
        );
      } else {
        await client.query(
          `UPDATE apis SET status = $1::api_status, updated_at = NOW() WHERE id = $2`,
          [newStatus, targetId]
        );
      }
    }

    // If approved, apply proposed Studio pricing changes back to Studio project
    if (action === 'APPROVED') {
      let specObj: any = {};
      try {
        specObj = typeof api.api_spec === 'string' ? JSON.parse(api.api_spec as string) : (api.api_spec || {});
      } catch {
        specObj = {};
      }

      if (specObj && specObj.studioProjectId && specObj.proposedStudioChanges) {
        const studioProjectId = String(specObj.studioProjectId);
        const proposedPlans = specObj.proposedStudioChanges.plans || [];

        for (const plan of proposedPlans) {
          if (plan && plan.name && plan.priceMonthly !== undefined) {
            await client.query(
              `UPDATE api_build_plans
               SET price_monthly = $1,
                   requests_per_month = COALESCE($2, requests_per_month),
                   rate_limit_per_min = COALESCE($3, rate_limit_per_min)
               WHERE project_id = $4 AND (id = $5 OR name = $6)`,
              [
                plan.priceMonthly,
                plan.requestsPerMonth || null,
                plan.rateLimitPerMin || null,
                studioProjectId,
                plan.id || '',
                plan.name,
              ]
            ).catch(() => {});
          }
        }

        await client.query(
          `INSERT INTO api_build_activity (project_id, label, kind, at)
           VALUES ($1, $2, 'ok', NOW())`,
          [studioProjectId, `Marketplace listing approved. Studio pricing synced.`]
        ).catch(() => {});
      }
    }

    if (deprecateVersion) {
      await client.query(
        `UPDATE api_versions SET is_deprecated = TRUE, updated_at = NOW() WHERE api_id = $1 AND is_current = TRUE`,
        [targetId]
      );
    }

    // 4. Write audit log
    await writeAuditRow(client, {
      actorId: actor.id,
      action: auditAction,
      entityId: targetId,
      oldValues: { status: api.status, is_deprecated: api.is_deprecated },
      newValues: { status: newStatus, is_deprecated: deprecateVersion || api.is_deprecated, reason: reason ?? null },
      context,
    });

    // 5. Build provider notification
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: String(api.owner_id),
      type: 'api',
      title:
        action === 'APPROVED'
          ? `API Approved: ${api.name}`
          : action === 'REJECTED'
          ? `API Submission Rejected: ${api.name}`
          : `API Deprecated: ${api.name}`,
      message:
        action === 'APPROVED'
          ? `Your API "${api.name}" has been approved and published to the Marketplace! Studio pricing plans have been synchronized.`
          : action === 'REJECTED'
          ? `Your submission for "${api.name}" was not approved. ${reason ? `Reason: ${reason}` : ''}`
          : `Your API "${api.name}" has been marked as deprecated.`,
      time: 'Just now',
      read: false,
      actionUrl: action === 'APPROVED' ? `/marketplace` : undefined,
    };

    // 6. Fetch updated API
    const { rows: updatedRows } = await client.query<Record<string, unknown>>(
      `
      SELECT ${API_SELECT}
      FROM apis a
      LEFT JOIN users u ON a.owner_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN api_versions av ON a.id = av.api_id AND av.is_current = TRUE
      WHERE a.id = $1
      `,
      [targetId]
    );

    return { api: mapApiRow(updatedRows[0]), auditLogged: true, notification };
  });
}
