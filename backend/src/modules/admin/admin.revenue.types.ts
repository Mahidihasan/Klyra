export interface RevenueAnalytics {
  grossVolume: number;
  klyraCut: number;
  pendingPayouts: number;
  netRevenue: number;
  timeSeries: { date: string; volume: number }[];
}

export interface ProviderPayoutRow {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  stripeAccountId: string | null;
  createdAt: Date;
  processedAt: Date | null;
}
