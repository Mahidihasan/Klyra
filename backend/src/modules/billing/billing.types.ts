// Mirrors the invoice_status enum in infrastructure/database/schema.sql.
// Keep these in sync — an unknown label makes Postgres reject the enum cast.
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

// Mirrors the payment_status enum.
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export type InvoiceStatusFilter = 'paid' | 'unpaid' | 'void';

export type PaymentStatusFilter = 'succeeded' | 'pending' | 'failed' | 'refunded';

export interface InvoiceSubscription {
  id: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  api: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    name: string;
  };
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

/** A payment attempt recorded against an invoice. */
export interface InvoicePayment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  /** Non-sensitive card details only (brand, last4) — never full card data. */
  paymentMethodDetails: Record<string, unknown> | null;
  failureReason: string | null;
  createdAt: string;
}

/** Single-invoice response: the invoice plus its payment attempts. */
export interface InvoiceDetail extends Invoice {
  payments: InvoicePayment[];
  amountPaid: number;
  amountDue: number;
}

/** A payment as listed in payment history, with its invoice context. */
export interface Payment extends InvoicePayment {
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  apiName: string | null;
}

export interface GetInvoicesQuery {
  page?: number;
  limit?: number;
  status?: InvoiceStatusFilter;
}

export interface GetPaymentsQuery {
  page?: number;
  limit?: number;
  status?: PaymentStatusFilter;
}

/** One currency's slice of a money total — amounts can't be summed across currencies. */
export interface CurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export interface BillingOverview {
  outstanding: CurrencyTotal[];
  paidThisMonth: CurrencyTotal[];
  paidLastMonth: CurrencyTotal[];
  nextPayment: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    dueDate: string;
    isOverdue: boolean;
  } | null;
  recentInvoices: Invoice[];
  recentPayments: Payment[];
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface AddPaymentMethodPayload {
  paymentMethodId: string;
  setAsDefault?: boolean;
}
