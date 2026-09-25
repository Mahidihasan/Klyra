import React, { useState } from 'react';
import { Search, FileText, ChevronDown, ChevronRight, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_LINE_ITEMS = [
  { id: 'li_1', endpoint: 'GET /api/v1/weather', calls: 14500, rate: 0.001, total: 14.50, waived: false },
  { id: 'li_2', endpoint: 'POST /api/v1/ml/predict', calls: 200, rate: 0.05, total: 10.00, waived: false },
  { id: 'li_3', endpoint: 'GET /api/v2/auth', calls: 54000, rate: 0.0001, total: 5.40, waived: false },
];

export const InvoiceForensics = () => {
  const [invoiceId, setInvoiceId] = useState('inv_8B9X2Y');
  const [items, setItems] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [totalBilled, setTotalBilled] = useState(0);

  React.useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch(`/api/v1/admin/finances/forensics/invoice/${invoiceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setItems(json.data.items);
            setTotalBilled(json.data.adjustedTotal);
          }
        }
      } catch (err) {
        console.error('Failed to fetch invoice data', err);
      }
    };
    fetchInvoice();
  }, [invoiceId]);

  const toggleWaive = async (id: string) => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/finances/forensics/invoice/waive/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Optimistically update local state to avoid refetching
        setItems(prev => {
          const newItems = prev.map(item => item.id === id ? { ...item, waived: !item.waived } : item);
          const newTotal = newItems.reduce((acc, curr) => curr.waived ? acc : acc + curr.total, 0);
          setTotalBilled(newTotal);
          return newItems;
        });
      }
    } catch (err) {
      console.error('Failed to waive item', err);
    }
  };

  return (
    <div className="bg-zinc-950/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col h-full">
      
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[14px] font-bold text-white m-0 flex items-center gap-2 tracking-widest uppercase">
          <FileText size={16} className="text-blue-500" /> Invoice Forensics
        </h3>
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
          <Search size={14} className="text-white/40" />
          <input 
            type="text" 
            value={invoiceId} 
            onChange={e => setInvoiceId(e.target.value)} 
            className="bg-transparent border-none text-blue-400 outline-none w-[100px] text-[13px] font-bold font-mono"
          />
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20 flex flex-col flex-1">
        
        {/* Table Header */}
        <div className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_100px] p-3 bg-white/[0.02] border-b border-white/5 text-[11px] text-white/50 uppercase tracking-widest font-bold shrink-0">
          <div></div>
          <div>Endpoint</div>
          <div className="text-right">Calls</div>
          <div className="text-right">Rate</div>
          <div className="text-right">Total</div>
          <div className="text-right pr-2">Action</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="border-b border-white/5 last:border-0 group">
              <div className={`grid grid-cols-[32px_2fr_1fr_1fr_1fr_100px] p-3 items-center transition-colors duration-300 ${
                item.waived ? 'bg-rose-500/5' : 'hover:bg-white/[0.02]'
              }`}>
                
                {/* Expander */}
                <div onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="cursor-pointer text-white/30 hover:text-white/70">
                  {expanded === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                
                {/* Endpoint */}
                <div className={`text-[13px] font-mono transition-colors duration-300 ${
                  item.waived ? 'text-white/30' : 'text-zinc-300'
                }`}>
                  {item.endpoint}
                </div>
                
                {/* Calls */}
                <div className="text-[12px] font-mono text-right text-white/60">
                  {item.calls.toLocaleString()}
                </div>
                
                {/* Rate */}
                <div className="text-[12px] font-mono text-right text-white/40">
                  ${item.rate}
                </div>
                
                {/* Total (with Strikethrough Animation) */}
                <div className="text-right flex justify-end">
                  <div className="relative inline-block">
                    <span className={`text-[13px] font-mono font-bold tracking-wider transition-all duration-300 ${
                      item.waived 
                        ? 'text-white/30' 
                        : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                    }`}>
                      ${item.total.toFixed(2)}
                    </span>
                    {/* Strikethrough Line */}
                    <motion.div
                      initial={false}
                      animate={{ width: item.waived ? '100%' : '0%' }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="absolute top-1/2 left-0 h-[2px] bg-rose-500 -translate-y-1/2 origin-left"
                    />
                  </div>
                </div>
                
                {/* Action Toggle */}
                <div className="text-right flex justify-end pr-2">
                  <button 
                    onClick={() => toggleWaive(item.id)}
                    className={`relative overflow-hidden flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all duration-200 border active:scale-95 ${
                      item.waived 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                        : 'bg-zinc-800/50 border-white/10 text-white/40 hover:text-white/70 hover:border-white/30'
                    }`}
                  >
                    <Ban size={12} className={item.waived ? 'animate-pulse' : ''} />
                    {item.waived ? 'Waived' : 'Waive'}
                  </button>
                </div>

              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expanded === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-black/40"
                  >
                    <div className="px-12 py-3 text-[11px] text-white/40 font-mono flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div><span className="text-white/20">Strategy:</span> Daily Aggregate</div>
                        <div><span className="text-white/20">Avg Latency:</span> 42ms <span className="mx-2">|</span> <span className="text-white/20">Error Rate:</span> 0.01%</div>
                      </div>
                      <button className="px-3 py-1 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors active:scale-95">
                        View Raw Logs
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* ── Footer / Total ── */}
        <div className="flex justify-end items-center p-4 bg-black/40 border-t border-white/5 shrink-0 gap-6">
          <span className="text-[12px] text-white/50 uppercase tracking-widest font-bold">Adjusted Total</span>
          <div className="relative">
            <motion.span 
              key={totalBilled}
              initial={{ scale: 1.1, color: '#fff' }}
              animate={{ scale: 1, color: '#34d399' }}
              className="text-[20px] font-black font-mono tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]"
            >
              ${totalBilled.toFixed(2)}
            </motion.span>
          </div>
        </div>

      </div>
    </div>
  );
};
