import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export const PlanPricingModal = ({ 
  isOpen, 
  onClose, 
  plan,
  onPlanUpdated 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  plan: any,
  onPlanUpdated: () => void 
}) => {
  const [price, setPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (plan && isOpen) {
      setPrice(plan.price.toString());
      
      let features = [];
      try {
        if (typeof plan.features === 'string') features = JSON.parse(plan.features);
        else features = plan.features || [];
      } catch (e) {}

      const discountFeature = features.find((f: any) => f.id === 'discount_percent');
      if (discountFeature) {
        setDiscountPercent(discountFeature.value.toString());
      } else {
        setDiscountPercent('');
      }
    }
  }, [plan, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || isNaN(Number(price))) {
      toast.error('Valid price is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/finances/plans/${plan.id}/pricing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          price: Number(price),
          discountPercent: discountPercent ? Number(discountPercent) : 0
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Pricing updated successfully');
        onPlanUpdated();
        onClose();
      } else {
        toast.error(data.error?.message || 'Failed to update pricing');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while updating pricing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedDiscount = discountPercent && Number(discountPercent) > 0 
    ? (Number(price) * (1 - (Number(discountPercent) / 100))).toFixed(2)
    : price;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
          >
            <div className="bg-[#0a0a0f] border border-emerald-500/30 rounded-2xl w-full max-w-sm shadow-[0_0_100px_rgba(16,185,129,0.2)] pointer-events-auto overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-400" />
                  Edit Pricing
                </h3>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <form id="edit-pricing-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Base Price ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest flex justify-between">
                      <span>Discount Percentage (%)</span>
                      <span>Optional</span>
                    </label>
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(e.target.value)}
                      placeholder="e.g. 20"
                      className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-2 text-emerald-400 placeholder-emerald-500/30 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                    />
                  </div>

                  {discountPercent && Number(discountPercent) > 0 && (
                    <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                      <span className="text-xs text-white/50 font-medium">Final Price Preview</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30 line-through font-mono">${price || '0'}</span>
                        <span className="text-sm text-emerald-400 font-bold font-mono">${calculatedDiscount}</span>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-white/5 bg-[#0a0a0f]/90">
                <button 
                  type="submit" 
                  form="edit-pricing-form"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} /> {isSubmitting ? 'Saving...' : 'Save Pricing'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
