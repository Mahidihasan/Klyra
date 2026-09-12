import React, { useState } from 'react';
import { Users, Search, DollarSign, Key, Ban, Mail } from 'lucide-react';
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

  const filteredConsumers = consumers.filter(c => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase());
    const matchPlan = planFilter === 'ALL' || c.plan.toLowerCase() === planFilter.toLowerCase();
    return matchQ && matchPlan;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header toolbar */}
      <div className="kly-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Consumer Management & Quotas</h3>
            <p style={{ fontSize: 13, color: 'var(--kly-text-muted)', marginTop: 4 }}>
              Inspect telemetry, issue API keys, and manage subscription quotas per developer account.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 240 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--kly-text-dim)' }} />
              <input
                type="text"
                className="kly-input"
                style={{ paddingLeft: 32, width: '100%' }}
                placeholder="Search consumers..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <select className="kly-select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="ALL">All Plans</option>
              <option value="Business">Business Tier</option>
              <option value="Pro">Pro Tier</option>
              <option value="Free">Free Tier</option>
            </select>
          </div>
        </div>
      </div>

      {/* Consumers Table */}
      <div className="kly-table-wrapper">
        <table className="kly-table">
          <thead>
            <tr>
              <th>Consumer</th>
              <th>Plan Tier</th>
              <th>Assigned Version</th>
              <th>Monthly Requests</th>
              <th>Quota Used</th>
              <th>Spend</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filteredConsumers.map((c) => {
              const quotaLimit = c.plan === 'Business' ? 500000 : c.plan === 'Pro' ? 50000 : 1000;
              const quotaPct = Math.min(Math.round((c.requests / quotaLimit) * 100), 100);
              return (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectConsumer(c)}
                >
                  <td>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--kly-text-main)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>{c.email}</div>
                    </div>
                  </td>
                  <td>
                    <span className="kly-badge kly-badge-pill" style={{
                      color: c.plan === 'Business' ? '#c4b5fd' : c.plan === 'Pro' ? '#38bdf8' : 'var(--kly-text-dim)'
                    }}>
                      {c.plan}
                    </span>
                  </td>
                  <td className="kly-mono" style={{ fontSize: 12 }}>v2.4.1</td>
                  <td><b>{c.requests.toLocaleString()}</b></td>
                  <td style={{ minWidth: 140 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: quotaPct > 80 ? '#fbbf24' : 'var(--kly-text-muted)' }}>{quotaPct}%</span>
                      <span style={{ color: 'var(--kly-text-dim)' }}>{quotaLimit.toLocaleString()} max</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%', width: `${quotaPct}%`,
                        background: quotaPct > 85 ? '#f43f5e' : quotaPct > 70 ? '#fbbf24' : '#10b981',
                        borderRadius: 2
                      }} />
                    </div>
                  </td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>${c.plan === 'Business' ? '79' : c.plan === 'Pro' ? '19' : '0'}</td>
                  <td>
                    <span className={`kly-badge ${c.status === 'active' ? 'kly-badge-healthy' : 'kly-badge-deploying'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--kly-text-dim)' }}>{c.joinedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
