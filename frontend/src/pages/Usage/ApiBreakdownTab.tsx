import React, { useState, useEffect } from 'react';
import { AlertTriangle, Server } from 'lucide-react';
import { usageApi, UsageApiError } from '../../services/api/usage';
import { ApiUsageRow, UsagePeriod } from '../../types/usage';
import { formatNumber, formatLatency, formatPercent, formatRateLimit } from './format';
import { UsageEmptyState, UsageTableSkeleton } from './shared';

interface ApiBreakdownTabProps {
  refreshToken: number;
  period: UsagePeriod;
  onLoadingChange: (loading: boolean) => void;
}

export const ApiBreakdownTab: React.FC<ApiBreakdownTabProps> = ({ refreshToken, period, onLoadingChange }) => {
  const [data, setData] = useState<ApiUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      onLoadingChange(true);
      setError(null);
      try {
        const rows = await usageApi.fetchByApi(period);
        setData(rows.sort((a, b) => b.requests - a.requests));
      } catch (err) {
        setError(
          err instanceof UsageApiError && err.isUnauthorized
            ? 'Your session has expired. Sign in again to see this breakdown.'
            : err instanceof Error
              ? err.message
              : 'Failed to load API breakdown',
        );
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    };

    fetchData();
  }, [refreshToken, period]);

  if (error) {
    return (
      <UsageEmptyState 
        icon={<AlertTriangle size={32} style={{ color: 'var(--accent-purple)' }} />}
        title="Error loading data"
        description={error}
      />
    );
  }

  if (loading && data.length === 0) {
    return <UsageTableSkeleton rows={8} />;
  }

  if (data.length === 0) {
    return (
      <UsageEmptyState 
        icon={<Server size={32} style={{ color: 'var(--text-muted)' }} />}
        title="No API Usage"
        description="You have not made any API requests in the selected period."
      />
    );
  }

  return (
    <div className="card-base usage-table-container">
      <table className="usage-table">
        <thead>
          <tr>
            <th>API Name</th>
            <th className="usage-text-right">Requests</th>
            <th className="usage-text-right">Errors</th>
            <th className="usage-text-right">Error Rate</th>
            <th className="usage-text-right">Avg Latency</th>
            <th className="usage-text-right">This period</th>
            <th>Plan rate limit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.apiId}>
              <td className="usage-font-medium">{row.apiName}</td>
              <td className="usage-text-right">{formatNumber(row.requests)}</td>
              <td className="usage-text-right">{formatNumber(row.errors)}</td>
              <td className="usage-text-right">{formatPercent(row.errorRate)}</td>
              <td className="usage-text-right">{formatLatency(row.avgLatencyMs)}</td>
              <td className="usage-text-right">
                {row.requestsThisPeriod > 0 ? (
                  formatNumber(row.requestsThisPeriod)
                ) : (
                  <span className="usage-text-muted">—</span>
                )}
              </td>
              <td>
                {row.rateLimit !== null ? (
                  <span>{formatRateLimit(row.rateLimit, row.rateLimitPeriod)}</span>
                ) : (
                  <span className="usage-text-muted">No active plan</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
