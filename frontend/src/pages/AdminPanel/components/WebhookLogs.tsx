import React, { useState } from 'react';
import { Webhook, ChevronDown, ChevronRight, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const MOCK_WEBHOOKS = [
  { id: 'wh_1', event: 'payment.succeeded', target: 'https://api.userapp.com/webhooks/klyra', status: 200, time: '2 mins ago', payload: { id: "evt_1", type: "payment.succeeded", data: { amount: 2000, currency: "usd" } } },
  { id: 'wh_2', event: 'api.rate_limit_exceeded', target: 'https://hooks.slack.com/services/T00...', status: 429, time: '15 mins ago', payload: { id: "evt_2", type: "api.rate_limit", user: "usr_992" } },
  { id: 'wh_3', event: 'user.created', target: 'https://api.partner.io/sync', status: 500, time: '1 hour ago', payload: { id: "evt_3", type: "user.created", user: { email: "new@acme.com" } } },
];

export const WebhookLogs = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id);
  };

  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Webhook size={16} color="#3b82f6" /> Webhook Dispatcher Logs
      </h3>

      <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
        {MOCK_WEBHOOKS.map(wh => (
          <div key={wh.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div 
              onClick={() => toggleExpand(wh.id)}
              style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: expanded === wh.id ? 'rgba(255,255,255,0.02)' : 'transparent', transition: 'background 0.2s' }}
            >
              <div style={{ color: 'var(--text-muted)', marginRight: 12 }}>
                {expanded === wh.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 180 }}>{wh.event}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wh.target}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 80 }}>{wh.time}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 60 }}>
                  {wh.status === 200 ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: wh.status === 200 ? '#22c55e' : '#ef4444' }}>{wh.status}</span>
                </div>
              </div>
            </div>
            
            {expanded === wh.id && (
              <div style={{ padding: '16px 16px 16px 44px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request Payload</div>
                    <pre style={{ background: '#09090b', padding: 12, borderRadius: 6, fontSize: 11, color: '#a1a1aa', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', margin: 0 }}>
                      {JSON.stringify(wh.payload, null, 2)}
                    </pre>
                  </div>
                  <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      <RefreshCw size={14} /> Retry Delivery
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
