import React from 'react';
import { 
  Layers, 
  Terminal, 
  Clock, 
  Sliders, 
  Server, 
  CreditCard, 
  Check, 
  Plus, 
  Trash2, 
  ExternalLink,
  Shield,
  Key,
  Cpu
} from 'lucide-react';
import { CollectionItem, ApiItem, NavigationTab } from '../types/api';

interface TabViewsProps {
  activeTab: NavigationTab;
  collections: CollectionItem[];
  apis: ApiItem[];
  onOpenCreateCollection: () => void;
  onOpenTester: (api?: ApiItem) => void;
  onSelectApi: (api: ApiItem) => void;
}

export const TabViews: React.FC<TabViewsProps> = ({
  activeTab,
  collections,
  apis,
  onOpenCreateCollection,
  onOpenTester,
  onSelectApi
}) => {

  if (activeTab === 'collections') {
    return (
      <div className="tab-view-container animate-fade-in">
        <div className="tab-header-row">
          <div>
            <h1 className="tab-view-title">API Collections</h1>
            <p className="tab-view-sub">Organize, manage, and share curated groups of APIs.</p>
          </div>
          <button className="new-col-btn" onClick={onOpenCreateCollection}>
            <Plus size={16} />
            <span>New Collection</span>
          </button>
        </div>

        <div className="collections-grid">
          {collections.map(col => (
            <div key={col.id} className="collection-card card-base">
              <div className="col-card-top">
                <div className="col-icon-box" style={{ backgroundColor: `${col.color}22` }}>
                  <Layers size={22} color={col.color} />
                </div>
                <span className="col-count-badge">{col.apiCount} APIs</span>
              </div>
              <h3 className="col-card-name">{col.name}</h3>
              <p className="col-card-desc">{col.description}</p>
              <div className="col-card-footer">
                <button className="col-action-btn" onClick={() => onOpenTester()}>Test Collection</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // API catalog pages (APIs, My APIs, Subscriptions, Playground)
  if (activeTab === 'apis' || activeTab === 'my-apis' || activeTab === 'subscriptions' || activeTab === 'playground') {
    const titleMap: Record<string, string> = {
      'apis': 'All Developer APIs',
      'my-apis': 'My Published APIs',
      'subscriptions': 'Subscribed APIs',
      'playground': 'API Playground'
    };
    return (
      <div className="tab-view-container animate-fade-in">
        <div className="tab-header-row">
          <div>
            <h1 className="tab-view-title">{titleMap[activeTab]}</h1>
            <p className="tab-view-sub">Explore production-grade APIs filtered for your development needs.</p>
          </div>
        </div>

        <div className="apis-grid">
          {apis.map(api => (
            <div key={api.id} className="api-catalog-card card-base" onClick={() => onSelectApi(api)}>
              <div className="catalog-top">
                <div className="catalog-logo" style={{ background: api.accentColor }}>
                  <span style={{ color: '#fff', fontWeight: 800 }}>{api.name.substring(0, 2)}</span>
                </div>
                <div>
                  <h3 className="catalog-name">{api.name}</h3>
                  <span className="badge-category">{api.category}</span>
                </div>
              </div>
              <p className="catalog-desc">{api.description}</p>
              <div className="catalog-footer">
                <span className="rating-val">★ {api.rating}</span>
                <span className="request-val">{api.requestCount} requests</span>
                <button className="try-btn" onClick={(e) => { e.stopPropagation(); onOpenTester(api); }}>Try</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // History page
  if (activeTab === 'history') {
    return (
      <div className="tab-view-container animate-fade-in">
        <h1 className="tab-view-title">Request History</h1>
        <p className="tab-view-sub">Log of all recent test executions and mock API hits.</p>

        <div className="history-list card-base" style={{ marginTop: '20px' }}>
          {[
            { method: 'POST', path: 'https://api.openai.com/v1/chat/completions', status: 200, time: '2 mins ago', duration: '142ms' },
            { method: 'GET', path: 'https://api.weatherapi.com/v1/current.json?q=London', status: 200, time: '18 mins ago', duration: '85ms' },
            { method: 'POST', path: 'https://api.stripe.com/v1/payment_intents', status: 200, time: '1 hour ago', duration: '110ms' },
            { method: 'GET', path: 'https://api.coingecko.com/api/v3/simple/price', status: 200, time: '3 hours ago', duration: '75ms' },
          ].map((h, idx) => (
            <div key={idx} className="history-row">
              <span className={`method-badge method-${h.method}`}>{h.method}</span>
              <code className="history-path">{h.path}</code>
              <span className="status-200">{h.status} OK</span>
              <span className="history-time">{h.time} ({h.duration})</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Environments and API Keys
  if (activeTab === 'environments' || activeTab === 'api-keys') {
    return (
      <div className="tab-view-container animate-fade-in">
        <h1 className="tab-view-title" style={{ textTransform: 'capitalize' }}>{activeTab === 'api-keys' ? 'API Keys' : 'Environments'}</h1>
        <p className="tab-view-sub">
          {activeTab === 'api-keys'
            ? 'Manage sandbox, production, and team API keys securely.'
            : 'Configure sandbox keys, global environment variables, and mock endpoints.'}
        </p>

        <div className="card-base env-card" style={{ marginTop: '20px' }}>
          <div className="env-header">
            <h3>{activeTab === 'api-keys' ? 'Active API Keys' : 'Global Environment Variables'}</h3>
            <button className="add-var-btn">+ {activeTab === 'api-keys' ? 'Create Key' : 'Add Variable'}</button>
          </div>
          <div className="env-table">
            <div className="env-row">
              <span className="env-key">{activeTab === 'api-keys' ? 'klyra_prod_pk_live_9x2...' : 'OPENAI_API_KEY'}</span>
              <span className="env-val">{activeTab === 'api-keys' ? '•••••••••••• 8f2a' : 'sk-prod-892415902...'}</span>
              <span className="status-indicator"><span className="status-dot"/>Active</span>
            </div>
            <div className="env-row">
              <span className="env-key">{activeTab === 'api-keys' ? 'klyra_test_sk_test_77a...' : 'STRIPE_SECRET_KEY'}</span>
              <span className="env-val">{activeTab === 'api-keys' ? '•••••••••••• d1b3' : 'sk_live_51M3xYz...'}</span>
              <span className="status-indicator"><span className="status-dot"/>Active</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Account pages (Usage, Wallet, Billing, Settings)
  if (activeTab === 'usage' || activeTab === 'wallet' || activeTab === 'billing' || activeTab === 'settings') {
    const titleMap: Record<string, string> = {
      'usage': 'API Usage Analytics',
      'wallet': 'Wallet & Balance',
      'billing': 'Billing & Plan',
      'settings': 'Account Settings'
    };
    return (
      <div className="tab-view-container animate-fade-in">
        <h1 className="tab-view-title">{titleMap[activeTab]}</h1>
        <p className="tab-view-sub">Manage your profile, team API keys, and subscription plan.</p>

        <div className="settings-grid" style={{ marginTop: '20px' }}>
          <div className="card-base settings-card">
            <h3>{activeTab === 'usage' ? 'Usage Summary' : activeTab === 'wallet' ? 'Wallet Overview' : 'Profile Summary'}</h3>
            {activeTab === 'usage' ? (
              <>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <div className="stat-box">
                    <div className="stat-value">12.4M</div>
                    <div className="stat-label">Total Requests</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-value">$0.42</div>
                    <div className="stat-label">Avg / 1K Calls</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-value">99.96%</div>
                    <div className="stat-label">Uptime</div>
                  </div>
                </div>
              </>
            ) : activeTab === 'wallet' ? (
              <>
                <div className="plan-badge" style={{ marginTop: '12px' }}>$2,450.00</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>Available balance includes prepaid credits and promotional funds.</p>
              </>
            ) : (
              <>
                <div className="profile-row">
                  <div className="user-avatar-lg">AD</div>
                  <div>
                    <div className="user-name-title">API Developer</div>
                    <div className="user-email-sub">developer@klyra.io</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card-base settings-card">
            <h3>{activeTab === 'billing' ? 'Current Plan' : 'Account Details'}</h3>
            <div className="plan-badge">Pro Developer Plan</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>Includes unlimited API testing, mock servers, and response schema analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};