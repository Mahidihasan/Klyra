import { Router, Request, Response } from 'express';
import { catalogService } from './catalog.service';
import { requireAuth, authOptional } from '../auth/auth.middleware';
import { pool as db } from '../../services/database.service';
import { applyTransaction, getOrCreateWallet, WalletError } from '../wallet/wallet.service';
import { createTopUpCheckoutSession, getStripe, isStripeConfigured } from '../wallet/wallet.stripe';
import {
  activateMarketplaceSubscription,
  getMarketplacePurchaseQuote,
  MARKETPLACE_PAYGO_MAX_MONTHLY_REQUESTS,
} from './catalog.purchase';

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

router.get('/apis/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const apis = await catalogService.listOwnedApis(req.user!.sub);
    res.json({ success: true, data: apis });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to load your APIs' } });
  }
});

router.patch('/apis/:id/visibility', requireAuth, async (req: Request, res: Response) => {
  try {
    if (typeof req.body?.isPublic !== 'boolean') {
      return res.status(400).json({ success: false, error: { message: 'isPublic must be a boolean' } });
    }
    const updated = await catalogService.setOwnedApiVisibility(req.user!.sub, req.params.id, req.body.isPublic);
    if (!updated) return res.status(404).json({ success: false, error: { message: 'API not found' } });
    res.json({ success: true, data: { isPublic: req.body.isPublic } });
  } catch (err: any) {
    const status = err.message?.includes('Only published') ? 409 : 500;
    res.status(status).json({ success: false, error: { message: err.message || 'Failed to update API visibility' } });
  }
});

router.post('/apis/:id/remove-from-marketplace', requireAuth, async (req: Request, res: Response) => {
  try {
    const updated = await catalogService.removeOwnedApiFromMarketplace(req.user!.sub, req.params.id);
    if (!updated) return res.status(404).json({ success: false, error: { message: 'API not found' } });
    res.json({ success: true, data: { removed: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to remove API from Marketplace' } });
  }
});

router.delete('/apis/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await catalogService.deleteOwnedApi(
      req.user!.sub,
      req.params.id,
      req.query.deleteStudioProject === 'true',
      typeof req.query.studioProjectId === 'string' ? req.query.studioProjectId : undefined,
    );
    if (!deleted) return res.status(404).json({ success: false, error: { message: 'API not found' } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to delete API' } });
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
      requireApproval,
      studioProjectId,
      proposedStudioChanges,
      marketplaceAvailability,
      media,
      documentationMarkdown,
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

    const createdApi = await catalogService.publishApi(req.user!.sub, {
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
      requireApproval: Boolean(requireApproval),
      studioProjectId,
      proposedStudioChanges,
      marketplaceAvailability,
      media,
      documentationMarkdown,
    });

    res.status(201).json({
      success: true,
      data: createdApi,
      message:
        createdApi.status === 'PENDING'
          ? 'Approval request created. Your API listing will be published upon admin approval.'
          : 'API published successfully to marketplace',
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
    const { planId, includePaygo = false, monthlyRequests = 0 } = req.body;
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: { message: 'planId is required' },
      });
    }

    const quote = await getMarketplacePurchaseQuote({
      apiId: req.params.id,
      planId: String(planId),
      includePaygo: includePaygo === true,
      monthlyRequests: Number(monthlyRequests),
    });
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: { message: 'Subscription plan not found for this API' },
      });
    }

    if (quote.totalAmount === 0) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await activateMarketplaceSubscription(client, req.user!.sub, quote.apiId, quote.planId);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } else {
      const wallet = await getOrCreateWallet(req.user!.sub);
      if (wallet.currency !== quote.currency) {
        return res.status(409).json({ success: false, error: { message: 'Wallet currency does not match this plan.' } });
      }
      await applyTransaction(
        {
          userId: req.user!.sub,
          type: 'SPEND',
          direction: 'DEBIT',
          amount: quote.totalAmount,
          description: `Marketplace subscription · ${quote.apiName} · ${quote.planName}`,
          referenceType: 'marketplace_subscription',
          referenceId: quote.apiId,
          metadata: { planId: quote.planId, paygoAmount: quote.paygoAmount },
        },
        async (client) => activateMarketplaceSubscription(client, req.user!.sub, quote.apiId, quote.planId),
      );
    }

    res.json({
      success: true,
      data: { apiId: quote.apiId, planId: quote.planId, amount: quote.totalAmount },
      message: `Subscribed successfully to ${quote.planName}`,
    });
  } catch (err: any) {
    if (err instanceof WalletError) {
      const status = err.code === 'INSUFFICIENT_FUNDS' ? 409 : err.code === 'WALLET_LOCKED' ? 423 : 400;
      return res.status(status).json({ success: false, error: { code: err.code, message: err.message } });
    }
    res.status(500).json({
      success: false,
      error: { message: err.message || 'Failed to subscribe to API' },
    });
  }
});

router.post('/apis/:id/purchase-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const planId = String(req.body?.planId || '');
    const includePaygo = req.body?.includePaygo === true;
    const monthlyRequests = Number(req.body?.monthlyRequests ?? 0);
    const returnUrl = typeof req.body?.returnUrl === 'string' ? req.body.returnUrl : '';
    if (!planId) return res.status(400).json({ success: false, error: { message: 'planId is required' } });
    if (!Number.isInteger(monthlyRequests) || monthlyRequests < 0 || monthlyRequests > MARKETPLACE_PAYGO_MAX_MONTHLY_REQUESTS) {
      return res.status(400).json({ success: false, error: { message: 'Invalid monthly request estimate.' } });
    }
    if (!/^https?:\/\/(localhost|127\.0\.0\.1):3000(?:\/|$)/.test(returnUrl)) {
      return res.status(400).json({ success: false, error: { message: 'returnUrl must point at the Klyra frontend.' } });
    }
    const quote = await getMarketplacePurchaseQuote({
      apiId: req.params.id,
      planId,
      includePaygo,
      monthlyRequests,
    });
    if (!quote) return res.status(404).json({ success: false, error: { message: 'Subscription plan not found for this API' } });
    if (quote.totalAmount <= 0) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await activateMarketplaceSubscription(client, req.user!.sub, quote.apiId, quote.planId);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return res.json({ success: true, data: { completed: true, amount: 0 } });
    }
    if (!isStripeConfigured()) {
      return res.status(503).json({ success: false, error: { message: 'Payments are not configured on this environment.' } });
    }
    const parsedReturnUrl = new URL(returnUrl);
    const successUrl = `${parsedReturnUrl.origin}${parsedReturnUrl.pathname}${parsedReturnUrl.search}${parsedReturnUrl.search ? '&' : '?'}marketplace_session={CHECKOUT_SESSION_ID}${parsedReturnUrl.hash}`;
    const checkout = await createTopUpCheckoutSession({
      userId: req.user!.sub,
      amount: quote.totalAmount,
      currency: quote.currency,
      returnUrl,
      successUrl,
      purpose: 'marketplace_purchase',
      productName: `${quote.apiName} · ${quote.planName}`,
      productDescription: includePaygo
        ? `Marketplace subscription with Pay-as-you-go estimate for ${monthlyRequests} requests`
        : 'Marketplace API subscription',
      metadata: {
        klyraApiId: quote.apiId,
        klyraPlanId: quote.planId,
        klyraIncludePaygo: String(includePaygo),
        klyraMonthlyRequests: String(monthlyRequests),
        klyraTotalAmount: quote.totalAmount.toFixed(2),
        klyraCurrency: quote.currency.toUpperCase(),
      },
    });
    return res.json({ success: true, data: checkout });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || 'Failed to start payment' } });
  }
});

router.post('/purchase-session/:sessionId/confirm', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    if (!/^cs_[A-Za-z0-9_]{8,255}$/.test(sessionId)) {
      return res.status(404).json({ success: false, error: { message: 'Payment session not found.' } });
    }
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (
      session.metadata?.klyraPurpose !== 'marketplace_purchase' ||
      session.metadata?.klyraUserId !== req.user!.sub
    ) {
      return res.status(404).json({ success: false, error: { message: 'Payment session not found.' } });
    }
    if (session.payment_status !== 'paid') {
      return res.status(409).json({ success: false, error: { message: 'Payment has not completed.' } });
    }
    const apiId = session.metadata.klyraApiId;
    const planId = session.metadata.klyraPlanId;
    const expectedAmount = Number(session.metadata.klyraTotalAmount);
    const expectedCurrency = session.metadata.klyraCurrency;
    if (
      !Number.isFinite(expectedAmount) ||
      Math.abs((session.amount_total ?? 0) / 100 - expectedAmount) > 0.004 ||
      session.currency?.toUpperCase() !== expectedCurrency
    ) {
      return res.status(409).json({ success: false, error: { message: 'Payment no longer matches the current Marketplace pricing.' } });
    }
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await activateMarketplaceSubscription(client, req.user!.sub, apiId, planId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return res.json({ success: true, data: { apiId, planId, amount: expectedAmount } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || 'Failed to confirm payment' } });
  }
});

export const catalogRouter = router;
