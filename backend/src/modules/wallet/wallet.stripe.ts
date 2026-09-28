// Stripe access for the Wallet module: one hosted Checkout session per top-up.
//
// Card data never reaches Klyra. The user pays on Stripe's page and the money
// is credited only when the signed webhook arrives — see wallet.webhook.ts.
//
// Like billing's stripe.service, everything here degrades to a clear "not
// configured" answer rather than a 500, so the UI can explain itself.

import Stripe from 'stripe';

import { pool } from '../../services/database.service';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();

let client: Stripe | null = null;

/**
 * True only when a real-looking key is present.
 *
 * Placeholder values left in .env templates ("sk_test_your_stripe_secret_key")
 * must not count as configured: they pass a length check and then fail at the
 * Stripe API with a confusing 500, when the caller wants a clean 503.
 */
export function isStripeConfigured(): boolean {
  if (!SECRET_KEY) return false;
  if (!SECRET_KEY.startsWith('sk_')) return false;
  return !/your|placeholder|changeme|xxx/i.test(SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!SECRET_KEY || !isStripeConfigured()) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!client) {
    client = new Stripe(SECRET_KEY);
  }
  return client;
}

/**
 * How long a Checkout session stays payable.
 *
 * Stripe's default is 24 hours, which meant an abandoned top-up sat on the
 * Overview screen saying "awaiting payment" until the next day. Thirty minutes
 * is Stripe's minimum and is long enough to find a card and clear a 3-D Secure
 * prompt, while a tab closed without paying stops lying about itself quickly.
 */
export const TOPUP_SESSION_TTL_SECONDS = 30 * 60;

export interface TopUpCheckout {
  url: string;
  sessionId: string;
  /** ISO timestamp after which Stripe will not accept payment. */
  expiresAt: string | null;
}

/**
 * Reads the Stripe customer already recorded for this user, if any.
 *
 * Deliberately read-only. Billing's getOrCreateCustomerId writes the id into
 * users.metadata; Wallet has no business writing to the users table, so it
 * links the payment to an existing customer when there is one and falls back
 * to the account's email when there isn't. Either way Stripe records the
 * charge, and our own wallet_topup_sessions row is what we reconcile against.
 */
async function readCustomerContext(
  userId: string,
): Promise<{ customerId: string | null; email: string | null }> {
  const result = await pool.query(
    `SELECT email, metadata->>'stripeCustomerId' AS stripe_customer_id
       FROM users WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return { customerId: null, email: null };
  return { customerId: row.stripe_customer_id ?? null, email: row.email ?? null };
}

/**
 * Creates a Checkout session in payment mode for a wallet top-up.
 *
 * The amount is converted to minor units here and is the server's figure, not
 * the client's: the route validates it before this is ever called, and the
 * webhook credits from Stripe's own amount_total rather than from anything a
 * browser sent.
 */
/**
 * Stops a Checkout session being payable.
 *
 * Best effort: a failure here is reported to the caller but must not block the
 * local cancel. If the session somehow still gets paid, the webhook credits it
 * anyway — money that arrived is always credited, which is the safe direction
 * for this to fail in.
 */
export async function expireCheckoutSession(stripeSessionId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.checkout.sessions.expire(stripeSessionId);
}

export async function createTopUpCheckoutSession(input: {
  userId: string;
  amount: number;
  currency: string;
  returnUrl: string;
}): Promise<TopUpCheckout> {
  const stripe = getStripe();
  const { customerId, email } = await readCustomerContext(input.userId);

  const currency = input.currency.toLowerCase();
  const unitAmount = Math.round(input.amount * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: input.returnUrl,
    cancel_url: input.returnUrl,
    expires_at: Math.floor(Date.now() / 1000) + TOPUP_SESSION_TTL_SECONDS,
    ...(customerId ? { customer: customerId } : {}),
    ...(!customerId && email ? { customer_email: email } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: 'Klyra wallet top-up',
            description: 'Prepaid credit for API usage and invoices',
          },
        },
      },
    ],
    // Read back by the webhook as a fallback identity if our own session row
    // is somehow missing. Never trusted for the amount.
    metadata: {
      klyraUserId: input.userId,
      klyraPurpose: 'wallet_topup',
    },
    payment_intent_data: {
      metadata: {
        klyraUserId: input.userId,
        klyraPurpose: 'wallet_topup',
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout URL');
  }

  return {
    url: session.url,
    sessionId: session.id,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}
