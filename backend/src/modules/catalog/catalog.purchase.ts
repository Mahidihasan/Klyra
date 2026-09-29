import { PoolClient } from 'pg';
import { pool } from '../../services/database.service';

export const MARKETPLACE_PAYGO_FREE_REQUESTS = 10_000;
export const MARKETPLACE_PAYGO_RATE_PER_REQUEST = 0.0008;
export const MARKETPLACE_PAYGO_MAX_MONTHLY_REQUESTS = 5_000_000;

export interface MarketplacePurchaseQuote {
  apiId: string;
  apiName: string;
  planId: string;
  planName: string;
  planPrice: number;
  currency: string;
  billingInterval: string;
  paygoAmount: number;
  totalAmount: number;
}

export async function getMarketplacePurchaseQuote(input: {
  apiId: string;
  planId: string;
  includePaygo: boolean;
  monthlyRequests: number;
}): Promise<MarketplacePurchaseQuote | null> {
  if (
    !Number.isInteger(input.monthlyRequests) ||
    input.monthlyRequests < 0 ||
    input.monthlyRequests > MARKETPLACE_PAYGO_MAX_MONTHLY_REQUESTS
  ) {
    throw new Error(`Monthly requests must be between 0 and ${MARKETPLACE_PAYGO_MAX_MONTHLY_REQUESTS}.`);
  }

  const result = await pool.query(
    `SELECT a.id AS api_id, a.name AS api_name, p.id AS plan_id, p.name AS plan_name,
            p.price, p.currency, p.billing_interval
       FROM apis a
       JOIN subscription_plans p ON p.api_id = a.id
      WHERE a.id = $1 AND p.id = $2 AND a.deleted_at IS NULL
        AND a.status = 'PUBLISHED' AND a.is_public = TRUE
        AND p.is_active = TRUE AND p.deleted_at IS NULL`,
    [input.apiId, input.planId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const planPrice = Number(row.price);
  const paygoRequests = Math.max(0, input.monthlyRequests - MARKETPLACE_PAYGO_FREE_REQUESTS);
  const paygoAmount = input.includePaygo
    ? Math.round(paygoRequests * MARKETPLACE_PAYGO_RATE_PER_REQUEST * 100) / 100
    : 0;

  return {
    apiId: row.api_id,
    apiName: row.api_name,
    planId: row.plan_id,
    planName: row.plan_name,
    planPrice,
    currency: String(row.currency || 'USD').trim(),
    billingInterval: row.billing_interval,
    paygoAmount,
    totalAmount: Math.round((planPrice + paygoAmount) * 100) / 100,
  };
}

export async function activateMarketplaceSubscription(
  client: PoolClient,
  userId: string,
  apiId: string,
  planId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO user_subscriptions (user_id, api_id, plan_id, status, period_start)
     VALUES ($1, $2, $3, 'ACTIVE', NOW())
     ON CONFLICT (user_id, api_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = 'ACTIVE',
       period_start = CASE
         WHEN user_subscriptions.plan_id = EXCLUDED.plan_id THEN user_subscriptions.period_start
         ELSE NOW()
       END,
       updated_at = NOW()`,
    [userId, apiId, planId],
  );
}

