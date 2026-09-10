import { db } from '../../../database';
import { AdminSubscriptionRow, GlobalTierTemplate } from './admin.subscriptions.types';
import { ViewerIdentity } from './admin.users.types';

export class AdminSubscriptionsService {
  async getSubscriptions(filters: { status?: string; search?: string }): Promise<AdminSubscriptionRow[]> {
    let query = \`
      SELECT 
        us.id,
        u.name AS "subscriberName",
        u.email AS "subscriberEmail",
        a.name AS "apiName",
        sp.name AS "planName",
        sp.billing_interval AS "billingInterval",
        us.period_end AS "periodEnd",
        us.status,
        us.auto_renew AS "autoRenew",
        us.created_at AS "createdAt"
      FROM user_subscriptions us
      JOIN users u ON u.id = us.user_id
      JOIN apis a ON a.id = us.api_id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE 1=1
    \`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += \` AND us.status = $\${paramIndex++}\`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += \` AND (u.email ILIKE $\${paramIndex} OR u.name ILIKE $\${paramIndex})\`;
      params.push(\`%\${filters.search}%\`);
      paramIndex++;
    }

    query += \` ORDER BY us.created_at DESC LIMIT 100\`;

    const result = await db.query(query, params);
    return result.rows;
  }

  async cancelSubscription(viewer: ViewerIdentity, id: string): Promise<void> {
    const result = await db.query(
      \`
      UPDATE user_subscriptions
      SET status = 'CANCELED', cancelled_at = NOW(), auto_renew = FALSE, updated_at = NOW()
      WHERE id = $1 AND status != 'CANCELED'
      RETURNING id, user_id, api_id
      \`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error('Subscription not found or already canceled');
    }

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
      VALUES ($1, 'UPDATE', 'SUBSCRIPTION', $2, $3)
      \`,
      [viewer.id, id, { status: 'CANCELED', manual_override: true }]
    );
  }

  async getGlobalTierTemplates(): Promise<GlobalTierTemplate[]> {
    const result = await db.query(\`SELECT value FROM system_settings WHERE key = 'global_tier_templates'\`);
    if (result.rows.length === 0 || !result.rows[0].value) {
      // Return defaults if none exist
      return [
        { id: '1', name: 'Free Tier', slug: 'free', description: 'Basic access', suggestedPrice: 0, features: ['Core Endpoints'], rateLimit: 100, rateLimitPeriod: 'MONTHLY' },
        { id: '2', name: 'Pro Tier', slug: 'pro', description: 'Production ready', suggestedPrice: 49, features: ['All Endpoints', 'Email Support'], rateLimit: 10000, rateLimitPeriod: 'MONTHLY' }
      ];
    }
    return result.rows[0].value as GlobalTierTemplate[];
  }

  async saveGlobalTierTemplates(viewer: ViewerIdentity, templates: GlobalTierTemplate[]): Promise<void> {
    await db.query(
      \`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('global_tier_templates', $1::jsonb, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      \`,
      [JSON.stringify(templates), viewer.id]
    );

    await db.query(
      \`
      INSERT INTO audit_logs (user_id, action, resource_type, details)
      VALUES ($1, 'UPDATE', 'TIER_TEMPLATES', $2)
      \`,
      [viewer.id, { templates }]
    );
  }
}

export const adminSubscriptionsService = new AdminSubscriptionsService();
