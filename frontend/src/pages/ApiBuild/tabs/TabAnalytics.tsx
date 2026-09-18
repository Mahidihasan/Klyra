import React, { useState } from 'react';
import {
  BarChart3, DollarSign, Activity, Globe, RefreshCw, Download,
  CheckCircle2, Server, Users, TrendingUp, TrendingDown, Map
} from 'lucide-react';
import { ProviderProject } from '../../../types/apibuild';

interface TabAnalyticsProps {
  project: ProviderProject;
}

export const TabAnalytics: React.FC<TabAnalyticsProps> = ({ project }) => {
  const [mode, setMode] = useState<'tech' | 'biz'>('tech');
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [compare, setCompare] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Simulated traffic for tech chart
  const traffic = range === '24h' ? [42, 67, 54, 82, 60, 74, 91, 69] : range === '7d' ? [55, 76, 62, 88, 71, 93, 79] : [48, 58, 52, 67, 72, 63, 81, 76, 92, 84];
  const maxTraffic = Math.max(...traffic);

  // Simulated revenue for biz chart
  const revenueTrend = [12000, 14500, 13800, 16200, 19500, 21000, project.revenue];
  const maxRevenue = Math.max(...revenueTrend);

  return (
    <div className="kly-analytics-root">
      {/* Top Controller */}
      <div className="kly-analytics-controller kly-card">
        <div className="kly-analytics-mode-switch">
          <button
            className={`kly-analytics-mode-btn ${mode === 'tech' ? 'active' : ''}`}
            onClick={() => setMode('tech')}
          >
            <Activity size={14} /> Technical & Infrastructure
          </button>
          <button
            className={`kly-analytics-mode-btn ${mode === 'biz' ? 'active' : ''}`}
            onClick={() => setMode('biz')}
          >
            <DollarSign size={14} /> Monetization & Business
          </button>
        </div>

        <div className="kly-analytics-global-controls">
          <div className="kly-analytics-status">
            <span className={`kly-pulse-dot ${autoRefresh ? 'active' : 'paused'}`} />
            {autoRefresh ? 'Live telemetry' : 'Paused'}
          </div>
          <div className="kly-analytics-toolbar-divider" />
          <label className="kly-analytics-checkbox">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare vs prior
          </label>
          <button className={`kly-btn-icon ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)} title="Toggle Auto-refresh">
            <RefreshCw size={14} />
          </button>
          <button className="kly-btn kly-btn-secondary" title="Export Dashboard Data">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {mode === 'tech' ? (
        <div className="kly-analytics-view tech-view">
          {/* Tech KPIs */}
          <div className="kly-analytics-kpi-grid">
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">P50 Latency (Median)</span>
              </div>
              <div className="kly-analytics-kpi-val">110<small>ms</small></div>
              <div className="kly-analytics-kpi-trend positive"><TrendingDown size={11} /> 12ms faster</div>
            </div>
            
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">P90 Latency</span>
              </div>
              <div className="kly-analytics-kpi-val">240<small>ms</small></div>
              <div className="kly-analytics-kpi-trend positive"><TrendingDown size={11} /> 5ms faster</div>
            </div>
            
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">P95 Latency</span>
              </div>
              <div className="kly-analytics-kpi-val">421<small>ms</small></div>
              <div className="kly-analytics-kpi-trend neutral"><Activity size={11} /> Stable</div>
            </div>
            
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">P99 Latency (Tail)</span>
              </div>
              <div className="kly-analytics-kpi-val">890<small>ms</small></div>
              <div className="kly-analytics-kpi-trend negative"><TrendingUp size={11} /> 45ms slower</div>
            </div>
          </div>

          <div className="kly-analytics-main-grid">
            {/* Tech Chart */}
            <div className="kly-card kly-analytics-chart-panel">
              <div className="kly-analytics-chart-header">
                <div>
                  <h4>Gateway Request Volume</h4>
                  <p>Inbound traffic routed across global edge nodes.</p>
                </div>
                <div className="kly-analytics-time-range">
                  {(['24h', '7d', '30d'] as const).map((r) => (
                    <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
                  ))}
                </div>
              </div>
              
              <div className="kly-analytics-bars-wrapper">
                <div className="kly-analytics-bars">
                  {traffic.map((val, i) => (
                    <div key={i} className="kly-analytics-bar-col">
                      <div className="kly-analytics-bar-tooltip">{val}k reqs</div>
                      <div className="kly-analytics-bar-fill" style={{ height: `${(val / maxTraffic) * 100}%` }}></div>
                      <span className="kly-analytics-bar-label">
                        {range === '24h' ? `${i*3}:00` : range === '7d' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i] : `D${i+1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Geo Distribution */}
            <div className="kly-card kly-analytics-geo-panel">
              <div className="kly-analytics-chart-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Map size={16} color="white" />
                  <h4>Edge Node Routing Map</h4>
                </div>
              </div>
              
              <div className="kly-analytics-geo-list">
                <div className="kly-analytics-geo-item">
                  <div className="kly-analytics-geo-info">
                    <span>APAC (Singapore, Tokyo)</span>
                    <strong>48.4%</strong>
                  </div>
                  <div className="kly-analytics-geo-bar"><div style={{ width: '48.4%', background: '#8b5cf6' }}></div></div>
                </div>
                <div className="kly-analytics-geo-item">
                  <div className="kly-analytics-geo-info">
                    <span>North America (US-East)</span>
                    <strong>32.1%</strong>
                  </div>
                  <div className="kly-analytics-geo-bar"><div style={{ width: '32.1%', background: '#38bdf8' }}></div></div>
                </div>
                <div className="kly-analytics-geo-item">
                  <div className="kly-analytics-geo-info">
                    <span>Europe (Frankfurt, London)</span>
                    <strong>15.2%</strong>
                  </div>
                  <div className="kly-analytics-geo-bar"><div style={{ width: '15.2%', background: '#34d399' }}></div></div>
                </div>
                <div className="kly-analytics-geo-item">
                  <div className="kly-analytics-geo-info">
                    <span>Other Regions</span>
                    <strong>4.3%</strong>
                  </div>
                  <div className="kly-analytics-geo-bar"><div style={{ width: '4.3%', background: '#f59e0b' }}></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="kly-analytics-view biz-view">
          {/* Business KPIs */}
          <div className="kly-analytics-kpi-grid">
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">Monthly Recurring Revenue</span>
                <DollarSign size={14} color="#10b981" />
              </div>
              <div className="kly-analytics-kpi-val">${project.revenue.toLocaleString()}</div>
              <div className="kly-analytics-kpi-trend positive"><TrendingUp size={11} /> 8.7% MoM</div>
            </div>
            
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">Annual Run Rate (ARR)</span>
                <DollarSign size={14} color="#10b981" />
              </div>
              <div className="kly-analytics-kpi-val">${(project.revenue * 12).toLocaleString()}</div>
              <div className="kly-analytics-kpi-trend positive"><TrendingUp size={11} /> Target $60K</div>
            </div>
            
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">Net Revenue Retention</span>
                <Users size={14} color="#8b5cf6" />
              </div>
              <div className="kly-analytics-kpi-val">108.4%</div>
              <div className="kly-analytics-kpi-trend positive"><Activity size={11} /> Zero churn (Paid)</div>
            </div>
            
            <div className="kly-analytics-kpi-card">
              <div className="kly-analytics-kpi-header">
                <span className="kly-analytics-kpi-title">Paid Conversion Rate</span>
                <TrendingUp size={14} color="#38bdf8" />
              </div>
              <div className="kly-analytics-kpi-val">18.6%</div>
              <div className="kly-analytics-kpi-trend positive"><TrendingUp size={11} /> Free → Pro</div>
            </div>
          </div>

          <div className="kly-analytics-main-grid">
            {/* Revenue Trend Chart */}
            <div className="kly-card kly-analytics-chart-panel">
              <div className="kly-analytics-chart-header">
                <div>
                  <h4>Revenue Trajectory</h4>
                  <p>Monthly recognized revenue over time.</p>
                </div>
              </div>
              
              <div className="kly-analytics-bars-wrapper" style={{ height: 220 }}>
                <div className="kly-analytics-bars">
                  {revenueTrend.map((val, i) => (
                    <div key={i} className="kly-analytics-bar-col">
                      <div className="kly-analytics-bar-tooltip">${val.toLocaleString()}</div>
                      <div className="kly-analytics-bar-fill" style={{ height: `${(val / maxRevenue) * 100}%`, background: 'linear-gradient(to top, rgba(16,185,129,0.2), #10b981)' }}></div>
                      <span className="kly-analytics-bar-label">Month {i+1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Monetization Breakdown */}
            <div className="kly-card kly-analytics-geo-panel">
              <div className="kly-analytics-chart-header">
                <h4>Monetization by Plan Tier</h4>
              </div>
              
              <div className="kly-analytics-tier-list">
                <div className="kly-analytics-tier-item">
                  <div className="kly-analytics-tier-info">
                    <div>
                      <strong>Business Tier</strong> <span className="kly-badge kly-badge-pill" style={{marginLeft: 6}}>$79/mo</span>
                    </div>
                    <span>79 subscribers</span>
                  </div>
                  <div className="kly-analytics-tier-stats">
                    <b style={{ color: '#8b5cf6' }}>$6,241 / mo (72.8%)</b>
                  </div>
                  <div className="kly-analytics-geo-bar"><div style={{ width: '72.8%', background: '#8b5cf6' }}></div></div>
                </div>

                <div className="kly-analytics-tier-item">
                  <div className="kly-analytics-tier-info">
                    <div>
                      <strong>Pro Tier</strong> <span className="kly-badge kly-badge-pill" style={{marginLeft: 6}}>$19/mo</span>
                    </div>
                    <span>372 subscribers</span>
                  </div>
                  <div className="kly-analytics-tier-stats">
                    <b style={{ color: '#38bdf8' }}>$7,068 / mo (27.2%)</b>
                  </div>
                  <div className="kly-analytics-geo-bar"><div style={{ width: '27.2%', background: '#38bdf8' }}></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

