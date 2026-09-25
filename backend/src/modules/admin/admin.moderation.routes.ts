import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { updateUserStatus, prepareImpersonation } from './admin.users.service';

const prisma = new PrismaClient();
const router = Router();

function handleError(res: Response, route: string, err: unknown) {
  console.error(`Error in ${route}:`, err);
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ success: false, error: { message: msg, code: 'INTERNAL_ERROR' } });
}

// Helper for auditing
function auditContext(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
  };
}

// GET /api/v1/admin/moderation/inbox
// Fetch flagged users, suspicious API activities, or pending support tickets.
router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const reports = await (prisma as any).moderationReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: reports });
  } catch (err) {
    return handleError(res, 'GET /moderation', err);
  }
});

// PATCH /api/v1/admin/moderation/:id/action
router.patch('/:id/action', async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).user?.sub;
    const actorRole = (req as any).user?.role;
    if (!actorId || !actorRole) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }});
    }

    const { action, reason } = req.body;
    // Map action to status
    const statusMap: Record<string, string> = {
      'SUSPEND': 'SUSPENDED',
      'BAN': 'BANNED',
      'RESTORE': 'ACTIVE'
    };
    
    const status = statusMap[action?.toUpperCase()] || action;

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid action/status', code: 'INVALID_STATUS' }});
    }

    const actor = { id: actorId, role: actorRole.toUpperCase() } as any;
    
    const data = await updateUserStatus(
      actor,
      req.params.id,
      status as any,
      typeof reason === 'string' ? reason.trim().slice(0, 500) || undefined : undefined,
      auditContext(req)
    );

    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, 'PATCH /moderation/users/:id/status', err);
  }
});

// POST /api/v1/admin/moderation/seed-test-data
router.post('/seed-test-data', async (req: Request, res: Response) => {
  try {
    await (prisma as any).moderationReport.createMany({
      data: [
        {
          type: 'API_ABUSE',
          title: 'Abnormal Rate Limit Abuse',
          preview: 'Multiple IPs associated with this API key are consistently hitting the 429 limit.',
          severity: 'high',
          reporter: 'System Watchdog',
          target: 'api_keys',
          targetDetail: 'key_prod_8f92j',
          unread: true,
          fullBody: 'Triggered 500+ Rate Limit Errors. Pattern suggests a distributed brute force attempt.',
          flaggedWords: ['brute force', '429', 'abuse']
        },
        {
          type: 'SECURITY_RISK',
          title: 'Suspicious Login Attempts from Blocked IP',
          preview: 'Failed logins from known blocked IP range.',
          severity: 'critical',
          reporter: 'Registration Filter',
          target: 'users',
          targetDetail: 'mock_user_id',
          unread: true,
          fullBody: 'Suspicious Login Attempts from Blocked IP datacenter in multiple bursts.',
          flaggedWords: ['blocked', 'proxy']
        }
      ]
    });
    res.json({ success: true, message: 'Seeded test records' });
  } catch (err) {
    return handleError(res, 'POST /seed-test-data', err);
  }
});

export const adminModerationRouter = router;
