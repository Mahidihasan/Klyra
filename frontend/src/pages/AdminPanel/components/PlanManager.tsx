import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Save, Archive, Plus, ShieldCheck, Trash2, DollarSign, Edit3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { PlanManagerModal } from './PlanManagerModal';
import { PlanPricingModal } from './PlanPricingModal';
import { DeletePlanModal } from './DeletePlanModal';

// Magnetic Button Component
const MagneticButton = ({ children, onClick }: { children: React.ReactNode, onClick: () => void }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.4, y: middleY * 0.4 }); // 0.4 pull strength
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      onClick={onClick}
      className="relative flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-shadow"
    >
      {children}
    </motion.button>
  );
};

// iOS-style Toggle Switch Component
const ToggleSwitch = ({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => {
  return (
    <div 
      className={`relative w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${enabled ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/10'}`}
      onClick={onToggle}
    >
      <motion.div 
        layout
        className="w-4 h-4 bg-white rounded-full shadow-md"
        initial={false}
        animate={{ x: enabled ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  );
};

export const PlanManager = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedPlanForPricing, setSelectedPlanForPricing] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPlanForDelete, setSelectedPlanForDelete] = useState<any>(null);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<any>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/finances/plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPlans(data.data.filter((p: any) => p.is_active !== false));
      }
    } catch (err) {
      console.error('Failed to fetch plans', err);
      toast.error('Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const toggleFeature = (planId: string, featureId: string) => {
    setPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      
      let parsedFeatures = plan.features;
      if (typeof parsedFeatures === 'string') parsedFeatures = JSON.parse(parsedFeatures);

      const newFeatures = (parsedFeatures || []).map((f: any) => 
        f.id === featureId ? { ...f, enabled: !f.enabled } : f
      );
      
      return { ...plan, features: newFeatures };
    }));
  };

  const handleSavePlan = async (plan: any) => {
    const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
    const savePromise = fetch(`/api/v1/admin/finances/plans/${plan.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        features: plan.features
      })
    }).then(async res => {
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    });

    toast.promise(savePromise, {
      loading: 'Saving plan rules...',
      success: 'Plan updated successfully!',
      error: 'Failed to update plan.'
    }, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
  };

  const handleDeletePlan = async () => {
    if (!selectedPlanForDelete) return;
    const planId = selectedPlanForDelete.id;
    
    const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
    const deletePromise = fetch(`/api/v1/admin/finances/plans/${planId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(async res => {
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    }).then(res => {
      if (res.success) {
        fetchPlans();
      }
      return res;
    });

    toast.promise(deletePromise, {
      loading: 'Deleting plan...',
      success: 'Plan successfully removed/archived!',
      error: 'Failed to delete plan.'
    }, { style: { background: '#4c0519', color: '#fff', border: '1px solid #9f1239' } });
  };

  return (
    <div className="flex flex-col gap-12 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap size={20} className="text-indigo-400" />
            3D Interactive Plan Architect
          </h2>
          <p className="text-sm text-white/50 mt-1">Design and manage subscription tiers. Toggle features instantly.</p>
        </div>
        
        <MagneticButton onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Draft New Plan
        </MagneticButton>
      </div>

      <div className="grid grid-cols-3 gap-8 relative z-10">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[500px] rounded-3xl bg-[#0a0a0f]/60 border border-white/5 animate-pulse" />
          ))
        ) : plans.map(plan => {
          let features = plan.features;
          if (typeof features === 'string') features = JSON.parse(features);
          if (!Array.isArray(features)) features = [];

          return (
            <div key={plan.id} className="relative group">
            
            {/* Glowing Tier Indication (Behind the Card) */}
            {plan.isPopular && (
              <motion.div 
                className="absolute -inset-4 bg-indigo-500/30 blur-[60px] rounded-[3rem] -z-10"
                animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Glassmorphism Plan Card */}
            <div className={`relative h-full flex flex-col p-8 rounded-3xl bg-[#0a0a0f]/60 backdrop-blur-2xl border transition-all duration-300 ${plan.isPopular ? 'border-indigo-500/50 shadow-2xl shadow-indigo-500/20' : 'border-white/5 hover:border-white/20'}`}>
              
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/30">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <button 
                    onClick={() => { setSelectedPlanForEdit(plan); setIsModalOpen(true); }}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  {features.find((f: any) => f.id === 'discount_percent' && f.value > 0) ? (
                    <>
                      <span className="text-xl font-mono font-bold text-white/30 line-through">${plan.price}</span>
                      <span className="text-4xl font-mono font-bold text-emerald-400">
                        ${(plan.price * (1 - features.find((f: any) => f.id === 'discount_percent').value / 100)).toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-4xl font-mono font-bold text-white">${plan.price}</span>
                  )}
                  <span className="text-sm text-white/40">/{plan.interval}</span>
                </div>
              </div>

              <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 mb-8 flex justify-between items-center">
                <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-1">Global Rate Limit</div>
                <div className="font-mono text-indigo-400 font-bold">{plan.limit}</div>
              </div>
              
              {/* Tactile Feature Toggles */}
              <div className="flex-1 flex flex-col gap-5">
                {features.map((feature: any) => (
                  <div key={feature.id} className="flex items-center justify-between group/feature">
                    <div className={`text-[13px] font-medium transition-colors ${feature.enabled ? 'text-white/90' : 'text-white/30 line-through'}`}>
                      {feature.name}
                    </div>
                    <ToggleSwitch 
                      enabled={feature.enabled} 
                      onToggle={() => toggleFeature(plan.id, feature.id)} 
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-3">
                <button 
                  onClick={() => handleSavePlan(plan)}
                  className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 font-semibold text-sm hover:bg-indigo-500/20 hover:text-white hover:border-indigo-500/50 transition-colors flex items-center justify-center gap-2">
                  <ShieldCheck size={16} /> Save Plan Rules
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setSelectedPlanForPricing(plan); setPricingModalOpen(true); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 font-semibold text-sm hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2">
                    <DollarSign size={16} /> Pricing
                  </button>
                  <button 
                    onClick={() => { setSelectedPlanForDelete(plan); setDeleteModalOpen(true); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 font-semibold text-sm hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 transition-colors flex items-center justify-center gap-2">
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <PlanManagerModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedPlanForEdit(null); }} 
        onPlanCreated={fetchPlans}
        planToEdit={selectedPlanForEdit}
      />

      <PlanPricingModal 
        isOpen={pricingModalOpen}
        onClose={() => { setPricingModalOpen(false); setSelectedPlanForPricing(null); }}
        plan={selectedPlanForPricing}
        onPlanUpdated={fetchPlans}
      />

      <DeletePlanModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setSelectedPlanForDelete(null); }}
        onConfirm={handleDeletePlan}
        planName={selectedPlanForDelete?.name || ''}
      />
    </div>
  );
};
