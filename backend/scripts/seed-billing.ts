/* eslint-disable no-console */
/**
 * Development-only Billing seed.
 *
 * Seeds realistic dummy billing data into the existing Neon PostgreSQL billing
 * tables (subscription_plans, user_subscriptions, invoices, payments) for ONE
 * existing development user so the user's Billing page shows real-looking data.
 *
 * Safety rules:
 *   - Development/test data ONLY. Uses fake Stripe-style IDs and the Stripe
 *     TEST card number (4242...). No real payment credentials, no real
 *     customer data.
 *   - Refuses to run when NODE_ENV === 'production'.
 *   - Idempotent: every insert is guarded by a natural key (upsert or
 *     existence check), so running it multiple times is safe.
 *   - Never deletes or modifies existing rows (only upserts the seed's own
 *     records), and never touches the schema.
 *
 * NOTE: The billing tables reference the main `users` table (UUID ids), not
 * the repos-module `kr_users` table (integer ids). The target user is chosen
 * from `users`:
 *      1. SEED_BILLING_USER_ID env var (a users.id UUID), or
 *      2. the first ACTIVE, non-deleted user in `users`.
 *
 * Usage (from backend/):
 *   npm run seed:billing
 */
process.env.DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH || '../.env.development';

import { pool } from '../src/services/database.service';

const API_SLUG = 'klyra-dev-billing-api';
const INVOICE_PREFIX = 'INV-KLYRA-DEV';
const PAYMENT_REF_PREFIX = 'klyra_dev_seed_pay';

/**
 * Deterministic per-user tag so invoice numbers / payment refs never collide
 * across users (invoice_number is globally unique). Same user always regenerates
 * the same keys, which is what makes reruns idempotent.
 */
function userTag(userId: string): string {
  return userId.replace(/-/g, '').slice(0, 8);
}

function invoiceNumberFor(userId: string, seq: number): string {
  return `${INVOICE_PREFIX}-${userTag(userId)}-${String(seq).padStart(4, '0')}`;
}

function paymentRefFor(userId: string, seq: number): string {
  return `${PAYMENT_REF_PREFIX}_${userTag(userId)}_${String(seq).padStart(4, '0')}`;
}


if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error('[seed:billing] Refusing to run: NODE_ENV is "production". This seed is development-only.');
  process.exit(1);
}

interface PlanSeed {
  slug: string;
  name: string;
  description: string;
  price: string;
  interval: 'MONTHLY' | 'YEARLY';
  features: string[];
  rateLimit: number;
}

const PLAN_SEEDS: PlanSeed[] = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For hobby projects and evaluation [DEV SEED DATA]',
    price: '9.99',
    interval: 'MONTHLY',
    features: ['10,000 requests / month', 'Community support', '1 API key'],
    rateLimit: 10,
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'For growing products with production traffic [DEV SEED DATA]',
    price: '49.00',
    interval: 'MONTHLY',
    features: ['500,000 requests / month', 'Email support', '10 API keys', '99.9% uptime SLA'],
    rateLimit: 100,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Dedicated capacity and premium support [DEV SEED DATA]',
    price: '199.00',
    interval: 'MONTHLY',
    features: ['Unlimited requests', 'Dedicated support', 'Unlimited API keys', 'Custom rate limits'],
    rateLimit: 1000,
  },
];

function monthsAgo(n: number, dayOffset = 0): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

async function resolveUserId(): Promise<string> {
  const explicit = process.env.SEED_BILLING_USER_ID?.trim();
  if (explicit) {
    const found = await pool.query(
      `SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [explicit],
    );
    if (found.rows.length === 0) {
      throw new Error(`SEED_BILLING_USER_ID ${explicit} does not match an existing users.id`);
    }
    return found.rows[0].id as string;
  }

  const fallback = await pool.query(
    `SELECT id, email FROM users
     WHERE status = 'ACTIVE' AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
  );
  if (fallback.rows.length === 0) {
    throw new Error(
      'No existing user found in the users table. Create a user first or set SEED_BILLING_USER_ID.',
    );
  }
  return fallback.rows[0].id as string;
}

async function ensureCategory(): Promise<string> {
  const existing = await pool.query(`SELECT id FROM categories ORDER BY created_at ASC LIMIT 1`);
  if (existing.rows.length > 0) return existing.rows[0].id as string;

  const inserted = await pool.query(
    `INSERT INTO categories (name, slug, description)
     VALUES ('Development Tools', 'development-tools', 'Development-only seed category')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  return inserted.rows[0].id as string;
}

async function ensureDevApi(userId: string): Promise<string> {
  const bySlug = await pool.query(`SELECT id FROM apis WHERE slug = $1`, [API_SLUG]);
  if (bySlug.rows.length > 0) return bySlug.rows[0].id as string;

  const categoryId = await ensureCategory();
  const inserted = await pool.query(
    `INSERT INTO apis (name, slug, description, base_url, category_id, owner_id,
                       pricing_model, status, is_public)
     VALUES ('Klyra Dev Billing API', $1,
             'Development-only API used to seed billing demo data.',
             'https://dev.klyra.example/seed-api', $2, $3,
             'PAID', 'PUBLISHED', TRUE)
     ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [API_SLUG, categoryId, userId],
  );
  return inserted.rows[0].id as string;
}

async function ensurePlans(apiId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const plan of PLAN_SEEDS) {
    const result = await pool.query(
      `INSERT INTO subscription_plans
         (api_id, name, slug, description, price, currency, billing_interval,
          features, rate_limit, rate_limit_period, is_active)
       VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7::JSONB, $8, 'MINUTE', TRUE)
       ON CONFLICT (api_id, slug) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [
        apiId,
        plan.name,
        plan.slug,
        plan.description,
        plan.price,
        plan.interval,
        JSON.stringify(plan.features),
        plan.rateLimit,
      ],
    );
    ids[plan.slug] = result.rows[0].id as string;
  }
  return ids;
}

async function ensureSubscription(userId: string, apiId: string, planId: string): Promise<string> {
  // Active subscription on the "pro" plan that started last month and runs
  // through next month — a realistic in-flight billing period.
  const periodStart = monthsAgo(1);
  const periodEnd = monthsAgo(-1);
  const result = await pool.query(
    `INSERT INTO user_subscriptions
       (user_id, api_id, plan_id, status, period_start, period_end, auto_renew,
        stripe_subscription_id)
     VALUES ($1, $2, $3, 'ACTIVE', $4, $5, TRUE, 'sub_dev_seed_0001')
     ON CONFLICT (user_id, api_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       period_start = EXCLUDED.period_start,
       period_end = EXCLUDED.period_end,
       updated_at = NOW()
     RETURNING id`,
    [userId, apiId, planId, periodStart, periodEnd],
  );
  return result.rows[0].id as string;
}

interface InvoiceSeed {
  seq: number;
  amount: string;
  status: 'PAID' | 'SENT';
  createdOffsetMonths: number;
  dueOffsetDays: number;
}

function invoiceSeedsFor(userId: string): Array<InvoiceSeed & { number: string }> {
  return [
    { seq: 1, amount: '49.00', status: 'PAID', createdOffsetMonths: 3, dueOffsetDays: 14, number: invoiceNumberFor(userId, 1) },
    { seq: 2, amount: '49.00', status: 'PAID', createdOffsetMonths: 2, dueOffsetDays: 14, number: invoiceNumberFor(userId, 2) },
    { seq: 3, amount: '49.00', status: 'SENT', createdOffsetMonths: 0, dueOffsetDays: 10, number: invoiceNumberFor(userId, 3) },
  ];
}

async function ensureInvoices(
  userId: string,
  subscriptionId: string,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const inv of invoiceSeedsFor(userId)) {
    const createdAt = monthsAgo(inv.createdOffsetMonths);
    const dueDate = monthsAgo(inv.createdOffsetMonths, inv.dueOffsetDays);
    const paidAt = inv.status === 'PAID' ? monthsAgo(inv.createdOffsetMonths, 2) : null;
    const result = await pool.query(
      `INSERT INTO invoices
         (user_id, subscription_id, invoice_number, amount, currency, status,
          stripe_invoice_id, due_date, paid_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'USD', $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (invoice_number) DO NOTHING
       RETURNING id`,
      [
        userId,
        subscriptionId,
        inv.number,
        inv.amount,
        inv.status,
        `in_dev_seed_${inv.number.toLowerCase()}`,
        dueDate,
        paidAt,
        createdAt,
      ],
    );

    if (result.rows.length > 0) {
      ids[inv.number] = result.rows[0].id as string;
    } else {
      // Already seeded on a previous run — read the existing id (read-only).
      const existing = await pool.query(
        `SELECT id FROM invoices WHERE invoice_number = $1`,
        [inv.number],
      );
      ids[inv.number] = existing.rows[0].id as string;
    }
  }
  return ids;
}

interface PaymentSeed {
  ref: string;
  invoiceNumber: string;
  amount: string;
  status: 'SUCCEEDED' | 'FAILED';
  method: string;
  details: Record<string, unknown>;
  failureReason: string | null;
  offsetMonths: number;
}

function paymentSeedsFor(userId: string): PaymentSeed[] {
  return [
    {
      ref: paymentRefFor(userId, 1),
      invoiceNumber: invoiceNumberFor(userId, 1),
      amount: '49.00',
      status: 'SUCCEEDED',
      method: 'card',
      details: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 }, // Stripe TEST card digits
      failureReason: null,
      offsetMonths: 3,
    },
    {
      ref: paymentRefFor(userId, 2),
      invoiceNumber: invoiceNumberFor(userId, 2),
      amount: '49.00',
      status: 'SUCCEEDED',
      method: 'card',
      details: { brand: 'mastercard', last4: '4242', exp_month: 12, exp_year: 2030 },
      failureReason: null,
      offsetMonths: 2,
    },
    {
      ref: paymentRefFor(userId, 3),
      invoiceNumber: invoiceNumberFor(userId, 3),
      amount: '49.00',
      status: 'FAILED',
      method: 'card',
      details: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      failureReason: 'Your card was declined. [dev seed data]',
      offsetMonths: 0,
    },
  ];
}

async function ensurePayments(
  userId: string,
  subscriptionId: string,
  invoiceIds: Record<string, string>,
): Promise<number> {
  let inserted = 0;
  for (const pay of paymentSeedsFor(userId)) {
    // payments has no natural unique key — guard on our per-user fake Stripe ref.
    const exists = await pool.query(
      `SELECT 1 FROM payments WHERE stripe_payment_id = $1 AND user_id = $2`,
      [pay.ref, userId],
    );
    if (exists.rows.length > 0) continue;

    await pool.query(
      `INSERT INTO payments
         (user_id, subscription_id, invoice_id, amount, currency, status,
          stripe_payment_id, payment_method, payment_method_details,
          failure_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'USD', $5, $6, $7, $8::JSONB, $9, $10, NOW())`,
      [
        userId,
        subscriptionId,
        invoiceIds[pay.invoiceNumber],
        pay.amount,
        pay.status,
        pay.ref,
        pay.method,
        JSON.stringify(pay.details),
        pay.failureReason,
        monthsAgo(pay.offsetMonths, 2),
      ],
    );
    inserted += 1;
  }
  return inserted;
}

async function verify(userId: string): Promise<void> {
  console.log('\n=== VERIFY (read-only) ===');

  const plans = await pool.query(
    `SELECT p.name, p.slug, p.price, p.currency, p.billing_interval, a.name AS api_name
     FROM subscription_plans p JOIN apis a ON a.id = p.api_id
     WHERE a.slug = $1 ORDER BY p.price ASC`,
    [API_SLUG],
  );
  console.log('\nSubscription plans:');
  for (const row of plans.rows) {
    console.log(
      `  - ${row.name} (${row.slug}) $${row.price} ${row.currency}/${row.billing_interval} on "${row.api_name}"`,
    );
  }

  const subs = await pool.query(
    `SELECT s.id, s.status, s.period_start, s.period_end, p.name AS plan_name, a.name AS api_name
     FROM user_subscriptions s
     JOIN subscription_plans p ON p.id = s.plan_id
     JOIN apis a ON a.id = s.api_id
     WHERE s.user_id = $1`,
    [userId],
  );
  console.log('\nSubscriptions for seeded user:');
  for (const row of subs.rows) {
    console.log(
      `  - ${row.id} ${row.status} | ${row.api_name} / ${row.plan_name} | ${new Date(row.period_start).toISOString().slice(0, 10)} -> ${new Date(row.period_end).toISOString().slice(0, 10)}`,
    );
  }

  const invoices = await pool.query(
    `SELECT invoice_number, amount, currency, status, due_date, paid_at
     FROM invoices WHERE user_id = $1 AND invoice_number LIKE $2
     ORDER BY invoice_number ASC`,
    [userId, `${INVOICE_PREFIX}%`],
  );
  console.log('\nInvoices:');
  for (const row of invoices.rows) {
    console.log(
      `  - ${row.invoice_number} | ${row.amount} ${row.currency} | ${row.status} | due ${row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : '-'} | paid ${row.paid_at ? new Date(row.paid_at).toISOString().slice(0, 10) : '-'}`,
    );
  }

  const payments = await pool.query(
    `SELECT stripe_payment_id, amount, currency, status, payment_method, failure_reason
     FROM payments WHERE user_id = $1 AND stripe_payment_id LIKE $2
     ORDER BY stripe_payment_id ASC`,
    [userId, `${PAYMENT_REF_PREFIX}%`],
  );
  console.log('\nPayments:');
  for (const row of payments.rows) {
    console.log(
      `  - ${row.stripe_payment_id} | ${row.amount} ${row.currency} | ${row.status} | ${row.payment_method}${row.failure_reason ? ` | reason: ${row.failure_reason}` : ''}`,
    );
  }
}

async function main(): Promise<void> {
  const userId = await resolveUserId();
  const userRow = await pool.query(`SELECT email, name FROM users WHERE id = $1`, [userId]);
  console.log(
    `[seed:billing] Development-only seed. Target user: ${userRow.rows[0].name} <${userRow.rows[0].email}> (${userId})`,
  );

  const apiId = await ensureDevApi(userId);
  const planIds = await ensurePlans(apiId);
  const subscriptionId = await ensureSubscription(userId, apiId, planIds.pro);
  const invoiceIds = await ensureInvoices(userId, subscriptionId);
  const paymentsInserted = await ensurePayments(userId, subscriptionId, invoiceIds);

  console.log(
    `[seed:billing] Done. Plans: ${PLAN_SEEDS.length} (upserted), ` +
      `subscription: 1 (upserted), invoices: ${invoiceSeedsFor(userId).length} (insert-or-skip), ` +
      `payments: ${paymentsInserted} new inserted.`,
  );
  console.log('[seed:billing] No existing data was modified or deleted.');

  await verify(userId);
  await pool.end();
}

main().catch(async (err) => {
  console.error('[seed:billing] failed:', err.message);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});



