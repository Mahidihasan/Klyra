import React, { useState, useRef } from 'react';
import { Zap, Save, Archive, Plus, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const INITIAL_PLANS = [
  { 
    id: 'free', 
    name: 'Freemium', 
    price: 0, 
    interval: 'month', 
    limit: '100 req/min', 
    isPopular: false,
    features: [
      { id: 'f1', name: 'Public APIs Access', enabled: true }, 
      { id: 'f2', name: 'Community Forum Support', enabled: true },
      { id: 'f3', name: 'Custom Gateway Overrides', enabled: false },
      { id: 'f4', name: 'Dedicated IP Address', enabled: false }
    ] 
  },
  { 
    id: 'pro', 
    name: 'Professional', 
    price: 49, 
    interval: 'month', 
    limit: '5,000 req/min', 
    isPopular: true,
    features: [
      { id: 'p1', name: 'Premium APIs Access', enabled: true }, 
      { id: 'p2', name: 'Priority Email Support', enabled: true }, 
      { id: 'p3', name: 'Custom Gateway Overrides', enabled: true },
      { id: 'p4', name: 'Dedicated IP Address', enabled: false }
    ] 
  },
  { 
    id: 'ent', 
    name: 'Enterprise', 
    price: 299, 
    interval: 'month', 
    limit: 'Unlimited', 
    isPopular: false,
    features: [
      { id: 'e1', name: 'All Premium APIs', enabled: true }, 
      { id: 'e2', name: '24/7 Phone Support & SLA', enabled: true }, 
      { id: 'e3', name: 'Custom Gateway Overrides', enabled: true },
      { id: 'e4', name: 'Dedicated IP Address', enabled: true }
    ] 
  },
];

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
  const [plans, setPlans] = useState(INITIAL_PLANS);

  const toggleFeature = (planId: string, featureId: string) => {
    setPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      return {
        ...plan,
        features: plan.features.map(f => f.id === featureId ? { ...f, enabled: !f.enabled } : f)
      };
    }));
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
        
        <MagneticButton onClick={() => console.log('Draft New Plan')}>
          <Plus size={16} /> Draft New Plan
        </MagneticButton>
      </div>

      <div className="grid grid-cols-3 gap-8 relative z-10">
        {plans.map(plan => (
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
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-mono font-bold text-white">${plan.price}</span>
                  <span className="text-sm text-white/40">/{plan.interval}</span>
                </div>
              </div>

              <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 mb-8">
                <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-1">Global Rate Limit</div>
                <div className="font-mono text-indigo-400 font-bold">{plan.limit}</div>
              </div>
              
              {/* Tactile Feature Toggles */}
              <div className="flex-1 flex flex-col gap-5">
                {plan.features.map(feature => (
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

              <div className="mt-10 pt-6 border-t border-white/5">
                <button className="w-full py-3 rounded-xl border border-white/10 text-white/50 font-semibold text-sm hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2">
                  <ShieldCheck size={16} /> Save Plan Rules
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
