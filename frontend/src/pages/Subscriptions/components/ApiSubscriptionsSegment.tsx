import React, { useState, useMemo } from 'react';
import {
  Repeat,
  Store,
  Play,
  Key,
  ExternalLink,
  Trash2,
  Search,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ApiItem } from '../../../types/api';
import { useSubscription } from '../../Marketplace/useSubscription';
import { getApiCartPrice } from '../../../services/api/catalog';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import { toast } from 'react-hot-toast';

interface ApiSubscriptionsSegmentProps {
  apis: ApiItem[];
  onOpenTester?: (api: ApiItem) => void;
  onSelectApi?: (api: ApiItem) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ApiSubscriptionsSegment: React.FC<ApiSubscriptionsSegmentProps> = ({
  apis = [],
  onOpenTester,
  onSelectApi,
  onNavigateTab,
}) => {
  const { subscriptions, unsubscribe } = useSubscription();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApiToCancel, setSelectedApiToCancel] = useState<ApiItem | null>(null);

  // Match subscribed API IDs with all known API items
  const subscribedApis = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return [];

    const subSet = new Set(subscriptions);
    const seen = new Set<string>();
    const matched: ApiItem[] = [];

    // Search in passed APIs
    apis.forEach((api) => {
      if ((subSet.has(api.id) || subSet.has(api.name)) && !seen.has(api.id)) {
        seen.add(api.id);
        matched.push(api);
      }
    });

    // In case there are IDs in subscriptions that were not in apis array, create minimal item
    subscriptions.forEach((id) => {
      if (!seen.has(id)) {
        const found = apis.find((a) => a.id === id || a.name.toLowerCase() === id.toLowerCase());
        if (found) {
          seen.add(found.id);
          matched.push(found);
        }
      }
    });

    return matched;
  }, [apis, subscriptions]);

  // Filter based on search query
  const filteredSubscribedApis = useMemo(() => {
    if (!searchQuery.trim()) return subscribedApis;
    const q = searchQuery.toLowerCase();
    return subscribedApis.filter(
      (api) =>
        api.name.toLowerCase().includes(q) ||
        api.category.toLowerCase().includes(q) ||
        (api.provider && api.provider.toLowerCase().includes(q))
    );
  }, [subscribedApis, searchQuery]);

  // Compute metrics
  const totalMonthlySpend = useMemo(() => {
    return subscribedApis.reduce((sum, api) => sum + getApiCartPrice(api), 0);
  }, [subscribedApis]);

  const totalEndpointsUnlocked = useMemo(() => {
    return subscribedApis.reduce((sum, api) => sum + (api.endpointsCount || 4), 0);
  }, [subscribedApis]);

  const handleCancelConfirm = () => {
    if (!selectedApiToCancel) return;
    const apiName = selectedApiToCancel.name;
    unsubscribe(selectedApiToCancel.id);
    toast.success(`Unsubscribed from ${apiName}. Subscription cancelled.`);
    setSelectedApiToCancel(null);
  };

  // Helper for renewal date (e.g. 26 days from now)
  const getRenewalDate = (offsetDays = 26) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper for plan name
  const getPlanDetails = (api: ApiItem) => {
    const price = getApiCartPrice(api);
    if (price === 0) {
      return {
        name: 'Developer Free Tier',
        priceLabel: 'Free ($0/mo)',
        rateLimit: '60 req/min',
      };
    }
    if (price >= 40) {
      return {
        name: 'Scale & Growth Plan',
        priceLabel: `$${price.toFixed(2)}/mo`,
        rateLimit: '2,500 req/min',
      };
    }
    return {
      name: 'Starter Pro Tier',
      priceLabel: `$${price.toFixed(2)}/mo`,
      rateLimit: '600 req/min',
    };
  };

  return (
    <div className="api-subs-wrap">
      {/* Metric Cards Row */}
      <div className="api-subs-metrics-row">
        <div className="api-subs-metric-card">
          <span className="api-subs-metric-label">
            <Repeat size={14} color="var(--text-accent)" />
            <span>Active API Subscriptions</span>
          </span>
          <span className="api-subs-metric-val">{subscribedApis.length}</span>
          <span className="api-subs-metric-sub">
            {subscribedApis.length === 1 ? '1 integration connected' : `${subscribedApis.length} integrations connected`}
          </span>
        </div>

        <div className="api-subs-metric-card">
          <span className="api-subs-metric-label">
            <DollarSign size={14} color="#4ade80" />
            <span>Total Monthly API Spend</span>
          </span>
          <span className="api-subs-metric-val" style={{ color: '#4ade80' }}>
            ${totalMonthlySpend.toFixed(2)}
          </span>
          <span className="api-subs-metric-sub">Billed together in monthly cycle</span>
        </div>

        <div className="api-subs-metric-card">
          <span className="api-subs-metric-label">
            <Layers size={14} color="#60a5fa" />
            <span>Unlocked Endpoints</span>
          </span>
          <span className="api-subs-metric-val" style={{ color: '#60a5fa' }}>
            {totalEndpointsUnlocked}
          </span>
          <span className="api-subs-metric-sub">Ready for live and sandbox queries</span>
        </div>
      </div>

      {/* Filter Bar & Search */}
      {subscribedApis.length > 0 && (
        <div className="api-subs-filter-bar">
          <div className="api-subs-search-input-wrap">
            <Search size={15} className="api-subs-search-icon" />
            <input
              type="text"
              className="api-subs-search-input"
              placeholder="Filter by API name, provider, or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {onNavigateTab && (
            <button
              type="button"
              className="btn-outline-subtle"
              onClick={() => onNavigateTab('apis')}
            >
              <Store size={14} />
              <span>Browse More APIs</span>
            </button>
          )}
        </div>
      )}

      {/* Content: Empty State or Cards Grid */}
      {subscribedApis.length === 0 ? (
        <div className="api-subs-empty-card">
          <div className="api-subs-empty-icon">
            <Repeat size={26} />
          </div>
          <h3>No Active Marketplace Subscriptions</h3>
          <p>
            You have not subscribed to any Marketplace APIs yet. Explore over 50+
            production-grade APIs for AI, payments, mapping, developer tools, and communication.
          </p>
          {onNavigateTab && (
            <button
              type="button"
              className="btn-primary-gradient"
              style={{ marginTop: '8px' }}
              onClick={() => onNavigateTab('apis')}
            >
              <Store size={15} />
              <span>Explore Marketplace</span>
            </button>
          )}
        </div>
      ) : filteredSubscribedApis.length === 0 ? (
        <div className="api-subs-empty-card" style={{ padding: '36px 20px' }}>
          <Search size={24} color="var(--text-muted)" />
          <h3 style={{ fontSize: '15px' }}>No subscriptions matched "{searchQuery}"</h3>
          <p style={{ fontSize: '12.5px' }}>Try searching by a different term or clear the filter.</p>
          <button
            type="button"
            className="btn-outline-subtle"
            style={{ fontSize: '12px' }}
            onClick={() => setSearchQuery('')}
          >
            Clear Filter
          </button>
        </div>
      ) : (
        <div className="api-subs-grid">
          {filteredSubscribedApis.map((api) => {
            const planDetails = getPlanDetails(api);
            const renewalDate = getRenewalDate();

            return (
              <div key={api.id} className="api-sub-card">
                <div>
                  {/* Card Top: Logo, Name, Provider, Category */}
                  <div className="api-sub-top">
                    <div
                      className="api-sub-logo"
                      style={{ background: api.accentColor || '#8b5cf6' }}
                    >
                      {api.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="api-sub-meta">
                      <div className="api-sub-title-row">
                        <h3 className="api-sub-name" title={api.name}>
                          {api.name}
                        </h3>
                        <span className="api-sub-category-badge">{api.category}</span>
                      </div>
                      <div className="api-sub-provider">
                        <span>by {api.provider || 'Verified Partner'}</span>
                        <ShieldCheck size={13} color="#4ade80" />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="api-sub-desc">{api.description}</p>

                  {/* Plan & Pricing Box */}
                  <div className="api-sub-plan-box">
                    <div className="api-sub-plan-info">
                      <span className="api-sub-plan-name">
                        <Zap size={13} color="var(--text-accent)" />
                        <span>{planDetails.name}</span>
                      </span>
                      <span className="api-sub-renewal-info">
                        Renews {renewalDate} · {planDetails.rateLimit}
                      </span>
                    </div>
                    <div className="api-sub-price-tag">
                      {planDetails.priceLabel}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="api-sub-actions-row">
                  <div className="api-sub-main-btns">
                    {onOpenTester && (
                      <button
                        type="button"
                        className="api-sub-try-btn"
                        onClick={() => onOpenTester(api)}
                        title="Test API endpoints in Sandbox"
                      >
                        <Play size={13} />
                        <span>Test / Try</span>
                      </button>
                    )}

                    {onSelectApi && (
                      <button
                        type="button"
                        className="api-sub-details-btn"
                        onClick={() => onSelectApi(api)}
                        title="View Marketplace documentation & details"
                      >
                        <ExternalLink size={13} />
                        <span>Details</span>
                      </button>
                    )}

                    {onNavigateTab && (
                      <button
                        type="button"
                        className="api-sub-details-btn"
                        onClick={() => onNavigateTab('api-keys')}
                        title="Manage API Keys"
                      >
                        <Key size={13} />
                        <span>Keys</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="api-sub-cancel-btn"
                    title={`Cancel subscription to ${api.name}`}
                    onClick={() => setSelectedApiToCancel(api)}
                    aria-label={`Cancel ${api.name} subscription`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel API Subscription Modal */}
      {selectedApiToCancel && (
        <CancelSubscriptionModal
          title="Cancel API Subscription"
          itemTitle={selectedApiToCancel.name}
          itemSubtitle={`Provider: ${selectedApiToCancel.provider || 'Verified Partner'} · ${getPlanDetails(selectedApiToCancel).priceLabel}`}
          warningText={`Are you sure you want to cancel your subscription to ${selectedApiToCancel.name}? Your API keys for this service will be revoked, and access to all ${selectedApiToCancel.endpointsCount || 4} endpoints will end.`}
          confirmLabel="Unsubscribe from API"
          onClose={() => setSelectedApiToCancel(null)}
          onConfirm={handleCancelConfirm}
        />
      )}
    </div>
  );
};
