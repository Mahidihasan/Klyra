export interface TopMetrics {
  totalRequests: number;
  rps: number;
  avgLatency: number;
  p99Latency: number;
  errorRate: number; // percentage
}

export interface EndpointStat {
  method: string;
  path: string;
  hits: number;
  avgLatency: number;
  throttleCount: number;
}

export interface ThrottlingIncident {
  ipAddress: string | null;
  apiName: string | null;
  hits: number;
  lastSeen: Date;
}

export interface TimeSeriesPoint {
  timestamp: string;
  requests: number;
  avgLatency: number;
}

export interface TelemetryPayload {
  metrics: TopMetrics;
  topEndpoints: EndpointStat[];
  throttling: ThrottlingIncident[];
  timeSeries: TimeSeriesPoint[];
}
