import React, { useState } from 'react';
import { RevenueCharts } from './components/RevenueCharts';
import { PlanManager } from './components/PlanManager';
import { TransactionLedger } from './components/TransactionLedger';
import { TrendingUp, CreditCard, Activity, DollarSign } from 'lucide-react';
import './AdminBilling.css';

export const AdminBilling = () => {
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'PLANS' | 'LEDGER'>('DASHBOARD');

  return (
    <div className="admin-billing-container">
      <div className="billing-header">
        <h1>Subscription & Payment Administration</h1>
        
        <div className="view-tabs">
          <div className={`view-tab ${activeView === 'DASHBOARD' ? 'active' : ''}`} onClick={() => setActiveView('DASHBOARD')}>
            Revenue Dashboard
          </div>
          <div className={`view-tab ${activeView === 'PLANS' ? 'active' : ''}`} onClick={() => setActiveView('PLANS')}>
            Plans & Pricing
          </div>
          <div className={`view-tab ${activeView === 'LEDGER' ? 'active' : ''}`} onClick={() => setActiveView('LEDGER')}>
            Transaction Ledger
          </div>
        </div>
      </div>

      {activeView === 'DASHBOARD' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, overflowY: 'auto' }}>
          <div className="metrics-grid">
            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-title">Monthly Recurring Revenue</div>
                <DollarSign size={16} color="var(--text-muted)" />
              </div>
              <div className="metric-value">$58,000</div>
              <div className="metric-trend up"><TrendingUp size={14} /> +12.5%</div>
            </div>
            
            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-title">Platform Fees Collected</div>
                <CreditCard size={16} color="var(--text-muted)" />
              </div>
              <div className="metric-value">$14,500</div>
              <div className="metric-trend up"><TrendingUp size={14} /> +8.2%</div>
            </div>

            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-title">Active Subscriptions</div>
                <Activity size={16} color="var(--text-muted)" />
              </div>
              <div className="metric-value">1,245</div>
              <div className="metric-trend up"><TrendingUp size={14} /> +45 this month</div>
            </div>

            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-title">Churn Rate</div>
                <Activity size={16} color="var(--text-muted)" />
              </div>
              <div className="metric-value">2.4%</div>
              <div className="metric-trend down" style={{ color: '#22c55e' }}><TrendingUp size={14} style={{ transform: 'rotate(180deg)' }}/> -0.3%</div>
            </div>
          </div>
          
          <RevenueCharts />
        </div>
      )}

      {activeView === 'PLANS' && (
        <PlanManager />
      )}

      {activeView === 'LEDGER' && (
        <TransactionLedger />
      )}
    </div>
  );
};
