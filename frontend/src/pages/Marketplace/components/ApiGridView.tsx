import React from 'react';
import { Star, Zap, Clock, Users, ArrowRight, Shield, Activity } from 'lucide-react';
import { CatalogApi } from '../../../services/api/catalog';
import { useCart } from '../../../context/CartContext';
import { ApiThumbnail } from './ApiThumbnail';

interface ApiGridViewProps {
  apis: CatalogApi[];
  onSelectApi: (api: CatalogApi) => void;
  onOpenProvider?: (providerId: string) => void;
  isLoading?: boolean;
}

export const ApiGridView: React.FC<ApiGridViewProps> = ({
  apis,
  onSelectApi,
  onOpenProvider,
  isLoading,
}) => {
  const { addToCart, isInCart } = useCart();
  if (isLoading) {
    return (
      <div className="agv-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="agv-card agv-skeleton">
            <div className="agv-skel-header" />
            <div className="agv-skel-line w60" />
            <div className="agv-skel-line w80" />
            <div className="agv-skel-line w40" />
            <div className="agv-skel-metrics" />
          </div>
        ))}
      </div>
    );
  }

  if (apis.length === 0) {
    return (
      <div className="agv-empty">
        <div className="agv-empty-icon">🔍</div>
        <h3>No APIs found</h3>
        <p>Try adjusting your filters or search query to discover more APIs.</p>
      </div>
    );
  }

  const getPricingBadge = (model: string) => {
    switch (model) {
      case 'FREE':
        return { label: 'Free', cls: 'free' };
      case 'FREEMIUM':
        return { label: 'Freemium', cls: 'freemium' };
      case 'PAID':
        return { label: 'Paid', cls: 'paid' };
      case 'ENTERPRISE':
        return { label: 'Enterprise', cls: 'enterprise' };
      default:
        return { label: model || 'Other', cls: 'other' };
    }
  };

  return (
    <div className="agv-grid">
      {apis.map((api) => {
        const pricing = getPricingBadge(api.pricingModel);
        return (
          <div key={api.id} className="agv-card" onClick={() => onSelectApi(api)}>
            {/* Card header */}
            <div className="agv-card-header">
              <div className="agv-logo-wrap">
                <ApiThumbnail api={api} className="agv-logo" />
              </div>
              <div className="agv-card-meta">
                <span className={`agv-pricing-badge ${pricing.cls}`}>{pricing.label}</span>
                <span className="agv-version">v{api.currentVersion}</span>
              </div>
            </div>

            {/* Card body */}
            <div className="agv-card-body">
              <div className="agv-identity-row">
                <h3 className="agv-api-name">{api.name}</h3>
                <span className="agv-category">{api.categoryName}</span>
              </div>
              <p className="agv-api-desc">{api.description}</p>

              <button
                className="agv-provider-link"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProvider?.(api.ownerId);
                }}
              >
                {api.ownerAvatarUrl ? (
                  <img src={api.ownerAvatarUrl} alt="" className="agv-provider-avatar" />
                ) : (
                  <div className="agv-provider-avatar-placeholder">{api.ownerName.charAt(0)}</div>
                )}
                <span>{api.ownerName}</span>
                {api.ownerCompany && <span className="agv-company">· {api.ownerCompany}</span>}
              </button>

              {/* Tags */}
              {api.tags.length > 0 && (
                <div className="agv-tags">
                  {api.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="agv-tag">
                      {tag}
                    </span>
                  ))}
                  {api.tags.length > 3 && (
                    <span className="agv-tag agv-tag-more">+{api.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            {/* Card metrics */}
            <div className="agv-card-footer">
              <div className="agv-metrics">
                <span className="agv-metric" title="Rating">
                  <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                  {api.rating.toFixed(1)} <small>({api.totalReviews})</small>
                </span>
                <span className="agv-metric" title="Latency">
                  <Zap size={12} />
                  {api.latencyMs}ms
                </span>
                <span className="agv-metric" title="Uptime">
                  <Shield size={12} />
                  {api.uptimePercentage}%
                </span>
                <span className="agv-metric" title="Endpoints">
                  <Activity size={12} />
                  {api.endpointsCount}
                </span>
                <span className="agv-metric agv-request-metric" title="Total requests">
                  <Users size={12} />
                  {api.totalRequests >= 1000000
                    ? `${(api.totalRequests / 1000000).toFixed(1)}M`
                    : `${Math.round(api.totalRequests / 1000)}k`}
                </span>
              </div>
              <div className="agv-card-actions">
                <button
                  className="agv-cart-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    addToCart({
                      id: api.id,
                      name: api.name,
                      category: api.categoryName,
                      price: api.pricingPlans?.find((plan) => plan.price > 0)?.price || 0,
                      pricingModel: api.pricingModel,
                      logoUrl: api.logoUrl,
                      slug: api.slug,
                    });
                  }}
                  disabled={isInCart(api.id)}
                >
                  {isInCart(api.id) ? 'In cart' : 'Add to Cart'}
                </button>
                <button className="agv-explore-btn">
                  Explore <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Hover glow */}
            <div className="agv-glow" />
          </div>
        );
      })}

      <style>{`
        .agv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          animation: fadeInGrid 0.3s ease;
        }

        @keyframes fadeInGrid {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .agv-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }

        .agv-card:hover {
          border-color: rgba(139, 92, 246, 0.35);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(124, 58, 237, 0.15);
          background: linear-gradient(145deg, var(--bg-card-hover), var(--bg-card));
        }

        .agv-card::before {
          background: radial-gradient(circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(167, 139, 250, 0.14), transparent 34%);
          content: '';
          inset: 0;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          transition: opacity 0.25s ease;
        }

        .agv-card:hover::before { opacity: 1; }

        .agv-card:focus-within { border-color: var(--accent-purple); }

        .agv-glow {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at center, rgba(139, 92, 246, 0.04) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .agv-card:hover .agv-glow { opacity: 1; }

        .agv-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .agv-logo-wrap {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
        }

        .agv-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .agv-logo-placeholder {
          width: 100%;
          height: 100%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }

        .agv-card-meta {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .agv-pricing-badge {
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .agv-pricing-badge.free {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }
        .agv-pricing-badge.freemium {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
        }
        .agv-pricing-badge.paid {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }
        .agv-pricing-badge.enterprise {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }
        .agv-pricing-badge.other {
          background: var(--bg-pill);
          color: var(--text-secondary);
        }

        .agv-version {
          font-size: 10.5px;
          color: var(--text-muted);
          background: var(--bg-pill);
          padding: 2px 6px;
          border-radius: 999px;
        }

        .agv-card-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .agv-api-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .agv-identity-row {
          align-items: flex-start;
          display: flex;
          gap: 8px;
          justify-content: space-between;
        }

        .agv-category {
          background: var(--bg-pill);
          border-radius: 999px;
          color: var(--text-muted);
          flex-shrink: 0;
          font-size: 10px;
          padding: 3px 7px;
        }

        .agv-api-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .agv-provider-link {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 11.5px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }

        .agv-provider-link:hover { color: var(--accent-purple); }

        .agv-provider-avatar,
        .agv-provider-avatar-placeholder {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .agv-provider-avatar-placeholder {
          background: var(--bg-pill);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .agv-company { color: var(--text-muted); }

        .agv-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 2px;
        }

        .agv-tag {
          font-size: 10px;
          padding: 2px 7px;
          border-radius: 999px;
          background: var(--bg-pill);
          color: var(--text-muted);
          border: 1px solid var(--border-subtle);
        }

        .agv-tag-more {
          color: var(--accent-purple);
          font-weight: 600;
        }

        .agv-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid var(--border-subtle);
          gap: 8px;
        }

        .agv-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .agv-metric {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: var(--text-muted);
        }

        .agv-metric small {
          color: var(--text-muted);
          font-size: 10px;
        }

        .agv-request-metric { color: var(--text-muted); }

        .agv-explore-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 11.5px;
          font-weight: 500;
          padding: 4px 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .agv-card-actions { align-items: center; display: flex; gap: 6px; }
        .agv-cart-btn { background: var(--accent-subtle); border: 1px solid var(--accent-subtle-border); border-radius: var(--radius-md); color: var(--text-accent); font-size: 11px; font-weight: 600; padding: 5px 8px; white-space: nowrap; }
        .agv-cart-btn:disabled { cursor: default; opacity: .6; }

        .agv-explore-btn:hover {
          border-color: var(--accent-purple);
          color: var(--accent-purple);
          background: var(--accent-subtle);
        }

        /* Skeleton */
        .agv-skeleton {
          pointer-events: none;
        }

        .agv-skel-header {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: var(--bg-card-hover);
          animation: shimmer 1.5s infinite;
        }

        .agv-skel-line {
          height: 12px;
          border-radius: 6px;
          background: var(--bg-card-hover);
          animation: shimmer 1.5s infinite;
        }
        .agv-skel-line.w60 { width: 60%; }
        .agv-skel-line.w80 { width: 80%; }
        .agv-skel-line.w40 { width: 40%; }

        .agv-skel-metrics {
          height: 32px;
          border-radius: var(--radius-md);
          background: var(--bg-card-hover);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }

        .agv-empty {
          text-align: center;
          padding: 60px 24px;
          color: var(--text-muted);
        }

        .agv-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .agv-empty h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .agv-empty p {
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};
