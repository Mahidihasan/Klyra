import { Cpu } from 'lucide-react';
import React from 'react';

import { CronJobs } from './components/CronJobs';
import { FeatureFlags } from './components/FeatureFlags';
import { SystemHealth } from './components/SystemHealth';
import { WebhookLogs } from './components/WebhookLogs';

export const AdminDevOps = () => {
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
            <Cpu size={24} color="#a78bfa" /> DevOps & Automation
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 14 }}>
            Manage feature flags, background jobs, webhooks, and system telemetry.
          </p>
        </div>
      </div>

      <SystemHealth />
      <FeatureFlags />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <WebhookLogs />
        <CronJobs />
      </div>
    </div>
  );
};
