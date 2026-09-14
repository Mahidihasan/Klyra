import { pool as db } from '../../services/database.service';
import {
  FeaturedApiRow,
  AdminCategoryRow,
  AdminReviewRow,
  CategoryPayload,
  FeaturedApiConfig,
  AddFeaturedApiPayload,
  TrendingWeights,
  TrendingOverride,
  TrendingApiRow,
} from './admin.marketplace.types';
import { ViewerIdentity } from './admin.users.types';

export class AdminMarketplaceService {
  // ===================== FEATURED APIs =====================

  async getFeaturedConfigs(): Promise<FeaturedApiConfig[]> {
    const result = await db.query(
      `
      SELECT value
      FROM system_settings
      WHERE key = 'featured_apis'
      `
    );

    const rawConfigs: any[] = result.rows[0]?.value || [];

    return rawConfigs.map((c, i) => {
      if (typeof c === 'string') {
        return { apiId: c, slotType: 'Hero Carousel', orderIndex: i, expiresAt: null, promoTag: null };
      }
      return c;
    });
  }

  async getFeaturedApis(): Promise<FeaturedApiRow[]> {
    const configs = await this.getFeaturedConfigs();

    if (configs.length === 0) {
      return [];
    }

    const apiIds = configs.map(c => c.apiId);

    const apisResult = await db.query(
      `
      SELECT 
        a.id, 
        a.name, 
        a.logo_url AS "logoUrl",
        u.name AS "ownerName",
        c.name AS "categoryName",
        a.rating
      FROM apis a
      LEFT JOIN api_versions v ON v.api_id = a.id AND v.is_current = true
      LEFT JOIN users u ON u.id = a.owner_id
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.id = ANY($1)
      `,
      [apiIds]
    );

    const apiMap = new Map(apisResult.rows.map((row: any) => [row.id, row]));
    return configs.map(conf => {
      const api = apiMap.get(conf.apiId);
      if (!api) return null;
      return {
        ...api,
        slotType: conf.slotType || 'Hero Carousel',
        orderIndex: conf.orderIndex,
        expiresAt: conf.expiresAt || null,
        promoTag: conf.promoTag || null,
        rating: Number(api.rating)
      };
    }).filter(Boolean) as FeaturedApiRow[];
  }

  async setFeaturedApis(viewer: ViewerIdentity, configs: FeaturedApiConfig[]): Promise<void> {
    await db.query(
      `
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('featured_apis', $1::jsonb, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      [JSON.stringify(configs), viewer.id]
    );

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, new_values)
      VALUES ($1, 'UPDATE', 'FEATURED_APIS', $2)
      `,
      [viewer.id, { configs }]
    );
  }

  async addFeaturedApi(viewer: ViewerIdentity, payload: AddFeaturedApiPayload): Promise<void> {
    const configs = await this.getFeaturedConfigs();
    const filtered = configs.filter(c => c.apiId !== payload.apiId);
    filtered.push(payload);
    filtered.sort((a, b) => a.orderIndex - b.orderIndex);
    await this.setFeaturedApis(viewer, filtered);
  }

  async removeFeaturedApi(viewer: ViewerIdentity, apiId: string): Promise<void> {
    const configs = await this.getFeaturedConfigs();
    const filtered = configs.filter(c => c.apiId !== apiId);
    await this.setFeaturedApis(viewer, filtered);
  }

  // ===================== TRENDING APIs =====================

  async getTrendingWeights(): Promise<TrendingWeights> {
    const result = await db.query(`SELECT value FROM system_settings WHERE key = 'trending_weights'`);
    if (result.rows[0]) {
      return result.rows[0].value as TrendingWeights;
    }
    return { requestWeight: 40, subWeight: 30, ratingWeight: 30, errorPenalty: 10 };
  }

  async setTrendingWeights(viewer: ViewerIdentity, weights: TrendingWeights): Promise<void> {
    await db.query(
      `
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('trending_weights', $1::jsonb, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      [JSON.stringify(weights), viewer.id]
    );

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, new_values)
      VALUES ($1, 'UPDATE', 'TRENDING_WEIGHTS', $2)
      `,
      [viewer.id, { weights }]
    );
  }

  async getTrendingOverrides(): Promise<TrendingOverride[]> {
    const result = await db.query(`SELECT value FROM system_settings WHERE key = 'trending_overrides'`);
    return (result.rows[0]?.value || []) as TrendingOverride[];
  }

  async setTrendingOverride(viewer: ViewerIdentity, payload: { apiId: string, action: 'BOOST' | 'EXCLUDE' | 'RESET', boostValue?: number, expiresAt?: string }): Promise<void> {
    let overrides = await this.getTrendingOverrides();
    
    // Remove existing for this API
    overrides = overrides.filter(o => o.apiId !== payload.apiId);

    if (payload.action !== 'RESET') {
      overrides.push({
        apiId: payload.apiId,
        action: payload.action,
        boostValue: payload.boostValue,
        expiresAt: payload.expiresAt
      });
    }

    await db.query(
      `
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('trending_overrides', $1::jsonb, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      [JSON.stringify(overrides), viewer.id]
    );

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, new_values)
      VALUES ($1, 'UPDATE', 'TRENDING_OVERRIDE', $2)
      `,
      [viewer.id, { payload }]
    );
  }

  async getTrendingApis(): Promise<TrendingApiRow[]> {
    const weights = await this.getTrendingWeights();
    const overrides = await this.getTrendingOverrides();

    const apisResult = await db.query(
      `
      SELECT 
        a.id, 
        a.name, 
        a.logo_url AS "logoUrl",
        c.name AS "categoryName",
        a.total_requests AS "totalRequests",
        a.total_subscribers AS "totalSubscribers",
        a.rating
      FROM apis a
      LEFT JOIN api_versions v ON v.api_id = a.id AND v.is_current = true
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.status = 'PUBLISHED' AND a.deleted_at IS NULL
      `
    );

    // Calculate max values for normalization
    let maxReqs = 1;
    let maxSubs = 1;
    for (const row of apisResult.rows) {
      if (Number(row.totalRequests) > maxReqs) maxReqs = Number(row.totalRequests);
      if (Number(row.totalSubscribers) > maxSubs) maxSubs = Number(row.totalSubscribers);
    }

    let results: TrendingApiRow[] = [];

    for (const row of apisResult.rows) {
      const override = overrides.find(o => o.apiId === row.id);
      
      // Handle expiration
      let isExpired = false;
      if (override && override.expiresAt) {
        if (new Date(override.expiresAt) < new Date()) {
          isExpired = true;
        }
      }

      if (override && override.action === 'EXCLUDE' && !isExpired) {
        continue;
      }

      // Algorithmic Base Score (Normalized to 100)
      const reqScore = (Number(row.totalRequests) / maxReqs) * 100;
      const subScore = (Number(row.totalSubscribers) / maxSubs) * 100;
      const ratScore = (Number(row.rating) / 5) * 100;

      let baseScore = 
        (reqScore * (weights.requestWeight / 100)) + 
        (subScore * (weights.subWeight / 100)) + 
        (ratScore * (weights.ratingWeight / 100));

      let finalScore = baseScore;
      let status: 'ALGORITHMIC' | 'BOOSTED' | 'EXCLUDED' = 'ALGORITHMIC';

      if (override && override.action === 'BOOST' && !isExpired) {
        status = 'BOOSTED';
        const boostVal = override.boostValue || 0;
        finalScore = finalScore * (1 + (boostVal / 100));
      }

      results.push({
        id: row.id,
        name: row.name,
        logoUrl: row.logoUrl,
        categoryName: row.categoryName,
        totalRequests: Number(row.totalRequests),
        totalSubscribers: Number(row.totalSubscribers),
        rating: Number(row.rating),
        dynamicScore: Math.round(finalScore * 10) / 10,
        overrideStatus: status,
      });
    }

    results.sort((a, b) => b.dynamicScore - a.dynamicScore);
    return results.slice(0, 20);
  }

  // ===================== CATEGORIES =====================

  async getCategories(): Promise<AdminCategoryRow[]> {
    const result = await db.query(
      `
      SELECT 
        c.id, c.name, c.slug, c.description, c.icon_url AS "iconUrl", 
        c.sort_order AS "sortOrder", c.is_active AS "isActive", c.created_at AS "createdAt",
        (SELECT COUNT(*) FROM apis WHERE category_id = c.id) AS "apiCount"
      FROM categories c
      ORDER BY c.sort_order ASC, c.name ASC
      `
    );
    return result.rows;
  }

  async createCategory(viewer: ViewerIdentity, payload: CategoryPayload): Promise<AdminCategoryRow> {
    const result = await db.query(
      `
      INSERT INTO categories (name, slug, description, icon_url, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, slug, description, icon_url AS "iconUrl", sort_order AS "sortOrder", is_active AS "isActive", created_at AS "createdAt"
      `,
      [payload.name, payload.slug, payload.description || null, payload.iconUrl || null, payload.sortOrder || 0, payload.isActive ?? true]
    );

    const category = { ...result.rows[0], apiCount: 0 } as AdminCategoryRow;

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES ($1, 'CREATE', 'CATEGORY', $2, $3)
      `,
      [viewer.id, category.id, payload]
    );

    return category;
  }

  async updateCategory(viewer: ViewerIdentity, id: string, payload: CategoryPayload): Promise<AdminCategoryRow> {
    const result = await db.query(
      `
      UPDATE categories
      SET name = COALESCE($2, name),
          slug = COALESCE($3, slug),
          description = COALESCE($4, description),
          icon_url = COALESCE($5, icon_url),
          sort_order = COALESCE($6, sort_order),
          is_active = COALESCE($7, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, slug, description, icon_url AS "iconUrl", sort_order AS "sortOrder", is_active AS "isActive", created_at AS "createdAt"
      `,
      [id, payload.name, payload.slug, payload.description, payload.iconUrl, payload.sortOrder, payload.isActive]
    );

    if (result.rowCount === 0) {
      throw new Error('Category not found');
    }

    const apiCountResult = await db.query('SELECT COUNT(*) FROM apis WHERE category_id = $1', [id]);
    const category = { ...result.rows[0], apiCount: parseInt(apiCountResult.rows[0].count, 10) } as AdminCategoryRow;

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES ($1, 'UPDATE', 'CATEGORY', $2, $3)
      `,
      [viewer.id, id, payload]
    );

    return category;
  }

  async deleteCategory(viewer: ViewerIdentity, id: string): Promise<void> {
    const apiCountResult = await db.query('SELECT COUNT(*) FROM apis WHERE category_id = $1 AND deleted_at IS NULL', [id]);
    if (parseInt(apiCountResult.rows[0].count, 10) > 0) {
      const error: any = new Error('Category has active APIs assigned');
      error.code = 'CONFLICT';
      throw error;
    }

    const result = await db.query('DELETE FROM categories WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new Error('Category not found');
    }

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
      VALUES ($1, 'DELETE', 'CATEGORY', $2)
      `,
      [viewer.id, id]
    );
  }

  // ===================== REVIEWS =====================

  async getReviews(): Promise<AdminReviewRow[]> {
    const result = await db.query(
      `
      SELECT 
        r.id,
        r.api_id AS "apiId",
        a.name AS "apiName",
        r.user_id AS "userId",
        u.name AS "userName",
        u.email AS "userEmail",
        r.rating,
        r.title,
        r.content,
        r.is_approved AS "isApproved",
        r.is_verified AS "isVerified",
        r.created_at AS "createdAt"
      FROM api_reviews r
      JOIN users u ON u.id = r.user_id
      JOIN apis a ON a.id = r.api_id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 100
      `
    );
    return result.rows;
  }

  async toggleReviewApproval(viewer: ViewerIdentity, id: string, isApproved: boolean): Promise<void> {
    const result = await db.query(
      `
      UPDATE api_reviews
      SET is_approved = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [id, isApproved]
    );

    if (result.rowCount === 0) {
      throw new Error('Review not found');
    }

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES ($1, 'UPDATE', 'REVIEW', $2, $3)
      `,
      [viewer.id, id, { isApproved }]
    );
  }

  async deleteReview(viewer: ViewerIdentity, id: string): Promise<void> {
    // Soft delete
    const result = await db.query(
      `
      UPDATE api_reviews
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error('Review not found');
    }

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
      VALUES ($1, 'DELETE', 'REVIEW', $2)
      `,
      [viewer.id, id]
    );
  }
}

export const adminMarketplaceService = new AdminMarketplaceService();
