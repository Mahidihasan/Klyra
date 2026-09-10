export interface TimeSeriesPoint {
  date: string;
  volume: number;
}

export interface RevenueAnalytics {
  grossVolume: number;
  klyraCut: number;
  pendingPayouts: number;
  netRevenue: number;
  timeSeries: TimeSeriesPoint[];
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
  createdAt: string;
  processedAt: string | null;
}
