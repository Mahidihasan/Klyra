import { pool as db } from '../../services/database.service';
import { AdminAuditLog } from './admin.activity.types';

export class AdminActivityService {
  async getActivityLogs(filters: {
    severity?: string;
    entity?: string; // Maps to resource_type
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLog[]> {
    let query = `
      SELECT 
        a.id,
        a.user_id as "userId",
        u.name as "actorName",
        a.action,
        a.entity_type as "resourceType",
        a.entity_id as "resourceId",
        a.new_values as "details",
        'INFO' as "severity",
        a.ip_address as "ipAddress",
        a.created_at as "createdAt"
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.severity) {
      // severity is not a column in audit_logs, so we can't filter by it on DB level easily without custom JSON logic. We ignore it for now.
    }

    if (filters.entity) {
      query += ` AND a.entity_type = $${paramIndex++}`;
      params.push(filters.entity);
    }

    if (filters.search) {
      query += ` AND (
        a.action ILIKE $${paramIndex} OR 
        u.name ILIKE $${paramIndex} OR 
        a.new_values::text ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC `;
    
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }
}

export const adminActivityService = new AdminActivityService();
