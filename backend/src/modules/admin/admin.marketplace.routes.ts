import { Router } from 'express';
import { adminMarketplaceService } from './admin.marketplace.service';
import { requireAdmin } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// ===================== FEATURED APIs =====================

router.get(
  '/featured',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const featuredApis = await adminMarketplaceService.getFeaturedApis();
    res.json({ success: true, data: featuredApis });
  })
);

router.put(
  '/featured',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { apiIds } = req.body;
    await adminMarketplaceService.setFeaturedApis(req.user!, apiIds);
    res.json({ success: true });
  })
);

// ===================== CATEGORIES =====================

router.get(
  '/categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const categories = await adminMarketplaceService.getCategories();
    res.json({ success: true, data: categories });
  })
);

router.post(
  '/categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const category = await adminMarketplaceService.createCategory(req.user!, req.body);
    res.json({ success: true, data: category });
  })
);

router.put(
  '/categories/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const category = await adminMarketplaceService.updateCategory(req.user!, req.params.id, req.body);
    res.json({ success: true, data: category });
  })
);

router.delete(
  '/categories/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.deleteCategory(req.user!, req.params.id);
    res.json({ success: true });
  })
);

// ===================== REVIEWS =====================

router.get(
  '/reviews',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const reviews = await adminMarketplaceService.getReviews();
    res.json({ success: true, data: reviews });
  })
);

router.patch(
  '/reviews/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { isApproved } = req.body;
    await adminMarketplaceService.toggleReviewApproval(req.user!, req.params.id, isApproved);
    res.json({ success: true });
  })
);

router.delete(
  '/reviews/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.deleteReview(req.user!, req.params.id);
    res.json({ success: true });
  })
);

export const adminMarketplaceRouter = router;
