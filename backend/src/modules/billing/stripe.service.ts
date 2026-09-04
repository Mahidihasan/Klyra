import Stripe from 'stripe';

import { pool } from '../../services/database.service';
import { PaymentMethod } from './billing.types';

/**
 * Stripe access for the billing module.
 *
 * Everything here degrades gracefully when Stripe isn't configured: routes can
 * check `isStripeConfigured()` and return a clear "not set up" response instead
 * of a 500, so the UI can explain the situation rather than look broken.
 *
 * Card data never touches this codebase. Adding a card happens on a
 * Stripe-hosted Checkout page, and we only ever read back the brand, last four
 * digits and expiry.
 */
const SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(SECRET_KEY);
}

function getStripe(): Stripe {
  if (!SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!client) {
    client = new Stripe(SECRET_KEY);
  }
  return client;
}

/**
 * Finds (or creates) the Stripe customer for a user.
 *
 * The id lives in users.metadata->>'stripeCustomerId' rather than a dedicated
 * column so that no migration is needed; move it to a real column later if the
 * team decides to.
 */
export async function getOrCreateCustomerId(userId: string): Promise<string> {
  const stripe = getStripe();

  const userResult = await pool.query(
    `SELECT email, name, metadata->>'stripeCustomerId' AS stripe_customer_id
     FROM users
     WHERE id = $1`,
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new Error(`No user found for id ${userId}`);
  }

  if (user.stripe_customer_id) {
    // Verify it still exists — a deleted test-mode customer would otherwise
    // fail every later call with a confusing error.
    try {
      const existing = await stripe.customers.retrieve(user.stripe_customer_id);
      if (!existing.deleted) return user.stripe_customer_id;
    } catch {
      // Fall through and create a fresh customer.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { klyraUserId: userId },
  });

  await pool.query(
    `UPDATE users
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{stripeCustomerId}', to_jsonb($2::text), true),
         updated_at = NOW()
     WHERE id = $1`,
    [userId, customer.id],
  );

  return customer.id;
}

function mapPaymentMethod(
  method: Stripe.PaymentMethod,
  defaultId: string | null,
): PaymentMethod {
  const card = method.card;
  return {
    id: method.id,
    brand: card?.brand ?? 'unknown',
    last4: card?.last4 ?? '••••',
    expMonth: card?.exp_month ?? 0,
    expYear: card?.exp_year ?? 0,
    isDefault: method.id === defaultId,
    createdAt: new Date(method.created * 1000).toISOString(),
  };
}

export async function listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const stripe = getStripe();
  const customerId = await getOrCreateCustomerId(userId);

  const [customer, methods] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
  ]);

  let defaultId: string | null = null;
  if (!customer.deleted) {
    const configured = customer.invoice_settings?.default_payment_method;
    defaultId = typeof configured === 'string' ? configured : configured?.id ?? null;
  }

  const mapped = methods.data.map((method) => mapPaymentMethod(method, defaultId));

  // Default first, then newest — matches how the list reads on screen.
  return mapped.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Starts the hosted "add a card" flow.
 *
 * Returns a Stripe Checkout URL in setup mode: the person enters card details
 * on Stripe's page and comes back to `returnUrl`. Nothing sensitive passes
 * through this server.
 */
export async function createSetupSession(
  userId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const customerId = await getOrCreateCustomerId(userId);

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    currency: 'usd',
    success_url: returnUrl,
    cancel_url: returnUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout URL');
  }

  return session.url;
}

/** Confirms the card belongs to this user before acting on it. */
async function assertOwnership(customerId: string, paymentMethodId: string) {
  const stripe = getStripe();
  const method = await stripe.paymentMethods.retrieve(paymentMethodId);
  const owner = typeof method.customer === 'string' ? method.customer : method.customer?.id;

  if (owner !== customerId) {
    const error = new Error('Payment method does not belong to this customer');
    (error as Error & { code?: string }).code = 'NOT_FOUND';
    throw error;
  }
}

export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
  const stripe = getStripe();
  const customerId = await getOrCreateCustomerId(userId);

  await assertOwnership(customerId, paymentMethodId);

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

export async function removePaymentMethod(userId: string, paymentMethodId: string) {
  const stripe = getStripe();
  const customerId = await getOrCreateCustomerId(userId);

  await assertOwnership(customerId, paymentMethodId);

  await stripe.paymentMethods.detach(paymentMethodId);
}
