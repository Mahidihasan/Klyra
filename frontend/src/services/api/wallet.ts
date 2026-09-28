/**
 * Wallet API client.
 *
 * Follows services/api/admin.ts: the backend wraps every response in
 * { success, data } and reports failures as
 * { success: false, error: { code, message } }, so this unwraps `data` and
 * surfaces the error as a typed WalletApiError carrying the code.
 *
 * config/devAuth is deliberately not imported. That is billing's legacy path
 * and these endpoints move money — the JWT is the only identity they accept.
 */

import {
  GetTransactionsQuery,
  TopUpSessionResponse,
  WalletErrorCode,
  WalletOverview,
  WalletSummaryResponse,
  WalletTopUpSession,
  WalletTransactionsPage,
} from '../../types/wallet';

const API_BASE_URL = '/api/wallet';

/** The SSE stream. Read with fetch, not EventSource — see useWalletLiveRefresh. */
export const WALLET_EVENTS_URL = `${API_BASE_URL}/events`;

/**
 * Thrown so screens can tell one failure from another.
 *
 * The distinction that matters on this screen: STRIPE_NOT_CONFIGURED means
 * "top-ups are switched off in this environment", which deserves an
 * explanation rather than the red error state a real outage gets.
 */
export class WalletApiError extends Error {
  code: WalletErrorCode | null;

  status: number;

  constructor(message: string, code: WalletErrorCode | null, status: number) {
    super(message);
    this.name = 'WalletApiError';
    this.code = code;
    this.status = status;
  }

  /** No usable session — the screen should send the user to sign in. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Payments are off in this environment; not an outage. */
  get isStripeMissing(): boolean {
    return this.code === 'STRIPE_NOT_CONFIGURED';
  }

  /** An admin has frozen spending on this wallet. */
  get isLocked(): boolean {
    return this.code === 'WALLET_LOCKED';
  }

  /** The top-up was already paid, already closed, or never this user's. */
  get isSessionGone(): boolean {
    return this.code === 'TOPUP_SESSION_NOT_FOUND';
  }
}

/** Exported so the stream hook sends the same credentials as every call. */
export function walletAuthHeaders(): Record<string, string> {
  return authHeaders();
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const token = localStorage.getItem('klyra_access_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // A non-JSON body means something upstream of the route answered — a proxy
    // error page, say. Surface it as-is rather than pretending it was ours.
    throw new WalletApiError(text || `HTTP ${res.status}: ${res.statusText}`, null, res.status);
  }

  const body = json as {
    success?: boolean;
    data?: T;
    error?: { code?: WalletErrorCode; message?: string };
  } | null;

  if (!res.ok || body?.success === false) {
    throw new WalletApiError(
      body?.error?.message || `HTTP ${res.status}: ${res.statusText}`,
      body?.error?.code ?? null,
      res.status,
    );
  }

  return body?.data as T;
}

/**
 * `signal` lets a screen abort a request it no longer needs — switching
 * filters fires a new fetch on every click, and without this a slow earlier
 * response could land last and overwrite the newer one.
 */
interface RequestOptions {
  signal?: AbortSignal;
}

/** Omits anything unset: the backend treats an empty `type=` as a 400. */
function transactionParams(query: GetTransactionsQuery): string {
  const params = new URLSearchParams();

  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.type && query.type !== 'all') params.set('type', query.type);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/** Balance, lock state, pending top-ups and the last five movements. */
export async function fetchWallet(options: RequestOptions = {}): Promise<WalletOverview> {
  const res = await fetch(API_BASE_URL, {
    headers: authHeaders(),
    signal: options.signal,
  });
  return handleResponse<WalletOverview>(res);
}

/** The monthly credited/spent series behind the Overview chart. */
export async function fetchWalletSummary(
  months = 6,
  options: RequestOptions = {},
): Promise<WalletSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/summary?months=${months}`, {
    headers: authHeaders(),
    signal: options.signal,
  });
  return handleResponse<WalletSummaryResponse>(res);
}

/** One page of the ledger. */
export async function fetchWalletTransactions(
  query: GetTransactionsQuery = {},
  options: RequestOptions = {},
): Promise<WalletTransactionsPage> {
  const res = await fetch(`${API_BASE_URL}/transactions${transactionParams(query)}`, {
    headers: authHeaders(),
    signal: options.signal,
  });
  return handleResponse<WalletTransactionsPage>(res);
}

/**
 * Starts a hosted Stripe Checkout and returns the URL to send the user to.
 *
 * The amount is validated again server-side; this is not the only guard. The
 * balance changes when Stripe's signed webhook arrives, never on return from
 * the payment page, so callers should re-fetch rather than assume.
 */
export async function createTopUpSession(
  amount: number,
  returnUrl: string,
): Promise<TopUpSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/topup/session`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, returnUrl }),
  });
  return handleResponse<TopUpSessionResponse>(res);
}

/**
 * Closes a top-up the user started and did not pay.
 *
 * Moves no money — it closes an intention. The balance and the ledger are
 * untouched, so callers only need to refresh the pending list.
 */
export async function cancelTopUpSession(
  stripeSessionId: string,
): Promise<WalletTopUpSession> {
  const res = await fetch(
    `${API_BASE_URL}/topup/session/${encodeURIComponent(stripeSessionId)}/cancel`,
    { method: 'POST', headers: authHeaders() },
  );
  return handleResponse<WalletTopUpSession>(res);
}
