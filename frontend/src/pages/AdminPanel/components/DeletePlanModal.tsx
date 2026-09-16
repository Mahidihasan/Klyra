import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const DeletePlanModal = ({
  isOpen,
  onClose,
  onConfirm,
  planName
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName: string;
}) => {
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
            <div className="bg-[#0a0a0f] border border-rose-500/30 rounded-3xl w-full max-w-md shadow-[0_0_100px_rgba(244,63,94,0.15)] pointer-events-auto overflow-hidden flex flex-col relative">
              {/* Danger Accents */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/20 blur-[80px] rounded-full pointer-events-none" />

              <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <AlertTriangle size={20} />
                  </div>
                  Delete Plan
                </h3>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 relative z-10 flex flex-col gap-4">
                <p className="text-white/80 text-lg leading-relaxed">
                  Are you absolutely sure you want to delete <strong className="text-white">"{planName}"</strong>?
                </p>
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-start gap-3">
                  <div className="mt-0.5">
                    <Trash2 size={16} className="text-rose-400" />
                  </div>
                  <p className="text-sm text-rose-200/70 leading-relaxed">
                    If this plan has <strong>active subscribers</strong>, it will be safely archived instead of deleted. It will remain hidden from new users, but existing subscriptions will not be broken.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-black/40 flex items-center justify-end gap-4 relative z-10">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-bold text-sm hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
                >
                  <Trash2 size={16} /> Confirm Deletion
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
