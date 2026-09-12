import React, { useMemo, useState } from 'react';
import {
  Plus, Search, FolderOpen, ArrowRight, Server, GitBranch, Container,
  Activity, DollarSign, Timer, Cpu, X, ArrowLeft, Filter, Check,
} from 'lucide-react';
import { ProviderProject, ProviderProjectStatus, ApiSourceKind } from '../../types/apibuild';
import { STATUS_META } from '../../services/apiBuild';
import { StatusDot } from './bits';
import './styles.css';

type Filter = 'all' | ProviderProjectStatus;

const fmtMoney = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

const SOURCE_META: Record<ApiSourceKind, { label: string; Icon: typeof Server }> = {
  existing: { label: 'Connect', Icon: Server },
  github: { label: 'GitHub', Icon: GitBranch },
  docker: { label: 'Docker', Icon: Container },
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#d946ef)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#d946ef,#f59e0b)',
  'linear-gradient(135deg,#22c55e,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
];

const rateColor = (r: number) => (r >= 98 ? '#22c55e' : r >= 92 ? '#f59e0b' : '#ef4444');

export const ProjectsDashboard: React.FC<{
  projects: ProviderProject[];
  onNew: () => void;
  onOpen: (p: ProviderProject) => void;
}> = ({ projects, onNew, onOpen }) => {
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'healthy', label: 'Healthy' },
    { id: 'deploying', label: 'Deploying' }, { id: 'failed', label: 'Failed' },
    { id: 'paused', label: 'Paused' },
  ];

  const list = useMemo(() => projects.filter((p) => {
    const mq = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase());
    const mf = f === 'all' || p.status === f || (f === 'healthy' && p.status === 'published');
    return mq && mf;
  }), [projects, q, f]);

  // Provider-level KPIs derived from all projects (not the filtered list).
  const kpis = useMemo(() => {
    const totalRequests = projects.reduce((s, p) => s + p.requests, 0);
    const active = projects.filter((p) => ['healthy', 'published', 'degraded'].includes(p.status));
    const avgSuccess = projects.length
      ? Math.round(projects.reduce((s, p) => s + p.successRate, 0) / projects.length)
      : 0;
    const totalRevenue = projects.reduce((s, p) => s + p.revenue, 0);
    return [
      { id: 'active' as const, label: 'Active APIs', value: String(active.length), sub: `${projects.length} total projects`, Icon: Cpu },
      { id: 'requests' as const, label: 'Total requests', value: totalRequests.toLocaleString(), sub: 'across all APIs · 30 days', Icon: Activity },
      { id: 'success' as const, label: 'Avg. success', value: `${avgSuccess}%`, sub: 'upstream + gateway traffic', Icon: Timer },
      { id: 'revenue' as const, label: 'Monthly revenue', value: fmtMoney(totalRevenue), sub: 'from active subscriptions', Icon: DollarSign },
    ];
  }, [projects]);

  const [kpi, setKpi] = useState<null | 'active' | 'requests' | 'success' | 'revenue'>(null);

  const sortedBy = (key: 'requests' | 'successRate' | 'revenue') =>
    [...projects].sort((a, b) => b[key] - a[key]);

  const kpiMeta = {
    active: { title: 'Active APIs', desc: 'APIs currently serving traffic (Healthy, Published or Degraded).' },
    requests: { title: 'Total requests', desc: 'Gateway traffic across all API projects in the last 30 days.' },
    success: { title: 'Average success rate', desc: 'Share of 2xx responses per API, including gateway errors.' },
    revenue: { title: 'Monthly revenue', desc: 'Estimated MRR from consumer subscriptions on your pricing plans.' },
  } as const;

  return (
    <div className="ab2-page"><div className="ab2-shell ab2-shell-dash">
     { /*Add a back button to home*/}
      {/* Hero */}
      <section className="ab2-hero">
        <div className="ab2-hero-top">
          <div className="ab2-hero-title">
            <h1 className="ab2-title">API Build</h1>
            <p className="ab2-sub">Connect an existing API, or deploy from GitHub or Docker. Manage, version, monetize and publish it to the Klyra marketplace.</p>
          </div>
          <button className="ab2-primary ab2-primary-lg" onClick={onNew}><Plus size={16} /><span>New Project</span></button>
        </div>

        {/* Summary KPIs */}
        <div className="ab2-summary">
          {kpis.map((k) => (
            <button key={k.id} className="ab2-kpi" onClick={() => setKpi(k.id)} title={`View ${k.label.toLowerCase()} details`}>
              <div className="ab2-kpi-ic"><k.Icon size={15} /></div>
              <div className="ab2-kpi-body">
                <b>{k.value}</b>
                <span>{k.label}</span>
                <small>{k.sub}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Toolbar */}
      <div className="ab2-toolbar">
        <div className="ab2-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects..." /></div>
        <div className="ab2-toolbar-actions">
          <div className="ab2-filter-menu">
            <button className={`ab2-filter-trigger ${f !== 'all' ? 'active' : ''}`} aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}><Filter size={14} /><span>Filter</span>{f !== 'all' && <i />}</button>
            {filterOpen && <div className="ab2-filter-popover" role="menu"><span>Project status</span>{filters.map((x) => (
              <button key={x.id} className={f === x.id ? 'active' : ''} onClick={() => { setF(x.id); setFilterOpen(false); }}><span>{x.label}</span>{f === x.id && <Check size={13} />}</button>
            ))}</div>}
          </div>
          {f !== 'all' && <button className="ab2-clear-filter" onClick={() => setF('all')}>Clear</button>}
        </div>
        {list.length > 0 && <span className="ab2-count">{list.length} project{list.length !== 1 ? 's' : ''}</span>}
      </div>

      {/* Content */}
      {list.length === 0 ? (
        <div className="ab2-card ab2-empty">
          <FolderOpen size={30} color="#8b5cf6" />
          <h3>{projects.length === 0 ? 'No projects yet' : 'No matches'}</h3>
          <p>{projects.length === 0 ? 'Create your first API project — connect an existing deployment or let Klyra deploy it for you.' : 'Try a different search or filter.'}</p>
          <button className="ab2-primary" onClick={onNew}><Plus size={15} /> New Project</button>
        </div>
      ) : (
        <div className="ab2-proj-grid">{list.map((p, i) => {
          const src = SOURCE_META[p.sourceKind];
          const SrcIcon = src.Icon;
          const rc = rateColor(p.successRate);
          const meta = STATUS_META[p.status];
          const isLive = meta.label === 'Published';
          return (
            <div
              key={p.id}
              className="ab2-card ab2-proj-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p); } }}
              title={`Open ${p.name}`}
            >
              <div className="ab2-card-head">
                <div className="ab2-avatar" style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="ab2-card-title">
                  <div className="ab2-proj-name">{p.name}</div>
                  <div className="ab2-proj-desc">{p.description}</div>
                </div>
                <span className="ab2-statuschip" style={{ color: meta.color }}>
                  <StatusDot status={p.status} showLabel={false} />
                  {isLive ? 'Live' : meta.label}
                </span>
              </div>

              <div className="ab2-proj-meta">
                <span className="ab2-pill">{p.environment === 'production' ? 'Production' : p.environment}</span>
                <span className="ab2-pill ab2-mono">{p.version}</span>
                <span className="ab2-pill"><SrcIcon size={11} style={{ marginRight: 4 }} />{src.label}</span>
                <span className="ab2-pill">{p.endpointCount} endpoints</span>
              </div>

              <div className="ab2-stats">
                <div className="ab2-stat"><b>{p.requestsLabel.split(' ')[0]}</b><span>requests</span></div>
                <div className="ab2-stat"><b style={{ color: rc }}>{p.successRate}%</b><span>success</span>
                  <div className="ab2-bar"><i style={{ width: `${p.successRate}%`, background: rc }} /></div>
                </div>
                <div className="ab2-stat"><b>{p.consumers.toLocaleString()}</b><span>consumers</span></div>
                <div className="ab2-stat"><b>{fmtMoney(p.revenue)}</b><span>revenue</span></div>
              </div>

              <div className="ab2-footcard">
                <span className="ab2-gateway" title={p.gatewayUrl}>{p.gatewayUrl.replace('https://', '')}</span>
              </div>
            </div>
          );
        })}</div>
      )}

      {/* KPI detail modal */}
      {kpi && (() => {
        const meta = kpiMeta[kpi];
        const rows = kpi === 'requests' ? sortedBy('requests')
          : kpi === 'success' ? sortedBy('successRate')
          : kpi === 'revenue' ? sortedBy('revenue')
          : projects;
        const total = kpi === 'requests' ? rows.reduce((s, p) => s + p.requests, 0)
          : kpi === 'revenue' ? rows.reduce((s, p) => s + p.revenue, 0)
          : 0;
        return (
          <div className="ab2-modal-overlay" onClick={() => setKpi(null)}>
            <div className="ab2-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ab2-modal-head">
                <div>
                  <h3>{meta.title}</h3>
                  <p>{meta.desc}</p>
                </div>
                <button className="ab2-ghost ab2-modal-x" onClick={() => setKpi(null)}><X size={14} /></button>
              </div>
              <div className="ab2-modal-body">
                {rows.length === 0 && <p className="ab2-modal-empty">No projects yet — create your first API project to see metrics here.</p>}
                {rows.map((p) => {
                  const rc = rateColor(p.successRate);
                  const share = total > 0 ? Math.round((p.requests / total) * 100) : 0;
                  const src = SOURCE_META[p.sourceKind];
                  const SrcIcon = src.Icon;
                  return (
                    <div key={p.id} className="ab2-kpi-row">
                      <div className="ab2-kpi-row-top">
                        <div className="ab2-kpi-row-name">
                          <span className="ab2-avatar ab2-avatar-sm" style={{ background: AVATAR_GRADIENTS[p.name.length % AVATAR_GRADIENTS.length] }}>
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <b>{p.name}</b>
                            <span className="ab2-kpi-row-meta">
                              <StatusDot status={p.status} showLabel={false} /> {STATUS_META[p.status].label} · {src.label} · {p.environment} · {p.version}
                            </span>
                          </div>
                        </div>
                        <button className="ab2-ghost" onClick={() => { setKpi(null); onOpen(p); }}>Open <ArrowRight size={12} /></button>
                      </div>
                      <div className="ab2-kpi-row-stats">
                        <div><b>{p.requestsLabel.split(' ')[0]}</b><span>requests</span>{total > 0 && <div className="ab2-bar"><i style={{ width: `${Math.max(share, 2)}%` }} /></div>}{total > 0 && <small>{share}% of traffic</small>}</div>
                        <div><b style={{ color: rc }}>{p.successRate}%</b><span>success</span><div className="ab2-bar"><i style={{ width: `${p.successRate}%`, background: rc }} /></div></div>
                        <div><b>{p.latencyMs || '—'}{p.latencyMs ? 'ms' : ''}</b><span>latency</span></div>
                        <div><b>{p.consumers.toLocaleString()}</b><span>consumers</span></div>
                        <div><b>{fmtMoney(p.revenue)}</b><span>revenue/mo</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {rows.length > 0 && (
                <div className="ab2-modal-foot">
                  <span>{rows.length} project{rows.length !== 1 ? 's' : ''}</span>
                  {kpi === 'requests' && <span>Total: <b>{total.toLocaleString()}</b> requests</span>}
                  {kpi === 'revenue' && <span>Total: <b>{fmtMoney(total)}</b> / month</span>}
                  {kpi === 'success' && <span>Average: <b>{kpis[2].value}</b></span>}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div></div>
  );
};
