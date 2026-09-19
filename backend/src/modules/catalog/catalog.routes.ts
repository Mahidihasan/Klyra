import { Router, Request, Response } from 'express';
import { catalogService } from './catalog.service';
import { requireAuth, authOptional } from '../auth/auth.middleware';
import { pool as db } from '../../services/database.service';
import { CertificatesService } from '../certificates/certificates.service';

const router = Router();

/**
 * GET /curated
 * Returns curated rails for the Marketplace home page:
 * Featured, Trending, Popular, Newly Launched, Recommended.
 */
router.get('/curated', authOptional, async (_req: Request, res: Response) => {
  try {
    const rails = await catalogService.getCuratedRails();
    res.json({
      success: true,
      data: rails,
      message: 'Curated rails retrieved successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to fetch curated rails' },
    });
  }
});

/**
 * GET /apis
 * Discover and browse APIs with multi-facet filters & sorting.
 */
router.get('/apis', authOptional, async (req: Request, res: Response) => {
  try {
    const {
      page,
      limit,
      search,
      category,
      pricingModel,
      minRating,
      maxLatency,
      sort,
      order,
    } = req.query;

    const result = await catalogService.browseApis({
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 16,
      search: search ? String(search) : undefined,
      category: category ? String(category) : undefined,
      pricingModel: pricingModel ? String(pricingModel) : undefined,
      minRating: minRating ? parseFloat(String(minRating)) : undefined,
      maxLatency: maxLatency ? parseInt(String(maxLatency), 10) : undefined,
      sort: sort as any,
      order: order as any,
    });

    res.json({
      success: true,
      data: result,
      message: 'APIs retrieved successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to search APIs' },
    });
  }
});

/**
 * GET /categories
 * List active marketplace categories with dynamic API counts.
 */
router.get('/categories', authOptional, async (_req: Request, res: Response) => {
  try {
    const categories = await catalogService.getCategories();
    res.json({
      success: true,
      data: { categories },
      message: 'Categories retrieved successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to fetch categories' },
    });
  }
});

/**
 * GET /apis/:idOrSlug
 * Full details of a single API.
 */
router.get('/apis/:idOrSlug', authOptional, async (req: Request, res: Response) => {
  try {
    const api = await catalogService.getApiBySlugOrId(req.params.idOrSlug);
    if (!api) {
      return res.status(404).json({
        success: false,
        error: { code: 'API_NOT_FOUND', message: 'API not found' },
      });
    }

    res.json({
      success: true,
      data: api,
      message: 'API details retrieved successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to load API details' },
    });
  }
});

/**
 * GET /apis/:id/reviews
 * User reviews for an API.
 */
router.get('/apis/:id/reviews', authOptional, async (req: Request, res: Response) => {
  try {
    const reviews = await catalogService.getApiReviews(req.params.id);
    res.json({
      success: true,
      data: reviews,
      message: 'API reviews retrieved successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to fetch API reviews' },
    });
  }
});

/**
 * POST /apis/:id/reviews
 * Submit a review for an API (requires authentication).
 */
router.post('/apis/:id/reviews', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rating, title, content } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: { message: 'Rating must be an integer between 1 and 5' },
      });
    }

    const review = await catalogService.createApiReview(req.user!.sub, req.params.id, {
      rating: Math.round(Number(rating)),
      title: title ? String(title).slice(0, 200) : undefined,
      content: content ? String(content).slice(0, 2000) : undefined,
    });

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to submit review' },
    });
  }
});

/**
 * GET /providers/:id
 * Public profile of an API provider.
 */
router.get('/providers/:id', authOptional, async (req: Request, res: Response) => {
  try {
    const provider = await catalogService.getProviderProfile(req.params.id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: { message: 'Provider profile not found' },
      });
    }

    res.json({
      success: true,
      data: provider,
      message: 'Provider profile retrieved successfully',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to fetch provider profile' },
    });
  }
});

/**
 * POST /apis
 * Self-serve provider publishing endpoint (requires authentication).
 */
router.post('/apis', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      categoryId,
      baseUrl,
      docsUrl,
      logoUrl,
      pricingModel,
      apiSpec,
      tags,
      plans,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: { message: 'API name must be at least 3 characters long' },
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: { message: 'API description must be at least 10 characters long' },
      });
    }

    if (!baseUrl || !baseUrl.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: { message: 'Base URL must start with http:// or https://' },
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Category is required' },
      });
    }

    const createdApi = await catalogService.publishApi(req.user!.sub, req.user!.role, {
      name: name.trim(),
      slug: slug?.trim(),
      description: description.trim(),
      categoryId,
      baseUrl: baseUrl.trim(),
      docsUrl: docsUrl?.trim(),
      logoUrl: logoUrl?.trim(),
      pricingModel: pricingModel || 'FREEMIUM',
      apiSpec,
      tags: Array.isArray(tags) ? tags : [],
      plans: Array.isArray(plans) ? plans : undefined,
    });
    await CertificatesService.ensureMarketplaceImpactCertificate(req.user!.sub);

    res.status(201).json({
      success: true,
      data: createdApi,
      message:
        req.user!.role === 'ADMIN'
          ? 'API published successfully to marketplace'
          : 'API submitted for review and published',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to publish API' },
    });
  }
});

/**
 * POST /apis/:id/subscribe
 * Subscribe authenticated user to an API tier.
 */
router.post('/apis/:id/subscribe', requireAuth, async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: { message: 'planId is required' },
      });
    }

    // Verify plan belongs to this API
    const planRes = await db.query(
      `SELECT id, price, name FROM subscription_plans WHERE id = $1 AND api_id = $2 AND is_active = true`,
      [planId, req.params.id]
    );

    if (planRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Subscription plan not found for this API' },
      });
    }

    // Upsert user_subscriptions
    const subRes = await db.query(
      `INSERT INTO user_subscriptions (user_id, api_id, plan_id, status, period_start)
       VALUES ($1, $2, $3, 'ACTIVE', NOW())
       ON CONFLICT (user_id, api_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = 'ACTIVE',
         updated_at = NOW()
       RETURNING id, status, period_start`,
      [req.user!.sub, req.params.id, planId]
    );

    // Bump total_subscribers counter on API
    await db.query(
      `UPDATE apis SET total_subscribers = total_subscribers + 1 WHERE id = $1`,
      [req.params.id]
    );

    const ownerResult = await db.query('SELECT owner_id FROM apis WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (ownerResult.rows[0]?.owner_id) {
      await CertificatesService.ensureMarketplaceImpactCertificate(ownerResult.rows[0].owner_id);
    }

    res.json({
      success: true,
      data: subRes.rows[0],
      message: `Subscribed successfully to ${planRes.rows[0].name}`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to subscribe to API' },
    });
  }
});

export const catalogRouter = router;
