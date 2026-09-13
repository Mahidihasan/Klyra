import { Router } from 'express';
import { adminRevenueService } from './admin.revenue.service';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const range = (req.query.range as '7d' | '30d' | '1y') || '30d';
    const analytics = await adminRevenueService.getAnalytics(range);
    res.json({ success: true, data: analytics });
  })
);

router.get(
  '/payouts',
  asyncHandler(async (req, res) => {
    const payouts = await adminRevenueService.getPayouts();
    res.json({ success: true, data: payouts });
  })
);

router.post(
  '/payouts/:id/approve',
  asyncHandler(async (req, res) => {
    await adminRevenueService.approvePayout(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id);
    res.json({ success: true });
  })
);

export const adminRevenueRouter = router;
