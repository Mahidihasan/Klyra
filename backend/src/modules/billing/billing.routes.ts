import { Router, Request, Response } from 'express';

import {
  getUserInvoices,
  getInvoiceById,
  getUserPayments,
  getBillingOverview,
  getMonthlySpending,
  getSpendingByApi,
  isValidStatusFilter,
  isValidPaymentStatusFilter,
  isUuid,
  getBillingInformation,
  saveBillingInformation,
  validateBillingInformation,
} from './billing.service';
import {
  isCloudinaryConfigured,
  renderInvoicePdf,
  storeInvoicePdf,
} from './billing.pdf.service';
import {
  isStripeConfigured,
  listPaymentMethods,
  createSetupSession,
  setDefaultPaymentMethod,
  removePaymentMethod,
  syncCustomerBillingDetails,
} from './stripe.service';
import { subscribeBillingEvents } from './realtime.service';

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

    // Stripe lives outside the service layer, so the default card is attached
    // here — and a Stripe outage shouldn't take the whole dashboard down.
    if (isStripeConfigured()) {
      try {
        const methods = await listPaymentMethods(userId);
        overview.defaultPaymentMethod =
          methods.find((method) => method.isDefault) ?? methods[0] ?? null;
      } catch (stripeError) {
        // eslint-disable-next-line no-console
        console.error('Could not attach default payment method to overview', stripeError);
      }
    }

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

// ============ Get Billing Information ============
// GET /api/billing/information
router.get('/information', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const information = await getBillingInformation(userId);

    res.json({
      success: true,
      data: { information },
      message: 'Billing information retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get billing information', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get billing information' },
    });
  }
});

// ============ Save Billing Information ============
// PUT /api/billing/information
router.put('/information', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const { values, errors } = validateBillingInformation(req.body);

    if (!values) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields need attention',
          fields: errors,
        },
      });
    }

    const information = await saveBillingInformation(userId, values);

    // Keep Stripe in step when it's configured, but never fail the save
    // because of it — the details are stored either way.
    if (isStripeConfigured()) {
      try {
        await syncCustomerBillingDetails(userId, information);
      } catch (stripeError) {
        // eslint-disable-next-line no-console
        console.error('Saved billing information but Stripe sync failed', stripeError);
      }
    }

    res.json({
      success: true,
      data: { information },
      message: 'Billing information saved successfully',
    });
  } catch (error) {
    if ((error as Error & { code?: string }).code === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // eslint-disable-next-line no-console
    console.error('Failed to save billing information', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save billing information' },
    });
  }
});

// ============ Realtime events (Server-Sent Events) ============
// GET /api/billing/events
//
// Streams `data:` frames whenever the user's billing data changes in the
// database. The client applies the change by re-fetching the relevant tab.
router.get('/events', (req: RequestWithUser, res: Response) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
    return;
  }

  // Keep the HTTP layer from buffering/time-ing out the long-lived stream.
  subscribeBillingEvents(userId, res);
});

// ============ Monthly Spending ============
// GET /api/billing/spending?months=6
router.get('/spending', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const months = req.query.months ? Number(req.query.months) : 6;
    if (Number.isNaN(months)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_MONTHS', message: 'months must be a number' },
      });
    }

    const points = await getMonthlySpending(userId, months);

    res.json({
      success: true,
      data: { points },
      message: 'Spending retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get spending', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get spending' },
    });
  }
});

// ============ Spending By API ============
// GET /api/billing/spending/by-api
//
// Must be registered before nothing in particular, but note it sits above the
// invoice routes only for readability — the paths don't overlap.
router.get('/spending/by-api', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const breakdown = await getSpendingByApi(userId);

    res.json({
      success: true,
      data: { breakdown },
      message: 'Spending by API retrieved successfully',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get spending by API', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get spending by API' },
    });
  }
});

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

// ============ Download Invoice PDF ============
// GET /api/billing/invoices/:invoiceId/pdf
//
// Registered after /invoices/:invoiceId, which is fine — Express matches on the
// full path, and this one is more specific.
router.get('/invoices/:invoiceId/pdf', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return unauthorized(res);

    const invoiceId = String(req.params.invoiceId);
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

    // Already uploaded once — send the person to the stored copy.
    if (invoice.pdfUrl) {
      return res.redirect(302, invoice.pdfUrl);
    }

    const billing = await getBillingInformation(userId);
    const buffer = await renderInvoicePdf(invoice, billing);

    // Cache to Cloudinary when it's configured, but never fail the download
    // because the upload did — the bytes are ready either way.
    if (isCloudinaryConfigured()) {
      try {
        const stored = await storeInvoicePdf(invoice.id, invoice.invoiceNumber, buffer);
        return res.redirect(302, stored.url);
      } catch (uploadError) {
        // eslint-disable-next-line no-console
        console.error('Generated invoice PDF but could not store it', uploadError);
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to build invoice PDF', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to build invoice PDF' },
    });
  }
});

export default router;
