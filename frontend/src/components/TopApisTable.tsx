import React, { useState } from 'react';
import { Star, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ApiItem } from '../types/api';

interface TopApisTableProps {
  apis: ApiItem[];
  onSelectApi: (api: ApiItem) => void;
}

export const TopApisTable: React.FC<TopApisTableProps> = ({ apis, onSelectApi }) => {
  const [showAll, setShowAll] = useState(false);

  const displayedApis = showAll ? apis : apis.slice(0, 5);

  const renderLogo = (api: ApiItem) => {
    switch (api.icon) {
      case 'twilio':
        return (
          <div className="table-logo" style={{ background: '#f22f46' }}>
            <span style={{ color: '#fff', fontWeight: '800', fontSize: '13px' }}>T</span>
          </div>
        );
      case 'sendgrid':
        return (
          <div className="table-logo" style={{ background: '#1a82e2' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        );
      case 'coingecko':
        return (
          <div className="table-logo" style={{ background: '#8dc63f' }}>
            <span style={{ color: '#fff', fontWeight: '800', fontSize: '12px' }}>🦎</span>
          </div>
        );
      case 'newsapi':
        return (
          <div className="table-logo" style={{ background: '#e11d48' }}>
            <span style={{ color: '#fff', fontWeight: '800', fontSize: '13px' }}>N</span>
          </div>
        );
      case 'ipgeo':
        return (
          <div className="table-logo" style={{ background: '#3b82f6' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className="table-logo" style={{ background: api.accentColor || '#7c3aed' }}>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '12px' }}>{api.name.substring(0, 2)}</span>
          </div>
        );
    }
  };

  return (
    <div className="top-apis-container card-base">
      {/* Table Title Header */}
      <div className="table-header-row">
        <div>
          <h2 className="table-title">Top APIs</h2>
          <p className="table-subtitle">Highest rated APIs by developers</p>
        </div>
        <button 
          className="view-all-btn"
          onClick={() => setShowAll(!showAll)}
        >
          <span>{showAll ? 'Show top 5' : 'View all'}</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Table Wrapper */}
      <div className="table-responsive">
        <table className="apis-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>API</th>
              <th>Category</th>
              <th>Rating</th>
              <th>Requests</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedApis.map((api, index) => (
              <tr 
                key={api.id}
                onClick={() => onSelectApi(api)}
                className="table-row-interactive"
              >
                <td className="row-rank">{index + 1}</td>
                <td>
                  <div className="api-cell">
                    {renderLogo(api)}
                    <div className="api-info">
                      <div className="api-name">{api.name}</div>
                      <div className="api-desc">{api.description}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge-category">{api.category}</span>
                </td>
                <td>
                  <div className="rating-cell">
                    <Star size={14} fill="#f59e0b" color="#f59e0b" />
                    <span>{api.rating}</span>
                  </div>
                </td>
                <td className="request-count">{api.requestCount}</td>
                <td>
                  <div className="status-indicator">
                    <span className="status-dot" />
                    <span>{api.status}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .top-apis-container {
          width: 100%;
          background-color: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 20px 24px;
        }

        .table-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .table-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .table-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .view-all-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-accent);
          font-weight: 500;
          transition: color 0.2s;
        }

        .view-all-btn:hover {
          color: #c4b5fd;
        }

        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        .apis-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .apis-table th {
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border-subtle);
        }

        .apis-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-subtle);
          font-size: 13px;
          vertical-align: middle;
        }

        .table-row-interactive {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .table-row-interactive:hover {
          background-color: var(--bg-card-hover);
        }

        .table-row-interactive:last-child td {
          border-bottom: none;
        }

        .row-rank {
          font-weight: 600;
          color: var(--text-muted);
        }

        .api-cell {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .table-logo {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .api-info {
          display: flex;
          flex-direction: column;
        }

        .api-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .api-desc {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .rating-cell {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .request-count {
          font-weight: 500;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};
