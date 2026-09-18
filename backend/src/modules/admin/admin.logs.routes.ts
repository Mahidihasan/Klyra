import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router();

// GET /api/v1/admin/logs/system - Fetch audit logs for the System Logs terminal
router.get('/system', async (req, res) => {
  try {

    const logs = await (prisma as any).auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
      include: { users: { select: { email: true, id: true } } }
    });

    // Reverse so the newest logs appear at the bottom (chat-style)
    logs.reverse();

    const formattedLogs = logs.map((log: any) => ({
      id: log.id,
      time: log.created_at,
      level: log.action.includes('DELETE') || log.action.includes('BAN') || log.action.includes('SUSPEND') 
             ? 'ERROR' 
             : log.action.includes('UPDATE') ? 'WARN' : 'INFO',
      module: log.entity_type,
      action: log.action,
      user: log.users?.email || log.user_id || 'System',
      details: log.new_values?.details || log.new_values?.reason || (log.entity_id ? `Target: ${log.entity_id}` : 'N/A'),
      ip: log.ip_address || 'Unknown'
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.json(formattedLogs);
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

// GET /api/v1/admin/logs/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await (prisma as any).auditLog.findMany({
      take: 100,
      orderBy: { created_at: 'desc' }
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export const AdminLogsRoutes = router;
