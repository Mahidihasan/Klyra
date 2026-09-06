import { pool } from '../../services/database.service';

import { publishBillingChange } from './realtime.service';

import {
  BillingInformation,
  BillingInformationInput,
  BillingOverview,
  CurrencyTotal,
  DueInvoiceSummary,
  Invoice,
  InvoiceDetail,
  InvoicePayment,
  Payment,
  GetInvoicesQuery,
  GetPaymentsQuery,
  InvoiceStatusFilter,
  PaymentStatusFilter,
} from './billing.types';

// Only labels that exist in the invoice_status enum. Postgres rejects the
// ::invoice_status[] cast outright if an unknown label slips in here.
const INVOICE_STATUS_MAP: Record<InvoiceStatusFilter, string[]> = {
  paid: ['PAID'],
  unpaid: ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'],
  void: ['VOID'],
};

// Same rule for the payment_status enum. CANCELLED sits with FAILED because
// both mean "no money moved" from the user's point of view.
const PAYMENT_STATUS_MAP: Record<PaymentStatusFilter, string[]> = {
  succeeded: ['SUCCEEDED'],
  pending: ['PENDING'],
  failed: ['FAILED', 'CANCELLED'],
  refunded: ['REFUNDED'],
};

export function isValidStatusFilter(value: unknown): value is InvoiceStatusFilter {
  return typeof value === 'string' && value in INVOICE_STATUS_MAP;
}

export function isValidPaymentStatusFilter(value: unknown): value is PaymentStatusFilter {
  return typeof value === 'string' && value in PAYMENT_STATUS_MAP;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Clamps paging input so a bad page/limit can't produce a huge scan. */
function resolvePaging(page?: number, limit?: number) {
  const resolvedPage = Number(page) > 0 ? Number(page) : 1;
  const requestedLimit = Number(limit) > 0 ? Number(limit) : 20;
  const resolvedLimit = Math.min(requestedLimit, 100);

  return {
    page: resolvedPage,
    limit: resolvedLimit,
    offset: (resolvedPage - 1) * resolvedLimit,
  };
}

function buildMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

const INVOICE_SELECT = `
  i.id,
  i.invoice_number,
  i.amount,
  i.currency,
  i.status,
  i.pdf_url,
  i.due_date,
  i.paid_at,
  i.created_at,
  s.id AS subscription_id,
  s.status AS subscription_status,
  s.period_start,
  s.period_end,
  a.id AS api_id,
  a.name AS api_name,
  p.id AS plan_id,
  p.name AS plan_name
`;

const INVOICE_JOINS = `
  FROM invoices i
  LEFT JOIN user_subscriptions s ON s.id = i.subscription_id
  LEFT JOIN apis a ON a.id = s.api_id
  LEFT JOIN subscription_plans p ON p.id = s.plan_id
`;

function mapInvoice(row: Record<string, any>): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    subscription: row.subscription_id
      ? {
          id: row.subscription_id,
          status: row.subscription_status,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          api: { id: row.api_id, name: row.api_name },
          plan: { id: row.plan_id, name: row.plan_name },
        }
      : null,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    pdfUrl: row.pdf_url,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function mapPaymentRow(row: Record<string, any>): InvoicePayment {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentMethodDetails: row.payment_method_details,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

export async function getUserInvoices(userId: string, query: GetInvoicesQuery) {
  const { page, limit, offset } = resolvePaging(query.page, query.limit);

  const statusFilter = query.status ? INVOICE_STATUS_MAP[query.status] : null;

  const whereClauses = ['i.user_id = $1'];
  const params: unknown[] = [userId];

  if (statusFilter) {
    params.push(statusFilter);
    whereClauses.push(`i.status = ANY($${params.length}::invoice_status[])`);
  }

  const whereSql = whereClauses.join(' AND ');

  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM invoices i WHERE ${whereSql}`,
    params,
  );
  const total = totalResult.rows[0]?.total ?? 0;

  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT ${INVOICE_SELECT}
     ${INVOICE_JOINS}
     WHERE ${whereSql}
     ORDER BY i.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    invoices: dataResult.rows.map(mapInvoice),
    meta: buildMeta(page, limit, total),
  };
}

/**
 * Loads one invoice with its payment attempts.
 *
 * Scoped by user_id as well as id so that a valid invoice id belonging to
 * someone else reads as "not found" rather than leaking another user's data.
 *
 * Returns null when the invoice does not exist for this user.
 */
export async function getInvoiceById(
  userId: string,
  invoiceId: string,
): Promise<InvoiceDetail | null> {
  const invoiceResult = await pool.query(
    `SELECT ${INVOICE_SELECT}
     ${INVOICE_JOINS}
     WHERE i.id = $1 AND i.user_id = $2
     LIMIT 1`,
    [invoiceId, userId],
  );

  const row = invoiceResult.rows[0];
  if (!row) return null;

  const paymentsResult = await pool.query(
    `SELECT
       id,
       amount,
       currency,
       status,
       payment_method,
       payment_method_details,
       failure_reason,
       created_at
     FROM payments
     WHERE invoice_id = $1 AND user_id = $2
     ORDER BY created_at DESC`,
    [invoiceId, userId],
  );

  const payments = paymentsResult.rows.map(mapPaymentRow);
  const invoice = mapInvoice(row);

  const amountPaid = payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    ...invoice,
    payments,
    amountPaid,
    amountDue: Math.max(0, Number((invoice.amount - amountPaid).toFixed(2))),
  };
}

/**
 * Payment history for a user: every payment attempt across all invoices,
 * newest first, with the invoice number and API name for context.
 */
export async function getUserPayments(userId: string, query: GetPaymentsQuery) {
  const { page, limit, offset } = resolvePaging(query.page, query.limit);

  const statusFilter = query.status ? PAYMENT_STATUS_MAP[query.status] : null;

  const whereClauses = ['pay.user_id = $1'];
  const params: unknown[] = [userId];

  if (statusFilter) {
    params.push(statusFilter);
    whereClauses.push(`pay.status = ANY($${params.length}::payment_status[])`);
  }

  const whereSql = whereClauses.join(' AND ');

  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM payments pay WHERE ${whereSql}`,
    params,
  );
  const total = totalResult.rows[0]?.total ?? 0;

  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT
       pay.id,
       pay.amount,
       pay.currency,
       pay.status,
       pay.payment_method,
       pay.payment_method_details,
       pay.failure_reason,
       pay.created_at,
       inv.id AS invoice_id,
       inv.invoice_number,
       a.name AS api_name
     FROM payments pay
     LEFT JOIN invoices inv ON inv.id = pay.invoice_id
     LEFT JOIN user_subscriptions s ON s.id = pay.subscription_id
     LEFT JOIN apis a ON a.id = s.api_id
     WHERE ${whereSql}
     ORDER BY pay.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const payments: Payment[] = dataResult.rows.map((row) => ({
    ...mapPaymentRow(row),
    invoice: row.invoice_id
      ? { id: row.invoice_id, invoiceNumber: row.invoice_number }
      : null,
    apiName: row.api_name,
  }));

  return {
    payments,
    meta: buildMeta(page, limit, total),
  };
}

function mapCurrencyTotals(rows: Record<string, any>[]): CurrencyTotal[] {
  return rows.map((row) => ({
    currency: row.currency,
    amount: Number(row.amount),
    count: Number(row.count),
  }));
}

function mapDueInvoice(row: Record<string, any> | undefined): DueInvoiceSummary | null {
  if (!row) return null;
  const dueDate = new Date(row.due_date);
  const msPerDay = 24 * 60 * 60 * 1000;
  return {
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    amount: Number(row.amount),
    currency: row.currency,
    dueDate: row.due_date,
    daysFromNow: Math.round((dueDate.getTime() - Date.now()) / msPerDay),
  };
}

/**
 * Nets out successful payments so a partially paid invoice only counts for
 * what is actually still owed.
 */
const OUTSTANDING_SELECT = `
  SELECT
    i.currency,
    SUM(GREATEST(i.amount - COALESCE(paid.total, 0), 0)) AS amount,
    COUNT(*)::int AS count
  FROM invoices i
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) AS total
    FROM payments
    WHERE status = 'SUCCEEDED' AND invoice_id IS NOT NULL
    GROUP BY invoice_id
  ) paid ON paid.invoice_id = i.id
  WHERE i.user_id = $1 AND i.status = ANY($2::invoice_status[])
`;

/**
 * Everything the billing dashboard shows, in one round trip.
 *
 * Money is grouped by currency rather than summed into a single figure —
 * invoices can be raised in more than one currency, and adding those together
 * would produce a number that means nothing.
 */
export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const unpaidStatuses = INVOICE_STATUS_MAP.unpaid;
  const params = [userId, unpaidStatuses];

  const [
    outstandingResult,
    overdueResult,
    thisMonthResult,
    lastMonthResult,
    nextPaymentResult,
    oldestOverdueResult,
    failedResult,
  ] = await Promise.all([
    pool.query(
      `${OUTSTANDING_SELECT}
       GROUP BY i.currency
       HAVING SUM(GREATEST(i.amount - COALESCE(paid.total, 0), 0)) > 0
       ORDER BY 2 DESC`,
      params,
    ),
    pool.query(
      `${OUTSTANDING_SELECT}
         AND i.due_date IS NOT NULL
         AND i.due_date < NOW()
       GROUP BY i.currency
       HAVING SUM(GREATEST(i.amount - COALESCE(paid.total, 0), 0)) > 0
       ORDER BY 2 DESC`,
      params,
    ),
    pool.query(
      `SELECT currency, SUM(amount) AS amount, COUNT(*)::int AS count
       FROM payments
       WHERE user_id = $1
         AND status = 'SUCCEEDED'
         AND created_at >= date_trunc('month', NOW())
       GROUP BY currency
       ORDER BY SUM(amount) DESC`,
      [userId],
    ),
    pool.query(
      `SELECT currency, SUM(amount) AS amount, COUNT(*)::int AS count
       FROM payments
       WHERE user_id = $1
         AND status = 'SUCCEEDED'
         AND created_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
         AND created_at < date_trunc('month', NOW())
       GROUP BY currency
       ORDER BY SUM(amount) DESC`,
      [userId],
    ),
    // Soonest invoice not yet past its due date.
    pool.query(
      `SELECT id, invoice_number, amount, currency, due_date
       FROM invoices
       WHERE user_id = $1
         AND status = ANY($2::invoice_status[])
         AND due_date IS NOT NULL
         AND due_date >= NOW()
       ORDER BY due_date ASC
       LIMIT 1`,
      params,
    ),
    // Longest-overdue invoice — the one to chase first.
    pool.query(
      `SELECT id, invoice_number, amount, currency, due_date
       FROM invoices
       WHERE user_id = $1
         AND status = ANY($2::invoice_status[])
         AND due_date IS NOT NULL
         AND due_date < NOW()
       ORDER BY due_date ASC
       LIMIT 1`,
      params,
    ),
    // Failed charges in the last 30 days are worth surfacing; older ones are
    // history rather than something to act on.
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM payments
       WHERE user_id = $1
         AND status IN ('FAILED', 'CANCELLED')
         AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId],
    ),
  ]);

  const [
    { invoices: recentInvoices },
    { payments: recentPayments },
    { payments: failedPayments },
    billingInformation,
  ] = await Promise.all([
    getUserInvoices(userId, { limit: 4 }),
    getUserPayments(userId, { limit: 4 }),
    getUserPayments(userId, { limit: 1, status: 'failed' }),
    getBillingInformation(userId),
  ]);

  return {
    outstanding: mapCurrencyTotals(outstandingResult.rows),
    overdue: mapCurrencyTotals(overdueResult.rows),
    paidThisMonth: mapCurrencyTotals(thisMonthResult.rows),
    paidLastMonth: mapCurrencyTotals(lastMonthResult.rows),
    nextPayment: mapDueInvoice(nextPaymentResult.rows[0]),
    oldestOverdue: mapDueInvoice(oldestOverdueResult.rows[0]),
    failedPayments: {
      count: failedResult.rows[0]?.count ?? 0,
      latest: failedPayments[0] ?? null,
    },
    // Filled in by the route when Stripe is configured — the service layer
    // stays free of Stripe so it can be used without it.
    defaultPaymentMethod: null,
    billingInformation,
    recentInvoices,
    recentPayments,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_LENGTHS: Record<keyof BillingInformationInput, number> = {
  billingName: 100,
  companyName: 255,
  invoiceEmail: 255,
  addressLine1: 255,
  addressLine2: 255,
  city: 100,
  state: 100,
  postalCode: 20,
  country: 2,
  taxId: 50,
};

/** Trims a value and turns blanks into null so empty fields don't persist as ''. */
function normalizeOptional(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export interface ValidationResult {
  values?: BillingInformationInput;
  errors: Partial<Record<keyof BillingInformationInput, string>>;
}

/**
 * Validates and normalizes a billing information payload.
 *
 * Only billingName is required — someone may not have a company, a tax ID, or
 * a full postal address, and blocking a save on those would be unhelpful.
 */
export function validateBillingInformation(payload: unknown): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const body = (payload ?? {}) as Record<string, unknown>;

  const billingName = normalizeOptional(body.billingName);
  if (!billingName) {
    errors.billingName = 'Enter the name invoices should be addressed to';
  }

  const invoiceEmail = normalizeOptional(body.invoiceEmail);
  if (invoiceEmail && !EMAIL_PATTERN.test(invoiceEmail)) {
    errors.invoiceEmail = 'Enter a valid email address';
  }

  const country = normalizeOptional(body.country)?.toUpperCase() ?? null;
  if (country && !/^[A-Z]{2}$/.test(country)) {
    errors.country = 'Use a two-letter country code';
  }

  const values: BillingInformationInput = {
    billingName: billingName ?? '',
    companyName: normalizeOptional(body.companyName),
    invoiceEmail,
    addressLine1: normalizeOptional(body.addressLine1),
    addressLine2: normalizeOptional(body.addressLine2),
    city: normalizeOptional(body.city),
    state: normalizeOptional(body.state),
    postalCode: normalizeOptional(body.postalCode),
    country,
    taxId: normalizeOptional(body.taxId),
  };

  for (const [field, limit] of Object.entries(MAX_LENGTHS)) {
    const key = field as keyof BillingInformationInput;
    const value = values[key];
    if (value && value.length > limit) {
      errors[key] = `Keep this under ${limit} characters`;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { values, errors };
}

const EMPTY_INFORMATION: BillingInformation = {
  billingName: '',
  companyName: null,
  invoiceEmail: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  taxId: null,
  updatedAt: null,
};

/**
 * Reads stored billing details, falling back to the account name and email so
 * the form starts from something sensible rather than blank.
 */
export async function getBillingInformation(userId: string): Promise<BillingInformation> {
  const result = await pool.query(
    `SELECT name, email, metadata->'billingInformation' AS billing_information
     FROM users
     WHERE id = $1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) return EMPTY_INFORMATION;

  const stored = (row.billing_information ?? {}) as Partial<BillingInformation>;

  return {
    ...EMPTY_INFORMATION,
    ...stored,
    billingName: stored.billingName || row.name || '',
    invoiceEmail: stored.invoiceEmail ?? row.email ?? null,
  };
}

export async function saveBillingInformation(
  userId: string,
  values: BillingInformationInput,
): Promise<BillingInformation> {
  const record: BillingInformation = {
    ...values,
    updatedAt: new Date().toISOString(),
  };

  const result = await pool.query(
    `UPDATE users
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{billingInformation}', $2::jsonb, true),
         updated_at = NOW()
     WHERE id = $1
     RETURNING metadata->'billingInformation' AS billing_information`,
    [userId, JSON.stringify(record)],
  );

  if (result.rowCount === 0) {
    const error = new Error(`No user found for id ${userId}`);
    (error as Error & { code?: string }).code = 'NOT_FOUND';
    throw error;
  }

  // Billing info lives in users.metadata, which has no DB trigger, so push the
  // change here so any open Billing pages refresh straight away. This runs on
  // the committed write, so the NOTIFY reflects the newly saved values.
  void publishBillingChange(userId, 'users', 'UPDATE');

  return result.rows[0].billing_information as BillingInformation;
}
