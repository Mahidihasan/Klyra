import React from 'react';
import { Star, Eye, Tag, TrendingUp } from 'lucide-react';
import { ApiItem } from '../types/api';

interface TrendingApiCardProps {
  api: ApiItem;
  onSelectApi: (api: ApiItem) => void;
}

export const TrendingApiCard: React.FC<TrendingApiCardProps> = ({ api, onSelectApi }) => {
  
  // Render logo graphic based on icon string
  const renderIcon = () => {
    switch (api.icon) {
      case 'openai':
        return (
          <div className="icon-box" style={{ background: '#10a37f' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
        );
      case 'weather':
        return (
          <div className="icon-box" style={{ background: '#f59e0b' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </div>
        );
      case 'stripe':
        return (
          <div className="icon-box" style={{ background: '#6366f1' }}>
            <span style={{ color: '#fff', fontWeight: '800', fontSize: '18px' }}>S</span>
          </div>
        );
      case 'github':
        return (
          <div className="icon-box" style={{ background: '#24292e' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className="icon-box" style={{ background: api.accentColor }}>
            <span style={{ color: '#fff', fontWeight: '700' }}>{api.name.substring(0, 2)}</span>
          </div>
        );
    }
  };

  return (
    <div className="trending-card card-base" onClick={() => onSelectApi(api)}>
      {/* Top Header */}
      <div className="card-top">
        {renderIcon()}
        <div className="card-title-group">
          <div className="card-name-row">
            <h3 className="card-name">{api.name}</h3>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="card-desc">{api.description}</p>

      {/* Footer Metrics */}
      <div className="card-footer">
        <div className="metric-item">
          <Star size={13} fill="#f59e0b" color="#f59e0b" />
          <span>{api.rating}</span>
        </div>
        <div className="metric-item">
          <Eye size={13} color="#94a3b8" />
          <span>{api.requestCount}</span>
        </div>
        <div className="metric-item category-tag">
          <Tag size={12} color="#8b5cf6" />
          <span>{api.category}</span>
        </div>
      </div>

      <style>{`
        .trending-card {
          width: 100%;
          min-width: 0;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background-color: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 14px;
          transition: all 0.2s ease;
        }

        .trending-card:hover {
          border-color: rgba(139, 92, 246, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(124, 58, 237, 0.15);
        }

        .card-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .icon-box {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .card-title-group {
          flex: 1;
          min-width: 0;
        }

        .card-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .card-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-desc {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 31px;
        }

        .card-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 10px;
          margin-top: auto;
        }

        .metric-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;

        }

        .category-tag {
          margin-left: auto;
          font-size: 10px;
          color: var(--text-accent);
          background: rgba(139, 92, 246, 0.1);
          padding: 2px 6px;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
