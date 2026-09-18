import React, { useState } from 'react';
import {
  BarChart3, Download, Filter, Calendar, Activity, ShieldCheck,
  AlertTriangle, ArrowUpRight, Zap, Database, TrendingUp, Layers
} from 'lucide-react';
import { ProviderProject, ApiConsumer } from '../../../types/apibuild';
import { DetailedEndpoint } from '../types';

interface TabUsageProps {
  project: ProviderProject;
  endpoints: DetailedEndpoint[];
  onShowToast: (msg: string) => void;
}

export const TabUsage: React.FC<TabUsageProps> = ({
  project,
  endpoints,
  onShowToast
}) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('30d');
  const [envFilter, setEnvFilter] = useState('ALL');

  const totalReqs = project.requests;
  const bandwidthGb = (totalReqs * 0.0000042).toFixed(2);
  const rangeLabel = timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days';

  // Simulated chart data
  const chartCols = 24;
  const chartData = Array.from({ length: chartCols }).map((_, i) => {
    const base = 40 + Math.random() * 40;
    const spike = i === 14 || i === 15 ? 80 : 0;
    return Math.min(base + spike, 100);
  });

  return (
    <div className="kly-usage-root">
      
      {/* Command Center Toolbar */}
      <div className="kly-usage-header-card">
        <div className="kly-usage-header-info">
          <Activity size={18} color="#a78bfa" />
          <div>
            <h3>Telemetry & Quota Posture</h3>
            <p>Analyze traffic patterns, inspect bandwidth egress, and monitor error budgets.</p>
          </div>
        </div>
        <div className="kly-usage-header-controls">
          <div className="kly-usage-control-group">
            <Layers size={13} />
            <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
              <option value="ALL">All Environments</option>
              <option value="prod">Production</option>
              <option value="staging">Staging</option>
            </select>
          </div>
          <div className="kly-usage-control-group">
            <Calendar size={13} />
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as '24h' | '7d' | '30d')}>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <button className="kly-btn kly-btn-secondary" onClick={() => onShowToast(`Exporting ${rangeLabel} report...`)}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kly-usage-kpi-grid">
        <div className="kly-usage-kpi">
          <div className="kly-usage-kpi-val-row">
            <span className="kly-usage-kpi-val">{project.requestsLabel.split(' ')[0]}</span>
            <span className="kly-usage-kpi-trend trend-up"><TrendingUp size={11} /> 12.4%</span>
          </div>
          <div className="kly-usage-kpi-label">Ingress Traffic ({rangeLabel})</div>
          <div className="kly-usage-kpi-meta">~420 req/sec average</div>
        </div>
        
        <div className="kly-usage-kpi">
          <div className="kly-usage-kpi-val-row">
            <span className="kly-usage-kpi-val">{bandwidthGb} <small>GB</small></span>
            <span className="kly-usage-kpi-trend trend-up"><TrendingUp size={11} /> 4.1%</span>
          </div>
          <div className="kly-usage-kpi-label">Bandwidth Egress</div>
          <div className="kly-usage-kpi-meta">64% served from edge cache</div>
        </div>
        
        <div className="kly-usage-kpi">
          <div className="kly-usage-kpi-val-row">
            <span className="kly-usage-kpi-val" style={{ color: '#34d399' }}>{project.successRate}%</span>
          </div>
          <div className="kly-usage-kpi-label">Service Reliability</div>
          <div className="kly-usage-kpi-meta">0.12% error rate (5xx)</div>
        </div>

        <div className="kly-usage-kpi">
          <div className="kly-usage-kpi-val-row">
            <span className="kly-usage-kpi-val" style={{ color: '#fbbf24' }}>4,210</span>
          </div>
          <div className="kly-usage-kpi-label">Throttled (429s)</div>
          <div className="kly-usage-kpi-meta">0.8% of total volume</div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="kly-card kly-usage-chart-panel">
        <div className="kly-usage-chart-header">
          <div>
            <h4>Traffic Volume & Latency Profile</h4>
            <p>Aggregated edge requests per interval</p>
          </div>
          <div className="kly-usage-chart-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: '#a78bfa' }}></span> 2xx Success</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#fbbf24' }}></span> 4xx Client</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#f43f5e' }}></span> 5xx Server</span>
          </div>
        </div>
        
        <div className="kly-usage-chart-container">
          {chartData.map((val, i) => (
            <div key={i} className="kly-usage-chart-bar-group">
              <div 
                className="kly-usage-chart-bar kly-usage-chart-bar-success" 
                style={{ height: `${val * 0.8}%` }}
                title={`${Math.round(val * 0.8 * 1200)} success`}
              />
              <div 
                className="kly-usage-chart-bar kly-usage-chart-bar-warn" 
                style={{ height: `${val * 0.15}%` }}
                title={`${Math.round(val * 0.15 * 1200)} 4xx errors`}
              />
              <div 
                className="kly-usage-chart-bar kly-usage-chart-bar-error" 
                style={{ height: `${val * 0.05}%` }}
                title={`${Math.round(val * 0.05 * 1200)} 5xx errors`}
              />
            </div>
          ))}
        </div>
        <div className="kly-usage-chart-x-axis">
          <span>{timeRange === '24h' ? '00:00' : timeRange === '7d' ? 'Mon' : '1st'}</span>
          <span>{timeRange === '24h' ? '12:00' : timeRange === '7d' ? 'Thu' : '15th'}</span>
          <span>{timeRange === '24h' ? '23:59' : timeRange === '7d' ? 'Sun' : '30th'}</span>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="kly-usage-breakdown-grid">
        
        {/* Endpoints */}
        <div className="kly-card kly-usage-breakdown-card">
          <div className="kly-usage-breakdown-header">
            <div>
              <Database size={14} color="#38bdf8" />
              <h4>Endpoint Utilization</h4>
            </div>
            <button className="kly-btn-icon" title="View all endpoints"><ArrowUpRight size={14} /></button>
          </div>
          
          <div className="kly-usage-breakdown-list">
            {endpoints.slice(0, 5).map((ep) => {
              const sharePct = Math.round((ep.totalRequests / (totalReqs || 1)) * 100);
              return (
                <div key={ep.id} className="kly-usage-breakdown-item">
                  <div className="kly-usage-breakdown-meta">
                    <div className="kly-usage-breakdown-title">
                      <span className={`kly-method-tag kly-method-${ep.method}`} style={{ fontSize: 9, padding: '1px 4px' }}>{ep.method}</span>
                      <span className="kly-mono" style={{ fontSize: 11, fontWeight: 600 }}>{ep.path}</span>
                    </div>
                    <span className="kly-usage-breakdown-stat">{ep.totalRequests.toLocaleString()} <small>({sharePct}%)</small></span>
                  </div>
                  <div className="kly-usage-progress-track">
                    <div className="kly-usage-progress-fill" style={{ width: `${Math.max(sharePct, 2)}%`, background: '#38bdf8' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consumers */}
        <div className="kly-card kly-usage-breakdown-card">
          <div className="kly-usage-breakdown-header">
            <div>
              <Zap size={14} color="#c4b5fd" />
              <h4>Top Consumers</h4>
            </div>
            <button className="kly-btn-icon" title="View all consumers"><ArrowUpRight size={14} /></button>
          </div>
          
          <div className="kly-usage-breakdown-list">
            {project.consumersList.slice(0, 5).map((c: ApiConsumer) => {
              const sharePct = Math.round((c.requests / (totalReqs || 1)) * 100);
              return (
                <div key={c.id} className="kly-usage-breakdown-item">
                  <div className="kly-usage-breakdown-meta">
                    <div className="kly-usage-breakdown-title">
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--kly-text-main)' }}>{c.name}</span>
                      <span className="kly-badge kly-badge-pill" style={{ fontSize: 9, padding: '1px 5px', color: '#a78bfa', borderColor: 'rgba(167,139,250,.3)' }}>{c.plan}</span>
                    </div>
                    <span className="kly-usage-breakdown-stat">{c.requests.toLocaleString()} <small>({sharePct}%)</small></span>
                  </div>
                  <div className="kly-usage-progress-track">
                    <div className="kly-usage-progress-fill" style={{ width: `${Math.max(sharePct, 2)}%`, background: '#a78bfa' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

