import React, { useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { UsagePeriod } from '../../types/usage';
import { OverviewTab } from './OverviewTab';
import { ApiBreakdownTab } from './ApiBreakdownTab';
import { RequestHistoryTab } from './RequestHistoryTab';
import { UsageFilters } from './shared';

type Section = 'overview' | 'api-breakdown' | 'history';

export const UsagePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [period, setPeriod] = useState<UsagePeriod>('30d');
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshToken(prev => prev + 1);
  };

  const periodOptions: { label: string; value: UsagePeriod }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
  ];

  return (
    <div className="usage-page">
      <style>{`
        .usage-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .usage-title-group h1 {
          font-size: 28px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .usage-title-group p {
          color: var(--text-muted);
          margin: 0;
        }

        .usage-refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .usage-refresh-btn:hover {
          background: var(--bg-input);
          border-color: var(--border-subtle);
        }

        .usage-refresh-btn.refreshing svg {
          animation: spin 1s linear infinite;
        }

        .usage-controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .usage-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--border-card);
          padding-bottom: 1px;
        }

        .usage-tab-btn {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -1px;
        }

        .usage-tab-btn:hover {
          color: var(--text-primary);
        }

        .usage-tab-btn.active {
          color: var(--accent-purple);
          border-bottom-color: var(--accent-purple);
        }

        .usage-filters {
          display: flex;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 4px;
        }

        .usage-filter-btn {
          padding: 6px 16px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .usage-filter-btn:hover {
          color: var(--text-primary);
        }

        .usage-filter-btn.active {
          background: var(--bg-input);
          color: var(--text-primary);
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        /* KPI Cards */
        .usage-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }

        .usage-kpi-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
        }

        .usage-kpi-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .usage-icon-purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
        .usage-icon-amber { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .usage-icon-red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .usage-icon-blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .usage-icon-green { background: rgba(16, 185, 129, 0.1); color: #10b981; }

        .usage-kpi-value {
          font-size: 28px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .usage-kpi-label {
          color: var(--text-muted);
          font-size: 14px;
        }

        /* Charts */
        .usage-chart-card {
          padding: 24px;
        }

        .usage-card-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 24px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .usage-bar-chart {
          height: 300px;
          width: 100%;
          position: relative;
          padding-bottom: 24px; /* Space for labels */
        }
        
        .usage-bar-chart-inner {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 100%;
          gap: 4px;
        }

        .usage-bar-container {
          flex: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          position: relative;
          group: bar;
        }

        .usage-bar {
          width: 100%;
          max-width: 40px;
          background: var(--accent-purple);
          border-radius: 4px 4px 0 0;
          opacity: 0.8;
          transition: opacity 0.2s, height 0.5s ease-out;
          position: relative;
        }

        .usage-bar-container:hover .usage-bar {
          opacity: 1;
        }

        .usage-bar-label {
          position: absolute;
          bottom: -24px;
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          transform: translateX(-50%);
          left: 50%;
        }

        .usage-bar-tooltip {
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s;
          white-space: nowrap;
          z-index: 10;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .usage-bar-container:hover .usage-bar-tooltip {
          opacity: 1;
          visibility: visible;
          top: -48px;
        }

        .usage-bar-tooltip-date {
          color: var(--text-muted);
          margin-bottom: 2px;
          font-size: 11px;
        }
        .usage-bar-tooltip-val {
          color: var(--text-primary);
          font-weight: 500;
        }

        /* Tables */
        .usage-table-container {
          overflow-x: auto;
        }

        .usage-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .usage-table th {
          padding: 16px 24px;
          color: var(--text-muted);
          font-weight: 500;
          font-size: 14px;
          border-bottom: 1px solid var(--border-card);
          background: var(--bg-card);
        }

        .usage-table td {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-card);
          color: var(--text-primary);
          font-size: 14px;
        }

        .usage-table tbody tr:hover {
          background: var(--bg-input);
        }

        .usage-text-right { text-align: right; }
        .usage-font-medium { font-weight: 500; }
        .usage-font-mono { font-family: var(--font-mono, monospace); }
        .usage-text-muted { color: var(--text-muted); }
        .usage-text-sm { font-size: 13px; }

        /* Statuses & Badges */
        .usage-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
        }

        .usage-status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }

        .usage-row-error {
          background: rgba(239, 68, 68, 0.05);
        }

        /* Quota Bar */
        .usage-quota-bar-container {
          width: 100%;
          min-width: 120px;
        }

        .usage-quota-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .usage-quota-track {
          width: 100%;
          height: 6px;
          background: var(--bg-input);
          border-radius: 3px;
          overflow: hidden;
        }

        .usage-quota-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        /* Pagination */
        .usage-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-top: 1px solid var(--border-card);
        }

        .usage-pagination-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 14px;
        }

        .usage-pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .usage-pagination-btn:not(:disabled):hover {
          background: var(--bg-input);
        }

        .usage-pagination-text {
          color: var(--text-muted);
          font-size: 14px;
        }

        /* Utilities */
        .usage-empty-state {
          padding: 64px 24px;
          text-align: center;
        }

        .usage-empty-icon {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }

        .usage-empty-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        .usage-empty-desc {
          color: var(--text-muted);
          margin: 0;
          max-width: 400px;
          margin: 0 auto;
        }

        .usage-skeleton-text {
          height: 20px;
          background: linear-gradient(90deg, var(--bg-input) 25%, var(--border-card) 50%, var(--bg-input) 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="usage-header">
        <div className="usage-title-group">
          <h1><Activity size={28} style={{ color: 'var(--accent-purple)' }} /> Usage</h1>
          <p>Monitor your API consumption, performance and quota usage.</p>
        </div>
        <button 
          className={`usage-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="usage-controls-bar">
        <div className="usage-tabs">
          <button 
            className={`usage-tab-btn ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </button>
          <button 
            className={`usage-tab-btn ${activeSection === 'api-breakdown' ? 'active' : ''}`}
            onClick={() => setActiveSection('api-breakdown')}
          >
            Per-API Breakdown
          </button>
          <button 
            className={`usage-tab-btn ${activeSection === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSection('history')}
          >
            Request History
          </button>
        </div>

        {(activeSection === 'overview' || activeSection === 'api-breakdown') && (
          <UsageFilters 
            options={periodOptions} 
            value={period} 
            onChange={setPeriod} 
          />
        )}
      </div>

      <div className="usage-content">
        {activeSection === 'overview' && (
          <OverviewTab 
            refreshToken={refreshToken} 
            period={period} 
            onLoadingChange={setIsRefreshing}
          />
        )}
        
        {activeSection === 'api-breakdown' && (
          <ApiBreakdownTab 
            refreshToken={refreshToken} 
            period={period}
            onLoadingChange={setIsRefreshing}
          />
        )}
        
        {activeSection === 'history' && (
          <RequestHistoryTab 
            refreshToken={refreshToken}
            period={period}
            onLoadingChange={setIsRefreshing}
          />
        )}
      </div>
    </div>
  );
};
