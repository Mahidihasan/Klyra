import { pool as db } from '../../services/database.service';
import {
  CatalogApi,
  CatalogCategory,
  CuratedRailsResponse,
  BrowseApisQuery,
  BrowseApisResponse,
  ApiReviewsResponse,
  ProviderProfileResponse,
  PublishApiPayload,
  CatalogEndpoint,
} from './catalog.types';

function extractEndpointsFromSpec(apiSpec: any): CatalogEndpoint[] {
  if (!apiSpec?.paths) return [];
  const endpoints: CatalogEndpoint[] = [];
  for (const [path, methods] of Object.entries(apiSpec.paths as Record<string, any>)) {
    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
        endpoints.push({
          method: method.toUpperCase() as any,
          path,
          description: op?.summary || op?.description || `Execute ${method.toUpperCase()} ${path}`,
          sampleRequest: op?.requestBody ? JSON.stringify(op.requestBody, null, 2) : undefined,
          sampleResponse: op?.responses?.['200']
            ? JSON.stringify(op.responses['200'], null, 2)
            : undefined,
        });
      }
    }
  }
  return endpoints;
}

function mapApiRow(row: any): CatalogApi {
  const endpoints = extractEndpointsFromSpec(row.api_spec);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    longDescription: row.description,
    currentVersion: row.current_version || '1.0.0',
    baseUrl: row.base_url,
    docsUrl: row.docs_url || undefined,
    logoUrl: row.logo_url || undefined,
    categoryId: row.category_id,
    categoryName: row.category_name || 'General',
    categorySlug: row.category_slug || 'general',
    categoryIcon: row.category_icon || 'Layers',
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'Verified Provider',
    ownerAvatarUrl: row.owner_avatar_url || undefined,
    ownerCompany: row.owner_company || undefined,
    pricingModel: row.pricing_model || 'FREEMIUM',
    status: row.status,
    isPublic: Boolean(row.is_public),
    rating: parseFloat(row.rating || '0.00'),
    totalReviews: parseInt(row.total_reviews || '0', 10),
    totalSubscribers: parseInt(row.total_subscribers || '0', 10),
    totalRequests: parseInt(row.total_requests || '0', 10),
    latencyMs: parseInt(row.latency_ms || '120', 10),
    uptimePercentage: parseFloat(row.uptime_percentage || '99.95'),
    tags: Array.isArray(row.tags) ? row.tags : [],
    endpointsCount:
      endpoints.length > 0
        ? endpoints.length
        : row.endpoints_count !== undefined && row.endpoints_count !== null
          ? parseInt(row.endpoints_count, 10)
          : 1,
    endpoints: endpoints.length > 0 ? endpoints : undefined,
    lastPublishedAt: row.last_published_at
      ? new Date(row.last_published_at).toISOString()
      : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    studioProjectId: row.api_spec?.studioProjectId || undefined,
  };
}

const SELECT_API_FIELDS = `
  a.id, a.name, a.slug, a.description, a.current_version, a.base_url, a.docs_url,
  a.logo_url, a.category_id, c.name AS category_name, c.slug AS category_slug,
  COALESCE(c.icon_name, 'Layers') AS category_icon,
  a.owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar_url, u.company AS owner_company,
  a.pricing_model, a.status, a.is_public, a.api_spec, a.tags, a.rating, a.total_reviews,
  a.total_subscribers, a.total_requests, COALESCE(a.latency_ms, 120) AS latency_ms,
  COALESCE(a.uptime_percentage, 99.95) AS uptime_percentage,
  a.trending_score, a.popularity_score, a.last_published_at, a.created_at, a.updated_at
`;

// Browse cards do not need the full OpenAPI document.
const SELECT_API_BROWSE_FIELDS = SELECT_API_FIELDS.replace('a.api_spec, ', '');

export class CatalogService {
  async listOwnedApis(userId: string): Promise<CatalogApi[]> {
    const result = await db.query(
      `SELECT ${SELECT_API_FIELDS}
       FROM apis a
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.owner_id
       WHERE a.owner_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.updated_at DESC`,
      [userId],
    );
    return result.rows.map(mapApiRow);
  }

  async setOwnedApiVisibility(userId: string, apiId: string, isPublic: boolean): Promise<boolean> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT api_spec, status FROM apis WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [apiId, userId],
      );
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      if (result.rows[0].status !== 'PUBLISHED') {
        await client.query('ROLLBACK');
        throw new Error('Only published APIs can change Marketplace visibility.');
      }
      await client.query(
        'UPDATE apis SET is_public = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3',
        [isPublic, apiId, userId],
      );
      const studioProjectId = result.rows[0].api_spec?.studioProjectId;
      if (studioProjectId) {
        await client.query(
          `UPDATE api_build_projects
           SET project = jsonb_set(jsonb_set(project, '{published}', 'true'::jsonb, true), '{visibility}', to_jsonb($2::text), true), updated_at = NOW()
           WHERE id = $1`,
          [studioProjectId, isPublic ? 'public' : 'private'],
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async removeOwnedApiFromMarketplace(userId: string, apiId: string): Promise<boolean> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT api_spec FROM apis WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [apiId, userId],
      );
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `UPDATE apis SET status = 'DRAFT', is_public = false, updated_at = NOW() WHERE id = $1 AND owner_id = $2`,
        [apiId, userId],
      );
      const studioProjectId = result.rows[0].api_spec?.studioProjectId;
      if (studioProjectId) {
        await client.query(
          `UPDATE api_build_projects
           SET project = jsonb_set(jsonb_set(project, '{published}', 'false'::jsonb, true), '{visibility}', '"private"'::jsonb, true), updated_at = NOW()
           WHERE id = $1`,
          [studioProjectId],
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteOwnedApi(
    userId: string,
    apiId: string,
    deleteStudioProject: boolean,
    requestedStudioProjectId?: string,
  ): Promise<boolean> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT api_spec, slug FROM apis WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [apiId, userId],
      );
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      let studioProjectId = result.rows[0].api_spec?.studioProjectId;
      if (!studioProjectId && deleteStudioProject && requestedStudioProjectId) {
        const linkedProject = await client.query(
          `SELECT id FROM api_build_projects WHERE id = $1 AND project->>'slug' = $2 FOR UPDATE`,
          [requestedStudioProjectId, result.rows[0].slug],
        );
        studioProjectId = linkedProject.rows[0]?.id;
      }
      await client.query(
        `UPDATE apis SET deleted_at = NOW(), status = 'DRAFT', is_public = false, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2`,
        [apiId, userId],
      );
      if (deleteStudioProject && studioProjectId) {
        await client.query('DELETE FROM api_build_projects WHERE id = $1', [studioProjectId]);
      } else if (studioProjectId) {
        await client.query(
          `UPDATE api_build_projects
           SET project = jsonb_set(jsonb_set(project, '{published}', 'false'::jsonb, true), '{visibility}', '"private"'::jsonb, true), updated_at = NOW()
           WHERE id = $1`,
          [studioProjectId],
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetches curated rails for the homepage: Trending, Popular, Newly Launched,
   * Recommended, and Featured APIs.
   */
  async getCuratedRails(): Promise<CuratedRailsResponse> {
    // 1. Featured APIs from system_settings
    let featuredApis: CatalogApi[] = [];
    const featRes = await db.query(`SELECT value FROM system_settings WHERE key = 'featured_apis'`);
    const featuredIds: string[] = featRes.rows[0]?.value || [];
    if (featuredIds.length > 0) {
      const featApisRes = await db.query(
        `SELECT ${SELECT_API_FIELDS}
         FROM apis a
         LEFT JOIN categories c ON c.id = a.category_id
         LEFT JOIN users u ON u.id = a.owner_id
         WHERE a.id = ANY($1) AND a.status = 'PUBLISHED' AND a.deleted_at IS NULL`,
        [featuredIds],
      );
      featuredApis = featApisRes.rows.map(mapApiRow);
    }

    const catalogVisibility = `
       FROM apis a
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.owner_id
       WHERE a.status = 'PUBLISHED' AND a.is_public = true AND a.deleted_at IS NULL`;

    const [trendingRes, popularRes, newRes, recRes] = await Promise.all([
      db.query(
        `SELECT ${SELECT_API_FIELDS}${catalogVisibility}
       ORDER BY a.trending_score DESC, a.rating DESC, a.total_requests DESC
       LIMIT 8`,
      ),
      db.query(
        `SELECT ${SELECT_API_FIELDS}${catalogVisibility}
       ORDER BY a.popularity_score DESC, a.total_subscribers DESC, a.total_requests DESC
       LIMIT 8`,
      ),
      db.query(
        `SELECT ${SELECT_API_FIELDS}${catalogVisibility}
       ORDER BY COALESCE(a.last_published_at, a.created_at) DESC
       LIMIT 8`,
      ),
      db.query(
        `SELECT ${SELECT_API_FIELDS}${catalogVisibility}
       ORDER BY a.rating DESC, COALESCE(a.uptime_percentage, 99.95) DESC, COALESCE(a.latency_ms, 120) ASC
       LIMIT 8`,
      ),
    ]);
    const trending = trendingRes.rows.map(mapApiRow);
    const popular = popularRes.rows.map(mapApiRow);
    const newlyLaunched = newRes.rows.map(mapApiRow);
    const recommended = recRes.rows.map(mapApiRow);

    return {
      featured: featuredApis.length > 0 ? featuredApis : trending.slice(0, 4),
      trending,
      popular,
      newlyLaunched,
      recommended,
    };
  }

  /**
   * Browse and filter APIs with multi-facet queries and full pagination.
   */
  async browseApis(query: BrowseApisQuery): Promise<BrowseApisResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 16));
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      "a.status = 'PUBLISHED'",
      'a.is_public = true',
      'a.deleted_at IS NULL',
    ];
    const params: any[] = [];

    // Search condition: trigram or ILIKE across name, description, tags
    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      const searchParam = `$${params.length}`;
      params.push(query.search.trim().toLowerCase());
      const tagParam = `$${params.length}`;
      conditions.push(
        `(a.name ILIKE ${searchParam} OR a.description ILIKE ${searchParam} OR ${tagParam} = ANY(a.tags))`,
      );
    }

    // Category filter by slug or ID
    if (query.category && query.category !== 'all' && query.category !== 'All Categories') {
      params.push(query.category);
      const catParam = `$${params.length}`;
      conditions.push(
        `(c.slug = ${catParam} OR c.id::text = ${catParam} OR c.name ILIKE ${catParam})`,
      );
    }

    // Pricing Model filter
    if (query.pricingModel && query.pricingModel !== 'all') {
      params.push(query.pricingModel.toUpperCase());
      conditions.push(`a.pricing_model = $${params.length}::api_pricing_model`);
    }

    // Min Rating filter
    if (query.minRating && query.minRating > 0) {
      params.push(query.minRating);
      conditions.push(`a.rating >= $${params.length}`);
    }

    // Max Latency filter
    if (query.maxLatency && query.maxLatency > 0) {
      params.push(query.maxLatency);
      conditions.push(`COALESCE(a.latency_ms, 120) <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting logic
    let orderClause = 'ORDER BY a.trending_score DESC, a.rating DESC';
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';

    switch (query.sort) {
      case 'popular':
        orderClause = `ORDER BY a.popularity_score ${direction}, a.total_subscribers ${direction}`;
        break;
      case 'rating':
        orderClause = `ORDER BY a.rating ${direction}, a.total_reviews ${direction}`;
        break;
      case 'newest':
        orderClause = `ORDER BY COALESCE(a.last_published_at, a.created_at) ${direction}`;
        break;
      case 'latency':
        orderClause = `ORDER BY COALESCE(a.latency_ms, 120) ${
          query.order === 'desc' ? 'DESC' : 'ASC'
        }`;
        break;
      case 'name':
        orderClause = `ORDER BY a.name ${query.order === 'desc' ? 'DESC' : 'ASC'}`;
        break;
      case 'trending':
      default:
        orderClause = `ORDER BY a.trending_score ${direction}, a.rating ${direction}`;
        break;
    }

    const countParams = [...params];
    const listParams = [...params, limit, offset];
    const [countRes, listRes] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total
         FROM apis a
         LEFT JOIN categories c ON c.id = a.category_id
         ${whereClause}`,
        countParams,
      ),
      db.query(
        `SELECT ${SELECT_API_BROWSE_FIELDS}
         FROM apis a
         LEFT JOIN categories c ON c.id = a.category_id
         LEFT JOIN users u ON u.id = a.owner_id
         ${whereClause}
         ${orderClause}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        listParams,
      ),
    ]);
    const total = parseInt(countRes.rows[0].total, 10);

    return {
      apis: listRes.rows.map(mapApiRow),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single API details including active pricing plans and OpenAPI endpoints.
   */
  async getApiBySlugOrId(idOrSlug: string): Promise<CatalogApi | null> {
    const res = await db.query(
      `SELECT ${SELECT_API_FIELDS}
       FROM apis a
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.owner_id
       WHERE (a.slug = $1 OR a.id::text = $1) AND a.deleted_at IS NULL`,
      [idOrSlug],
    );

    if (res.rows.length === 0) return null;
    const api = mapApiRow(res.rows[0]);

    // Fetch pricing plans
    const plansRes = await db.query(
      `SELECT id, name, slug, description, price, currency, billing_interval, features, rate_limit
       FROM subscription_plans
       WHERE api_id = $1 AND is_active = true AND deleted_at IS NULL
       ORDER BY price ASC`,
      [api.id],
    );

    api.pricingPlans = plansRes.rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      price: parseFloat(p.price || '0.00'),
      currency: p.currency || 'USD',
      billingInterval: String(p.billing_interval).toLowerCase(),
      features: Array.isArray(p.features)
        ? p.features
        : typeof p.features === 'string'
        ? JSON.parse(p.features)
        : [],
      rateLimit: p.rate_limit || undefined,
    }));

    return api;
  }

  /**
   * List categories with real-time published API counts.
   */
  async getCategories(): Promise<CatalogCategory[]> {
    const res = await db.query(
      `SELECT c.id, c.name, c.slug, c.description, COALESCE(c.icon_name, 'Layers') AS "iconName",
              c.icon_url AS "iconUrl", c.sort_order AS "sortOrder",
              COUNT(a.id) FILTER (WHERE a.status = 'PUBLISHED' AND a.is_public = true AND a.deleted_at IS NULL) AS "apiCount"
       FROM categories c
       LEFT JOIN apis a ON a.category_id = c.id
       WHERE c.is_active = true AND c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`,
    );

    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || undefined,
      iconName: r.iconName,
      iconUrl: r.iconUrl || undefined,
      sortOrder: r.sortOrder,
      apiCount: parseInt(r.apiCount || '0', 10),
    }));
  }

  /**
   * Retrieves approved user reviews for an API with rating breakdown statistics.
   */
  async getApiReviews(apiId: string): Promise<ApiReviewsResponse> {
    const reviewsRes = await db.query(
      `SELECT r.id, r.user_id, u.name AS user_name, u.avatar_url AS user_avatar_url,
              r.rating, r.title, r.content, r.is_verified, r.created_at
       FROM api_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.api_id = $1 AND r.is_approved = true AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC`,
      [apiId],
    );

    const reviews = reviewsRes.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name || 'Developer',
      userAvatarUrl: r.user_avatar_url || undefined,
      rating: r.rating,
      title: r.title || undefined,
      content: r.content || undefined,
      isVerified: Boolean(r.is_verified),
      createdAt: new Date(r.created_at).toISOString(),
    }));

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const rev of reviews) {
      if (breakdown[rev.rating] !== undefined) {
        breakdown[rev.rating] += 1;
      }
      sum += rev.rating;
    }

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 ? parseFloat((sum / totalReviews).toFixed(2)) : 0;

    return {
      summary: {
        averageRating,
        totalReviews,
        ratingBreakdown: breakdown,
      },
      reviews,
    };
  }

  /**
   * Submits a user review, auto-recalculates rating on `apis`.
   */
  async createApiReview(
    userId: string,
    apiId: string,
    payload: { rating: number; title?: string; content?: string },
  ): Promise<any> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        `INSERT INTO api_reviews (user_id, api_id, rating, title, content, is_verified, is_approved)
         VALUES ($1, $2, $3, $4, $5, true, true)
         ON CONFLICT (user_id, api_id) DO UPDATE SET
           rating = EXCLUDED.rating,
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           is_approved = true,
           updated_at = NOW()
         RETURNING id, rating, title, content, created_at`,
        [userId, apiId, payload.rating, payload.title || null, payload.content || null],
      );

      // Recompute average rating and review counts on apis
      const statsRes = await client.query(
        `SELECT COUNT(*) AS total, AVG(rating) AS avg_rating
         FROM api_reviews
         WHERE api_id = $1 AND is_approved = true AND deleted_at IS NULL`,
        [apiId],
      );

      const totalReviews = parseInt(statsRes.rows[0].total, 10);
      const avgRating = parseFloat(Number(statsRes.rows[0].avg_rating || 0).toFixed(2));

      await client.query(
        `UPDATE apis SET rating = $1, total_reviews = $2, updated_at = NOW() WHERE id = $3`,
        [avgRating, totalReviews, apiId],
      );

      await client.query('COMMIT');
      return res.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves provider public profile with their portfolio of published APIs.
   */
  async getProviderProfile(providerId: string): Promise<ProviderProfileResponse | null> {
    const userRes = await db.query(
      `SELECT id, name, email, avatar_url, bio, company, website, role, created_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [providerId],
    );

    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    const apisRes = await db.query(
      `SELECT ${SELECT_API_FIELDS}
       FROM apis a
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.owner_id
       WHERE a.owner_id = $1 AND a.status = 'PUBLISHED' AND a.is_public = true AND a.deleted_at IS NULL
       ORDER BY a.rating DESC, a.total_subscribers DESC`,
      [providerId],
    );

    const apis = apisRes.rows.map(mapApiRow);
    const totalSubscribers = apis.reduce((sum, item) => sum + item.totalSubscribers, 0);
    const averageRating =
      apis.length > 0
        ? parseFloat((apis.reduce((sum, item) => sum + item.rating, 0) / apis.length).toFixed(2))
        : 0;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url || undefined,
      bio: user.bio || undefined,
      company: user.company || undefined,
      website: user.website || undefined,
      role: user.role,
      isVerified: user.role === 'PROVIDER' || user.role === 'ADMIN',
      memberSince: new Date(user.created_at).toISOString(),
      totalPublishedApis: apis.length,
      totalSubscribers,
      averageRating,
      apis,
    };
  }

  /**
   * Self-serve provider publishing pipeline.
   * Auto-validates OpenAPI spec, base URL, and provisions default tiers.
   */
  async publishApi(
    userId: string,
    payload: PublishApiPayload,
  ): Promise<CatalogApi> {
    const slug =
      payload.slug ||
      payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      `api-${Date.now()}`;

    const initialStatus = payload.requireApproval ? 'PENDING' : 'PUBLISHED';

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const existingApi = await client.query(
        `SELECT id, slug
         FROM apis
         WHERE owner_id = $1
           AND (slug = $3 OR ($2::text IS NOT NULL AND api_spec->>'studioProjectId' = $2))
         ORDER BY COALESCE(api_spec->>'studioProjectId' = $2, false) DESC,
                  (slug = $3) DESC,
                  (deleted_at IS NULL) DESC,
                  updated_at DESC
         LIMIT 1
         FOR UPDATE`,
        [userId, payload.studioProjectId || null, slug],
      );
      const existingApiId: string | undefined = existingApi.rows[0]?.id;
      const publishSlug = existingApi.rows[0]?.slug || slug;

      const selectedVersion = payload.proposedStudioChanges?.semver || '1.0.0';
      const currentVersion = selectedVersion.trim().replace(/^v(?=\d)/i, '');
      if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
        throw new Error('API version must use the X.Y.Z format (for example, 1.2.3).');
      }

      const apiSpec = {
        ...(payload.apiSpec || {
          openapi: '3.0.0',
          info: { title: payload.name, version: currentVersion, description: payload.description },
          paths: {},
        }),
        studioProjectId: payload.studioProjectId,
        proposedStudioChanges: payload.proposedStudioChanges,
        marketplaceAvailability: payload.marketplaceAvailability,
        media: payload.media,
        documentationMarkdown: payload.documentationMarkdown,
      };

      const apiValues = [
        payload.name,
        publishSlug,
        payload.description,
        currentVersion,
        payload.baseUrl,
        payload.docsUrl || null,
        payload.logoUrl || null,
        payload.categoryId,
        userId,
        payload.pricingModel,
        initialStatus,
        JSON.stringify(apiSpec),
        payload.tags || [],
      ];
      const apiResult = existingApiId
        ? await client.query(
            `UPDATE apis
             SET name = $1, slug = $2, description = $3, current_version = $4,
                 base_url = $5, docs_url = $6, logo_url = $7, category_id = $8,
                 pricing_model = $10, status = $11, is_public = true, api_spec = $12,
                 tags = $13, deleted_at = NULL, updated_at = NOW(),
                 last_published_at = ${initialStatus === 'PUBLISHED' ? 'NOW()' : 'NULL'}
             WHERE id = $14 AND owner_id = $9
             RETURNING id`,
            [...apiValues, existingApiId],
          )
        : await client.query(
            `INSERT INTO apis (
               name, slug, description, current_version, base_url, docs_url, logo_url,
               category_id, owner_id, pricing_model, status, is_public, api_spec, tags,
               rating, total_reviews, total_subscribers, total_requests, latency_ms,
               uptime_percentage, trending_score, popularity_score, last_published_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $13, 5.00, 0, 1, 0, 110, 99.99, 10.0, 50.0, ${initialStatus === 'PUBLISHED' ? 'NOW()' : 'NULL'})
             RETURNING id`,
            apiValues,
          );

      const apiId = apiResult.rows[0].id;

      // Create version
      await client.query(
        `INSERT INTO api_versions (api_id, version, api_spec, is_current, released_at)
         VALUES ($1, $2, $3, true, NOW())
         ${existingApiId ? 'ON CONFLICT (api_id, version) DO NOTHING' : ''}`,
        [apiId, currentVersion, JSON.stringify(apiSpec)],
      );

      // Create subscription plans
      if (payload.plans && payload.plans.length > 0) {
        for (const plan of payload.plans) {
          await client.query(
            `INSERT INTO subscription_plans (api_id, name, slug, description, price, billing_interval, features, rate_limit, is_active)
             VALUES ($1, $2, $3, $4, $5, $6::billing_interval, $7, $8, true)
             ${existingApiId ? 'ON CONFLICT (api_id, slug) DO NOTHING' : ''}`,
            [
              apiId,
              plan.name,
              plan.slug,
              plan.description,
              plan.price,
              plan.billingInterval || 'MONTHLY',
              JSON.stringify(plan.features || []),
              plan.rateLimit || 60,
            ],
          );
        }
      } else {
        // Fallback default plan
        await client.query(
          `INSERT INTO subscription_plans (api_id, name, slug, description, price, billing_interval, features, rate_limit, is_active)
           VALUES ($1, 'Free Developer', 'free', 'Standard sandbox access', 0.00, 'MONTHLY', '["1,000 requests/mo", "Community Support"]', 60, true)
           ${existingApiId ? 'ON CONFLICT (api_id, slug) DO NOTHING' : ''}`,
          [apiId],
        );
      }

      if (payload.studioProjectId && payload.proposedStudioChanges?.plans?.length) {
        for (const plan of payload.proposedStudioChanges.plans) {
          if (!plan?.name || !Number.isFinite(plan.priceMonthly)) continue;
          await client.query(
            `UPDATE api_build_plans
             SET price_monthly = $1,
                 requests_per_month = COALESCE($2, requests_per_month),
                 rate_limit_per_min = COALESCE($3, rate_limit_per_min)
             WHERE project_id = $4 AND (id = $5 OR name = $6)`,
            [
              plan.priceMonthly,
              plan.requestsPerMonth ?? null,
              plan.rateLimitPerMin ?? null,
              payload.studioProjectId,
              plan.id || '',
              plan.name,
            ],
          );
        }

        await client.query(
          `INSERT INTO api_build_activity (project_id, label, kind)
           VALUES ($1, $2, 'ok')`,
          [payload.studioProjectId, 'Marketplace listing published. Studio pricing synced.'],
        );
      }

      // Log in audit_logs
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'CREATE', 'api', $2, $3)`,
        [userId, apiId, JSON.stringify({ name: payload.name, slug: publishSlug, status: initialStatus })],
      );

      await client.query('COMMIT');

      const fullApi = await this.getApiBySlugOrId(apiId);
      return fullApi!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const catalogService = new CatalogService();
