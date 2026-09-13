export interface AdminSubscriptionRow {
  id: string;
  subscriberName: string;
  subscriberEmail: string;
  apiName: string;
  planName: string;
  billingInterval: string;
  periodEnd: Date | null;
  status: string;
  autoRenew: boolean;
  createdAt: Date;
}

export interface GlobalTierTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  suggestedPrice: number;
  features: string[];
  rateLimit: number | null;
  rateLimitPeriod: string | null;
}
