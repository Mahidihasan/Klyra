import React from 'react';
import { Droplet, Mail, CreditCard, Clock } from 'lucide-react';

const MOCK_LEAKS = [
  { id: 'lk_1', user: 'usr_812', amount: 450.00, issue: 'Card Expired', date: '2 days ago' },
  { id: 'lk_2', user: 'usr_441', amount: 1200.00, issue: 'Insufficient Funds', date: '5 days ago' },
];

export const RevenueLeakage = () => {
  return (
    <div className="bg-zinc-950/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-5 shadow-2xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-white m-0 flex items-center gap-2 tracking-widest uppercase">
            <Droplet size={16} className="text-rose-500" /> Revenue Leakage Monitor
          </h3>
          <p className="text-[12px] text-white/40 mt-1">Active uncollected funds</p>
        </div>
        <div className="text-[24px] font-bold text-rose-500 font-mono">
          $1,650.00
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_LEAKS.map(leak => (
          <div key={leak.id} className="flex justify-between items-center bg-rose-500/5 border border-rose-500/20 p-3 px-4 rounded-lg">
            <div>
              <div className="text-[13px] font-semibold text-white/90">{leak.user}</div>
              <div className="text-[11px] text-white/40 mt-1 flex items-center gap-1.5">
                <CreditCard size={12} /> {leak.issue} • <Clock size={12} /> {leak.date}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-semibold font-mono text-white/90">${leak.amount.toFixed(2)}</span>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[12px] font-bold hover:bg-white/10 transition-colors active:scale-95">
                <Mail size={14} /> Dunning
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
