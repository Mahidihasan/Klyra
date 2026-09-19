import React, { useState, useEffect } from 'react';
import { AlertTriangle, List } from 'lucide-react';
import { usageApi, UsageApiError } from '../../services/api/usage';
import { RequestLogResult, UsagePeriod } from '../../types/usage';
import { formatLatency, formatDateTime, methodColor, statusColor } from './format';
import { UsageEmptyState, UsageTableSkeleton, UsagePagination } from './shared';

interface RequestHistoryTabProps {
  refreshToken: number;
  /** The page-level period. This tab used to ignore it and always show all
      history, which made the selector look broken here. */
  period: UsagePeriod;
  onLoadingChange: (loading: boolean) => void;
}

export const RequestHistoryTab: React.FC<RequestHistoryTabProps> = ({ refreshToken, period, onLoadingChange }) => {
  const [data, setData] = useState<RequestLogResult | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      onLoadingChange(true);
      setError(null);
      try {
        const result = await usageApi.fetchHistory(period, page, limit);
        setData(result);
      } catch (err) {
        setError(
          err instanceof UsageApiError && err.isUnauthorized
            ? 'Your session has expired. Sign in again to see your history.'
            : err instanceof Error
              ? err.message
              : 'Failed to load request history',
        );
      } finally {
        setLoading(false);
        onLoadingChange(false);
      }
    };

    fetchData();
  }, [refreshToken, page, period]);

  // A new period is a different result set, so an old page number would land
  // past the end of it and show an empty table.
  useEffect(() => {
    setPage(1);
  }, [period]);

  // Reset page when refresh token changes
  useEffect(() => {
    if (refreshToken > 0) {
      setPage(1);
    }
  }, [refreshToken]);

  if (error) {
    return (
      <UsageEmptyState 
        icon={<AlertTriangle size={32} style={{ color: 'var(--accent-purple)' }} />}
        title="Error loading history"
        description={error}
      />
    );
  }

  if (loading && !data) {
    return <UsageTableSkeleton rows={10} />;
  }

  if (data?.entries.length === 0) {
    return (
      <UsageEmptyState 
        icon={<List size={32} style={{ color: 'var(--text-muted)' }} />}
        title="No Request History"
        description="No API requests have been logged yet."
      />
    );
  }

  return (
    <div className="card-base usage-table-container">
      <table className="usage-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>API</th>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th className="usage-text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          {data?.entries.map((log) => (
            <tr key={log.id} className={log.isError ? 'usage-row-error' : ''}>
              <td className="usage-text-muted" style={{ whiteSpace: 'nowrap' }}>
                {formatDateTime(log.createdAt)}
              </td>
              <td>{log.apiName || 'Unknown API'}</td>
              <td>
                <span 
                  className="usage-badge" 
                  style={{ 
                    backgroundColor: `${methodColor(log.method)}20`, 
                    color: methodColor(log.method) 
                  }}
                >
                  {log.method}
                </span>
              </td>
              <td className="usage-font-mono usage-text-sm" style={{ wordBreak: 'break-all' }}>
                {log.endpoint}
              </td>
              <td>
                <span 
                  className="usage-status-dot" 
                  style={{ backgroundColor: statusColor(log.statusCode) }}
                ></span>
                <span style={{ color: statusColor(log.statusCode) }}>{log.statusCode}</span>
              </td>
              <td className="usage-text-right">
                {formatLatency(log.latencyMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {data && (
        <UsagePagination 
          page={data.meta.page} 
          totalPages={data.meta.totalPages} 
          onPageChange={setPage} 
        />
      )}
    </div>
  );
};
