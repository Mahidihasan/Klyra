import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Code2, AlertTriangle, ShieldAlert, CheckCircle, TrendingUp, Star, Trash2 } from 'lucide-react';

export const ApiReviewPane = ({ api, onClose, onApprove, onReject }: any) => {
  const [isKillModalOpen, setIsKillModalOpen] = useState(false);
  const [killConfirmText, setKillConfirmText] = useState('');
  
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);

  if (!api) return null;

  const handleKill = () => {
    if (killConfirmText === api.name) {
      onReject(api.id);
      setIsKillModalOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Massive Split-Pane Drawer */}
      <motion.div
        initial={{ x: '100%', opacity: 0, scale: 0.95 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ x: '100%', opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[85vw] bg-[#0a0a0f] border-l border-white/5 shadow-2xl shadow-black/80 flex flex-col"
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              {api.name} <span className="px-2 py-0.5 rounded bg-white/10 text-[12px] font-mono text-white/70">v{api.version}</span>
            </h2>
            <p className="text-sm text-white/50 mt-1">Submitted by <strong className="text-white/70">{api.provider}</strong> • {api.description}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors outline-none">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Pane: Spec & Testing */}
          <div className="w-3/5 border-r border-white/5 flex flex-col bg-[#12121a]/50">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-black/20">
              <Code2 size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">OpenAPI Specification</h3>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="rounded-xl bg-[#0d0d12] border border-white/5 shadow-inner shadow-black p-4 font-mono text-[13px] text-emerald-400/80 overflow-x-auto whitespace-pre">
                {`openapi: 3.0.0
info:
  title: ${api.name}
  version: ${api.version}
paths:
  /v1/predict:
    post:
      summary: Generate prediction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: Successful response`}
              </div>

              <div className="mt-8">
                <h3 className="text-sm font-semibold text-white mb-4">Live Test Ping</h3>
                <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">POST</span>
                    <span className="font-mono text-sm text-white/70">https://api.klyra.com/v1/predict</span>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-sm font-semibold">
                    <Play size={14} /> Run Test Request
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Pane: Admin Controls */}
          <div className="w-2/5 flex flex-col">
            <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Marketplace Curation</h3>
                <div className="space-y-4">
                  {/* Featured Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isFeatured ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/40'}`}>
                        <Star size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Featured API</div>
                        <div className="text-[11px] text-white/50">Display on the marketplace hero section</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsFeatured(!isFeatured)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${isFeatured ? 'bg-amber-500' : 'bg-white/20'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isFeatured ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Trending Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isTrending ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/10 text-white/40'}`}>
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Trending Status</div>
                        <div className="text-[11px] text-white/50">Boost algorithm rankings</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsTrending(!isTrending)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${isTrending ? 'bg-indigo-500' : 'bg-white/20'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isTrending ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-rose-400 mb-4 flex items-center gap-2">
                  <ShieldAlert size={16} /> Danger Zone
                </h3>
                <div className="p-5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <h4 className="text-sm font-semibold text-white mb-1">Force Unpublish</h4>
                  <p className="text-[12px] text-white/50 mb-4">Instantly remove this API from the marketplace. Existing consumer subscriptions will be forcefully terminated.</p>
                  <button 
                    onClick={() => setIsKillModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                  >
                    <Trash2 size={16} /> Take Down API
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-[#0a0a0f]/90 flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 hover:text-white transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => onApprove(api.id)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
              >
                <CheckCircle size={16} /> Save & Approve
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Kill Switch Modal */}
      <AnimatePresence>
        {isKillModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#12121a] rounded-2xl border border-rose-500/30 p-6 shadow-2xl shadow-rose-500/20"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 mb-4 mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Are you absolutely sure?</h3>
              <p className="text-sm text-white/50 text-center mb-6">
                This action cannot be undone. This will permanently delete the <strong>{api.name}</strong> API and terminate all active consumer connections.
              </p>
              
              <div className="mb-6">
                <label className="block text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Please type <strong className="text-white">{api.name}</strong> to confirm.
                </label>
                <input 
                  type="text" 
                  value={killConfirmText}
                  onChange={(e) => setKillConfirmText(e.target.value)}
                  className="w-full h-10 px-3 bg-black/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsKillModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleKill}
                  disabled={killConfirmText !== api.name}
                  className="flex-1 h-10 rounded-lg bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Take Down
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
