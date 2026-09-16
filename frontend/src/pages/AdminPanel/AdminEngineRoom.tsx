import React from 'react';
import { TerminalSquare, Activity } from 'lucide-react';

import { CacheInvalidation } from './components/CacheInvalidation';
import { CircuitBreakers, TrafficShaping } from './components/CircuitBreakers';
import { LivePayloadInspector } from './components/LivePayloadInspector';

export const AdminEngineRoom = () => {
  return (
    <div className="flex flex-col h-full gap-6 text-white animate-[fadeIn_0.4s_ease-out]">
      
      {/* ── Header ── */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-[24px] font-bold m-0 flex items-center gap-3 tracking-tight">
            <TerminalSquare size={24} className="text-purple-400" /> API Engine Room
          </h1>
          <p className="text-white/40 mt-1 text-[14px]">
            Deep infrastructural control. Use extreme caution—actions here execute directly at the Edge Gateway.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-emerald-500/20">
          <Activity size={14} /> Edge Gateway: Online
        </div>
      </div>

      {/* ── 12-Column God-Mode Grid ── */}
      <div className="grid grid-cols-12 gap-6 items-start flex-1 overflow-y-auto custom-scrollbar pb-12 pr-2">
        
        {/* The 70% Hero - Left Column */}
        <div className="col-span-12 xl:col-span-8 backdrop-blur-2xl bg-zinc-950/80 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-6 h-full min-h-[600px] flex flex-col">
          <LivePayloadInspector />
        </div>

        {/* The 30% Tactical Rail - Right Column */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
          <CircuitBreakers />
        </div>

        {/* Full-Width Control Board - Bottom */}
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          <TrafficShaping />
          <CacheInvalidation />
        </div>

      </div>

    </div>
  );
};
