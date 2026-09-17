// Shared Wallet shapes. Mirrored on the frontend in src/types/wallet.ts, so
// every name here is part of the contract — rename in both places or not at all.
//
// Nothing in this file may import from the backend runtime (pg, express, …):
// it is copied verbatim to the frontend in Phase 4.

// Mirrors the wallet_transaction_type enum in
// infrastructure/database/2026_09_16_001_wallet.sql. An unknown label makes
// Postgres reject the enum cast outright.
export type WalletTransactionType =
  | 'TOPUP'
  | 'SPEND'
  | 'REFUND'
  | 'BONUS'
  | 'ADJUSTMENT';

// Mirrors wallet_transaction_direction.
export type WalletTransactionDirection = 'CREDIT' | 'DEBIT';

// Mirrors wallet_transaction_status.
export type WalletTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

/**
 * The filter chips on the Transactions tab, per WALLET_DESIGN.md section 4.3.
 *
 * BONUS sits under 'topups' because both are credits the user did not spend;
 * it has no chip of its own in the design.
 */
export type WalletTransactionFilter =
  | 'all'
  | 'topups'
  | 'spending'
  | 'refunds'
  | 'adjustments';

/** Error codes from WALLET_ARCHITECTURE.md section 4.5. */
export type WalletErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_AMOUNT'
  | 'INVALID_RETURN_URL'
  | 'INSUFFICIENT_FUNDS'
  | 'WALLET_LOCKED'
  | 'STRIPE_NOT_CONFIGURED'
  | 'INVALID_SIGNATURE'
  | 'INTERNAL_ERROR'
  // Not in WALLET_ARCHITECTURE.md section 4.5: added for the cancel endpoint,
  // which the document does not describe. Reusing one of the codes above would
  // have meant reporting "not found" as something it is not.
  | 'TOPUP_SESSION_NOT_FOUND';

export interface Wallet {
  id: string;
  userId: string;
  /** Cached projection of the ledger. Written only by applyTransaction. */
  balance: number;
  currency: string;
  /** Frozen by an admin during a dispute: debits are refused, credits are not. */
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  status: WalletTransactionStatus;
  /** Always positive. The direction carries the sign. */
  amount: number;
  currency: string;
  /** Wallet balance immediately after this movement. */
  balanceAfter: number;
  description: string | null;
  /** What caused the movement: 'invoice', 'stripe_checkout', … */
  referenceType: string | null;
  referenceId: string | null;
  /** Stripe session or payment intent id. Unique across the ledger. */
  externalReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Mirrors the wallet_topup_session_status enum in
// infrastructure/database/2026_09_16_002_wallet_topup_sessions.sql.
export type WalletTopUpSessionStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'FAILED';

/**
 * An intent to add funds, tracked separately from the ledger.
 *
 * The ledger is append-only and records money that moved; this records money
 * the user has committed to but that has not arrived. Keeping them apart is
 * what lets the Overview screen show a pending top-up without inventing a
 * ledger row that could never be completed.
 */
export interface WalletTopUpSession {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: WalletTopUpSessionStatus;
  stripeSessionId: string;
  /** The ledger row this session produced. Null until the webhook credits. */
  transactionId: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GetTransactionsQuery {
  page?: number;
  limit?: number;
  type?: WalletTransactionFilter;
  /** Inclusive ISO date or timestamp. */
  from?: string;
  /** Inclusive ISO date or timestamp. */
  to?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WalletTransactionsPage {
  transactions: WalletTransaction[];
  meta: PaginationMeta;
}

/** One month of the Overview chart. */
export interface WalletMonthlyPoint {
  /** 'YYYY-MM' */
  month: string;
  credited: number;
  debited: number;
  /** credited − debited. Negative when the month spent more than it added. */
  net: number;
}

export interface WalletSummary {
  wallet: Wallet;
  /**
   * Total of still-open top-up sessions: money committed but not yet credited.
   * Comes from wallet_topup_sessions, never from the ledger, and is never part
   * of `wallet.balance`. Expired sessions are excluded.
   */
  pendingTopUp: number;
  /** The open sessions behind `pendingTopUp`, newest first. */
  pendingSessions: WalletTopUpSession[];
  recentTransactions: WalletTransaction[];
  monthly: WalletMonthlyPoint[];
}

// ---------------------------------------------------------------------------
// Endpoint responses
//
// What each route puts in the `data` field of the { success, data } envelope.
// Declared here rather than in the route file so the frontend mirror carries
// them too: the two workspaces compile separately, and this is the only place
// the shape of the contract is written down.
// ---------------------------------------------------------------------------

/** GET /api/wallet */
export interface WalletOverview {
  wallet: Wallet;
  pendingTopUp: number;
  pendingSessions: WalletTopUpSession[];
  recentTransactions: WalletTransaction[];
}

/** GET /api/wallet/summary */
export interface WalletSummaryResponse {
  wallet: Wallet;
  pendingTopUp: number;
  monthly: WalletMonthlyPoint[];
}

/** POST /api/wallet/topup/session */
export interface TopUpSessionResponse {
  url: string;
  sessionId: string;
}

/** Input to the one function permitted to change a balance. */
export interface ApplyTransactionInput {
  userId: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  /** Positive. At most two decimal places. */
  amount: number;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  /**
   * Stripe identifier. When supplied the call becomes idempotent: a repeat
   * returns the existing ledger row instead of moving money a second time.
   */
  externalReference?: string;
  metadata?: Record<string, unknown>;
}
