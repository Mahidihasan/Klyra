import React from 'react';
import { Star, Zap, Shield, Activity, ArrowRight, Clock, Users, ShoppingCart, Check } from 'lucide-react';
import { CatalogApi, getApiCartPrice } from '../../../services/api/catalog';
import { useCart } from '../../../context/CartContext';
import { ApiThumbnail } from './ApiThumbnail';

interface ApiListViewProps {
  apis: CatalogApi[];
  onSelectApi: (api: CatalogApi) => void;
  onOpenProvider?: (providerId: string) => void;
  isLoading?: boolean;
}

export const ApiListView: React.FC<ApiListViewProps> = ({
  apis,
  onSelectApi,
  onOpenProvider,
  isLoading,
}) => {
  const { addToCart, isInCart } = useCart();
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

  const formatNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1000)}k`;
    return String(n);
  };

  if (isLoading) {
    return (
      <div className="alv-container">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="alv-row alv-skeleton">
            <div className="alv-skel-logo" />
            <div className="alv-skel-body">
              <div className="alv-skel-line w50" />
              <div className="alv-skel-line w80" />
            </div>
            <div className="alv-skel-metrics" />
          </div>
        ))}
      </div>
    );
  }

  if (apis.length === 0) {
    return (
      <div className="alv-empty">
        <div className="alv-empty-icon">📋</div>
        <h3>No APIs match your criteria</h3>
        <p>Try broadening your search or adjusting filters.</p>
      </div>
    );
  }

  return (
    <div className="alv-container">
      {/* Table Header */}
      <div className="alv-header-row">
        <span className="alv-col alv-col-api">API</span>
        <span className="alv-col alv-col-cat">Category</span>
        <span className="alv-col alv-col-rating">Rating</span>
        <span className="alv-col alv-col-latency">Response</span>
        <span className="alv-col alv-col-uptime">Uptime</span>
        <span className="alv-col alv-col-requests">Traffic</span>
        <span className="alv-col alv-col-pricing">Pricing</span>
        <span className="alv-col alv-col-action"></span>
      </div>

      {apis.map((api) => {
        const pricing = getPricingBadge(api.pricingModel);
        return (
          <div key={api.id} className="alv-row" onClick={() => onSelectApi(api)}>
            {/* API Info */}
            <div className="alv-col alv-col-api">
              <div className="alv-logo-wrap">
                <ApiThumbnail api={api} className="alv-logo" />
              </div>
              <div className="alv-api-info">
                <span className="alv-api-name">{api.name}</span>
                <span className="alv-api-provider">
                  by{' '}
                  <button
                    className="alv-provider-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProvider?.(api.ownerId);
                    }}
                  >
                    {api.ownerName}
                  </button>
                </span>
              </div>
            </div>

            {/* Category */}
            <span className="alv-col alv-col-cat">
              <span className="alv-cat-pill">{api.categoryName}</span>
            </span>

            {/* Rating */}
            <span className="alv-col alv-col-rating">
              <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
              <span>{api.rating.toFixed(1)}</span>
              <span className="alv-review-count">({api.totalReviews})</span>
            </span>

            {/* Latency */}
            <span className="alv-col alv-col-latency">
              <Zap size={12} />
              {api.latencyMs}ms
            </span>

            {/* Uptime */}
            <span className="alv-col alv-col-uptime">
              <Shield size={12} />
              {api.uptimePercentage}%
            </span>

            {/* Requests */}
            <span className="alv-col alv-col-requests">{formatNumber(api.totalRequests)}</span>

            {/* Pricing */}
            <span className="alv-col alv-col-pricing">
              <span className={`alv-pricing-badge ${pricing.cls}`}>{pricing.label}</span>
            </span>

            <span className="alv-col alv-col-cart">
              <button
                className={`alv-cart-btn ${isInCart(api.id) ? 'in-cart' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  addToCart({
                    id: api.id,
                    name: api.name,
                    category: api.categoryName,
                    price: getApiCartPrice(api),
                    pricingModel: api.pricingModel,
                    logoUrl: api.logoUrl,
                    slug: api.slug,
                  });
                }}
                disabled={isInCart(api.id)}
                title={isInCart(api.id) ? 'Already in cart' : `Add ${api.name} to cart ($${getApiCartPrice(api)}/mo)`}
              >
                {isInCart(api.id) ? (
                  <>
                    <Check size={11} className="alv-cart-icon" />
                    <span>In Cart</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={11} className="alv-cart-icon" />
                    <span>Add</span>
                  </>
                )}
              </button>
            </span>

            {/* Action */}
            <span className="alv-col alv-col-action">
              <ArrowRight size={14} />
            </span>
          </div>
        );
      })}

      <style>{`
        .alv-container {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
          animation: fadeInList 0.3s ease;
        }

        @keyframes fadeInList {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .alv-header-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-card);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .alv-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 20px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .alv-row:last-child { border-bottom: none; }

        .alv-row:hover {
          background: var(--bg-card-hover);
        }

        .alv-col { display: flex; align-items: center; gap: 4px; }
        .alv-col-api { flex: 2; min-width: 200px; }
        .alv-col-cat { flex: 1; min-width: 100px; }
        .alv-col-rating { flex: 0.8; min-width: 80px; }
        .alv-col-latency { flex: 0.7; min-width: 70px; font-size: 12px; color: var(--text-secondary); }
        .alv-col-uptime { flex: 0.7; min-width: 70px; font-size: 12px; color: var(--text-secondary); }
        .alv-col-requests { flex: 0.7; min-width: 70px; font-size: 12px; color: var(--text-secondary); }
        .alv-col-pricing { flex: 0.8; min-width: 80px; }
        .alv-col-action { flex: 0; min-width: 28px; color: var(--text-muted); }
        .alv-col-cart { flex: 0; min-width: 58px; }

        @media (max-width: 900px) {
          .alv-header-row { display: none; }
          .alv-row { flex-wrap: wrap; }
          .alv-col-cat,
          .alv-col-uptime,
          .alv-col-requests { display: none; }
        }

        .alv-logo-wrap {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
        }

        .alv-logo { width: 100%; height: 100%; object-fit: cover; }

        .alv-logo-placeholder {
          width: 100%;
          height: 100%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
          color: #fff;
        }

        .alv-api-info {
          display: flex;
          flex-direction: column;
          margin-left: 10px;
          min-width: 0;
        }

        .alv-api-name {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .alv-api-provider {
          font-size: 11px;
          color: var(--text-muted);
        }

        .alv-provider-btn {
          background: none;
          border: none;
          padding: 0;
          color: var(--text-accent);
          cursor: pointer;
          font-size: 11px;
        }

        .alv-provider-btn:hover { text-decoration: underline; }

        .alv-cat-pill {
          font-size: 10.5px;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--bg-pill);
          color: var(--text-muted);
        }

        .alv-col-rating {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .alv-review-count {
          font-size: 10.5px;
          color: var(--text-muted);
          font-weight: 400;
        }

        .alv-pricing-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .alv-pricing-badge.free { background: rgba(34,197,94,0.15); color: #22c55e; }
        .alv-pricing-badge.freemium { background: rgba(139,92,246,0.15); color: #a78bfa; }
        .alv-pricing-badge.paid { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .alv-pricing-badge.enterprise { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .alv-pricing-badge.other { background: var(--bg-pill); color: var(--text-secondary); }
        .alv-cart-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.16) 0%, rgba(99, 102, 241, 0.22) 100%);
          border: 1px solid rgba(139, 92, 246, 0.42);
          border-radius: var(--radius-sm);
          color: #c4b5fd;
          font-size: 10px;
          font-weight: 600;
          padding: 5px 9px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 6px rgba(139, 92, 246, 0.12);
        }
        .alv-cart-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(99, 102, 241, 0.45) 100%);
          border-color: rgba(167, 139, 250, 0.85);
          color: #ffffff;
          transform: translateY(-1px);
        }
        .alv-cart-btn.in-cart, .alv-cart-btn:disabled {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.4);
          color: #4ade80;
          cursor: default;
          box-shadow: none;
          opacity: 1;
        }
        .alv-cart-icon { flex-shrink: 0; }

        /* Skeleton */
        .alv-skeleton { pointer-events: none; }
        .alv-skel-logo {
          width: 36px; height: 36px; border-radius: var(--radius-md);
          background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
        }
        .alv-skel-body { flex: 1; display: flex; flex-direction: column; gap: 6px; margin-left: 10px; }
        .alv-skel-line {
          height: 10px; border-radius: 5px;
          background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
        }
        .alv-skel-line.w50 { width: 50%; }
        .alv-skel-line.w80 { width: 80%; }
        .alv-skel-metrics {
          width: 200px; height: 20px; border-radius: 6px;
          background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
        }

        .alv-empty {
          text-align: center; padding: 60px 24px; color: var(--text-muted);
        }
        .alv-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .alv-empty h3 { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
        .alv-empty p { font-size: 13px; }
      `}</style>
    </div>
  );
};
