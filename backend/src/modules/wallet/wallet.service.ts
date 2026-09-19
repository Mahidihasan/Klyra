// Wallet ledger service.
//
// The ledger (wallet_transactions) is the source of truth; wallets.balance is a
// cached projection maintained in the same transaction as the ledger row.
//
// Three rules this file exists to enforce:
//   1. applyTransaction is the ONLY writer to wallets.balance.
//   2. A balance never goes negative.
//   3. A repeated externalReference credits once, never twice.
//
// Money arithmetic is done by Postgres (numeric), never by JavaScript floats.
// Amounts cross the wire as fixed-point strings for the same reason. The
// integer-cent maths below is used only for comparisons, where it is exact:
// DECIMAL(12,2) tops out at 10^12 cents, well inside Number.MAX_SAFE_INTEGER.

import { PoolClient } from 'pg';

import { pool } from '../../services/database.service';

import { publishWalletChange } from './realtime.service';

import {
  ApplyTransactionInput,
  GetTransactionsQuery,
  PaginationMeta,
  Wallet,
  WalletErrorCode,
  WalletMonthlyPoint,
  WalletSummary,
  WalletTopUpSession,
  WalletTransaction,
  WalletTransactionFilter,
  WalletTransactionsPage,
} from './wallet.types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Carries the API error code so routes can map to a status without guessing. */
export class WalletError extends Error {
  constructor(
    public readonly code: WalletErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export class InvalidAmountError extends WalletError {
  constructor(message: string) {
    super('INVALID_AMOUNT', message);
    this.name = 'InvalidAmountError';
  }
}

export class InsufficientFundsError extends WalletError {
  constructor(message = 'This would take the wallet balance below zero.') {
    super('INSUFFICIENT_FUNDS', message);
    this.name = 'InsufficientFundsError';
  }
}

export class WalletLockedError extends WalletError {
  constructor(message = 'Spending is paused on this wallet.') {
    super('WALLET_LOCKED', message);
    this.name = 'WalletLockedError';
  }
}

// ---------------------------------------------------------------------------
// Amount handling
// ---------------------------------------------------------------------------

/**
 * Largest single movement this module will record. Far below the
 * DECIMAL(12,2) ceiling, so a mistake is rejected rather than overflowing.
 * The much smaller per-top-up cap belongs to the route layer.
 */
export const MAX_TRANSACTION_AMOUNT = 10_000_000;

/** Per-top-up cap from WALLET_ARCHITECTURE.md section 6. Enforced by routes. */
export const MAX_TOPUP_AMOUNT = 1_000;

/**
 * Validates a client- or caller-supplied amount and returns it rounded to the
 * scale the column actually stores. Throws rather than silently coercing: on a
 * money endpoint a surprising amount is a bug, not something to normalise away.
 */
export function normalizeAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(amount)) {
    throw new InvalidAmountError('Amount must be a finite number.');
  }
  if (amount <= 0) {
    throw new InvalidAmountError('Amount must be greater than zero.');
  }

  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) {
    throw new InvalidAmountError('Amount must have at most two decimal places.');
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    throw new InvalidAmountError(
      `Amount must not exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString('en-US')}.`,
    );
  }

  return cents / 100;
}

/** Exact for every value DECIMAL(12,2) can hold. Comparison only — never storage. */
function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const WALLET_COLUMNS = 'id, user_id, balance, currency, is_locked, created_at, updated_at';

const TRANSACTION_COLUMNS = `
  id, wallet_id, user_id, type, direction, status, amount, currency,
  balance_after, description, reference_type, reference_id,
  external_reference, metadata, created_at
`;

const TOPUP_SESSION_COLUMNS = `
  id, wallet_id, user_id, amount, currency, status, stripe_session_id,
  transaction_id, completed_at, expires_at, created_at
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapWallet(row: Record<string, any>): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    balance: Number(row.balance),
    currency: row.currency,
    isLocked: row.is_locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransaction(row: Record<string, any>): WalletTransaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    type: row.type,
    direction: row.direction,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    balanceAfter: Number(row.balance_after),
    description: row.description,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    externalReference: row.external_reference,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapTopUpSession(row: Record<string, any>): WalletTopUpSession {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripe_session_id,
    transactionId: row.transaction_id,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Wallet lifecycle
// ---------------------------------------------------------------------------

/**
 * Returns the user's wallet, creating it on first touch.
 *
 * ON CONFLICT DO NOTHING rather than a read-then-write, so two simultaneous
 * first requests cannot both insert.
 */
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const existing = await pool.query(
    `SELECT ${WALLET_COLUMNS} FROM wallets WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return mapWallet(existing.rows[0]);

  await pool.query(
    `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  const created = await pool.query(
    `SELECT ${WALLET_COLUMNS} FROM wallets WHERE user_id = $1`,
    [userId],
  );
  if (!created.rows[0]) {
    throw new WalletError('INTERNAL_ERROR', 'Wallet could not be created.');
  }
  return mapWallet(created.rows[0]);
}

/**
 * Locks the caller's wallet row for the rest of the transaction, creating it
 * first if this is the user's first movement.
 *
 * FOR UPDATE is what serialises concurrent spends: without it two requests
 * read the same balance, both decide they can afford it, and both write.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function lockWalletRow(client: PoolClient, userId: string): Promise<Record<string, any>> {
  const locked = await client.query(
    `SELECT ${WALLET_COLUMNS} FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  if (locked.rows[0]) return locked.rows[0];

  await client.query(
    `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  const afterInsert = await client.query(
    `SELECT ${WALLET_COLUMNS} FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  if (!afterInsert.rows[0]) {
    throw new WalletError('INTERNAL_ERROR', 'Wallet could not be created.');
  }
  return afterInsert.rows[0];
}

async function findByExternalReference(
  client: PoolClient,
  externalReference: string,
): Promise<WalletTransaction | null> {
  const found = await client.query(
    `SELECT ${TRANSACTION_COLUMNS} FROM wallet_transactions WHERE external_reference = $1`,
    [externalReference],
  );
  return found.rows[0] ? mapTransaction(found.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// The one writer
// ---------------------------------------------------------------------------

/**
 * Applies one movement to a wallet and records it in the ledger.
 *
 * Runs inside a transaction with the wallet row locked, because two concurrent
 * spends reading the same balance would otherwise both succeed and overdraw.
 *
 * Idempotent when externalReference is supplied: a repeated Stripe webhook
 * finds the existing row and returns it instead of crediting twice. The unique
 * constraint on external_reference is the real guarantee — the early lookup is
 * only an optimisation, and the 23505 handler below covers the race where two
 * deliveries pass the lookup together.
 *
 * Always writes COMPLETED. PENDING and FAILED rows do not move a balance and
 * so are not this function's business.
 */
export async function applyTransaction(
  input: ApplyTransactionInput,
): Promise<WalletTransaction> {
  const amount = normalizeAmount(input.amount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (input.externalReference) {
      const already = await findByExternalReference(client, input.externalReference);
      if (already) {
        // Nothing was written; end the transaction rather than commit an empty one.
        await client.query('ROLLBACK');
        return already;
      }
    }

    const wallet = await lockWalletRow(client, input.userId);

    if (wallet.is_locked && input.direction === 'DEBIT') {
      throw new WalletLockedError();
    }

    const currentCents = toCents(wallet.balance);
    const deltaCents = input.direction === 'CREDIT'
      ? toCents(amount)
      : -toCents(amount);

    if (currentCents + deltaCents < 0) {
      throw new InsufficientFundsError(
        `Balance is ${Number(wallet.balance).toFixed(2)}; this debit of ${amount.toFixed(2)} would overdraw it.`,
      );
    }

    // Postgres does the arithmetic. The signed delta goes over as a string so
    // no float ever touches the value that gets stored.
    const signedDelta = (deltaCents / 100).toFixed(2);
    const updated = await client.query(
      `UPDATE wallets SET balance = balance + $2::numeric WHERE id = $1 RETURNING balance`,
      [wallet.id, signedDelta],
    );
    const balanceAfter: string = updated.rows[0].balance;

    const inserted = await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id, user_id, type, direction, status, amount, currency,
         balance_after, description, reference_type, reference_id,
         external_reference, metadata
       ) VALUES (
         $1, $2, $3::wallet_transaction_type, $4::wallet_transaction_direction,
         'COMPLETED'::wallet_transaction_status, $5::numeric, $6,
         $7::numeric, $8, $9, $10, $11, $12::jsonb
       )
       RETURNING ${TRANSACTION_COLUMNS}`,
      [
        wallet.id,
        input.userId,
        input.type,
        input.direction,
        amount.toFixed(2),
        wallet.currency,
        balanceAfter,
        input.description ?? null,
        input.referenceType ?? null,
        input.referenceId ?? null,
        input.externalReference ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    await client.query('COMMIT');

    const transaction = mapTransaction(inserted.rows[0]);
    // After the commit, never before: a stream told about money that then
    // rolled back would be telling the screen something untrue.
    publishWalletChange(input.userId, 'transaction');
    return transaction;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);

    // Two deliveries of the same Stripe event raced past the lookup above.
    // The unique index rejected the second; return what the first wrote.
    const code = (error as { code?: string }).code;
    if (code === '23505' && input.externalReference) {
      const winner = await findByExternalReference(
        // A fresh implicit transaction: the one above is already rolled back.
        client,
        input.externalReference,
      );
      if (winner) return winner;
    }

    if (code === '23503') {
      throw new WalletError('INTERNAL_ERROR', 'No such user for this wallet.');
    }

    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// Only labels that exist in wallet_transaction_type. Postgres rejects the
// ::wallet_transaction_type[] cast outright if an unknown label slips in.
const TRANSACTION_TYPE_MAP: Record<Exclude<WalletTransactionFilter, 'all'>, string[]> = {
  topups: ['TOPUP', 'BONUS'],
  spending: ['SPEND'],
  refunds: ['REFUND'],
  adjustments: ['ADJUSTMENT'],
};

export function isValidTransactionFilter(value: unknown): value is WalletTransactionFilter {
  return value === 'all' || (typeof value === 'string' && value in TRANSACTION_TYPE_MAP);
}

/** Clamps paging input so a bad page/limit can't produce a huge scan. */
function resolvePaging(page?: number, limit?: number) {
  const resolvedPage = Number(page) > 0 ? Math.trunc(Number(page)) : 1;
  const requestedLimit = Number(limit) > 0 ? Math.trunc(Number(limit)) : 20;
  const resolvedLimit = Math.min(requestedLimit, 100);

  return {
    page: resolvedPage,
    limit: resolvedLimit,
    offset: (resolvedPage - 1) * resolvedLimit,
  };
}

function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Rejects junk before it reaches Postgres, where it would be a 500. */
function parseBoundary(value: string | undefined, label: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new WalletError('INVALID_AMOUNT', `${label} is not a valid date.`);
  }
  return parsed;
}

/**
 * Paginated ledger for one user.
 *
 * Scoped by user_id from the JWT, never from a parameter: a transaction
 * belonging to someone else must read as absent, not as forbidden.
 */
export async function getWalletTransactions(
  userId: string,
  query: GetTransactionsQuery = {},
): Promise<WalletTransactionsPage> {
  const { page, limit, offset } = resolvePaging(query.page, query.limit);

  const whereClauses = ['user_id = $1'];
  const params: unknown[] = [userId];

  if (query.type && query.type !== 'all') {
    if (!isValidTransactionFilter(query.type)) {
      throw new WalletError('INVALID_AMOUNT', `Unknown transaction filter '${query.type}'.`);
    }
    params.push(TRANSACTION_TYPE_MAP[query.type]);
    whereClauses.push(`type = ANY($${params.length}::wallet_transaction_type[])`);
  }

  const from = parseBoundary(query.from, 'from');
  if (from) {
    params.push(from.toISOString());
    whereClauses.push(`created_at >= $${params.length}::timestamptz`);
  }

  const to = parseBoundary(query.to, 'to');
  if (to) {
    params.push(to.toISOString());
    whereClauses.push(`created_at <= $${params.length}::timestamptz`);
  }

  const whereSql = whereClauses.join(' AND ');

  const totalResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM wallet_transactions WHERE ${whereSql}`,
    params,
  );
  const total: number = totalResult.rows[0]?.total ?? 0;

  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT ${TRANSACTION_COLUMNS}
       FROM wallet_transactions
      WHERE ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    transactions: dataResult.rows.map(mapTransaction),
    meta: buildMeta(page, limit, total),
  };
}

/**
 * Sum of the COMPLETED ledger for one wallet.
 *
 * This is the consistency check from WALLET_ARCHITECTURE.md section 3.1: the
 * figure it returns must always equal wallets.balance. PENDING and FAILED rows
 * are excluded because they never moved the balance.
 */
export async function getLedgerBalance(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(
              CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END
            ), 0) AS total
       FROM wallet_transactions
      WHERE user_id = $1 AND status = 'COMPLETED'`,
    [userId],
  );
  return Number(result.rows[0].total);
}

// ---------------------------------------------------------------------------
// Top-up sessions
//
// Intent, not money. These rows are mutable; the ledger is not. Nothing here
// touches wallets.balance — only applyTransaction does that.
// ---------------------------------------------------------------------------

/** Records a Checkout session so the UI can show money that is on its way. */
export async function recordTopUpSession(input: {
  userId: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  expiresAt: string | null;
}): Promise<WalletTopUpSession> {
  const wallet = await getOrCreateWallet(input.userId);
  const amount = normalizeAmount(input.amount);

  const result = await pool.query(
    `INSERT INTO wallet_topup_sessions
       (wallet_id, user_id, amount, currency, stripe_session_id, expires_at)
     VALUES ($1, $2, $3::numeric, $4, $5, $6::timestamptz)
     ON CONFLICT (stripe_session_id) DO UPDATE SET updated_at = NOW()
     RETURNING ${TOPUP_SESSION_COLUMNS}`,
    [
      wallet.id,
      input.userId,
      amount.toFixed(2),
      input.currency,
      input.stripeSessionId,
      input.expiresAt,
    ],
  );
  publishWalletChange(input.userId, 'topup_session');
  return mapTopUpSession(result.rows[0]);
}

export async function getTopUpSessionByStripeId(
  stripeSessionId: string,
): Promise<WalletTopUpSession | null> {
  const result = await pool.query(
    `SELECT ${TOPUP_SESSION_COLUMNS} FROM wallet_topup_sessions WHERE stripe_session_id = $1`,
    [stripeSessionId],
  );
  return result.rows[0] ? mapTopUpSession(result.rows[0]) : null;
}

/**
 * Marks a session as credited and links it to the ledger row it produced.
 *
 * Safe to call twice: the WHERE clause only matches a session that is not
 * already COMPLETED, so a replayed webhook changes nothing.
 */
export async function completeTopUpSession(
  stripeSessionId: string,
  transactionId: string,
): Promise<void> {
  const result = await pool.query(
    `UPDATE wallet_topup_sessions
        SET status = 'COMPLETED', transaction_id = $2, completed_at = NOW()
      WHERE stripe_session_id = $1 AND status <> 'COMPLETED'
      RETURNING user_id`,
    [stripeSessionId, transactionId],
  );
  if (result.rows[0]) publishWalletChange(result.rows[0].user_id, 'topup_session');
}

/** Closes a session that Stripe reported as expired or failed. */
export async function closeTopUpSession(
  stripeSessionId: string,
  status: 'EXPIRED' | 'FAILED',
): Promise<void> {
  const result = await pool.query(
    `UPDATE wallet_topup_sessions
        SET status = $2::wallet_topup_session_status
      WHERE stripe_session_id = $1 AND status = 'PENDING'
      RETURNING user_id`,
    [stripeSessionId, status],
  );
  if (result.rows[0]) publishWalletChange(result.rows[0].user_id, 'topup_session');
}

/**
 * Cancels a top-up the user started and did not pay for.
 *
 * Scoped by user_id as well as id, so a session belonging to someone else
 * reads as absent rather than forbidden. Only a PENDING row moves: if a
 * webhook credited this session a moment ago it is no longer PENDING, and the
 * cancel quietly does nothing rather than marking paid money as abandoned.
 *
 * Touches nothing but this table. No balance, no ledger — cancelling an
 * intention is not a movement of money.
 *
 * Returns the session as it now stands, or null when there was nothing of the
 * caller's to cancel.
 */
export async function cancelTopUpSession(
  userId: string,
  stripeSessionId: string,
): Promise<WalletTopUpSession | null> {
  const result = await pool.query(
    `UPDATE wallet_topup_sessions
        SET status = 'EXPIRED'
      WHERE user_id = $1 AND stripe_session_id = $2 AND status = 'PENDING'
      RETURNING ${TOPUP_SESSION_COLUMNS}`,
    [userId, stripeSessionId],
  );
  if (result.rows[0]) publishWalletChange(userId, 'topup_session');
  return result.rows[0] ? mapTopUpSession(result.rows[0]) : null;
}

/**
 * Everything the Overview screen needs in one round trip: the wallet, money
 * paid but not yet credited, the last few movements, and the monthly
 * credited/spent series behind the chart.
 */
export async function getWalletSummary(
  userId: string,
  options: { months?: number; recentLimit?: number } = {},
): Promise<WalletSummary> {
  const months = Math.min(Math.max(Math.trunc(options.months ?? 6), 1), 24);
  const recentLimit = Math.min(Math.max(Math.trunc(options.recentLimit ?? 5), 1), 50);

  const wallet = await getOrCreateWallet(userId);

  const [pendingResult, recentResult, monthlyResult] = await Promise.all([
    // Pending money comes from wallet_topup_sessions, never from the ledger.
    //
    // Two things are filtered out beyond the obvious status check:
    //
    //   * a session past its Stripe expiry is stale, not pending, even if no
    //     sweep has marked it EXPIRED yet;
    //   * a session whose id already appears in the ledger has been credited.
    //     completeTopUpSession runs after applyTransaction commits, so a crash
    //     in that gap would leave a PENDING row against money already in the
    //     balance. The NOT EXISTS makes that phantom impossible to display
    //     rather than relying on the status update having landed.
    pool.query(
      `SELECT ${TOPUP_SESSION_COLUMNS}
         FROM wallet_topup_sessions s
        WHERE s.user_id = $1
          AND s.status = 'PENDING'
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions t
             WHERE t.external_reference = s.stripe_session_id
          )
        ORDER BY s.created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT ${TRANSACTION_COLUMNS}
         FROM wallet_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [userId, recentLimit],
    ),
    pool.query(
      `SELECT
         to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
         COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0) AS credited,
         COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0) AS debited
       FROM wallet_transactions
      WHERE user_id = $1
        AND status = 'COMPLETED'
        AND created_at >= date_trunc('month', NOW()) - ($2::int - 1) * INTERVAL '1 month'
      GROUP BY 1
      ORDER BY 1 ASC`,
      [userId, months],
    ),
  ]);

  const byMonth = new Map<string, { credited: number; debited: number }>();
  for (const row of monthlyResult.rows) {
    byMonth.set(row.month, {
      credited: Number(row.credited),
      debited: Number(row.debited),
    });
  }

  // Months with no movement still get a point, so the chart keeps its rhythm.
  const now = new Date();
  const monthly: WalletMonthlyPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const point = byMonth.get(month) ?? { credited: 0, debited: 0 };
    monthly.push({
      month,
      credited: point.credited,
      debited: point.debited,
      net: Number((point.credited - point.debited).toFixed(2)),
    });
  }

  const pendingSessions = pendingResult.rows.map(mapTopUpSession);
  const pendingCents = pendingSessions.reduce((sum, s) => sum + toCents(s.amount), 0);

  return {
    wallet,
    pendingTopUp: pendingCents / 100,
    pendingSessions,
    recentTransactions: recentResult.rows.map(mapTransaction),
    monthly,
  };
}
