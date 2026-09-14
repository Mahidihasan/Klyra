import React from 'react';
import { Activity, Database, Server, Mail, CreditCard } from 'lucide-react';

const NODES = [
  { id: 'db', name: 'PostgreSQL DB', icon: <Database size={24} />, status: 'HEALTHY', latency: '4ms', uptime: '99.99%' },
  { id: 'cache', name: 'Redis Cache', icon: <Server size={24} />, status: 'HEALTHY', latency: '1ms', uptime: '100%' },
  { id: 'email', name: 'SendGrid Email', icon: <Mail size={24} />, status: 'DEGRADED', latency: '450ms', uptime: '98.5%' },
  { id: 'billing', name: 'Stripe Gateway', icon: <CreditCard size={24} />, status: 'HEALTHY', latency: '120ms', uptime: '99.99%' },
];

export const SystemHealth = () => {
  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Activity size={16} color="#22c55e" /> System Health Node Map
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {NODES.map(node => (
          <div key={node.id} style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: `1px solid ${node.status === 'HEALTHY' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.4)'}`, 
            borderRadius: 12, 
            padding: 20, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ color: node.status === 'HEALTHY' ? '#22c55e' : '#f59e0b', marginBottom: 12 }}>
              {node.icon}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{node.name}</div>
            
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Latency:</span> {node.latency}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Uptime:</span> {node.uptime}</div>
            </div>

            {node.status === 'DEGRADED' && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#f59e0b', animation: 'pulse-yellow 2s infinite' }} />
            )}
            {node.status === 'HEALTHY' && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#22c55e', opacity: 0.5 }} />
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse-yellow {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
