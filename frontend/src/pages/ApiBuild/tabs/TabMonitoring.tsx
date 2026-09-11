import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, Clock, AlertTriangle, Bell, Plus } from 'lucide-react';
import { MonitoringIncident, AlertRule } from '../types';
import { ProviderProject } from '../../../types/apibuild';

interface TabMonitoringProps {
  project: ProviderProject;
  incidents: MonitoringIncident[];
  alertRules: AlertRule[];
  onShowToast: (msg: string) => void;
}

export const TabMonitoring: React.FC<TabMonitoringProps> = ({
  project,
  incidents,
  alertRules: initialAlertRules,
  onShowToast
}) => {
  const [alertRules, setAlertRules] = useState<AlertRule[]>(initialAlertRules);

  const toggleAlert = (id: string) => {
    setAlertRules(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    onShowToast('Alert rule updated');
  };

  return (
    <div className="kly-page-stack">
      {/* 30-Day Uptime Calendar Strip */}
      <div className="kly-card">
        <div className="kly-card-header">
          <div>
            <h4 className="kly-card-title">
              <CheckCircle2 size={15} color="#10b981" />
              <span>30-Day Availability History (99.97% Operational)</span>
            </h4>
            <p className="kly-card-subtitle">Zero major SLA breaches in the current billing cycle</p>
          </div>
          <span className="kly-badge kly-badge-healthy">● All Systems Normal</span>
        </div>

        {/* 30 green pill day blocks */}
        <div style={{ display: 'flex', gap: 4, height: 28, margin: '8px 0' }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: i === 22 ? '#fbbf24' : '#10b981',
                borderRadius: 3,
                opacity: 0.85
              }}
              title={i === 22 ? 'Day 23: 99.1% uptime (15m transient latency spike)' : `Day ${i + 1}: 100.0% uptime`}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--kly-text-dim)' }}>
          <span>30 days ago</span>
          <span>99.97% average uptime</span>
          <span>Today</span>
        </div>
      </div>

      {/* Probes & Certificates */}
      <div className="kly-grid-2col">
        {/* Origin Probe */}
        <div className="kly-card">
          <h4 className="kly-card-title" style={{ marginBottom: 10 }}>Upstream Origin Health Probe</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>Target Probe Path</span>
              <b className="kly-mono">{project.healthCheckPath || '/health'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>Probe Interval</span>
              <b>Every 30 seconds</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>Latest Latency Response</span>
              <b className="kly-mono" style={{ color: '#34d399' }}>14ms (HTTP 200 OK)</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>Consecutive Successes</span>
              <b>86,400 checks</b>
            </div>
          </div>
        </div>

        {/* SSL/TLS */}
        <div className="kly-card">
          <h4 className="kly-card-title" style={{ marginBottom: 10 }}>Edge SSL / TLS Security</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>TLS Protocol Version</span>
              <b>TLS 1.3 / HTTP/2</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>Certificate Authority</span>
              <b>Let's Encrypt Authority X3</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>Expiration Date</span>
              <b style={{ color: '#34d399' }}>Nov 14, 2027 (Auto-renews)</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kly-text-dim)' }}>HSTS & OCSP Stapling</span>
              <b style={{ color: '#34d399' }}>Enabled</b>
            </div>
          </div>
        </div>
      </div>

      {/* Incident History Timeline */}
      <div className="kly-card">
        <div className="kly-card-header">
          <div>
            <h4 className="kly-card-title">Incident History & Postmortems</h4>
            <p className="kly-card-subtitle">Past reliability occurrences and mitigation notes</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {incidents.map((inc) => (
            <div key={inc.id} style={{
              padding: '12px', background: '#0e0f18', borderRadius: 6,
              border: '1px solid var(--kly-border-subtle)', display: 'flex',
              flexDirection: 'column', gap: 6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="kly-badge kly-badge-healthy">Resolved</span>
                  <b style={{ fontSize: 13 }}>{inc.title}</b>
                </div>
                <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>{inc.startedAt} ({inc.durationMinutes}m duration)</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--kly-text-muted)', margin: 0 }}>
                {inc.summary}
              </p>
              {inc.postmortem && (
                <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', fontStyle: 'italic', marginTop: 2 }}>
                  Postmortem fix: {inc.postmortem}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configured Alert Rules */}
      <div className="kly-card">
        <div className="kly-card-header">
          <div>
            <h4 className="kly-card-title">Reliability Alert Policies</h4>
            <p className="kly-card-subtitle">Dispatch pager notifications when thresholds breach</p>
          </div>
          <button className="kly-btn kly-btn-secondary" onClick={() => onShowToast('Create alert modal')}>
            <Plus size={12} />
            <span>Add Alert Policy</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertRules.map((rule) => (
            <div key={rule.id} style={{
              padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 6,
              border: '1px solid var(--kly-border-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{rule.name}</div>
                <div style={{ fontSize: 11, color: 'var(--kly-text-dim)', marginTop: 2 }}>
                  Condition: <code>{rule.metric} {rule.condition} {rule.threshold}{rule.unit}</code> for {rule.durationSec}s · Dispatch: {rule.channels.join(', ')}
                </div>
              </div>

              <button
                className={`kly-btn ${rule.enabled ? 'kly-btn-secondary' : 'kly-btn-ghost'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => toggleAlert(rule.id)}
              >
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
