import React from 'react';
import { FileSearch } from 'lucide-react';

import { DisputeManager } from './components/DisputeManager';
import { InvoiceForensics } from './components/InvoiceForensics';
import { FraudRadar } from './components/FraudRadar';
import { SpatialLedger } from './components/SpatialLedger';
import { ActionBoard } from './components/ActionBoard';

export const AdminForensics = () => {
  return (
    <div className="flex flex-col h-full gap-6 text-white animate-[fadeIn_0.4s_ease-out]">
      
      {/* ── Header ── */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-[24px] font-bold m-0 flex items-center gap-3 tracking-tight">
            <FileSearch size={24} className="text-purple-400" /> Financial Forensics
          </h1>
          <p className="text-white/40 mt-1 text-[14px]">
            Deep financial manipulation, invoice adjustments, and dispute resolution.
          </p>
        </div>
      </div>

      {/* ── 12-Column God-Mode Grid ── */}
      <div className="grid grid-cols-12 gap-6 items-start flex-1 overflow-y-auto custom-scrollbar pb-12 pr-2">
        
        {/* The 70% Hero - Left Column */}
        <div className="col-span-12 xl:col-span-8 h-full">
          <SpatialLedger />
        </div>

        {/* The 30% Tactical Rail - Right Column */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
          <FraudRadar />
        </div>

        {/* Full-Width Control Board - Cyber-Tactical Actions */}
        <div className="col-span-12 mt-2">
          <ActionBoard />
        </div>

        {/* Legacy Support Tools */}
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <InvoiceForensics />
          <DisputeManager />
        </div>

      </div>

    </div>
  );
};
