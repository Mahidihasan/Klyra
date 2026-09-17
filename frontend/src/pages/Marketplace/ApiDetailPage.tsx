import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  Zap,
  Shield,
  Video,
  Users,
  ExternalLink,
  Code,
  CreditCard,
  MessageSquare,
  Globe,
  BookOpen,
  ShoppingCart,
} from 'lucide-react';
import {
  CatalogApi,
  CatalogPricingPlan,
  ApiReviewsResponse,
  catalogApi,
} from '../../services/api/catalog';
import { ReviewList } from './components/ReviewList';
import { ApiOverviewSection } from './components/ApiOverviewSection';
import { ApiShowcaseSection } from './components/ApiShowcaseSection';
import { ApiPricingSection } from './components/ApiPricingSection';
import { useCart } from '../../context/CartContext';
import { ApiThumbnail } from './components/ApiThumbnail';

type DetailTab = 'overview' | 'demo' | 'pricing' | 'reviews';

interface ApiDetailPageProps {
  api: CatalogApi;
  onBack: () => void;
  onOpenProvider?: (providerId: string) => void;
  onOpenTester?: (api: CatalogApi) => void;
}

export const ApiDetailPage: React.FC<ApiDetailPageProps> = ({
  api,
  onBack,
  onOpenProvider,
  onOpenTester,
}) => {
  const { addToCart, isInCart } = useCart();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [reviewsData, setReviewsData] = useState<ApiReviewsResponse | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'reviews' && !reviewsData) {
      setReviewsLoading(true);
      catalogApi
        .getApiReviews(api.id)
        .then(setReviewsData)
        .catch(() => {})
        .finally(() => setReviewsLoading(false));
    }
  }, [activeTab, api.id]);

  const handleSubscribe = async (planId: string) => {
    setSubscribingPlan(planId);
    try {
      await catalogApi.subscribeToPlan(api.id, planId);
    } catch (e) {}
    setSubscribingPlan(null);
  };

  const handleSubmitReview = async (rating: number, title: string, content: string) => {
    try {
      await catalogApi.submitApiReview(api.id, { rating, title, content });
      const updated = await catalogApi.getApiReviews(api.id);
      setReviewsData(updated);
    } catch (e) {}
  };

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

  const pricing = getPricingBadge(api.pricingModel);

  const tabs: { key: DetailTab; label: string; icon: React.FC<any> }[] = [
    { key: 'overview', label: 'Overview', icon: BookOpen },
    { key: 'demo', label: 'Provider Video & Showcase', icon: Video },
    { key: 'pricing', label: 'Pricing', icon: CreditCard },
    { key: 'reviews', label: `Reviews (${api.totalReviews})`, icon: MessageSquare },
  ];

  return (
    <div className="adp-container">
      {/* Back & Hero Header */}
      <div className="adp-hero">
        <button className="adp-back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Marketplace
        </button>

        <div className="adp-hero-content">
          <div className="adp-hero-left">
            <div className="adp-logo-wrap">
              <ApiThumbnail api={api} className="adp-logo" />
            </div>
            <div className="adp-hero-info">
              <div className="adp-hero-badges">
                <span className={`adp-pricing-badge ${pricing.cls}`}>{pricing.label}</span>
                <span className="adp-version-badge">v{api.currentVersion}</span>
                <span className="adp-cat-badge">{api.categoryName}</span>
              </div>
              <h1 className="adp-title">{api.name}</h1>
              <p className="adp-desc">{api.description}</p>
              <button className="adp-provider-link" onClick={() => onOpenProvider?.(api.ownerId)}>
                {api.ownerAvatarUrl ? (
                  <img src={api.ownerAvatarUrl} alt="" className="adp-provider-avatar" />
                ) : (
                  <div className="adp-provider-avatar-ph">{api.ownerName.charAt(0)}</div>
                )}
                <span>{api.ownerName}</span>
                {api.ownerCompany && <span className="adp-company">· {api.ownerCompany}</span>}
              </button>
            </div>
          </div>

          <div className="adp-hero-metrics">
            <div
              className="adp-metric-card metric-rating"
              title="Community Rating & Verified Reviews"
            >
              <Star size={16} fill="#f59e0b" stroke="#f59e0b" className="adp-metric-icon star" />
              <span className="adp-metric-value">{api.rating.toFixed(1)}</span>
              <span className="adp-metric-label">{api.totalReviews} reviews</span>
            </div>
            <div
              className="adp-metric-card metric-latency"
              title="Real-Time Anycast Latency Telemetry"
            >
              <Zap size={16} className="adp-metric-icon zap" />
              <span className="adp-metric-value">{api.latencyMs}ms</span>
              <span className="adp-metric-label">Avg Latency</span>
            </div>
            <div className="adp-metric-card metric-uptime" title="Production Uptime SLA Guarantee">
              <Shield size={16} className="adp-metric-icon shield" />
              <span className="adp-metric-value">{api.uptimePercentage}%</span>
              <span className="adp-metric-label">Uptime SLA</span>
            </div>
            <div className="adp-metric-card metric-subscribers" title="Active Platform Subscribers">
              <Users size={16} className="adp-metric-icon users" />
              <span className="adp-metric-value">
                {api.totalSubscribers > 1000
                  ? `${(api.totalSubscribers / 1000).toFixed(1)}k`
                  : api.totalSubscribers}
              </span>
              <span className="adp-metric-label">Subscribers</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="adp-hero-actions">
          <button
            className="adp-action-btn"
            onClick={() =>
              addToCart({
                id: api.id,
                name: api.name,
                category: api.categoryName,
                price: api.pricingPlans?.find((plan) => plan.price > 0)?.price || 0,
                pricingModel: api.pricingModel,
                logoUrl: api.logoUrl,
                slug: api.slug,
              })
            }
            disabled={isInCart(api.id)}
          >
            <ShoppingCart size={14} /> {isInCart(api.id) ? 'In Cart' : 'Add to Cart'}
          </button>
          {onOpenTester && (
            <button className="adp-action-btn primary" onClick={() => onOpenTester(api)}>
              <Code size={14} /> Try in Tester
            </button>
          )}
          {api.docsUrl && (
            <a href={api.docsUrl} target="_blank" rel="noreferrer" className="adp-action-btn">
              <ExternalLink size={14} /> Documentation
            </a>
          )}
          <a href={api.baseUrl} target="_blank" rel="noreferrer" className="adp-action-btn">
            <Globe size={14} /> Base URL
          </a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="adp-tabs">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`adp-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="adp-tab-content">
        {activeTab === 'overview' && <ApiOverviewSection api={api} onOpenTester={onOpenTester} />}

        {activeTab === 'demo' && (
          <ApiShowcaseSection
            api={api}
            onOpenProvider={onOpenProvider}
            onOpenTester={onOpenTester}
          />
        )}

        {activeTab === 'pricing' && (
          <ApiPricingSection
            api={api}
            onSubscribe={handleSubscribe}
            subscribingPlan={subscribingPlan}
            onOpenTester={onOpenTester}
          />
        )}

        {activeTab === 'reviews' && (
          <ReviewList
            reviewsData={reviewsData}
            isLoading={reviewsLoading}
            onSubmitReview={handleSubmitReview}
            canReview={true}
          />
        )}
      </div>

      <style>{`
        .adp-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1100px;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .adp-hero {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .adp-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }

        .adp-back-btn:hover { color: var(--accent-purple); }

        .adp-hero-content {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .adp-hero-left {
          flex: 1;
          display: flex;
          gap: 16px;
          min-width: 300px;
        }

        .adp-logo-wrap {
          width: 64px;
          height: 64px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          flex-shrink: 0;
        }

        .adp-logo { width: 100%; height: 100%; object-fit: cover; }

        .adp-logo-placeholder {
          width: 100%;
          height: 100%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 800;
          color: #fff;
        }

        .adp-hero-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .adp-hero-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .adp-pricing-badge, .adp-version-badge, .adp-cat-badge {
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
        }

        .adp-pricing-badge.free { background: rgba(34,197,94,0.15); color: #22c55e; }
        .adp-pricing-badge.freemium { background: rgba(139,92,246,0.15); color: #a78bfa; }
        .adp-pricing-badge.paid { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .adp-pricing-badge.enterprise { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .adp-pricing-badge.other { background: var(--bg-pill); color: var(--text-secondary); }

        .adp-version-badge {
          background: var(--bg-pill);
          color: var(--text-muted);
        }

        .adp-cat-badge {
          background: var(--accent-subtle);
          color: var(--text-accent);
        }

        .adp-title {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .adp-desc {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .adp-provider-link {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }

        .adp-provider-link:hover { color: var(--accent-purple); }

        .adp-provider-avatar, .adp-provider-avatar-ph {
          width: 20px; height: 20px; border-radius: 50%;
        }

        .adp-provider-avatar-ph {
          background: var(--bg-pill);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: var(--text-muted);
        }

        .adp-company { color: var(--text-muted); }

        .adp-hero-metrics {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .adp-metric-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 11px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          min-width: 90px;
          position: relative;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
          cursor: default;
        }

        .adp-metric-card:hover {
          transform: translateY(-2px);
        }

        /* 1. Rating: Warm golden twinkle & amber aura pulse */
        .adp-metric-card.metric-rating {
          animation: adpRatingGlow 3.5s ease-in-out infinite;
        }
        .adp-metric-card.metric-rating .adp-metric-icon.star {
          animation: starTwinkle 3.5s ease-in-out infinite;
        }
        @keyframes adpRatingGlow {
          0%, 100% {
            border-color: var(--border-card);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          50% {
            border-color: rgba(245, 158, 11, 0.45);
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.2), inset 0 0 12px rgba(245, 158, 11, 0.05);
          }
        }
        @keyframes starTwinkle {
          0%, 100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 1px rgba(245, 158, 11, 0.4)); }
          50% { transform: scale(1.18) rotate(6deg); filter: drop-shadow(0 0 7px rgba(245, 158, 11, 0.9)); }
        }

        /* 2. Latency: Telemetry electric heartbeat flash */
        .adp-metric-card.metric-latency {
          animation: adpLatencyPulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .adp-metric-card.metric-latency .adp-metric-icon.zap {
          animation: zapHeartbeat 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes adpLatencyPulse {
          0%, 100% {
            border-color: var(--border-card);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          35% {
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.25), inset 0 0 12px rgba(59, 130, 246, 0.05);
          }
        }
        @keyframes zapHeartbeat {
          0%, 100% { transform: scale(1); color: var(--text-secondary); filter: none; }
          30% { transform: scale(1.22) translateY(-1px); color: #60a5fa; filter: drop-shadow(0 0 8px #3b82f6); }
          45% { transform: scale(1.05); color: #93c5fd; }
        }

        /* 3. Uptime SLA: Emerald radar sweep / security vigilance breathe */
        .adp-metric-card.metric-uptime {
          animation: adpUptimeSweep 4s ease-in-out infinite;
        }
        .adp-metric-card.metric-uptime .adp-metric-icon.shield {
          animation: shieldPulse 4s ease-in-out infinite;
        }
        @keyframes adpUptimeSweep {
          0%, 100% {
            border-color: var(--border-card);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          50% {
            border-color: rgba(34, 197, 94, 0.5);
            box-shadow: 0 0 16px rgba(34, 197, 94, 0.25), inset 0 0 12px rgba(34, 197, 94, 0.05);
          }
        }
        @keyframes shieldPulse {
          0%, 100% { transform: scale(1); color: var(--text-secondary); }
          50% { transform: scale(1.15); color: #22c55e; filter: drop-shadow(0 0 7px rgba(34, 197, 94, 0.8)); }
        }

        /* 4. Subscribers: Community crowd ripple and purple aura */
        .adp-metric-card.metric-subscribers {
          animation: adpSubscribersAura 3.6s ease-in-out infinite;
        }
        .adp-metric-card.metric-subscribers .adp-metric-icon.users {
          animation: usersFloatRipple 3.6s ease-in-out infinite;
        }
        @keyframes adpSubscribersAura {
          0%, 100% {
            border-color: var(--border-card);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          50% {
            border-color: rgba(139, 92, 246, 0.5);
            box-shadow: 0 0 16px rgba(139, 92, 246, 0.28), inset 0 0 12px rgba(139, 92, 246, 0.05);
          }
        }
        @keyframes usersFloatRipple {
          0%, 100% { transform: translateY(0); color: var(--text-secondary); }
          50% { transform: translateY(-2px) scale(1.12); color: #c084fc; filter: drop-shadow(0 0 7px rgba(192, 132, 252, 0.8)); }
        }

        .adp-metric-value {
          font-size: 17px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .adp-metric-label {
          font-size: 10px;
          color: var(--text-muted);
        }

        .adp-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .adp-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 500;
          border: 1px solid var(--border-card);
          background: var(--bg-card);
          color: var(--text-secondary);
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .adp-action-btn:hover {
          border-color: var(--accent-purple);
          color: var(--accent-purple);
        }

        .adp-action-btn.primary {
          background: var(--accent-gradient);
          color: #fff;
          border: none;
          font-weight: 600;
          box-shadow: var(--shadow-purple);
        }

        .adp-action-btn.primary:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        /* Tabs */
        .adp-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border-card);
          padding-bottom: 0;
          overflow-x: auto;
        }

        .adp-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .adp-tab:hover { color: var(--text-primary); }

        .adp-tab.active {
          color: var(--accent-purple);
          border-bottom-color: var(--accent-purple);
        }

        .adp-tab-content { min-height: 200px; }

        /* Overview */
        .adp-overview { display: flex; flex-direction: column; gap: 24px; }

        .adp-discovery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .adp-discovery-card, .adp-description-section, .adp-video-section, .adp-test-section { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-lg); padding: 20px; }
        .adp-discovery-card { display: flex; gap: 14px; min-height: 150px; }
        .adp-value-card { background: linear-gradient(145deg, var(--bg-card-hover), var(--bg-card)); }
        .adp-section-icon { align-items: center; background: var(--accent-subtle); border: 1px solid var(--accent-subtle-border); border-radius: var(--radius-md); color: var(--text-accent); display: flex; flex: 0 0 34px; height: 34px; justify-content: center; }
        .adp-card-kicker, .adp-plan-kicker { align-items: center; color: var(--text-accent); display: flex; font-size: 10px; font-weight: 700; gap: 5px; letter-spacing: .08em; text-transform: uppercase; }
        .adp-discovery-card h3, .adp-description-section h2, .adp-video-section h2, .adp-test-section h2 { color: var(--text-primary); font-size: 17px; line-height: 1.35; margin: 5px 0 8px; }
        .adp-discovery-card p, .adp-description-section p, .adp-video-caption { color: var(--text-secondary); font-size: 12.5px; line-height: 1.6; }
        .adp-description-section { background: var(--bg-input); }
        .adp-description-section h2 { font-size: 22px; max-width: 600px; }
        .adp-description-points { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 16px; }
        .adp-description-points span { align-items: center; color: var(--text-secondary); display: flex; font-size: 11px; gap: 6px; }
        .adp-description-points svg { color: var(--status-active); }

        .adp-demo-tab { display: flex; flex-direction: column; gap: 16px; }
        .adp-video-heading { align-items: flex-start; display: flex; justify-content: space-between; gap: 12px; }
        .adp-live-pill { align-items: center; background: var(--bg-pill); border: 1px solid var(--border-subtle); border-radius: 999px; color: var(--text-muted); display: inline-flex; font-size: 10px; gap: 6px; padding: 5px 9px; }
        .adp-live-pill span { background: var(--status-active); border-radius: 50%; height: 6px; width: 6px; }
        .adp-video-frame { aspect-ratio: 16 / 8; background: #080910; border-radius: var(--radius-md); overflow: hidden; position: relative; }
        .adp-video-frame video { height: 100%; object-fit: cover; width: 100%; }
        .adp-video-overlay { align-items: center; background: rgba(8, 9, 16, .72); border: 1px solid rgba(255,255,255,.12); border-radius: 999px; bottom: 16px; color: #fff; display: flex; font-size: 11px; gap: 7px; left: 16px; padding: 7px 10px; position: absolute; pointer-events: none; }
        .adp-video-caption { margin-top: 10px; }
        .adp-test-section { background: linear-gradient(145deg, var(--bg-card), var(--bg-input)); }
        .adp-test-icon { color: var(--text-accent); }
        .adp-test-configs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
        .adp-test-config { background: var(--bg-input); border: 1px solid var(--border-card); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; display: flex; flex-direction: column; gap: 4px; padding: 11px; text-align: left; transition: border-color .18s ease, background .18s ease; }
        .adp-test-config span { color: var(--text-primary); font-size: 12px; font-weight: 600; }
        .adp-test-config small { color: var(--text-muted); font-size: 10px; }
        .adp-test-config:hover, .adp-test-config.active { background: var(--accent-subtle); border-color: var(--accent-purple); }
        .adp-test-launch { align-items: center; border-top: 1px solid var(--border-subtle); color: var(--text-muted); display: flex; font-size: 11px; justify-content: space-between; margin-top: 14px; padding-top: 14px; }
        .adp-test-launch b { color: var(--text-primary); }
        .adp-sandbox-label { background: var(--bg-pill); border-radius: 999px; padding: 6px 9px; }

        .adp-pricing { display: flex; flex-direction: column; gap: 18px; }
        .adp-pricing-intro { align-items: flex-start; display: flex; justify-content: space-between; gap: 16px; }
        .adp-pricing-intro h2 { color: var(--text-primary); font-size: 22px; margin: 5px 0 6px; }
        .adp-pricing-intro p { color: var(--text-secondary); font-size: 12.5px; line-height: 1.5; max-width: 650px; }
        .adp-paygo-card { border-color: rgba(139,92,246,.35); }
        .adp-enterprise-card { border-color: rgba(59,130,246,.3); }
        .adp-enterprise-matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin: 6px 0; }
        .adp-enterprise-matrix span { color: var(--text-muted); }
        .adp-enterprise-matrix b { color: var(--text-primary); text-align: right; }
        .adp-secondary-action { background: var(--bg-pill); border: 1px solid var(--border-card); color: var(--text-primary); }
        .adp-calculator { align-items: center; background: var(--bg-input); border: 1px solid var(--border-card); border-radius: var(--radius-lg); display: grid; gap: 24px; grid-template-columns: 1fr 1fr; padding: 20px; }
        .adp-calculator-copy h3 { color: var(--text-primary); font-size: 16px; margin: 5px 0 6px; }
        .adp-calculator-copy p { color: var(--text-secondary); font-size: 11.5px; line-height: 1.5; }
        .adp-calculator-control input[type='range'] { accent-color: var(--accent-purple); width: 100%; }
        .adp-calculator-value { align-items: baseline; display: flex; gap: 6px; margin-bottom: 8px; }
        .adp-calculator-value b { color: var(--text-primary); font-size: 22px; }
        .adp-calculator-value span { color: var(--text-muted); font-size: 11px; }
        .adp-calculator-bottom { align-items: center; display: flex; gap: 8px; justify-content: space-between; margin-top: 8px; }
        .adp-calculator-bottom input { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 11px; padding: 7px 8px; width: 110px; }
        .adp-calculator-bottom strong { color: var(--text-accent); font-size: 12px; }

        .adp-tags-section h3,
        .adp-snippets-section h3 {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .adp-tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .adp-tag {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--bg-pill);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }

        .adp-snippet {
          margin-bottom: 16px;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .adp-snippet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .adp-copy-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 11px;
          cursor: pointer;
        }

        .adp-copy-btn:hover { color: var(--accent-purple); }

        .adp-snippet-code {
          padding: 14px;
          background: var(--bg-input);
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
          overflow-x: auto;
          margin: 0;
          line-height: 1.6;
        }

        /* Endpoints */
        .adp-endpoints {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .adp-endpoint-card {
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .adp-ep-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .adp-method-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .method-get { background: rgba(34,197,94,0.15); color: #22c55e; }
        .method-post { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .method-put { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .method-delete { background: rgba(239,68,68,0.15); color: #ef4444; }
        .method-patch { background: rgba(168,85,247,0.15); color: #a855f7; }

        .adp-ep-path {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .adp-ep-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
        }

        .adp-ep-params h4,
        .adp-ep-sample h4 {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .adp-params-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .adp-params-table th {
          text-align: left;
          padding: 6px 10px;
          background: var(--bg-pill);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 11px;
        }

        .adp-params-table td {
          padding: 6px 10px;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }

        .adp-params-table code {
          background: var(--bg-pill);
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 11px;
          color: var(--text-accent);
        }

        /* Pricing */
        .adp-plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }

        .adp-plan-card {
          padding: 24px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s ease;
        }

        .adp-plan-card:hover {
          border-color: rgba(139,92,246,0.3);
        }

        .adp-plan-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .adp-plan-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .adp-plan-amount {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .adp-plan-interval {
          font-size: 13px;
          color: var(--text-muted);
        }

        .adp-plan-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
        }

        .adp-plan-features {
          list-style: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .adp-plan-features li {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--text-secondary);
        }

        .adp-plan-subscribe-btn {
          width: 100%;
          padding: 10px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .adp-plan-subscribe-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        .adp-plan-subscribe-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .adp-no-data {
          text-align: center;
          padding: 40px;
          color: var(--text-muted);
          font-size: 13px;
        }

        @media (max-width: 760px) {
          .adp-discovery-grid, .adp-calculator { grid-template-columns: 1fr; }
          .adp-test-configs { grid-template-columns: 1fr; }
          .adp-pricing-intro { flex-direction: column; }
          .adp-hero-metrics { gap: 8px; }
          .adp-metric-card { flex: 1 1 calc(50% - 8px); min-width: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .adp-metric-card { animation: none; }
        }
      `}</style>
    </div>
  );
};
