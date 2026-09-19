// The only path by which money enters a wallet.
//
// Mounted in app.ts with express.raw() ABOVE express.json(), because Stripe
// signs the unparsed bytes — a JSON-parsed body will never verify. The Git
// Smart HTTP route already uses the same treatment, so this is not a new idea
// in this codebase.
//
// There is deliberately no development shortcut beside this. A second path to
// free money is a second path to get it wrong.

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

import {
  applyTransaction,
  closeTopUpSession,
  completeTopUpSession,
  getTopUpSessionByStripeId,
} from './wallet.service';
import { getStripe, isStripeConfigured } from './wallet.stripe';

const router = Router();

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();

function isWebhookConfigured(): boolean {
  if (!WEBHOOK_SECRET) return false;
  if (!WEBHOOK_SECRET.startsWith('whsec_')) return false;
  return !/your|placeholder|changeme|xxx/i.test(WEBHOOK_SECRET);
}

/**
 * Best-effort card description for the ledger row, e.g. "Top-up · visa ···· 4242".
 *
 * Wrapped in its own try/catch and never allowed to fail the credit: a nicer
 * label is not worth losing money over. Falls back to a plain description.
 */
async function describeTopUp(session: Stripe.Checkout.Session): Promise<string> {
  try {
    const stripe = getStripe();
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['payment_intent.payment_method'],
    });

    const intent = full.payment_intent;
    if (intent && typeof intent !== 'string') {
      const method = intent.payment_method;
      if (method && typeof method !== 'string' && method.card) {
        return `Top-up · ${method.card.brand} ···· ${method.card.last4}`;
      }
    }
  } catch {
    // fall through to the plain label
  }
  return 'Wallet top-up';
}

/**
 * Credits a completed Checkout session, exactly once.
 *
 * The amount comes from Stripe's own `amount_total`, never from anything a
 * browser sent and not even from our own session row — what was actually
 * charged is the only figure worth crediting. Our row is used to identify the
 * user and to flag a mismatch worth investigating.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // Async payment methods fire this event before the money settles.
  if (session.payment_status !== 'paid') {
    console.log(`[wallet:webhook] ${session.id} completed but unpaid — ignoring for now`);
    return;
  }

  const ours = await getTopUpSessionByStripeId(session.id);
  const metadataUserId =
    session.metadata?.klyraPurpose === 'wallet_topup'
      ? session.metadata?.klyraUserId
      : undefined;

  const userId = ours?.userId ?? metadataUserId;
  if (!userId) {
    // Not a wallet top-up, or one this deployment did not create.
    console.log(`[wallet:webhook] ${session.id} has no wallet owner — ignoring`);
    return;
  }

  const amount = (session.amount_total ?? 0) / 100;
  if (amount <= 0) {
    console.warn(`[wallet:webhook] ${session.id} has a non-positive total — ignoring`);
    return;
  }

  if (ours && Math.abs(ours.amount - amount) > 0.004) {
    console.warn(
      `[wallet:webhook] ${session.id} charged ${amount} but was created for ${ours.amount}; crediting the charged amount`,
    );
  }

  const description = await describeTopUp(session);

  // Idempotent on external_reference: a replayed event returns the row the
  // first delivery wrote instead of crediting twice.
  const transaction = await applyTransaction({
    userId,
    type: 'TOPUP',
    direction: 'CREDIT',
    amount,
    description,
    referenceType: 'stripe_checkout',
    externalReference: session.id,
    metadata: {
      stripeSessionId: session.id,
      paymentIntent:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      currency: session.currency,
    },
  });

  // Runs after the credit has committed. If the process dies in this gap the
  // session stays PENDING against money already in the balance — which is why
  // the pending read in wallet.service also excludes sessions whose id is
  // already in the ledger.
  await completeTopUpSession(session.id, transaction.id);

  console.log(`[wallet:webhook] credited ${amount} to ${userId} from ${session.id}`);
}

router.post('/', async (req: Request, res: Response) => {
  if (!isStripeConfigured() || !isWebhookConfigured()) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe webhook handling is not configured.',
      },
    });
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Missing Stripe signature header.' },
    });
  }

  // req.body is a Buffer here because of express.raw() at the mount point.
  // Anything else means the mount order in app.ts is wrong.
  if (!Buffer.isBuffer(req.body)) {
    console.error('[wallet:webhook] body is not raw — check the mount order in app.ts');
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Webhook body was not read raw.' },
    });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET as string);
  } catch (error) {
    // Verification failed: this did not come from Stripe. Nothing is credited.
    console.warn(`[wallet:webhook] signature rejected: ${(error as Error).message}`);
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' },
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'checkout.session.expired':
        await closeTopUpSession((event.data.object as Stripe.Checkout.Session).id, 'EXPIRED');
        break;

      case 'checkout.session.async_payment_failed':
        await closeTopUpSession((event.data.object as Stripe.Checkout.Session).id, 'FAILED');
        break;

      default:
        // Everything else is ignored on purpose, and acknowledged so Stripe
        // stops sending it.
        break;
    }
  } catch (error) {
    // A real failure. Return 500 so Stripe retries — crediting is idempotent,
    // so a retry cannot double-credit, and silently swallowing this would lose
    // the user's money.
    console.error(`[wallet:webhook] handling ${event.type} failed:`, error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Webhook handling failed.' },
    });
  }

  return res.json({ received: true });
});

export default router;
