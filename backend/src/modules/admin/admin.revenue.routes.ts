import { Router } from 'express';
import { adminRevenueService } from './admin.revenue.service';
import { requireAdmin } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/analytics',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const range = (req.query.range as '7d' | '30d' | '1y') || '30d';
    const analytics = await adminRevenueService.getAnalytics(range);
    res.json({ success: true, data: analytics });
  })
);

router.get(
  '/payouts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payouts = await adminRevenueService.getPayouts();
    res.json({ success: true, data: payouts });
  })
);

router.post(
  '/payouts/:id/approve',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await adminRevenueService.approvePayout(req.user!, req.params.id);
    res.json({ success: true });
  })
);

export const adminRevenueRouter = router;
