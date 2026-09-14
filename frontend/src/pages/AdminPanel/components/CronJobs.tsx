import React from 'react';
import { Clock, PlayCircle, CheckCircle, Clock3 } from 'lucide-react';

const CRON_JOBS = [
  { id: 'cron_1', name: 'Daily Billing Sync', schedule: '0 0 * * *', lastRun: '2 hours ago', status: 'SUCCESS' },
  { id: 'cron_2', name: 'Prune Inactive Tokens', schedule: '0 */6 * * *', lastRun: '15 mins ago', status: 'SUCCESS' },
  { id: 'cron_3', name: 'Generate Analytics Report', schedule: '0 2 * * 0', lastRun: 'Pending', status: 'PENDING' },
];

export const CronJobs = () => {
  return (
    <div style={{ background: 'rgba(20, 21, 36, 0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <Clock size={16} color="#f59e0b" /> Scheduled Tasks & Cron
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CRON_JOBS.map(job => (
          <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {job.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{job.schedule}</span>
                <span>Last run: {job.lastRun}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {job.status === 'SUCCESS' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 12, fontWeight: 600 }}><CheckCircle size={14} /> OK</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#a78bfa', fontSize: 12, fontWeight: 600 }}><Clock3 size={14} /> Wait</div>
              )}
              
              <button style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <PlayCircle size={14} /> Trigger Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
