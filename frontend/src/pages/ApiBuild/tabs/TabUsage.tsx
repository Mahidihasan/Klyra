import React, { useState } from 'react';
import { BarChart3, Download, Filter, Calendar } from 'lucide-react';
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

  const totalReqs = project.requests;
  const bandwidthGb = (totalReqs * 0.0000042).toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Usage KPIs */}
      <div className="kly-metric-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Total Ingress Requests</div>
          <div className="kly-metric-val">{project.requestsLabel.split(' ')[0]}</div>
          <div className="kly-metric-trend kly-trend-up">100% capacity</div>
        </div>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Success Rate</div>
          <div className="kly-metric-val">{project.successRate}%</div>
          <div className="kly-metric-trend kly-trend-up">0.21% error rate</div>
        </div>
        <div className="kly-metric-box">
          <div className="kly-metric-label">Egress Bandwidth</div>
          <div className="kly-metric-val">{bandwidthGb} GB</div>
          <div className="kly-metric-trend kly-trend-neutral">Global CDN cache</div>
        </div>
        <div className="kly-metric-box">
          <div className="kly-metric-label">429 Throttled Calls</div>
          <div className="kly-metric-val">4,210</div>
          <div className="kly-metric-trend kly-trend-down">0.34% of volume</div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="kly-grid-2col">
        {/* Endpoint Volume Breakdown */}
        <div className="kly-card">
          <div className="kly-card-header">
            <div>
              <h4 className="kly-card-title">Volume by Endpoint Route</h4>
              <p className="kly-card-subtitle">Share of total API calls</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {endpoints.map((ep) => {
              const sharePct = Math.round((ep.totalRequests / (totalReqs || 1)) * 100);
              return (
                <div key={ep.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`kly-method-tag kly-method-${ep.method}`} style={{ fontSize: 9 }}>{ep.method}</span>
                      <span className="kly-mono" style={{ fontWeight: 600 }}>{ep.path}</span>
                    </div>
                    <span className="kly-mono" style={{ color: 'var(--kly-text-dim)' }}>
                      {ep.totalRequests.toLocaleString()} reqs ({sharePct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${Math.max(sharePct, 2)}%`, background: 'var(--kly-primary)', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consumer Volume Breakdown */}
        <div className="kly-card">
          <div className="kly-card-header">
            <div>
              <h4 className="kly-card-title">Volume by Top Consumers</h4>
              <p className="kly-card-subtitle">Bandwidth and call distribution</p>
            </div>
            <button className="kly-btn kly-btn-secondary" onClick={() => onShowToast('Exporting CSV telemetry report...')}>
              <Download size={12} />
              <span>Export CSV</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {project.consumersList.map((c: ApiConsumer) => {
              const sharePct = Math.round((c.requests / (totalReqs || 1)) * 100);
              return (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{c.name} ({c.plan})</span>
                    <span className="kly-mono" style={{ color: 'var(--kly-text-dim)' }}>
                      {c.requests.toLocaleString()} reqs ({sharePct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${Math.max(sharePct, 4)}%`, background: '#38bdf8', borderRadius: 3 }} />
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
