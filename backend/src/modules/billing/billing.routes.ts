import { Router, Request, Response } from 'express';

import {
  getUserInvoices,
  getInvoiceById,
  getUserPayments,
  getBillingOverview,
  isValidStatusFilter,
  isValidPaymentStatusFilter,
  isUuid,
} from './billing.service';
import {
  isStripeConfigured,
  listPaymentMethods,
  createSetupSession,
  setDefaultPaymentMethod,
  removePaymentMethod,
} from './stripe.service';

const router = Router();

type RequestWithUser = Request & {
  user?: {
    id?: string;
  };
};

// TODO: replace with real auth middleware once available (JWT -> req.user.id).
// For now, the frontend can pass ?userId=<uuid> during local development only.
function getUserIdFromRequest(req: RequestWithUser): string | null {
  const authUserId = req.user?.id;
  if (authUserId) return authUserId;

  // Dev-only escape hatch so the billing UI can be built before auth lands.
  if (process.env.NODE_ENV !== 'production') {
    return (req.query.userId as string | undefined) || null;
  }

  return null;
}

function unauthorized(res: Response) {
  return res
    .status(401)
    .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
}

// ============ Get User Invoices ============
// GET /api/billing/invoices?page=1&limit=20&status=paid
router.get('/invoices', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const { page, limit, status } = req.query;

    // Reject unknown filters here rather than letting Postgres fail on the
    // invoice_status cast, which would surface as a 500.
    if (status !== undefined && !isValidStatusFilter(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'status must be one of: paid, unpaid, void',
        },
      });
    }

    const result = await getUserInvoices(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });

    res.json({
      success: true,
      data: result,
      message: 'Invoices retrieved successfully',
    });
  } catch (error) {
    // This is the route's fallback server-side diagnostic.
    // eslint-disable-next-line no-console
    console.error('Failed to get invoices', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get invoices' },
    });
  }
});

// ============ Get Payment History ============
// GET /api/billing/payments?page=1&limit=20&status=succeeded
//
// Registered before /invoices/:invoiceId is irrelevant here (different path),
// but note that any future /invoices/... literal route must come before it.
router.get('/payments', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const { page, limit, status } = req.query;

    if (status !== undefined && !isValidPaymentStatusFilter(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'status must be one of: succeeded, pending, failed, refunded',
        },
      });
    }

    const result = await getUserPayments(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });

    res.json({
      success: true,
      data: result,
      message: 'Payments retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get payments', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get payments' },
    });
  }
});

// ============ Billing Overview (dashboard) ============
// GET /api/billing/overview
router.get('/overview', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const overview = await getBillingOverview(userId);

    res.json({
      success: true,
      data: overview,
      message: 'Billing overview retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get billing overview', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get billing overview' },
    });
  }
});

/** Stripe is optional config, so say so plainly rather than failing as a 500. */
function stripeNotConfigured(res: Response) {
  return res.status(503).json({
    success: false,
    error: {
      code: 'STRIPE_NOT_CONFIGURED',
      message: 'Card management needs STRIPE_SECRET_KEY to be set on the server.',
    },
  });
}

// ============ List Payment Methods ============
// GET /api/billing/payment-methods
router.get('/payment-methods', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);
    if (!isStripeConfigured()) return stripeNotConfigured(res);

    const paymentMethods = await listPaymentMethods(userId);

    res.json({
      success: true,
      data: { paymentMethods },
      message: 'Payment methods retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to list payment methods', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list payment methods' },
    });
  }
});

// ============ Start Add-Card Flow ============
// POST /api/billing/payment-methods/setup-session  { returnUrl }
//
// Card details are entered on a Stripe-hosted page, so this only hands back
// the URL to send the person to.
router.post('/payment-methods/setup-session', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);
    if (!isStripeConfigured()) return stripeNotConfigured(res);

    const returnUrl = typeof req.body?.returnUrl === 'string' ? req.body.returnUrl : null;

    // Only allow returning to our own dev/app origins — an open redirect here
    // would let someone bounce users to an arbitrary site after checkout.
    const allowedPrefixes = ['http://localhost:3000', 'http://127.0.0.1:3000'];
    const isAllowed = returnUrl && allowedPrefixes.some((prefix) => returnUrl.startsWith(prefix));

    if (!isAllowed) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RETURN_URL',
          message: 'returnUrl must point at the Klyra frontend',
        },
      });
    }

    const url = await createSetupSession(userId, returnUrl);

    res.json({
      success: true,
      data: { url },
      message: 'Setup session created successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create setup session', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to start card setup' },
    });
  }
});

// ============ Set Default Card ============
// POST /api/billing/payment-methods/:paymentMethodId/default
router.post(
  '/payment-methods/:paymentMethodId/default',
  async (req: RequestWithUser, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return unauthorized(res);
      if (!isStripeConfigured()) return stripeNotConfigured(res);

      const paymentMethodId = String(req.params.paymentMethodId);
      await setDefaultPaymentMethod(userId, paymentMethodId);

      res.json({
        success: true,
        data: { id: paymentMethodId },
        message: 'Default payment method updated successfully',
      });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === 'NOT_FOUND' || code === 'resource_missing') {
        return res.status(404).json({
          success: false,
          error: { code: 'PAYMENT_METHOD_NOT_FOUND', message: 'Payment method not found' },
        });
      }

      // eslint-disable-next-line no-console
      console.error('Failed to set default payment method', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update default card' },
      });
    }
  },
);

// ============ Remove Card ============
// DELETE /api/billing/payment-methods/:paymentMethodId
router.delete(
  '/payment-methods/:paymentMethodId',
  async (req: RequestWithUser, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return unauthorized(res);
      if (!isStripeConfigured()) return stripeNotConfigured(res);

      const paymentMethodId = String(req.params.paymentMethodId);
      await removePaymentMethod(userId, paymentMethodId);

      res.json({
        success: true,
        data: { id: paymentMethodId },
        message: 'Payment method removed successfully',
      });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === 'NOT_FOUND' || code === 'resource_missing') {
        return res.status(404).json({
          success: false,
          error: { code: 'PAYMENT_METHOD_NOT_FOUND', message: 'Payment method not found' },
        });
      }

      // eslint-disable-next-line no-console
      console.error('Failed to remove payment method', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove card' },
      });
    }
  },
);

// ============ Get Single Invoice ============
// GET /api/billing/invoices/:invoiceId
router.get('/invoices/:invoiceId', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const { invoiceId } = req.params;

    // A malformed id would otherwise reach Postgres and fail as a 22P02.
    if (!isUuid(invoiceId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INVOICE_ID', message: 'invoiceId must be a UUID' },
      });
    }

    const invoice = await getInvoiceById(userId, invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
      });
    }

    res.json({
      success: true,
      data: invoice,
      message: 'Invoice retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get invoice', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get invoice' },
    });
  }
});

export default router;
