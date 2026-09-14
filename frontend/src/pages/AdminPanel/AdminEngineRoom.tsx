import { TerminalSquare, Activity } from 'lucide-react';
import React from 'react';

import { CacheInvalidation } from './components/CacheInvalidation';
import { CircuitBreakers } from './components/CircuitBreakers';
import { DynamicRouting } from './components/DynamicRouting';
import { LivePayloadInspector } from './components/LivePayloadInspector';

export const AdminEngineRoom = () => {
  return (
    <div
      style={{
        animation: 'fadeIn 0.4s ease-out',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 24,
        color: 'var(--text-primary)',
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
            <TerminalSquare size={24} color="#a78bfa" /> API Engine Room
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 14 }}>
            Deep infrastructural control. Use extreme caution—actions here execute directly at the
            Edge Gateway.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(34,197,94,0.1)',
            color: '#22c55e',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <Activity size={14} /> Edge Gateway: Online
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 24,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Column - Live Inspector */}
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <LivePayloadInspector />
        </div>

        {/* Right Column - Infra Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflowY: 'auto',
            paddingRight: 8,
          }}
        >
          <CircuitBreakers />
          <DynamicRouting />
          <CacheInvalidation />
        </div>
      </div>
    </div>
  );
};
