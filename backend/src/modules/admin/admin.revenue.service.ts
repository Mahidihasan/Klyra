import { pool as db } from '../../services/database.service';
import { RevenueAnalytics, ProviderPayoutRow } from './admin.revenue.types';
import { ViewerIdentity } from './admin.users.types';

export class AdminRevenueService {
  async getAnalytics(range: '7d' | '30d' | '1y'): Promise<RevenueAnalytics> {
    let interval = '30 days';
    if (range === '7d') interval = '7 days';
    if (range === '1y') interval = '1 year';

    // 1. Gross Volume
    const grossResult = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE status = 'SUCCESS' AND created_at >= NOW() - $1::interval
      `,
      [interval]
    );
    const grossVolume = parseFloat(grossResult.rows[0].total);
    const klyraCut = grossVolume * 0.20; // 20% platform cut

    // 2. Pending Payouts
    const pendingResult = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM provider_payouts
      WHERE status = 'PENDING'
      `
    );
    const pendingPayouts = parseFloat(pendingResult.rows[0].total);

    const netRevenue = grossVolume - klyraCut; // Total generated minus platform cut = what goes to providers

    // 3. Time Series
    // Group by day for 7d/30d, by month for 1y
    const truncFormat = range === '1y' ? 'month' : 'day';
    
    const timeSeriesResult = await db.query(
      `
      SELECT 
        DATE_TRUNC($2, created_at) as date,
        COALESCE(SUM(amount), 0) as volume
      FROM payments
      WHERE status = 'SUCCESS' AND created_at >= NOW() - $1::interval
      GROUP BY DATE_TRUNC($2, created_at)
      ORDER BY date ASC
      `,
      [interval, truncFormat]
    );

    const timeSeries = timeSeriesResult.rows.map((r: any) => ({
      date: new Date(r.date).toISOString(),
      volume: parseFloat(r.volume)
    }));

    // If no data, provide an empty array (frontend handles padding if necessary)
    return {
      grossVolume,
      klyraCut,
      pendingPayouts,
      netRevenue: klyraCut, // The prompt mentions "Net Revenue", which usually means Klyra's net. Let's return Klyra's cut as the net revenue.
      timeSeries
    };
  }

  async getPayouts(): Promise<ProviderPayoutRow[]> {
    const result = await db.query(
      `
      SELECT 
        p.id,
        p.provider_id AS "providerId",
        u.name AS "providerName",
        u.email AS "providerEmail",
        p.amount,
        p.currency,
        p.status,
        p.stripe_account_id AS "stripeAccountId",
        p.created_at AS "createdAt",
        p.processed_at AS "processedAt"
      FROM provider_payouts p
      JOIN users u ON u.id = p.provider_id
      ORDER BY p.created_at DESC
      LIMIT 100
      `
    );
    return result.rows.map((row: any) => ({
      ...row,
      amount: parseFloat(row.amount)
    }));
  }

  async approvePayout(viewer: ViewerIdentity, id: string): Promise<void> {
    const result = await db.query(
      `
      UPDATE provider_payouts
      SET status = 'PROCESSED', processed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING id, provider_id, amount
      `,
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error('Payout not found or already processed');
    }

    await db.query(
      `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
      VALUES ($1, 'UPDATE', 'PAYOUT', $2, $3)
      `,
      [viewer.id, id, { status: 'PROCESSED' }]
    );
  }
}

export const adminRevenueService = new AdminRevenueService();
