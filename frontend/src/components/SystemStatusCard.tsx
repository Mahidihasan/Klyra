import React from 'react';
import { ExternalLink } from 'lucide-react';

export const SystemStatusCard: React.FC = () => {
  return (
    <div className="status-widget card-base">
      <h3 className="status-title">System Status</h3>

      <div className="status-main-row">
        <span className="status-glowing-dot" />
        <div className="status-info">
          <div className="status-state">All Systems Operational</div>
          <div className="status-uptime">99.9% uptime</div>
        </div>
      </div>

      <a 
        href="#status" 
        onClick={(e) => { e.preventDefault(); alert('Redirecting to status.apimarketplace.io dashboard'); }}
        className="status-link"
      >
        <span>View Status Page</span>
        <ExternalLink size={13} />
      </a>

      <style>{`
        .status-widget {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .status-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .status-main-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-glowing-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #22c55e;
          box-shadow: 0 0 10px #22c55e;
          flex-shrink: 0;
        }

        .status-info {
          display: flex;
          flex-direction: column;
        }

        .status-state {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .status-uptime {
          font-size: 11px;
          color: var(--text-muted);
        }

        .status-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-accent);
          font-weight: 500;
          transition: color 0.2s;
          margin-top: 2px;
        }

        .status-link:hover {
          color: #c4b5fd;
        }
      `}</style>
    </div>
  );
};
