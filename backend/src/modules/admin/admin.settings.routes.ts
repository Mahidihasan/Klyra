import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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
router.put('/gateway', async (req: Request, res: Response) => {
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

export const adminSettingsRouter = router;
