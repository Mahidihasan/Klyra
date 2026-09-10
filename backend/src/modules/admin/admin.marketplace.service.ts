import { db } from '../../../database';
import { logger } from '../../../utils/logger';
import {
  FeaturedApiRow,
  AdminCategoryRow,
  AdminReviewRow,
  CategoryPayload,
} from './admin.marketplace.types';
import { ViewerIdentity } from './admin.users.types';

export class AdminMarketplaceService {
  // ===================== FEATURED APIs =====================

  async getFeaturedApis(): Promise<FeaturedApiRow[]> {
    const result = await db.query(
      \`
      SELECT value
      FROM system_settings
      WHERE key = 'featured_apis'
      \`
    );

    const apiIds: string[] = result.rows[0]?.value || [];

    if (apiIds.length === 0) {
      return [];
    }

    const apisResult = await db.query(
      \`
      SELECT 
        a.id, 
        a.name, 
        v.logo_url AS "logoUrl",
        u.name AS "ownerName",
        c.name AS "categoryName"
      FROM apis a
      LEFT JOIN api_versions v ON v.api_id = a.id AND v.is_current = true
      LEFT JOIN users u ON u.id = a.owner_id
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE a.id = ANY($1)
      \`,
      [apiIds]
    );

    // Return in the exact order specified by the system setting
    const apiMap = new Map(apisResult.rows.map(row => [row.id, row]));
    return apiIds.map(id => apiMap.get(id)).filter(Boolean) as FeaturedApiRow[];
  }

  async setFeaturedApis(viewer: ViewerIdentity, apiIds: string[]): Promise<void> {
    await db.query(
      \`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('featured_apis', $1::jsonb, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      \`,
      [JSON.stringify(apiIds), viewer.id]
    );

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, details)
      VALUES ($1, 'UPDATE', 'FEATURED_APIS', $2)
      \`,
      [viewer.id, { apiIds }]
    );
  }

  // ===================== CATEGORIES =====================

  async getCategories(): Promise<AdminCategoryRow[]> {
    const result = await db.query(
      \`
      SELECT 
        c.id, c.name, c.slug, c.description, c.icon_url AS "iconUrl", 
        c.sort_order AS "sortOrder", c.is_active AS "isActive", c.created_at AS "createdAt",
        (SELECT COUNT(*) FROM apis WHERE category_id = c.id) AS "apiCount"
      FROM categories c
      ORDER BY c.sort_order ASC, c.name ASC
      \`
    );
    return result.rows;
  }

  async createCategory(viewer: ViewerIdentity, payload: CategoryPayload): Promise<AdminCategoryRow> {
    const result = await db.query(
      \`
      INSERT INTO categories (name, slug, description, icon_url, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, slug, description, icon_url AS "iconUrl", sort_order AS "sortOrder", is_active AS "isActive", created_at AS "createdAt"
      \`,
      [payload.name, payload.slug, payload.description || null, payload.iconUrl || null, payload.sortOrder || 0, payload.isActive ?? true]
    );

    const category = { ...result.rows[0], apiCount: 0 } as AdminCategoryRow;

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES ($1, 'CREATE', 'CATEGORY', $2, $3)
      \`,
      [viewer.id, category.id, payload]
    );

    return category;
  }

  async updateCategory(viewer: ViewerIdentity, id: string, payload: CategoryPayload): Promise<AdminCategoryRow> {
    const result = await db.query(
      \`
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
      \`,
      [id, payload.name, payload.slug, payload.description, payload.iconUrl, payload.sortOrder, payload.isActive]
    );

    if (result.rowCount === 0) {
      throw new Error('Category not found');
    }

    const apiCountResult = await db.query('SELECT COUNT(*) FROM apis WHERE category_id = $1', [id]);
    const category = { ...result.rows[0], apiCount: parseInt(apiCountResult.rows[0].count, 10) } as AdminCategoryRow;

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES ($1, 'UPDATE', 'CATEGORY', $2, $3)
      \`,
      [viewer.id, id, payload]
    );

    return category;
  }

  async deleteCategory(viewer: ViewerIdentity, id: string): Promise<void> {
    const result = await db.query('DELETE FROM categories WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new Error('Category not found');
    }

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
      VALUES ($1, 'DELETE', 'CATEGORY', $2)
      \`,
      [viewer.id, id]
    );
  }

  // ===================== REVIEWS =====================

  async getReviews(): Promise<AdminReviewRow[]> {
    const result = await db.query(
      \`
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
      \`
    );
    return result.rows;
  }

  async toggleReviewApproval(viewer: ViewerIdentity, id: string, isApproved: boolean): Promise<void> {
    const result = await db.query(
      \`
      UPDATE api_reviews
      SET is_approved = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id
      \`,
      [id, isApproved]
    );

    if (result.rowCount === 0) {
      throw new Error('Review not found');
    }

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES ($1, 'UPDATE', 'REVIEW', $2, $3)
      \`,
      [viewer.id, id, { isApproved }]
    );
  }

  async deleteReview(viewer: ViewerIdentity, id: string): Promise<void> {
    // Soft delete
    const result = await db.query(
      \`
      UPDATE api_reviews
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      \`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error('Review not found');
    }

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
      VALUES ($1, 'DELETE', 'REVIEW', $2)
      \`,
      [viewer.id, id]
    );
  }
}

export const adminMarketplaceService = new AdminMarketplaceService();
