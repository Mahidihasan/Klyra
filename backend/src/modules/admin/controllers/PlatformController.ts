import { Request, Response } from 'express';
import { pool } from '../../../services/database.service';

// Mock state for maintenance mode
export let isMaintenanceModeActive = false;

export const getMaintenanceStatus = () => isMaintenanceModeActive;

export const PlatformController = {
  acknowledgeAlerts: async (req: Request, res: Response) => {
    return res.status(200).json({ 
      success: true, 
      message: "All system node alerts acknowledged and cleared." 
    });
  },

  exportMetrics: async (req: Request, res: Response) => {
    const csvData = `Node,Latency,Status\nUS-East,12ms,Active\nEU-Central,45ms,Warning\nAP-South,110ms,Error`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="klyra_metrics.csv"');
    
    return res.status(200).send(csvData);
  },

  toggleMaintenance: async (req: Request, res: Response) => {
    isMaintenanceModeActive = !isMaintenanceModeActive;
    return res.status(200).json({ 
      success: true, 
      message: "Maintenance Mode updated.", 
      isActive: isMaintenanceModeActive 
    });
  },

  /**
   * GET /api/v1/admin/platform/top-apis
   * Returns the top 5 APIs ranked by total_requests, with a week-over-week
   * trend percentage computed from api_analytics_daily.
   */
  getTopApis: async (_req: Request, res: Response) => {
    try {
      const result = await pool.query<{
        id: string;
        name: string;
        owner_id: string;
        owner_name: string;
        total_requests: string;
        current_week: string;
        prev_week: string;
      }>(`
        SELECT
          a.id,
          a.name,
          a.owner_id,
          COALESCE(u.name, a.owner_id) AS owner_name,
          a.total_requests,
          -- Requests in the last 7 days
          COALESCE((
            SELECT SUM(total_requests)
            FROM api_analytics_daily
            WHERE api_id = a.id AND date >= CURRENT_DATE - INTERVAL '7 days'
          ), 0) AS current_week,
          -- Requests in the prior 7 days (8-14 days ago) for WoW trend
          COALESCE((
            SELECT SUM(total_requests)
            FROM api_analytics_daily
            WHERE api_id = a.id
              AND date >= CURRENT_DATE - INTERVAL '14 days'
              AND date < CURRENT_DATE - INTERVAL '7 days'
          ), 0) AS prev_week
        FROM apis a
        LEFT JOIN users u ON u.id = a.owner_id
        WHERE a.deleted_at IS NULL
          AND a.status = 'ACTIVE'
        ORDER BY a.total_requests DESC
        LIMIT 5
      `);

      const apis = result.rows.map((row) => {
        const currentWeek = Number(row.current_week) || 0;
        const prevWeek = Number(row.prev_week) || 0;
        let trend = 0;
        if (prevWeek > 0) {
          trend = Math.round(((currentWeek - prevWeek) / prevWeek) * 1000) / 10;
        } else if (currentWeek > 0) {
          trend = 100; // New traffic this week, no prior baseline
        }

        return {
          id: row.id,
          name: row.name,
          provider: row.owner_name,
          totalRequests: Number(row.total_requests) || 0,
          trend,
        };
      });

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ success: true, apis });
    } catch (err) {
      console.error('[PlatformController] getTopApis error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch top APIs' });
    }
  },
};
