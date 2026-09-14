import { FileSearch } from 'lucide-react';
import React from 'react';

import { CustomLedger } from './components/CustomLedger';
import { DisputeManager } from './components/DisputeManager';
import { InvoiceForensics } from './components/InvoiceForensics';
import { RevenueLeakage } from './components/RevenueLeakage';

export const AdminForensics = () => {
  return (
    <div
      style={{
        animation: 'fadeIn 0.4s ease-out',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        color: 'var(--text-primary)',
        height: '100%',
        overflowY: 'auto',
        paddingRight: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <FileSearch size={24} color="#8b5cf6" /> Financial Forensics
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 14 }}>
            Deep financial manipulation, invoice adjustments, and dispute resolution.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <CustomLedger />
        <RevenueLeakage />
      </div>

      <InvoiceForensics />

      <DisputeManager />
    </div>
  );
};
