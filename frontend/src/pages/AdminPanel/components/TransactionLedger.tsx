import React, { useState } from 'react';
import { Search, Download, CornerUpLeft, CheckCircle2, Loader2, X, ReceiptText, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_LEDGER = [
  { 
    id: 'txn_98a72', user: 'user_dev1', amount: 49.00, status: 'Paid', date: '2026-09-14 08:30:12', method: 'Card •••• 4242',
    breakdown: [
      { name: 'Base Platform Fee', amount: 20.00, desc: 'Pro Tier Subscription' },
      { name: 'Geolocation API', amount: 12.00, desc: '5,420 hits' },
      { name: 'Weather Data API', amount: 17.00, desc: '1,200 hits' }
    ]
  },
  { 
    id: 'txn_98a71', user: 'user_x99a', amount: 299.00, status: 'Paid', date: '2026-09-14 07:15:00', method: 'Bank Transfer',
    breakdown: [
      { name: 'Base Platform Fee', amount: 299.00, desc: 'Enterprise Tier Subscription' }
    ]
  },
  { 
    id: 'txn_98a70', user: 'user_fail', amount: 15.00, status: 'Failed', date: '2026-09-13 22:40:11', method: 'Card •••• 5555',
    breakdown: [
      { name: 'Base Platform Fee', amount: 15.00, desc: 'Basic Tier Subscription' }
    ]
  },
  { 
    id: 'txn_98a69', user: 'user_old1', amount: 49.00, status: 'Refunded', date: '2026-09-13 14:20:00', method: 'Card •••• 1234',
    breakdown: [
      { name: 'Base Platform Fee', amount: 49.00, desc: 'Pro Tier Subscription' }
    ]
  },
  { 
    id: 'txn_98a68', user: 'user_x99a', amount: 104.50, status: 'Paid', date: '2026-09-12 09:10:00', method: 'Card •••• 4242',
    breakdown: [
      { name: 'Base Platform Fee', amount: 49.00, desc: 'Pro Tier Subscription' },
      { name: 'DeepSeek Inference API', amount: 55.50, desc: '1,110 tokens' }
    ]
  },
];

const RefundButton = ({ txId }: { txId: string }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleRefund = () => {
    setStatus('loading');
    setTimeout(() => setStatus('success'), 600); // Fast, satisfying delay
  };

  return (
    <button 
      onClick={handleRefund}
      disabled={status !== 'idle'}
      className={`w-full flex items-center justify-center py-3.5 rounded-xl border font-bold transition-all relative overflow-hidden ${
        status === 'idle' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20' 
        : status === 'loading' ? 'bg-white/5 border-white/10 text-white/50'
        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      }`}
    >
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.span key="idle" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
            Process Full Refund
          </motion.span>
        )}
        {status === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader2 className="animate-spin text-white/50" size={20} />
          </motion.div>
        )}
        {status === 'success' && (
          <motion.div key="success" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
            <CheckCircle2 size={20} /> Refunded Successfully
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

export const TransactionLedger = () => {
  const [ledger, setLedger] = useState(MOCK_LEDGER);
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<typeof MOCK_LEDGER[0] | null>(null);

  const filteredLedger = ledger.filter(tx => tx.id.includes(search) || tx.user.includes(search));

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Table Toolbar */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input 
            type="text" 
            placeholder="Search TXN or User..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-black/50 border border-white/10 text-white text-[13px] py-1.5 pl-9 pr-4 rounded-md focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all w-64"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-white/5 border border-white/10 text-[13px] font-medium text-white/70 hover:bg-white/10 transition-colors">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Infinite Matrix Ledger */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-md z-10">
            <tr>
              <th className="px-6 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest border-b border-white/5">Transaction ID</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest border-b border-white/5">Date</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest border-b border-white/5">User</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest border-b border-white/5">Method</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest border-b border-white/5 text-right">Amount</th>
              <th className="px-6 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest border-b border-white/5 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.map(tx => (
              <tr 
                key={tx.id} 
                onClick={() => setSelectedTx(tx)}
                className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4 text-[13px] font-mono text-white/50 group-hover:text-white transition-colors">{tx.id}</td>
                <td className="px-6 py-4 text-[13px] text-white/70">{tx.date}</td>
                <td className="px-6 py-4 text-[13px] font-mono text-indigo-400">{tx.user}</td>
                <td className="px-6 py-4 text-[13px] text-white/50">{tx.method}</td>
                <td className="px-6 py-4 text-[14px] font-mono font-bold text-white text-right">
                  ${tx.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                    tx.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    tx.status === 'Failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                    'bg-white/5 text-white/50 border-white/10'
                  }`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Forensic Receipt Slide-Over Drawer */}
      <AnimatePresence>
        {selectedTx && (
          <>
            {/* Backdrop */}
            <motion.div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTx(null)}
            />
            
            {/* Drawer */}
            <motion.div 
              className="fixed top-0 right-0 h-full w-[440px] bg-[#0a0a0f] border-l border-white/10 z-50 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <ReceiptText size={18} className="text-indigo-400" /> Forensic Breakdown
                </h3>
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {/* Header Information */}
                <div className="flex flex-col gap-6 mb-12">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Transaction ID</span>
                      <span className="font-mono text-sm text-white/70">{selectedTx.id}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                      selectedTx.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      selectedTx.status === 'Failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                      'bg-white/5 text-white/50 border-white/10'
                    }`}>
                      {selectedTx.status}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Billed To</span>
                    <span className="font-mono text-sm text-indigo-400">{selectedTx.user}</span>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Payment Method</span>
                    <span className="text-sm text-white/70 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-400" /> {selectedTx.method}
                    </span>
                  </div>
                </div>

                {/* Digital Receipt Breakdown */}
                <div className="relative">
                  {/* Jagged Receipt Top (Visual Effect) */}
                  <div className="h-2 w-full bg-[radial-gradient(circle,transparent_4px,#1a1a24_4px)] bg-[length:12px_12px] bg-bottom absolute -top-2" />
                  
                  <div className="bg-[#1a1a24] p-6 rounded-b-xl rounded-t-sm border border-t-0 border-white/5">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-6 pb-4 border-b border-dashed border-white/10">
                      Line Items
                    </div>

                    <div className="flex flex-col gap-6">
                      {selectedTx.breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-medium text-white/90">{item.name}</span>
                            <span className="text-[11px] text-white/40">{item.desc}</span>
                          </div>
                          <span className="font-mono text-[13px] font-medium text-white/70">${item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-dashed border-white/20 flex justify-between items-end">
                      <span className="text-sm font-bold text-white/70 uppercase tracking-widest">Total Settled</span>
                      <span className="text-3xl font-mono font-bold text-white">${selectedTx.amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="p-6 border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl">
                {selectedTx.status === 'Paid' ? (
                  <RefundButton txId={selectedTx.id} />
                ) : (
                  <button disabled className="w-full py-3.5 rounded-xl border border-white/5 bg-white/5 text-white/30 font-bold cursor-not-allowed">
                    {selectedTx.status === 'Refunded' ? 'Already Refunded' : 'Cannot Refund Failed TXN'}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
