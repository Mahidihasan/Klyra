import { getDevUserId } from '../../config/devAuth';
import {
  GetInvoicesQuery,
  GetPaymentsQuery,
  InvoiceDetail,
  InvoiceListResult,
  PaymentListResult,
} from '../../types/billing';

const API_BASE_URL = '/api/billing';

interface BillingApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: {
    message?: string;
  };
}

/**
 * The billing endpoints wrap everything in { success, data, message } and
 * report failures as { success: false, error: { code, message } }, so this
 * unwraps `data` and surfaces `error.message`.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  let json: BillingApiResponse<T> | null = null;
  try {
    json = text ? (JSON.parse(text) as BillingApiResponse<T>) : null;
  } catch {
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`);
  }

  if (!json || !res.ok || json.success === false) {
    throw new Error(json?.error?.message || `HTTP ${res.status}: ${res.statusText}`);
  }

  return json.data as T;
}

function withDevUserId(params: URLSearchParams): string {
  // TODO(auth): drop this once the auth middleware sets req.user from the JWT.
  const devUserId = getDevUserId();
  if (devUserId) {
    params.set('userId', devUserId);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function pagedParams(query: { page?: number; limit?: number; status?: string }) {
  const params = new URLSearchParams();
  if (query.page) {
    params.set('page', String(query.page));
  }
  if (query.limit) {
    params.set('limit', String(query.limit));
  }
  if (query.status) {
    params.set('status', query.status);
  }
  return params;
}

export const billingApi = {
  async fetchInvoices(query: GetInvoicesQuery = {}): Promise<InvoiceListResult> {
    const res = await fetch(`${API_BASE_URL}/invoices${withDevUserId(pagedParams(query))}`);
    return handleResponse<InvoiceListResult>(res);
  },

  async fetchInvoice(invoiceId: string): Promise<InvoiceDetail> {
    const res = await fetch(
      `${API_BASE_URL}/invoices/${invoiceId}${withDevUserId(new URLSearchParams())}`,
    );
    return handleResponse<InvoiceDetail>(res);
  },

  async fetchPayments(query: GetPaymentsQuery = {}): Promise<PaymentListResult> {
    const res = await fetch(`${API_BASE_URL}/payments${withDevUserId(pagedParams(query))}`);
    return handleResponse<PaymentListResult>(res);
  },
};
