import { Router } from 'express';
import { adminMarketplaceService } from './admin.marketplace.service';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// ===================== FEATURED APIs =====================

router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const featuredApis = await adminMarketplaceService.getFeaturedApis();
    res.json({ success: true, data: featuredApis });
  })
);

router.put(
  '/featured',
  asyncHandler(async (req, res) => {
    const { apiIds } = req.body;
    await adminMarketplaceService.setFeaturedApis(({ id: req.user!.sub, role: req.user!.role } as any), apiIds);
    res.json({ success: true });
  })
);

// ===================== CATEGORIES =====================

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await adminMarketplaceService.getCategories();
    res.json({ success: true, data: categories });
  })
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const category = await adminMarketplaceService.createCategory(({ id: req.user!.sub, role: req.user!.role } as any), req.body);
    res.json({ success: true, data: category });
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const category = await adminMarketplaceService.updateCategory(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id, req.body);
    res.json({ success: true, data: category });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.deleteCategory(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id);
    res.json({ success: true });
  })
);

// ===================== REVIEWS =====================

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await adminMarketplaceService.getReviews();
    res.json({ success: true, data: reviews });
  })
);

router.patch(
  '/reviews/:id/status',
  asyncHandler(async (req, res) => {
    const { isApproved } = req.body;
    await adminMarketplaceService.toggleReviewApproval(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id, isApproved);
    res.json({ success: true });
  })
);

router.delete(
  '/reviews/:id',
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.deleteReview(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id);
    res.json({ success: true });
  })
);

export const adminMarketplaceRouter = router;
