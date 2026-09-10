import { Router } from 'express';
import { adminUsageService } from './admin.usage.service';
import { requireAdmin } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/telemetry',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = await adminUsageService.getTelemetry();
    res.json({ success: true, data: payload });
  })
);

export const adminUsageRouter = router;
