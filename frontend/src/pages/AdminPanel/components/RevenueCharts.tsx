import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const MOCK_REVENUE_DATA = [
  { month: 'Jan', mrr: 42000, volume: 120000, fee: 8400 },
  { month: 'Feb', mrr: 45000, volume: 135000, fee: 9000 },
  { month: 'Mar', mrr: 49000, volume: 152000, fee: 9800 },
  { month: 'Apr', mrr: 51000, volume: 160000, fee: 10200 },
  { month: 'May', mrr: 56000, volume: 180000, fee: 11200 },
  { month: 'Jun', mrr: 58000, volume: 195000, fee: 14500 },
];

export const RevenueCharts = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* MRR Area Chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.05em' }}>Monthly Recurring Revenue (MRR)</h3>
        <div style={{ height: 250, width: '100%' }}>
          <ResponsiveContainer>
            <AreaChart data={MOCK_REVENUE_DATA} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
              <Tooltip 
                contentStyle={{ background: '#1a1b26', border: '1px solid #2a2b36', borderRadius: 8, color: '#fff' }}
                itemStyle={{ color: '#22c55e' }}
                formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'MRR']}
              />
              <Area type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorMrr)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fees Bar Chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.05em' }}>Platform Fees Collected</h3>
        <div style={{ height: 250, width: '100%' }}>
          <ResponsiveContainer>
            <BarChart data={MOCK_REVENUE_DATA} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
              <Tooltip 
                contentStyle={{ background: '#1a1b26', border: '1px solid #2a2b36', borderRadius: 8, color: '#fff' }}
                itemStyle={{ color: '#8b5cf6' }}
                formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Fees']}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="fee" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
