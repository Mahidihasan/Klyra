import React, { useState, useEffect } from 'react';
import { X, Save, Zap, Plus, Trash2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const DEFAULT_FEATURES = [
  { id: 'API_INFERENCE', name: 'API Inference Access', enabled: true },
  { id: 'CUSTOM_WEBHOOKS', name: 'Custom Webhooks', enabled: false },
  { id: 'PRIORITY_SUPPORT', name: 'Priority Support', enabled: false },
  { id: 'BULK_EXPORT', name: 'Bulk API Export', enabled: false },
  { id: 'ADVANCED_ANALYTICS', name: 'Advanced Analytics', enabled: false },
  { id: 'TEAM_COLLABORATION', name: 'Team Collaboration', enabled: false },
  { id: 'HIGH_CONCURRENCY', name: 'High Concurrency', enabled: false },
];

export const PlanManagerModal = ({ isOpen, onClose, onPlanCreated, planToEdit }: { isOpen: boolean, onClose: () => void, onPlanCreated: () => void, planToEdit?: any }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [limit, setLimit] = useState('');
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && planToEdit) {
      setName(planToEdit.name || '');
      setPrice(planToEdit.price?.toString() || '');
      setLimit(planToEdit.rate_limit?.toString() || '');
      
      let parsed = planToEdit.features;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch(e) { parsed = []; }
      }
      setFeatures(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FEATURES);
    } else if (isOpen && !planToEdit) {
      setName('');
      setPrice('');
      setLimit('');
      setFeatures(DEFAULT_FEATURES);
    }
  }, [isOpen, planToEdit]);

  const handleToggle = (id: string) => {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      toast.error('Name and Price are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const endpoint = planToEdit ? `/api/v1/admin/finances/plans/${planToEdit.id}` : '/api/v1/admin/finances/plans';
      
      const res = await fetch(endpoint, {
        method: planToEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          price: Number(price),
          limit: limit ? Number(limit) : undefined,
          features
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(planToEdit ? 'Plan updated successfully' : 'Plan created successfully');
        onPlanCreated();
        onClose();
      } else {
        toast.error(data.error?.message || 'Failed to create plan');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while creating the plan');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.8)] pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {planToEdit ? (
                    <Edit3 size={20} className="text-indigo-400" />
                  ) : (
                    <Zap size={20} className="text-indigo-400" />
                  )}
                  {planToEdit ? 'Edit Plan Details' : 'Draft New Plan'}
                </h3>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form id="create-plan-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Plan Name</label>
                    <input 
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Pro Tier"
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Monthly Price ($)</label>
                      <input 
                        type="number"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="e.g. 49"
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-white/50 uppercase tracking-widest">Rate Limit</label>
                      <input 
                        type="number"
                        value={limit}
                        onChange={e => setLimit(e.target.value)}
                        placeholder="e.g. 5000"
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4 block">Feature Permissions & Access Control</label>
                    
                    <div className="flex flex-col gap-3">
                      {features.filter(f => !['discount_percent', 'burst_concurrency'].includes(f.id)).map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                          <span className={`text-sm font-medium transition-colors ${f.enabled ? 'text-white/90' : 'text-white/30'}`}>{f.name}</span>
                          <div 
                            onClick={() => handleToggle(f.id)}
                            className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${f.enabled ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/10'}`}
                          >
                            <motion.div 
                              layout
                              className="w-4 h-4 bg-white rounded-full shadow-md"
                              initial={false}
                              animate={{ x: f.enabled ? 16 : 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl">
                <button 
                  type="submit" 
                  form="create-plan-form"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} /> {isSubmitting ? 'Saving...' : (planToEdit ? 'Save Changes' : 'Create Plan')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
