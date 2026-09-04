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
  if (authUserId) {
    return authUserId;
  }

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
    if (!userId) {
      return unauthorized(res);
    }

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
    if (!userId) {
      return unauthorized(res);
    }

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
    if (!userId) {
      return unauthorized(res);
    }

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

// ============ Get Single Invoice ============
// GET /api/billing/invoices/:invoiceId
router.get('/invoices/:invoiceId', async (req: RequestWithUser, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return unauthorized(res);
    }

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
