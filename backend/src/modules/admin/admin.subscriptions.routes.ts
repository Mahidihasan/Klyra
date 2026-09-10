import { Router } from 'express';
import { adminSubscriptionsService } from './admin.subscriptions.service';
import { requireAdmin } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const subscriptions = await adminSubscriptionsService.getSubscriptions({
      status: status as string,
      search: search as string,
    });
    res.json({ success: true, data: subscriptions });
  })
);

router.post(
  '/:id/cancel',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await adminSubscriptionsService.cancelSubscription(req.user!, req.params.id);
    res.json({ success: true });
  })
);

router.get(
  '/templates',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const templates = await adminSubscriptionsService.getGlobalTierTemplates();
    res.json({ success: true, data: templates });
  })
);

router.put(
  '/templates',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await adminSubscriptionsService.saveGlobalTierTemplates(req.user!, req.body.templates);
    res.json({ success: true });
  })
);

export const adminSubscriptionsRouter = router;
