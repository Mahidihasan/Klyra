// Mirrors the invoice_status enum in infrastructure/database/schema.sql.
export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID';

// Mirrors the payment_status enum.
export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type InvoiceFilter = 'all' | 'paid' | 'unpaid' | 'void';

export type PaymentFilter = 'all' | 'succeeded' | 'pending' | 'failed' | 'refunded';

export interface InvoiceSubscription {
  id: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  api: { id: string; name: string };
  plan: { id: string; name: string };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  subscription: InvoiceSubscription | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  paymentMethodDetails: Record<string, unknown> | null;
  failureReason: string | null;
  createdAt: string;
}

export interface InvoiceDetail extends Invoice {
  payments: InvoicePayment[];
  amountPaid: number;
  amountDue: number;
}

export interface Payment extends InvoicePayment {
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  apiName: string | null;
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export interface SubscriptionSummary {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  api: { id: string; name: string };
  plan: { id: string; name: string };
}

export interface DueInvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  /** Negative when the due date has already passed. */
  daysFromNow: number;
}

export interface SpendingPoint {
  /** 'YYYY-MM' */
  month: string;
  currency: string;
  amount: number;
}

export interface ApiSpending {
  apiId: string | null;
  apiName: string;
  currency: string;
  amount: number;
  invoiceCount: number;
}

export interface BillingOverview {
  outstanding: CurrencyTotal[];
  overdue: CurrencyTotal[];
  paidThisMonth: CurrencyTotal[];
  paidLastMonth: CurrencyTotal[];
  totalSpent: CurrencyTotal[];
  nextPayment: DueInvoiceSummary | null;
  oldestOverdue: DueInvoiceSummary | null;
  failedPayments: {
    count: number;
    latest: Payment | null;
  };
  defaultPaymentMethod: PaymentMethod | null;
  billingInformation: BillingInformation;
  recentInvoices: Invoice[];
  recentPayments: Payment[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InvoiceListResult {
  invoices: Invoice[];
  meta: PaginationMeta;
}

export interface PaymentListResult {
  payments: Payment[];
  meta: PaginationMeta;
}

/**
 * Details that appear on invoices. Nullable fields mirror the backend, where a
 * blank input is stored as null rather than an empty string.
 */
export interface BillingInformation {
  billingName: string;
  companyName: string | null;
  invoiceEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string | null;
  taxId: string | null;
  updatedAt: string | null;
}

export type BillingInformationField = Exclude<keyof BillingInformation, 'updatedAt'>;

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface GetInvoicesQuery {
  page?: number;
  limit?: number;
  status?: Exclude<InvoiceFilter, 'all'>;
}

export interface GetPaymentsQuery {
  page?: number;
  limit?: number;
  status?: Exclude<PaymentFilter, 'all'>;
}
