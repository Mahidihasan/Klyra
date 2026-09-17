import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { checkPermission } from '../auth/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

function handleError(res: Response, route: string, err: unknown) {
  console.error(`Error in ${route}:`, err);
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ success: false, error: { message: msg, code: 'INTERNAL_ERROR' } });
}

// GET /api/v1/admin/settings/gateway
router.get('/gateway', async (req: Request, res: Response) => {
  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'gateway_limits' }
    });

    // Default if not found
    let limits = {
      Free: { rpm: 60, burst: 100 },
      Pro: { rpm: 1000, burst: 2500 },
      Enterprise: { rpm: 10000, burst: 50000 }
    };
    if (setting && setting.value) {
      limits = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: limits });
  } catch (err) {
    return handleError(res, 'GET /settings/gateway', err);
  }
});

// PUT /api/v1/admin/settings/gateway
router.put('/gateway', checkPermission('EDIT_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const limits = req.body.limits;

    if (!limits || typeof limits !== 'object') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'limits object is required' } });
    }

    const setting = await prisma.system_settings.upsert({
      where: { key: 'gateway_limits' },
      update: { value: limits, updated_at: new Date() },
      create: {
        key: 'gateway_limits',
        value: limits,
        description: 'Global API Gateway Rate Limits (Tiered)',
        is_public: false
      }
    });

    return res.json({ success: true, data: limits });
  } catch (err) {
    return handleError(res, 'PUT /settings/gateway', err);
  }
});

// GET /api/v1/admin/settings/core
router.get('/core', async (req: Request, res: Response) => {
  try {
    let settings = await prisma.coreSettings.findFirst();

    if (!settings) {
      settings = await prisma.coreSettings.create({
        data: {
          id: 'singleton',
          platformName: 'My SaaS Platform',
          supportEmail: 'support@example.com',
          maintenanceMode: false,
          systemTimezone: 'UTC',
          brandColor: '#6366f1',
          logoUrl: '',
          faviconUrl: '',
          ogImageUrl: ''
        }
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: settings });
  } catch (err) {
    return handleError(res, 'GET /settings/core', err);
  }
});

// PUT /api/v1/admin/settings/core
router.put('/core', checkPermission('EDIT_SETTINGS'), async (req: Request, res: Response) => {
  try {
    const { platformName, supportEmail, systemTimezone, maintenanceMode, brandColor, logoUrl, faviconUrl, ogImageUrl } = req.body;
    
    if (typeof req.body !== 'object') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Payload must be an object' } });
    }

    const adminId = (req as any).user?.sub;

    const existingSetting = await prisma.coreSettings.findFirst();

    let updatedSettings;

    if (existingSetting) {
      updatedSettings = await prisma.coreSettings.update({
        where: { id: existingSetting.id },
        data: { platformName, supportEmail, systemTimezone, maintenanceMode, brandColor, logoUrl, faviconUrl, ogImageUrl }
      });
    } else {
      updatedSettings = await prisma.coreSettings.create({
        data: { 
          platformName: platformName || 'My SaaS Platform', 
          supportEmail: supportEmail || 'support@example.com', 
          systemTimezone: systemTimezone || 'UTC',
          maintenanceMode: maintenanceMode || false,
          brandColor: brandColor || '#6366f1',
          logoUrl: logoUrl || '',
          faviconUrl: faviconUrl || '',
          ogImageUrl: ogImageUrl || ''
        }
      });
    }

    await (prisma as any).auditLog.create({
      data: {
        action: 'UPDATE',
        entity_type: 'core_settings',
        entity_id: 'singleton',
        user_id: adminId || '00000000-0000-0000-0000-000000000000',
        new_values: req.body as any,
        ip_address: req.ip || 'unknown'
      }
    });

    return res.json({ success: true, data: updatedSettings });
  } catch (err) {
    return handleError(res, 'PUT /settings/core', err);
  }
});

export const adminSettingsRouter = router;
