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
    const { configs } = req.body;
    await adminMarketplaceService.setFeaturedApis(({ id: req.user!.sub, role: req.user!.role } as any), configs);
    res.json({ success: true });
  })
);

router.post(
  '/featured',
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.addFeaturedApi(({ id: req.user!.sub, role: req.user!.role } as any), req.body);
    res.json({ success: true });
  })
);

router.delete(
  '/featured/:id',
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.removeFeaturedApi(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id);
    res.json({ success: true });
  })
);

// ===================== TRENDING APIs =====================

router.get(
  '/trending',
  asyncHandler(async (req, res) => {
    const data = await adminMarketplaceService.getTrendingApis();
    const weights = await adminMarketplaceService.getTrendingWeights();
    res.json({ success: true, data: { apis: data, weights } });
  })
);

router.patch(
  '/trending/weights',
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.setTrendingWeights(({ id: req.user!.sub, role: req.user!.role } as any), req.body);
    res.json({ success: true });
  })
);

router.post(
  '/trending/override',
  asyncHandler(async (req, res) => {
    await adminMarketplaceService.setTrendingOverride(({ id: req.user!.sub, role: req.user!.role } as any), req.body);
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
    try {
      await adminMarketplaceService.deleteCategory(({ id: req.user!.sub, role: req.user!.role } as any), req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'CONFLICT') {
        res.status(409).json({ success: false, error: { code: 'CONFLICT', message: err.message } });
      } else {
        throw err;
      }
    }
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
