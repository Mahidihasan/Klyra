import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Clock, Cpu, BarChart2 } from 'lucide-react';
import { usageApi, UsageApiError } from '../../services/api/usage';
import { UsageOverview, DailyUsagePoint, UsagePeriod } from '../../types/usage';
import { formatNumber, formatLatency, formatPercent, formatDate } from './format';
import { UsageEmptyState } from './shared';

interface OverviewTabProps {
  refreshToken: number;
  period: UsagePeriod;
  onLoadingChange: (loading: boolean) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ refreshToken, period, onLoadingChange }) => {
  const [overview, setOverview] = useState<UsageOverview | null>(null);
  const [daily, setDaily] = useState<DailyUsagePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      onLoadingChange(true);
      setError(null);
      try {
        const [overviewData, dailyData] = await Promise.all([
          usageApi.fetchOverview(period),
          usageApi.fetchDaily(period)
        ]);
        setOverview(overviewData);
        setDaily(dailyData);
      } catch (err) {
        setError(
          err instanceof UsageApiError && err.isUnauthorized
            ? 'Your session has expired. Sign in again to see your usage.'
            : err instanceof Error
              ? err.message
              : 'Failed to load overview data',
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

  if (loading && !overview) {
    return (
      <div className="usage-overview-skeleton">
        <div className="usage-kpi-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-base usage-kpi-card">
              <div className="usage-skeleton-text" style={{ width: '32px', height: '32px', borderRadius: '50%', marginBottom: '16px' }} />
              <div className="usage-skeleton-text" style={{ width: '80px', height: '28px', marginBottom: '8px' }} />
              <div className="usage-skeleton-text" style={{ width: '100px' }} />
            </div>
          ))}
        </div>
        <div className="card-base usage-chart-card" style={{ height: '300px' }}>
           <div className="usage-skeleton-text" style={{ width: '150px', marginBottom: '24px' }} />
           <div className="usage-chart-skeleton-bars" style={{ display: 'flex', gap: '8px', height: '100%', alignItems: 'flex-end' }}>
             {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="usage-skeleton-text" style={{ width: '100%', height: `${Math.random() * 80 + 20}%` }} />
             ))}
           </div>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const maxDailyRequests = Math.max(...(daily.map(d => d.requests) || [0]), 1);

  return (
    <div className="usage-overview-tab">
      <div className="usage-kpi-grid">
        <div className="card-base usage-kpi-card">
          <div className="usage-kpi-icon usage-icon-purple">
            <Activity size={20} />
          </div>
          <div className="usage-kpi-value">{formatNumber(overview.totalRequests)}</div>
          <div className="usage-kpi-label">Total Requests</div>
        </div>
        
        <div className="card-base usage-kpi-card">
          {/* errorRate is a percentage (0–100), so the threshold is 5, not 0.05.
              As a fraction this lit up red at a 0.05% error rate. */}
          <div className={`usage-kpi-icon ${overview.errorRate > 5 ? 'usage-icon-red' : 'usage-icon-amber'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="usage-kpi-value">{formatPercent(overview.errorRate)}</div>
          <div className="usage-kpi-label">Error Rate</div>
        </div>
        
        <div className="card-base usage-kpi-card">
          <div className="usage-kpi-icon usage-icon-blue">
            <Clock size={20} />
          </div>
          <div className="usage-kpi-value">{formatLatency(overview.avgLatencyMs)}</div>
          <div className="usage-kpi-label">Avg Latency</div>
        </div>
        
        <div className="card-base usage-kpi-card">
          <div className="usage-kpi-icon usage-icon-green">
            <Cpu size={20} />
          </div>
          <div className="usage-kpi-value">{formatNumber(overview.activeApis)}</div>
          <div className="usage-kpi-label">Active APIs</div>
        </div>
      </div>

      <div className="card-base usage-chart-card">
        <h3 className="usage-card-title">
          <BarChart2 size={18} /> Daily Requests ({overview.periodLabel})
        </h3>
        
        {daily.length === 0 ? (
          <div className="usage-chart-empty">No usage data for this period</div>
        ) : (
          <div className="usage-bar-chart">
            <div className="usage-bar-chart-inner">
              {daily.map((point, index) => {
                const heightPercent = Math.max((point.requests / maxDailyRequests) * 100, 2); // min 2% height
                
                return (
                  <div key={point.date} className="usage-bar-container" title={`${formatDate(point.date)}: ${formatNumber(point.requests)} requests`}>
                    <div className="usage-bar" style={{ height: `${heightPercent}%` }}>
                       <div className="usage-bar-tooltip">
                         <div className="usage-bar-tooltip-date">{formatDate(point.date)}</div>
                         <div className="usage-bar-tooltip-val">{formatNumber(point.requests)} reqs</div>
                       </div>
                    </div>
                    {/* Only show some labels to avoid crowding */}
                    {daily.length <= 14 || index % Math.ceil(daily.length / 7) === 0 ? (
                      <div className="usage-bar-label">
                        {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
