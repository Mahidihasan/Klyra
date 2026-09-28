// Wallet HTTP layer.
//
// Every route is behind requireAuth and reads the user id from the JWT
// subject. There is no ?userId= fallback: billing carries one for historical
// reasons and it is not a pattern to put on endpoints that move money.
//
// Response envelope matches billing:
//   { success: true, data }
//   { success: false, error: { code, message } }

import { Router, Request, Response } from 'express';

import { requireAuth } from '../auth/auth.middleware';

import {
  cancelTopUpSession,
  getOrCreateWallet,
  getTopUpSessionByStripeId,
  getWalletSummary,
  getWalletTransactions,
  isValidTransactionFilter,
  normalizeAmount,
  recordTopUpSession,
  MAX_TOPUP_AMOUNT,
  WalletError,
} from './wallet.service';
import {
  createTopUpCheckoutSession,
  expireCheckoutSession,
  isStripeConfigured,
} from './wallet.stripe';
import { subscribeWalletEvents } from './realtime.service';
import {
  TopUpSessionResponse,
  WalletErrorCode,
  WalletOverview,
  WalletSummaryResponse,
  WalletTransactionFilter,
} from './wallet.types';

const router = Router();

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------

const STATUS_BY_CODE: Record<WalletErrorCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_AMOUNT: 400,
  INVALID_RETURN_URL: 400,
  INSUFFICIENT_FUNDS: 409,
  WALLET_LOCKED: 423,
  STRIPE_NOT_CONFIGURED: 503,
  INVALID_SIGNATURE: 400,
  INTERNAL_ERROR: 500,
  TOPUP_SESSION_NOT_FOUND: 404,
};

function fail(res: Response, code: WalletErrorCode, message: string) {
  return res.status(STATUS_BY_CODE[code]).json({
    success: false,
    error: { code, message },
  });
}

/**
 * Maps a thrown error onto the documented codes.
 *
 * A WalletError carries its own code. Anything else is a bug, so it is logged
 * in full and reported as INTERNAL_ERROR — the message is never echoed to the
 * client, because a database error string is not something to hand out.
 */
function handleError(res: Response, error: unknown, context: string) {
  if (error instanceof WalletError) {
    return fail(res, error.code, error.message);
  }
  console.error(`[wallet] ${context}:`, error);
  return fail(res, 'INTERNAL_ERROR', 'Something went wrong handling your wallet.');
}

/** requireAuth guarantees req.user; this keeps the assertion in one place. */
function userIdOf(req: Request): string {
  return req.user!.sub;
}

// ---------------------------------------------------------------------------
// GET /api/wallet — balance, lock state, pending top-ups, recent activity
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const summary = await getWalletSummary(userIdOf(req), { recentLimit: 5 });

    const data: WalletOverview = {
      wallet: summary.wallet,
      pendingTopUp: summary.pendingTopUp,
      pendingSessions: summary.pendingSessions,
      recentTransactions: summary.recentTransactions,
    };

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'GET /');
  }
});

// ---------------------------------------------------------------------------
// GET /api/wallet/summary — the monthly series behind the Overview chart
// ---------------------------------------------------------------------------

router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const monthsParam = req.query.months;
    const months = monthsParam === undefined ? 6 : Number(monthsParam);
    if (!Number.isFinite(months) || months < 1 || months > 24) {
      return fail(res, 'INVALID_AMOUNT', 'months must be a number between 1 and 24.');
    }

    const summary = await getWalletSummary(userIdOf(req), { months });

    const data: WalletSummaryResponse = {
      wallet: summary.wallet,
      pendingTopUp: summary.pendingTopUp,
      monthly: summary.monthly,
    };

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'GET /summary');
  }
});

// ---------------------------------------------------------------------------
// GET /api/wallet/transactions — paginated ledger
// ---------------------------------------------------------------------------

router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, type, from, to } = req.query;

    if (page !== undefined && (!Number.isFinite(Number(page)) || Number(page) < 1)) {
      return fail(res, 'INVALID_AMOUNT', 'page must be a positive number.');
    }
    if (limit !== undefined && (!Number.isFinite(Number(limit)) || Number(limit) < 1)) {
      return fail(res, 'INVALID_AMOUNT', 'limit must be a positive number.');
    }
    if (type !== undefined && !isValidTransactionFilter(type)) {
      return fail(
        res,
        'INVALID_AMOUNT',
        'type must be one of all, topups, spending, refunds, adjustments.',
      );
    }

    const result = await getWalletTransactions(userIdOf(req), {
      page: page === undefined ? undefined : Number(page),
      limit: limit === undefined ? undefined : Number(limit),
      type: type as WalletTransactionFilter | undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, 'GET /transactions');
  }
});

// ---------------------------------------------------------------------------
// POST /api/wallet/topup/session — start a hosted Stripe Checkout
// ---------------------------------------------------------------------------

// Same allowlist billing's setup-session route uses, for the same reason:
// without it this endpoint is an open redirect.
const ALLOWED_RETURN_PREFIXES = ['http://localhost:3000', 'http://127.0.0.1:3000'];

router.post('/topup/session', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      return fail(
        res,
        'STRIPE_NOT_CONFIGURED',
        'Payments are not configured on this environment.',
      );
    }

    // normalizeAmount does the shape checks (finite, positive, at most two
    // decimals) and throws InvalidAmountError, which handleError maps to 400.
    const amount = normalizeAmount(req.body?.amount);
    if (amount > MAX_TOPUP_AMOUNT) {
      return fail(
        res,
        'INVALID_AMOUNT',
        `A single top-up cannot exceed ${MAX_TOPUP_AMOUNT.toLocaleString('en-US')}.`,
      );
    }

    const returnUrl = typeof req.body?.returnUrl === 'string' ? req.body.returnUrl : null;
    const allowed =
      returnUrl && ALLOWED_RETURN_PREFIXES.some((prefix) => returnUrl.startsWith(prefix));
    if (!allowed) {
      return fail(res, 'INVALID_RETURN_URL', 'returnUrl must point at the Klyra frontend.');
    }

    const userId = userIdOf(req);
    const wallet = await getOrCreateWallet(userId);

    const checkout = await createTopUpCheckoutSession({
      userId,
      amount,
      currency: wallet.currency,
      returnUrl,
    });

    // Recorded before the user is sent to Stripe, so the Overview screen can
    // show the top-up as pending the moment they come back. This writes intent
    // only; the balance moves when the signed webhook arrives, never here.
    await recordTopUpSession({
      userId,
      amount,
      currency: wallet.currency,
      stripeSessionId: checkout.sessionId,
      expiresAt: checkout.expiresAt,
    });

    const data: TopUpSessionResponse = {
      url: checkout.url,
      sessionId: checkout.sessionId,
    };

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'POST /topup/session');
  }
});

// ---------------------------------------------------------------------------
// POST /api/wallet/topup/session/:sessionId/cancel
//
// Not in WALLET_ARCHITECTURE.md. Added because an abandoned Checkout otherwise
// sat on the Overview screen saying "awaiting payment" until Stripe's own
// expiry, which is a screen telling the user something untrue.
//
// This moves no money: it closes an intention. The ledger is untouched.
// ---------------------------------------------------------------------------

router.post('/topup/session/:sessionId/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Checkout session ids look like cs_test_… / cs_live_…; anything else is
    // not worth a database round trip.
    if (!/^cs_[A-Za-z0-9_]{8,255}$/.test(sessionId)) {
      return fail(res, 'TOPUP_SESSION_NOT_FOUND', 'No such top-up session.');
    }

    const userId = userIdOf(req);

    const cancelled = await cancelTopUpSession(userId, sessionId);
    if (!cancelled) {
      // Either it is not this user's, or it is no longer PENDING. Both read as
      // not found: a session belonging to someone else must not be
      // distinguishable from one that does not exist.
      const existing = await getTopUpSessionByStripeId(sessionId);
      const message =
        existing && existing.userId === userId
          ? 'That top-up is no longer waiting for payment.'
          : 'No such top-up session.';
      return fail(res, 'TOPUP_SESSION_NOT_FOUND', message);
    }

    // Best effort: stop it being payable at Stripe too. A failure here is
    // logged, not surfaced — our record is already correct, and if the payment
    // somehow still completes the webhook credits it, which is the safe way
    // round for this to go wrong.
    try {
      await expireCheckoutSession(sessionId);
    } catch (error) {
      console.warn(
        `[wallet] could not expire ${sessionId} at Stripe:`,
        (error as Error).message,
      );
    }

    return res.json({ success: true, data: cancelled });
  } catch (error) {
    return handleError(res, error, 'POST /topup/session/:sessionId/cancel');
  }
});

// ---------------------------------------------------------------------------
// GET /api/wallet/events — SSE stream of this user's wallet changes
//
// Behind requireAuth like every other route, which is why the browser cannot
// use EventSource for it: EventSource sends no Authorization header, and
// billing's answer — putting the user id in the query string — is exactly the
// pattern these endpoints are not allowed to copy. The frontend reads this
// with fetch instead, so the token travels in a header and never in a URL.
//
// Frames say only that something changed. The screen re-fetches through the
// authenticated endpoints, so nothing here can put a figure on a screen.
// ---------------------------------------------------------------------------

router.get('/events', requireAuth, (req: Request, res: Response) => {
  subscribeWalletEvents(userIdOf(req), res);
});

export default router;
