import { db } from '../../../database';
import { TelemetryPayload, TopMetrics, EndpointStat, ThrottlingIncident, TimeSeriesPoint } from './admin.usage.types';

export class AdminUsageService {
  async getTelemetry(): Promise<TelemetryPayload> {
    // We analyze the last 1 hour of telemetry for the dashboard
    const interval = '1 hour';
    const seconds = 3600;

    // 1. Top Metrics
    // Calculate global stats
    const metricsResult = await db.query(
      `
      SELECT 
        COUNT(*) as total_requests,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0) as p99_latency,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
      FROM api_analytics
      WHERE created_at >= NOW() - $1::interval
      `,
      [interval]
    );

    const row = metricsResult.rows[0];
    const totalRequests = parseInt(row.total_requests || '0', 10);
    const rps = totalRequests / seconds;
    const avgLatency = parseFloat(row.avg_latency || '0');
    const p99Latency = parseFloat(row.p99_latency || '0');
    const errorCount = parseInt(row.error_count || '0', 10);
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const metrics: TopMetrics = {
      totalRequests,
      rps,
      avgLatency,
      p99Latency,
      errorRate
    };

    // 2. Top Endpoints
    const endpointsResult = await db.query(
      `
      SELECT 
        request_method as method,
        endpoint as path,
        COUNT(*) as hits,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) as throttle_count
      FROM api_analytics
      WHERE created_at >= NOW() - $1::interval
      GROUP BY request_method, endpoint
      ORDER BY hits DESC
      LIMIT 10
      `,
      [interval]
    );

    const topEndpoints: EndpointStat[] = endpointsResult.rows.map((r: any) => ({
      method: r.method,
      path: r.path,
      hits: parseInt(r.hits, 10),
      avgLatency: parseFloat(r.avg_latency),
      throttleCount: parseInt(r.throttle_count, 10)
    }));

    // 3. Throttling Incidents
    const throttlingResult = await db.query(
      `
      SELECT 
        aa.ip_address,
        a.name as api_name,
        COUNT(*) as hits,
        MAX(aa.created_at) as last_seen
      FROM api_analytics aa
      LEFT JOIN apis a ON a.id = aa.api_id
      WHERE aa.created_at >= NOW() - $1::interval AND aa.status_code = 429
      GROUP BY aa.ip_address, a.name
      ORDER BY hits DESC
      LIMIT 10
      `,
      [interval]
    );

    const throttling: ThrottlingIncident[] = throttlingResult.rows.map((r: any) => ({
      ipAddress: r.ip_address,
      apiName: r.api_name,
      hits: parseInt(r.hits, 10),
      lastSeen: new Date(r.last_seen)
    }));

    // 4. Time Series (Live spike chart - group by minute for the last hour)
    const timeSeriesResult = await db.query(
      `
      SELECT 
        DATE_TRUNC('minute', created_at) as ts,
        COUNT(*) as requests,
        COALESCE(AVG(latency_ms), 0) as avg_latency
      FROM api_analytics
      WHERE created_at >= NOW() - $1::interval
      GROUP BY DATE_TRUNC('minute', created_at)
      ORDER BY ts ASC
      `,
      [interval]
    );

    const timeSeries: TimeSeriesPoint[] = timeSeriesResult.rows.map((r: any) => ({
      timestamp: new Date(r.ts).toISOString(),
      requests: parseInt(r.requests, 10),
      avgLatency: parseFloat(r.avg_latency)
    }));

    return {
      metrics,
      topEndpoints,
      throttling,
      timeSeries
    };
  }
}

export const adminUsageService = new AdminUsageService();
