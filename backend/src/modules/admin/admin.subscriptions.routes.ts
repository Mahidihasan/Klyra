import { Router } from 'express';
import { adminSubscriptionsService } from './admin.subscriptions.service';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/',
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
  asyncHandler(async (req, res) => {
    await adminSubscriptionsService.cancelSubscription(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id);
    res.json({ success: true });
  })
);

router.get(
  '/templates',
  asyncHandler(async (req, res) => {
    const templates = await adminSubscriptionsService.getGlobalTierTemplates();
    res.json({ success: true, data: templates });
  })
);

router.put(
  '/templates',
  asyncHandler(async (req, res) => {
    await adminSubscriptionsService.saveGlobalTierTemplates(({ id: req.user!.sub, role: req.user!.role } as any), req.body.templates);
    res.json({ success: true });
  })
);

export const adminSubscriptionsRouter = router;
