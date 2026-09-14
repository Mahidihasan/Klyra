import React, { useState, useEffect } from 'react';
import { PlanManager } from './components/PlanManager';
import { TransactionLedger } from './components/TransactionLedger';
import { TrendingUp, CreditCard, Activity, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const REVENUE_DATA = [
  { month: 'Jan', mrr: 22000, new: 1200 },
  { month: 'Feb', mrr: 28000, new: 2100 },
  { month: 'Mar', mrr: 35000, new: 1800 },
  { month: 'Apr', mrr: 42000, new: 2800 },
  { month: 'May', mrr: 48000, new: 3100 },
  { month: 'Jun', mrr: 52000, new: 2500 },
  { month: 'Jul', mrr: 58000, new: 4200 },
];

const RollingNumber = ({ value, prefix = '', suffix = '' }: { value: number, prefix?: string, suffix?: string }) => {
  const spring = useSpring(0, { bounce: 0, duration: 2500 });
  
  // Format the number dynamically based on the value type (e.g., decimals vs integers)
  const display = useTransform(spring, (current) => {
    const isDecimal = value % 1 !== 0;
    const formattedNum = isDecimal 
      ? current.toFixed(1) 
      : Math.floor(current).toLocaleString();
    return `${prefix}${formattedNum}${suffix}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0f]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl">
        <p className="text-white/50 text-[12px] uppercase font-bold tracking-wider mb-2">{label} 2026</p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-6">
            <span className="text-indigo-400 font-semibold text-sm">MRR</span>
            <span className="font-mono text-white font-bold">${payload[0].value.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const AdminBilling = () => {
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'PLANS' | 'LEDGER'>('DASHBOARD');

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 z-10 bg-[#0a0a0f]/90 backdrop-blur-xl shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fintech Command Center</h1>
          <p className="text-sm text-white/50 mt-1">Real-time revenue analytics and subscription management.</p>
        </div>
        
        <div className="flex p-1 bg-white/5 rounded-lg border border-white/10">
          {['DASHBOARD', 'PLANS', 'LEDGER'].map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view as any)}
              className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-md transition-colors ${activeView === view ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              {activeView === view && (
                <motion.div
                  layoutId="billing-tab"
                  className="absolute inset-0 bg-white/10 border border-white/20 rounded-md -z-10 shadow-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              {view === 'DASHBOARD' ? 'Revenue' : view === 'PLANS' ? 'Plans' : 'Ledger'}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'DASHBOARD' && (
        <div className="flex-1 overflow-y-auto relative flex flex-col">
          {/* Edge-to-Edge Chart Background (Hero) */}
          <div className="w-full h-[400px] shrink-0 relative border-b border-white/5 bg-[#0a0a0f] overflow-hidden">
            {/* Top/Bottom Fade Gradients */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/50" />
            
            <div className="absolute inset-0 z-0 h-[120%] -bottom-[20%]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={REVENUE_DATA} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area 
                    type="monotone" 
                    dataKey="mrr" 
                    stroke="#818cf8" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorMrr)" 
                    isAnimationActive={true}
                    animationDuration={2500}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Floating Metrics Overlay */}
            <div className="relative z-20 w-full h-full p-8 flex flex-col">
              <h2 className="text-sm font-bold tracking-widest text-indigo-400 uppercase mb-8 flex items-center gap-2 drop-shadow-md">
                <Activity size={16} /> Live MRR Trajectory
              </h2>
              
              <div className="grid grid-cols-4 gap-6">
                {/* MRR Card */}
                <div className="p-6 rounded-2xl bg-[#0a0a0f]/70 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-white/50">Monthly Recurring Revenue</span>
                    <DollarSign size={16} className="text-white/30" />
                  </div>
                  <div>
                    <div className="text-[40px] font-bold text-white font-mono tracking-tight mb-1">
                      <RollingNumber value={58000} prefix="$" />
                    </div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-emerald-400">
                      <ArrowUpRight size={14} /> <span>12.5% this month</span>
                    </div>
                  </div>
                </div>

                {/* Fees Card */}
                <div className="p-6 rounded-2xl bg-[#0a0a0f]/70 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-white/50">Platform Fees Collected</span>
                    <CreditCard size={16} className="text-white/30" />
                  </div>
                  <div>
                    <div className="text-[40px] font-bold text-white font-mono tracking-tight mb-1">
                      <RollingNumber value={14500} prefix="$" />
                    </div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-emerald-400">
                      <ArrowUpRight size={14} /> <span>8.2% this month</span>
                    </div>
                  </div>
                </div>

                {/* Active Subscriptions Card */}
                <div className="p-6 rounded-2xl bg-[#0a0a0f]/70 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-white/50">Active Subscriptions</span>
                    <Activity size={16} className="text-white/30" />
                  </div>
                  <div>
                    <div className="text-[40px] font-bold text-white font-mono tracking-tight mb-1">
                      <RollingNumber value={1245} />
                    </div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-emerald-400">
                      <ArrowUpRight size={14} /> <span>+45 net new</span>
                    </div>
                  </div>
                </div>

                {/* Churn Rate Card */}
                <div className="p-6 rounded-2xl bg-[#0a0a0f]/70 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-white/50">Churn Rate</span>
                    <TrendingUp size={16} className="text-white/30" />
                  </div>
                  <div>
                    <div className="text-[40px] font-bold text-white font-mono tracking-tight mb-1">
                      <RollingNumber value={2.4} suffix="%" />
                    </div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-emerald-400">
                      <ArrowDownRight size={14} /> <span>Improved by 0.3%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            <h3 className="text-lg font-bold text-white mb-6">Recent Large Transactions</h3>
            {/* Integrated Ledger Preview */}
            <div className="w-full rounded-2xl border border-white/5 bg-[#0a0a0f] overflow-hidden shadow-2xl">
               <TransactionLedger />
            </div>
          </div>
        </div>
      )}

      {activeView === 'PLANS' && (
        <div className="flex-1 overflow-y-auto p-8"><PlanManager /></div>
      )}

      {activeView === 'LEDGER' && (
        <div className="flex-1 overflow-y-auto p-8"><TransactionLedger /></div>
      )}
    </div>
  );
};
