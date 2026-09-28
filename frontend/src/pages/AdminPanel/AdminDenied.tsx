import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export const AdminDenied: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[600px] w-full text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex flex-col items-center gap-6 max-w-md p-8 rounded-3xl bg-black/40 border border-rose-500/20 shadow-[0_0_80px_rgba(244,63,94,0.1)] relative overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(90deg,#f43f5e,#f43f5e_12px,transparent_12px,transparent_24px)]" />
        
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2">
          <ShieldAlert size={36} className="text-rose-500" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
          <p className="text-white/50 text-[15px] leading-relaxed">
            You do not have the required permissions to view this module. Please contact a Super Admin to request elevated access if you need it.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
