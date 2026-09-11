import React, { useState } from 'react';
import { BarChart3, DollarSign, Activity, Globe } from 'lucide-react';
import { ProviderProject } from '../../../types/apibuild';

interface TabAnalyticsProps {
  project: ProviderProject;
}

export const TabAnalytics: React.FC<TabAnalyticsProps> = ({ project }) => {
  const [mode, setMode] = useState<'tech' | 'biz'>('tech');
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const traffic = range === '24h' ? [42, 67, 54, 82, 60, 74, 91, 69] : range === '7d' ? [55, 76, 62, 88, 71, 93, 79] : [48, 58, 52, 67, 72, 63, 81, 76, 92, 84];

  return (
    <div className="kly-page-stack">
      {/* Mode Switcher */}
      <div className="kly-tab-toolbar">
        <div className="kly-seg-ctrl kly-analytics-mode">
          <button
            className={`kly-btn ${mode === 'tech' ? 'kly-btn-primary' : 'kly-btn-ghost'}`}
            onClick={() => setMode('tech')}
          >
            <Activity size={13} />
            <span>Technical & Infrastructure Analytics</span>
          </button>
          <button
            className={`kly-btn ${mode === 'biz' ? 'kly-btn-primary' : 'kly-btn-ghost'}`}
            onClick={() => setMode('biz')}
          >
            <DollarSign size={13} />
            <span>Monetization & Business Analytics</span>
          </button>
        </div>

        <div className="kly-realtime-label"><span className="kly-pulse-dot" /> Updated from edge telemetry</div>
      </div>

      {mode === 'tech' ? (
        <div className="kly-page-stack">
          {/* Latency percentiles */}
          <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="kly-metric-box">
              <div className="kly-metric-label">P50 Median Latency</div>
              <div className="kly-metric-val">110ms</div>
              <div className="kly-metric-trend kly-trend-up">Superfast execution</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">P90 Latency</div>
              <div className="kly-metric-val">240ms</div>
              <div className="kly-metric-trend kly-trend-up">Inference queue stable</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">P95 Latency</div>
              <div className="kly-metric-val">421ms</div>
              <div className="kly-metric-trend kly-trend-neutral">Peak model loads</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">P99 Tail Latency</div>
              <div className="kly-metric-val">890ms</div>
              <div className="kly-metric-trend kly-trend-down">Within 1.5s SLA</div>
            </div>
          </div>

          <section className="kly-card kly-analytics-chart-card">
            <div className="kly-card-header">
              <div>
                <h4 className="kly-card-title"><BarChart3 size={16} color="var(--kly-primary)" /> Gateway request volume</h4>
                <p className="kly-card-subtitle">Requests successfully routed through Klyra edge locations.</p>
              </div>
              <div className="kly-seg-ctrl">
                {(['24h', '7d', '30d'] as const).map((item) => <button key={item} className={`kly-seg-btn ${range === item ? 'active' : ''}`} onClick={() => setRange(item)}>{item}</button>)}
              </div>
            </div>
            <div className="kly-analytics-bars" aria-label={`Gateway request volume for ${range}`} role="img">
              {traffic.map((value, index) => (
                <div className="kly-analytics-bar-column" key={`${range}-${index}`} title={`${value}k requests`}>
                  <div className="kly-analytics-bar-value">{value}k</div>
                  <div className="kly-analytics-bar" style={{ height: `${value}%` }} />
                  <span>{range === '24h' ? `${index * 3}:00` : range === '7d' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] : `D${index + 1}`}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Regional Geographic Distribution */}
          <div className="kly-card">
            <div className="kly-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={15} color="#38bdf8" />
                <h4 className="kly-card-title">Geographic Request Origin Breakdown</h4>
              </div>
            </div>

            <div className="kly-region-grid">
              <div style={{ padding: '12px', background: '#0e0f18', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>APAC (Singapore, Tokyo)</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>48.4%</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '48.4%', background: '#8b5cf6', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ padding: '12px', background: '#0e0f18', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>North America (US-East)</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>32.1%</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '32.1%', background: '#38bdf8', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ padding: '12px', background: '#0e0f18', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>Europe (Frankfurt, London)</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>15.2%</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '15.2%', background: '#34d399', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ padding: '12px', background: '#0e0f18', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>Other Regions</div>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>4.3%</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '4.3%', background: '#f59e0b', borderRadius: 2 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="kly-page-stack">
          {/* Business KPIs */}
          <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Monthly Recurring Revenue</div>
              <div className="kly-metric-val">${project.revenue.toLocaleString()}</div>
              <div className="kly-metric-trend kly-trend-up">↑ 8.7% MoM growth</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Annual Run Rate (ARR)</div>
              <div className="kly-metric-val">${(project.revenue * 12).toLocaleString()}</div>
              <div className="kly-metric-trend kly-trend-up">Target $60K ARR</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Net Revenue Retention</div>
              <div className="kly-metric-val">108.4%</div>
              <div className="kly-metric-trend kly-trend-up">Zero churn in paid tiers</div>
            </div>
            <div className="kly-metric-box">
              <div className="kly-metric-label">Paid Conversion Rate</div>
              <div className="kly-metric-val">18.6%</div>
              <div className="kly-metric-trend kly-trend-up">Free → Pro conversion</div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="kly-card">
            <h4 className="kly-card-title" style={{ marginBottom: 12 }}>Monetization Breakdown by Plan Tier</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Business Tier ($79/mo · 79 subscribers)</span>
                <b style={{ color: '#34d399' }}>$6,241 / mo (72.8%)</b>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: '72.8%', background: '#8b5cf6', borderRadius: 3 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
                <span>Pro Tier ($19/mo · 372 subscribers)</span>
                <b style={{ color: '#38bdf8' }}>$7,068 / mo (27.2%)</b>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: '27.2%', background: '#38bdf8', borderRadius: 3 }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
