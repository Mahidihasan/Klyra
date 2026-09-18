import React, { useState } from 'react';
import {
  Users, Search, DollarSign, Activity, AlertTriangle, ChevronDown,
  Mail, Ban, RefreshCw, Eye, ShieldAlert, Zap, TrendingUp, Download, SlidersHorizontal
} from 'lucide-react';
import { ApiConsumer } from '../../../types/apibuild';

interface TabConsumersProps {
  consumers: ApiConsumer[];
  onSelectConsumer: (c: ApiConsumer) => void;
  onShowToast: (msg: string) => void;
}

export const TabConsumers: React.FC<TabConsumersProps> = ({
  consumers,
  onSelectConsumer,
  onShowToast
}) => {
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredConsumers = consumers.filter(c => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase());
    const matchPlan = planFilter === 'ALL' || c.plan.toLowerCase() === planFilter.toLowerCase();
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchQ && matchPlan && matchStatus;
  });

  const atRiskCount = consumers.filter((consumer) => {
    const limit = consumer.plan === 'Enterprise' ? 5000000 : consumer.plan === 'Pro' ? 500000 : 50000;
    return consumer.requests / limit >= 0.8;
  }).length;
  
  const activeMRR = consumers.reduce((acc, c) => acc + (c.plan === 'Enterprise' ? 499 : c.plan === 'Pro' ? 49 : 0), 0);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="kly-consumers-root">
      
      {/* KPI Strip */}
      <div className="kly-consumers-kpi-strip">
        <div className="kly-consumers-kpi">
          <div>
            <div className="kly-consumers-kpi-val">{consumers.length.toLocaleString()}</div>
            <div className="kly-consumers-kpi-label">Registered Consumers</div>
          </div>
        </div>
        <div className="kly-consumers-kpi">
          <div>
            <div className="kly-consumers-kpi-val">{consumers.filter((c) => c.status === 'active').length.toLocaleString()}</div>
            <div className="kly-consumers-kpi-label">Active Connections</div>
          </div>
        </div>
        <div className="kly-consumers-kpi">
          <div>
            <div className="kly-consumers-kpi-val">${activeMRR.toLocaleString()}</div>
            <div className="kly-consumers-kpi-label">Attributed MRR</div>
          </div>
        </div>
        <div className="kly-consumers-kpi">
          <div>
            <div className="kly-consumers-kpi-val">{atRiskCount}</div>
            <div className="kly-consumers-kpi-label">Approaching Quota</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="kly-card kly-consumers-toolbar">
        <div className="kly-consumers-toolbar-left">
          <h3 className="kly-consumers-title">Directory</h3>
          <span className="kly-consumers-count-badge">{filteredConsumers.length} found</span>
        </div>
        <div className="kly-consumers-toolbar-right">
          <div className="kly-consumers-search">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search by name, org, or email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="kly-consumers-filters">
            <SlidersHorizontal size={13} color="var(--kly-text-dim)" />
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="ALL">All Plans</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Pro">Pro</option>
              <option value="Free">Free</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="suspended">Suspended</option>
            </select>
            <button className="kly-btn kly-btn-ghost" title="Export CSV" onClick={() => onShowToast('Exporting to CSV...')}>
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="kly-card kly-consumers-table-wrapper" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="kly-table kly-consumers-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Identity</th>
              <th>Subscription</th>
              <th>Version</th>
              <th>Usage (30d)</th>
              <th>Status</th>
              <th>Joined</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredConsumers.map((c) => {
              const quotaLimit = c.plan === 'Enterprise' ? 5000000 : c.plan === 'Pro' ? 500000 : 50000;
              const quotaPct = Math.min(Math.round((c.requests / quotaLimit) * 100), 100);
              const isExpanded = expandedId === c.id;
              
              return (
                <React.Fragment key={c.id}>
                  <tr className={`kly-consumers-row ${isExpanded ? 'is-expanded' : ''}`} onClick={(e) => toggleExpand(c.id, e)}>
                    <td style={{ textAlign: 'center' }}>
                      <ChevronDown size={14} className="kly-consumers-expand-icon" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </td>
                    <td>
                      <div className="kly-consumers-identity">
                        <div className="kly-consumers-avatar">{c.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="kly-consumers-name">{c.name}</div>
                          <div className="kly-consumers-email">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="kly-badge kly-badge-pill kly-consumers-plan-badge" data-plan={c.plan.toLowerCase()}>
                        {c.plan}
                      </span>
                    </td>
                    <td>
                      <div className="kly-consumers-version-badge">
                        <span className="kly-consumers-version-dot"></span>
                        v2.4.1
                      </div>
                    </td>
                    <td>
                      <div className="kly-consumers-quota-bar-wrapper">
                        <div className="kly-consumers-quota-text">
                          <span style={{ color: quotaPct >= 80 ? '#fbbf24' : 'var(--kly-text-main)', fontWeight: 600 }}>{c.requests.toLocaleString()}</span>
                          <span style={{ color: 'var(--kly-text-dim)' }}> / {quotaLimit.toLocaleString()}</span>
                        </div>
                        <div className="kly-consumers-quota-track">
                          <div 
                            className="kly-consumers-quota-fill" 
                            style={{ 
                              width: `${quotaPct}%`,
                              background: quotaPct >= 90 ? '#f43f5e' : quotaPct >= 75 ? '#fbbf24' : '#10b981'
                            }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`kly-badge ${c.status === 'active' ? 'kly-badge-healthy' : c.status === 'trialing' ? 'kly-badge-deploying' : 'kly-badge-error'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="kly-consumers-date">{c.joinedAt}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="kly-btn kly-btn-ghost kly-consumers-action-btn" onClick={(e) => { e.stopPropagation(); onSelectConsumer(c); }}>
                        <Eye size={14} /> Inspect
                      </button>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr className="kly-consumers-expanded-row">
                      <td colSpan={8}>
                        <div className="kly-consumers-detail-panel">
                          <div className="kly-consumers-detail-grid">
                            
                            <div className="kly-consumers-detail-section">
                              <h5><Zap size={13} /> Active Credentials</h5>
                              <div className="kly-consumers-detail-box">
                                <div className="kly-consumers-key-row">
                                  <span>Production Key</span>
                                  <code className="kly-consumers-key-mask">sk_live_...942f</code>
                                  <span className="kly-consumers-key-meta">Used 2m ago</span>
                                </div>
                                <div className="kly-consumers-key-row">
                                  <span>Test Key</span>
                                  <code className="kly-consumers-key-mask">sk_test_...11ab</code>
                                  <span className="kly-consumers-key-meta">Used 5d ago</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="kly-consumers-detail-section">
                              <h5><TrendingUp size={13} /> Telemetry Snapshot</h5>
                              <div className="kly-consumers-detail-box">
                                <div className="kly-consumers-stat-row">
                                  <span className="kly-consumers-stat-label">Avg Latency</span>
                                  <span className="kly-consumers-stat-val">42ms</span>
                                </div>
                                <div className="kly-consumers-stat-row">
                                  <span className="kly-consumers-stat-label">Error Rate (5xx)</span>
                                  <span className="kly-consumers-stat-val" style={{ color: '#10b981' }}>0.01%</span>
                                </div>
                                <div className="kly-consumers-stat-row">
                                  <span className="kly-consumers-stat-label">429 Overages</span>
                                  <span className="kly-consumers-stat-val" style={{ color: '#fbbf24' }}>14 incidents</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="kly-consumers-detail-section kly-consumers-quick-actions-col">
                              <h5><ShieldAlert size={13} /> Administrative Actions</h5>
                              <div className="kly-consumers-quick-actions">
                                <button className="kly-btn kly-btn-ghost" onClick={() => onShowToast(`Sending email to ${c.email}`)}>
                                  <Mail size={13} /> Contact Developer
                                </button>
                                <button className="kly-btn kly-btn-ghost" onClick={() => onShowToast(`Resetting quotas for ${c.name}`)}>
                                  <RefreshCw size={13} /> Reset Quotas
                                </button>
                                <button className="kly-btn kly-btn-ghost" style={{ color: '#f43f5e' }} onClick={() => onShowToast(`Suspending access for ${c.name}`)}>
                                  <Ban size={13} /> Suspend Access
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {!filteredConsumers.length && (
              <tr>
                <td colSpan={8}>
                  <div className="kly-empty-state">
                    <Search size={18} />
                    <span>No consumers match the current filters.</span>
                    <button className="kly-btn kly-btn-ghost" onClick={() => { setQ(''); setPlanFilter('ALL'); setStatusFilter('ALL'); }}>Clear all filters</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

