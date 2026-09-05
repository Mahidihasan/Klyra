import {
  ApiSpending,
  BillingInformation,
  BillingInformationField,
  BillingOverview,
  GetInvoicesQuery,
  GetPaymentsQuery,
  InvoiceDetail,
  InvoiceListResult,
  PaymentListResult,
  PaymentMethod,
  SpendingPoint,
} from '../../types/billing';
import { getDevUserId } from '../../config/devAuth';

const API_BASE_URL = '/api/billing';

/**
 * The billing endpoints wrap everything in { success, data, message } and
 * report failures as { success: false, error: { code, message } }, so this
 * unwraps `data` and surfaces `error.message`.
 */
/**
 * Thrown so callers can tell one failure from another — "Stripe isn't set up"
 * from a real outage, or a validation error carrying per-field messages.
 */
export class BillingApiError extends Error {
  code: string | null;

  fields: Partial<Record<BillingInformationField, string>>;

  constructor(
    message: string,
    code: string | null,
    fields: Partial<Record<BillingInformationField, string>> = {},
  ) {
    super(message);
    this.name = 'BillingApiError';
    this.code = code;
    this.fields = fields;
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
      json?.error?.fields ?? {},
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
  /**
   * Direct link to the invoice PDF. The server generates it on demand, so this
   * works whether or not a stored copy exists yet.
   */
  invoicePdfUrl(invoiceId: string): string {
    return `${API_BASE_URL}/invoices/${invoiceId}/pdf${withDevUserId(new URLSearchParams())}`;
  },

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

  async fetchSpending(months = 6): Promise<{ points: SpendingPoint[] }> {
    const params = new URLSearchParams({ months: String(months) });
    const res = await fetch(`${API_BASE_URL}/spending${withDevUserId(params)}`);
    return handleResponse<{ points: SpendingPoint[] }>(res);
  },

  async fetchSpendingByApi(): Promise<{ breakdown: ApiSpending[] }> {
    const res = await fetch(
      `${API_BASE_URL}/spending/by-api${withDevUserId(new URLSearchParams())}`,
    );
    return handleResponse<{ breakdown: ApiSpending[] }>(res);
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

  async fetchBillingInformation(): Promise<{ information: BillingInformation }> {
    const res = await fetch(
      `${API_BASE_URL}/information${withDevUserId(new URLSearchParams())}`,
    );
    return handleResponse<{ information: BillingInformation }>(res);
  },

  async saveBillingInformation(
    payload: Record<string, string>,
  ): Promise<{ information: BillingInformation }> {
    const res = await fetch(
      `${API_BASE_URL}/information${withDevUserId(new URLSearchParams())}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return handleResponse<{ information: BillingInformation }>(res);
  },

  async removePaymentMethod(paymentMethodId: string): Promise<{ id: string }> {
    const res = await fetch(
      `${API_BASE_URL}/payment-methods/${paymentMethodId}${withDevUserId(new URLSearchParams())}`,
      { method: 'DELETE' },
    );
    return handleResponse<{ id: string }>(res);
  },
};
