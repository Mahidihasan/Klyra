import React, { useEffect, useMemo, useState } from 'react';
import { Activity, DollarSign, RefreshCw, Download, Users, TrendingUp, Map } from 'lucide-react';
import { ProviderProject, PricingPlan } from '../../../types/apibuild';
import { apiBuildService } from '../../../services/apiBuild';

interface AnalyticsData {
  timeRange: string;
  traffic: { label: string; total: number; success: number; clientErr: number; serverErr: number; rateLim: number; p95: number }[];
  totals: { total: number; success: number; errors: number; rateLimited: number; avgLatency: number; p95: number; successRate: number; errorRate: number };
  endpoints: { total: number; healthy: number; top: unknown[] };
}
interface TabAnalyticsProps { project: ProviderProject }

export const TabAnalytics: React.FC<TabAnalyticsProps> = ({ project }) => {
  const [mode, setMode] = useState<'tech' | 'biz'>('tech');
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [compare, setCompare] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [analytics, planRows] = await Promise.all([
          apiBuildService.getAnalytics<AnalyticsData>(project.id, range),
          apiBuildService.listPlans<PricingPlan>(project.id),
        ]);
        if (live) { setData(analytics); setPlans(planRows); setError(''); }
      } catch (e) { if (live) setError(e instanceof Error ? e.message : 'Analytics could not be loaded.'); }
      finally { if (live) setLoading(false); }
    };
    setLoading(true); void load();
    if (!autoRefresh) return () => { live = false; };
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => { live = false; window.clearInterval(timer); };
  }, [project.id, range, autoRefresh]);

  const traffic = data?.traffic ?? [];
  const totals = data?.totals;
  const maxTraffic = Math.max(...traffic.map((b) => b.total), 1);
  const revenueByPlan = useMemo(() => plans.map((p) => ({ ...p, revenue: p.priceMonthly * p.subscribers })), [plans]);
  const maxRevenue = Math.max(...revenueByPlan.map((p) => p.revenue), 1);
  const revenue = revenueByPlan.reduce((sum, p) => sum + p.revenue, 0);
  const exportCsv = () => {
    const rows = [['bucket','requests','success','client errors','server errors','rate limited','p95 ms'], ...traffic.map((b) => [b.label,b.total,b.success,b.clientErr,b.serverErr,b.rateLim,b.p95])];
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${project.slug}-analytics-${range}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const metric = (label: string, value: string | number, unit = '') => <div className="kly-analytics-kpi-card" key={label}><div className="kly-analytics-kpi-header"><span className="kly-analytics-kpi-title">{label}</span></div><div className="kly-analytics-kpi-val">{value}<small>{unit}</small></div><div className="kly-analytics-kpi-trend neutral"><Activity size={11} /> Observed in selected period</div></div>;

  return <div className="kly-analytics-root">
    <div className="kly-analytics-controller kly-card">
      <div className="kly-analytics-mode-switch">
        <button className={`kly-analytics-mode-btn ${mode === 'tech' ? 'active' : ''}`} onClick={() => setMode('tech')}><Activity size={14} /> Technical &amp; Infrastructure</button>
        <button className={`kly-analytics-mode-btn ${mode === 'biz' ? 'active' : ''}`} onClick={() => setMode('biz')}><DollarSign size={14} /> Monetization &amp; Business</button>
      </div>
      <div className="kly-analytics-global-controls"><div className="kly-analytics-status"><span className={`kly-pulse-dot ${autoRefresh ? 'active' : 'paused'}`} />{loading ? 'Loading telemetry' : autoRefresh ? 'Live telemetry' : 'Paused'}</div><div className="kly-analytics-toolbar-divider" /><label className="kly-analytics-checkbox"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare vs prior</label><button className={`kly-btn-icon ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)} title="Toggle Auto-refresh"><RefreshCw size={14} /></button><button className="kly-btn kly-btn-secondary" onClick={exportCsv} disabled={!traffic.length}><Download size={13} /> Export CSV</button></div>
    </div>
    {error && <div className="kly-card" role="alert" style={{ padding: 16, color: '#fca5a5' }}>Analytics unavailable: {error}</div>}
    {loading && !data ? <div className="kly-card" role="status" style={{ padding: 24 }}>Loading analytics…</div> : !error && !traffic.some((b) => b.total > 0) && mode === 'tech' ? <div className="kly-card" style={{ padding: 24, color: 'var(--kly-text-dim)' }}>No usage has been recorded for this period yet.</div> : <div className={`kly-analytics-view ${mode === 'tech' ? 'tech-view' : 'biz-view'}`}>
      {mode === 'tech' ? <>
        <div className="kly-analytics-kpi-grid">{metric('Requests', totals?.total ?? 0)}{metric('Success rate', totals?.successRate ?? 0, '%')}{metric('Average latency', totals?.avgLatency ?? 0, 'ms')}{metric('P95 latency', totals?.p95 ?? 0, 'ms')}</div>
        <div className="kly-analytics-main-grid"><div className="kly-card kly-analytics-chart-panel"><div className="kly-analytics-chart-header"><div><h4>Gateway Request Volume</h4><p>Observed request counts from persisted usage buckets.</p></div><div className="kly-analytics-time-range">{(['24h','7d','30d'] as const).map((r) => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>)}</div></div><div className="kly-analytics-bars-wrapper"><div className="kly-analytics-bars">{traffic.map((b, i) => <div key={`${b.label}-${i}`} className="kly-analytics-bar-col"><div className="kly-analytics-bar-tooltip">{b.total.toLocaleString()} reqs · p95 {b.p95}ms</div><div className="kly-analytics-bar-fill" style={{ height: `${(b.total / maxTraffic) * 100}%` }} /><span className="kly-analytics-bar-label">{b.label}</span></div>)}</div></div></div>
          <div className="kly-card kly-analytics-geo-panel"><div className="kly-analytics-chart-header"><Map size={16} /><h4>Service Health</h4></div><div className="kly-analytics-geo-list"><div className="kly-analytics-geo-item"><div className="kly-analytics-geo-info"><span>Healthy endpoints</span><strong>{data?.endpoints.healthy ?? 0} / {data?.endpoints.total ?? 0}</strong></div></div><div className="kly-analytics-geo-item"><div className="kly-analytics-geo-info"><span>Error rate</span><strong>{totals?.errorRate ?? 0}%</strong></div></div><div className="kly-analytics-geo-item"><div className="kly-analytics-geo-info"><span>Rate limited</span><strong>{(totals?.rateLimited ?? 0).toLocaleString()}</strong></div></div></div></div></div>
      </> : <>
        <div className="kly-analytics-kpi-grid">{metric('Monthly recurring revenue', revenue, '$')}{metric('Annual run rate', revenue * 12, '$')}{metric('Active subscribers', plans.reduce((s,p) => s + p.subscribers, 0))}{metric('Pricing plans', plans.length)}</div>
        <div className="kly-analytics-main-grid"><div className="kly-card kly-analytics-chart-panel"><div className="kly-analytics-chart-header"><div><h4>Monthly Revenue by Plan</h4><p>Current recurring revenue derived from persisted plan prices and subscriber counts.</p></div></div><div className="kly-analytics-bars-wrapper" style={{ height: 220 }}><div className="kly-analytics-bars">{revenueByPlan.map((p) => <div key={p.id} className="kly-analytics-bar-col"><div className="kly-analytics-bar-tooltip">${p.revenue.toLocaleString()} / mo</div><div className="kly-analytics-bar-fill" style={{ height: `${(p.revenue / maxRevenue) * 100}%`, background: 'linear-gradient(to top, rgba(16,185,129,0.2), #10b981)' }} /><span className="kly-analytics-bar-label">{p.name}</span></div>)}</div></div></div><div className="kly-card kly-analytics-geo-panel"><div className="kly-analytics-chart-header"><h4>Monetization by Plan Tier</h4></div><div className="kly-analytics-tier-list">{revenueByPlan.map((p) => <div className="kly-analytics-tier-item" key={p.id}><div className="kly-analytics-tier-info"><div><strong>{p.name}</strong><span className="kly-badge kly-badge-pill" style={{ marginLeft: 6 }}>${p.priceMonthly}/mo</span></div><span>{p.subscribers} subscribers</span></div><div className="kly-analytics-tier-stats"><b>${p.revenue.toLocaleString()} / mo ({revenue ? ((p.revenue / revenue) * 100).toFixed(1) : '0.0'}%)</b></div><div className="kly-analytics-geo-bar"><div style={{ width: `${revenue ? (p.revenue / revenue) * 100 : 0}%` }} /></div></div>)}</div></div></div>
      </>}
    </div>}
  </div>;
};
