import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

const prisma = new PrismaClient();
const router = Router();

function handleError(res: Response, route: string, err: unknown) {
  console.error(`Error in ${route}:`, err);
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ success: false, error: { message: msg, code: 'INTERNAL_ERROR' } });
}

// GET /api/v1/admin/reports
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Fetch audit logs that are critical or relevant for moderation
    const logs = await prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      skip,
      include: {
        users: { select: { id: true, email: true, name: true, role: true } }
      }
    });

    const mappedReports = logs.map(log => {
      // Determine type based on entity_type
      let type: 'API' | 'USER' | 'REVIEW' = 'USER';
      if (log.entity_type === 'apis' || log.entity_type === 'api_keys') type = 'API';
      
      // Determine severity based on action
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (['BAN', 'SUSPEND', 'DELETE', 'ADMIN_KEY_RESET'].includes(log.action)) severity = 'critical';
      else if (['REJECT', 'REVOKE'].includes(log.action)) severity = 'high';
      else if (['UPDATE', 'APPROVE'].includes(log.action)) severity = 'medium';

      return {
        id: log.id,
        type,
        title: `Action: ${log.action} on ${log.entity_type}`,
        preview: `Admin/System action performed on ${log.entity_id}`,
        severity,
        reporter: log.users?.name || log.users?.email || 'System',
        target: `${log.entity_type}`,
        targetDetail: log.entity_id,
        date: formatDistanceToNow(new Date(log.created_at), { addSuffix: true }),
        unread: false,
        fullBody: `Audit Log Details:\n- Action: ${log.action}\n- Entity: ${log.entity_type} (${log.entity_id})\n- IP: ${log.ip_address || 'N/A'}\n- Agent: ${log.user_agent || 'N/A'}\n- Data: ${JSON.stringify(log.new_values, null, 2)}`,
        apiLogs: [] // Optional
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: mappedReports });
  } catch (err) {
    return handleError(res, 'GET /reports', err);
  }
});

export const adminReportsRouter = router;
