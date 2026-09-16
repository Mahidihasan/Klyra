import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function handleError(res: Response, route: string, err: unknown) {
  console.error(`Error in ${route}:`, err);
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ success: false, error: { message: msg, code: 'INTERNAL_ERROR' } });
}

// POST /api/v1/admin/security/emergency-lockdown
router.post('/emergency-lockdown', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id || (req as any).user?.sub || 'system';

    // Transaction to ensure both the setting and the audit log are created
    await prisma.$transaction(async (tx) => {
      // 1. Upsert the global lockdown flag
      await tx.system_settings.upsert({
        where: { key: 'emergency_lockdown' },
        update: { value: true, updated_at: new Date(), updated_by: adminId !== 'system' ? adminId : undefined },
        create: {
          key: 'emergency_lockdown',
          value: true,
          description: 'Global Emergency Lockdown Flag',
          is_public: false,
          updated_by: adminId !== 'system' ? adminId : undefined
        }
      });

      // 2. Log the critical action using an existing enum value
      await tx.auditLog.create({
        data: {
          action: 'SUSPEND',
          entity_type: 'system_settings',
          user_id: adminId !== 'system' ? adminId : undefined,
          new_values: {
            event: 'EMERGENCY_LOCKDOWN',
            reason: 'Admin triggered kill switch',
            timestamp: new Date().toISOString()
          }
        }
      });
    });

    return res.json({ success: true, message: 'Emergency lockdown engaged successfully.' });
  } catch (err) {
    return handleError(res, 'POST /security/emergency-lockdown', err);
  }
});

// GET /api/v1/admin/security/emergency-lockdown/status
router.get('/emergency-lockdown/status', async (req: Request, res: Response) => {
  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'emergency_lockdown' }
    });
    const isActive = setting?.value === true;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, lockdownActive: isActive });
  } catch (err) {
    return handleError(res, 'GET /security/emergency-lockdown/status', err);
  }
});

// POST /api/v1/admin/security/lift-lockdown
router.post('/lift-lockdown', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id || (req as any).user?.sub || 'system';

    await prisma.$transaction(async (tx) => {
      await tx.system_settings.upsert({
        where: { key: 'emergency_lockdown' },
        update: { value: false, updated_at: new Date(), updated_by: adminId !== 'system' ? adminId : undefined },
        create: {
          key: 'emergency_lockdown',
          value: false,
          description: 'Global Emergency Lockdown Flag',
          is_public: false,
          updated_by: adminId !== 'system' ? adminId : undefined
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE', // Use UPDATE as LIFT_LOCKDOWN is not in enum
          entity_type: 'system_settings',
          user_id: adminId !== 'system' ? adminId : undefined,
          new_values: {
            event: 'LIFT_LOCKDOWN',
            reason: 'Admin restored routing',
            timestamp: new Date().toISOString()
          }
        }
      });
    });

    return res.json({ success: true, message: 'Emergency lockdown lifted successfully.' });
  } catch (err) {
    return handleError(res, 'POST /security/lift-lockdown', err);
  }
});

export const adminSecurityRouter = router;
