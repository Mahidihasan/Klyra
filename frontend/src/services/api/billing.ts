import {
  BillingOverview,
  GetInvoicesQuery,
  GetPaymentsQuery,
  InvoiceDetail,
  InvoiceListResult,
  PaymentListResult,
  PaymentMethod,
} from '../../types/billing';
import { getDevUserId } from '../../config/devAuth';

const API_BASE_URL = '/api/billing';

/**
 * The billing endpoints wrap everything in { success, data, message } and
 * report failures as { success: false, error: { code, message } }, so this
 * unwraps `data` and surfaces `error.message`.
 */
/** Thrown so callers can tell "Stripe isn't set up" from a real failure. */
export class BillingApiError extends Error {
  code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'BillingApiError';
    this.code = code;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`);
  }

  if (!res.ok || json?.success === false) {
    throw new BillingApiError(
      json?.error?.message || `HTTP ${res.status}: ${res.statusText}`,
      json?.error?.code ?? null,
    );
  }

  return json.data as T;
}

function withDevUserId(params: URLSearchParams): string {
  // TODO(auth): drop this once the auth middleware sets req.user from the JWT.
  const devUserId = getDevUserId();
  if (devUserId) params.set('userId', devUserId);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function pagedParams(query: { page?: number; limit?: number; status?: string }) {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.status) params.set('status', query.status);
  return params;
}

export const billingApi = {
  async fetchOverview(): Promise<BillingOverview> {
    const res = await fetch(
      `${API_BASE_URL}/overview${withDevUserId(new URLSearchParams())}`,
    );
    return handleResponse<BillingOverview>(res);
  },

  async fetchInvoices(query: GetInvoicesQuery = {}): Promise<InvoiceListResult> {
    const res = await fetch(
      `${API_BASE_URL}/invoices${withDevUserId(pagedParams(query))}`,
    );
    return handleResponse<InvoiceListResult>(res);
  },

  async fetchInvoice(invoiceId: string): Promise<InvoiceDetail> {
    const res = await fetch(
      `${API_BASE_URL}/invoices/${invoiceId}${withDevUserId(new URLSearchParams())}`,
    );
    return handleResponse<InvoiceDetail>(res);
  },

  async fetchPayments(query: GetPaymentsQuery = {}): Promise<PaymentListResult> {
    const res = await fetch(
      `${API_BASE_URL}/payments${withDevUserId(pagedParams(query))}`,
    );
    return handleResponse<PaymentListResult>(res);
  },

  async fetchPaymentMethods(): Promise<{ paymentMethods: PaymentMethod[] }> {
    const res = await fetch(
      `${API_BASE_URL}/payment-methods${withDevUserId(new URLSearchParams())}`,
    );
    return handleResponse<{ paymentMethods: PaymentMethod[] }>(res);
  },

  /** Returns the Stripe-hosted URL to send the person to for adding a card. */
  async createCardSetupSession(returnUrl: string): Promise<{ url: string }> {
    const res = await fetch(
      `${API_BASE_URL}/payment-methods/setup-session${withDevUserId(new URLSearchParams())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl }),
      },
    );
    return handleResponse<{ url: string }>(res);
  },

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<{ id: string }> {
    const res = await fetch(
      `${API_BASE_URL}/payment-methods/${paymentMethodId}/default${withDevUserId(new URLSearchParams())}`,
      { method: 'POST' },
    );
    return handleResponse<{ id: string }>(res);
  },

  async removePaymentMethod(paymentMethodId: string): Promise<{ id: string }> {
    const res = await fetch(
      `${API_BASE_URL}/payment-methods/${paymentMethodId}${withDevUserId(new URLSearchParams())}`,
      { method: 'DELETE' },
    );
    return handleResponse<{ id: string }>(res);
  },
};
