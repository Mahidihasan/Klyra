import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { HeroBanner } from './components/HeroBanner';
import { TrendingApiCard } from './components/TrendingApiCard';
import { CategoryFilter } from './components/CategoryFilter';
import { ApiTesterModal } from './components/ApiTesterModal';
import { ApiDetailModal } from './components/ApiDetailModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { CommandPalette } from './components/CommandPalette';
import { TabViews } from './components/TabViews';
import { PlaygroundPage } from './pages/Playground/index';
import { ApiBuildEntry } from './components/ApiBuildEntry';
import { ApiBuilder } from './pages/ApiBuilder/index';
import { BillingPage } from './pages/Billing/index';
import { RepositoriesPage } from './pages/Repositories/index';
import './pages/Playground/styles.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage, AuthMode } from './pages/Auth/AuthPage';
import { DemoInboxPage } from './pages/Auth/DemoInboxPage';

import {
  MOCK_TRENDING_APIS,
  MOCK_POPULAR_APIS,
  MOCK_NEWLY_LAUNCHED_APIS,
  MOCK_RECOMMENDED_APIS,
  MOCK_COLLECTIONS,
} from './data/mockData';
import { ApiItem, ApiProject, CollectionItem, NavigationTab } from './types/api';
import { ChevronRight, TrendingUp, Sparkles, Rocket, Star, RefreshCw } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  // Persist active tab in localStorage to survive refresh
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeTab');
      // Default to home if no saved value
      return (saved as NavigationTab) || 'home';
    }
    return 'home';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auth modal overlay state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('auth') || params.get('token'));
    }
    return false;
  });
  const [authModalMode, setAuthModalMode] = useState<AuthMode>(() => {
    if (typeof window !== 'undefined') {
      const auth = new URLSearchParams(window.location.search).get('auth');
      if (auth === 'register') return 'register';
      if (auth === 'verify-email') return 'verify-email';
      if (auth === 'reset-password') return 'reset-password';
      if (auth === 'forgot-password') return 'forgot-password';
      if (auth === '2fa') return '2fa';
    }
    return 'login';
  });
  const [authModalToken, setAuthModalToken] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('token') || undefined;
    }
    return undefined;
  });

  // Listen to popstate or url changes for auth query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const auth = params.get('auth');
      const token = params.get('token');
      if (auth || token) {
        setAuthModalToken(token || undefined);
        if (auth === 'register') setAuthModalMode('register');
        else if (auth === 'verify-email') setAuthModalMode('verify-email');
        else if (auth === 'reset-password') setAuthModalMode('reset-password');
        else if (auth === 'forgot-password') setAuthModalMode('forgot-password');
        else setAuthModalMode('login');
        setShowAuthModal(true);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Listen for sync from Demo Inbox tab (to open modal if closed)
  useEffect(() => {
    const handleSync = (type: string, token?: string) => {
      if (type === 'EMAIL_VERIFIED') {
        setAuthModalMode('verify-email');
        setShowAuthModal(true);
      } else if (type === 'START_RESET_PASSWORD') {
        setAuthModalToken(token);
        setAuthModalMode('reset-password');
        setShowAuthModal(true);
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('klyra_auth_channel');
      channel.onmessage = (e) => {
        if (e.data?.type) handleSync(e.data.type, e.data.token);
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'klyra_auth_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.type) handleSync(parsed.type, parsed.token);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Modals state
  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);
  const [isTesterOpen, setIsTesterOpen] = useState<boolean>(false);
  const [testerApi, setTesterApi] = useState<ApiItem | null>(null);
  const [isCreateColOpen, setIsCreateColOpen] = useState<boolean>(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [activeApiProject, setActiveApiProject] = useState<ApiProject | null>(null);

  // Collections state
  const [collections, setCollections] = useState<CollectionItem[]>(MOCK_COLLECTIONS);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // All combined APIs
  const allApis = useMemo(() => {
    return [
      ...MOCK_TRENDING_APIS,
      ...MOCK_POPULAR_APIS,
      ...MOCK_NEWLY_LAUNCHED_APIS,
      ...MOCK_RECOMMENDED_APIS,
    ];
  }, []);

  // Filter helper
  const filterApis = (apis: ApiItem[]) => {
    return apis.filter((api) => {
      const matchCat = selectedCategory === 'All Categories' || api.category === selectedCategory;
      const matchQuery =
        !searchQuery ||
        api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  };

  const filteredTrendingApis = useMemo(
    () => filterApis(MOCK_TRENDING_APIS),
    [selectedCategory, searchQuery],
  );
  const filteredPopularApis = useMemo(
    () => filterApis(MOCK_POPULAR_APIS),
    [selectedCategory, searchQuery],
  );
  const filteredNewlyLaunchedApis = useMemo(
    () => filterApis(MOCK_NEWLY_LAUNCHED_APIS),
    [selectedCategory, searchQuery],
  );
  const filteredRecommendedApis = useMemo(
    () => filterApis(MOCK_RECOMMENDED_APIS),
    [selectedCategory, searchQuery],
  );

  // Handlers
  const handleOpenTester = (api?: ApiItem | null) => {
    setTesterApi(api || null);
    setIsTesterOpen(true);
  };

  const handleCreateCollection = (newCol: CollectionItem) => {
    setCollections((prev) => [newCol, ...prev]);
  };

  // 1. Check if user opened Demo Inbox (dedicated window or view param)
  const isDemoInboxRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/demo-inbox' ||
      new URLSearchParams(window.location.search).get('view') === 'demo-inbox');

  if (isDemoInboxRoute) {
    return <DemoInboxPage />;
  }

  // 2. Loading state during auth check
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0c12',
        }}
      >
        <RefreshCw className="spin-icon" size={32} color="#8b5cf6" />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* When in Playground, hide the main Klyra topbar & sidebar entirely */}
      {activeTab === 'playground' ? (
        <PlaygroundPage apiProject={activeApiProject} onBackToKlyra={() => setActiveTab('home')} />
      ) : activeTab === 'api-builder' && activeApiProject ? (
        <ApiBuilder
          project={activeApiProject}
          onBack={() => setActiveTab('home')}
          onChange={(project) => {
            setActiveApiProject(project);
            const projects = JSON.parse(localStorage.getItem('klyra-api-projects') || '[]');
            localStorage.setItem(
              'klyra-api-projects',
              JSON.stringify(
                projects.map((item: ApiProject) => (item.id === project.id ? project : item)),
              ),
            );
          }}
        />
      ) : activeTab === 'api-build' ? (
        <ApiBuildEntry
          onBack={() => setActiveTab('home')}
          onOpenProject={(project) => {
            setActiveApiProject(project);
            setActiveTab('api-builder');
          }}
        />
      ) : (
        <>
          {/* Top Header Bar - Full Width */}
          <Topbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenCommandPalette={() => setIsCmdPaletteOpen(true)}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
            onOpenLogin={() => {
              setAuthModalMode('login');
              setShowAuthModal(true);
            }}
            onOpenRegister={() => {
              setAuthModalMode('register');
              setShowAuthModal(true);
            }}
          />

          {/* Body: Sidebar + Main Content */}
          <div className="app-body">
            {/* Left Navigation Sidebar */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onOpenNewRequest={() => setActiveTab('api-build')}
              isMobileOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="main-wrapper">
              {/* Dynamic View Rendering */}
              {activeTab === 'home' ? (
                <main className="content-grid animate-fade-in">
                  {/* Center Main Dashboard Column */}
                  <div className="center-column">
                    {/* 1. Hero Banner */}
                    <HeroBanner onSearchSubmit={(term) => setSearchQuery(term)} />

                    {/* 2. Category Filter Navigation Bar */}
                    <CategoryFilter
                      selectedCategory={selectedCategory}
                      onSelectCategory={setSelectedCategory}
                    />

                    {/* 3. Trending APIs Section */}
                    <section className="dashboard-section">
                      <div className="section-header">
                        <div className="section-title-group">
                          <div className="section-icon-wrapper trending">
                            <TrendingUp size={16} color="#8b5cf6" />
                          </div>
                          <div>
                            <h2 className="section-title">Trending APIs</h2>
                            <p className="section-subtitle">Most popular APIs this week</p>
                          </div>
                        </div>

                        <div className="section-header-actions">
                          <button className="view-all-link" onClick={() => setActiveTab('apis')}>
                            <span>View all</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="api-cards-row">
                        {filteredTrendingApis.length > 0 ? (
                          filteredTrendingApis
                            .slice(0, 8)
                            .map((api) => (
                              <TrendingApiCard
                                key={api.id}
                                api={api}
                                onSelectApi={(item) => setSelectedApi(item)}
                              />
                            ))
                        ) : (
                          <div className="empty-filter-state card-base">
                            No trending APIs match "{searchQuery || selectedCategory}".
                          </div>
                        )}
                      </div>
                    </section>

                    {/* 4. Newly Launched APIs Section */}
                    <section className="dashboard-section">
                      <div className="section-header">
                        <div className="section-title-group">
                          <div className="section-icon-wrapper new">
                            <Sparkles size={16} color="#22d3ee" />
                          </div>
                          <div>
                            <h2 className="section-title">Newly Launched</h2>
                            <p className="section-subtitle">Recently added APIs</p>
                          </div>
                        </div>

                        <div className="section-header-actions">
                          <button className="view-all-link" onClick={() => setActiveTab('apis')}>
                            <span>View all</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="api-cards-row">
                        {filteredNewlyLaunchedApis.length > 0 ? (
                          filteredNewlyLaunchedApis
                            .slice(0, 8)
                            .map((api) => (
                              <TrendingApiCard
                                key={api.id}
                                api={api}
                                onSelectApi={(item) => setSelectedApi(item)}
                              />
                            ))
                        ) : (
                          <div className="empty-filter-state card-base">
                            No newly launched APIs match "{searchQuery || selectedCategory}".
                          </div>
                        )}
                      </div>
                    </section>

                    {/* 5. Popular APIs Section */}
                    <section className="dashboard-section">
                      <div className="section-header">
                        <div className="section-title-group">
                          <div className="section-icon-wrapper popular">
                            <Rocket size={16} color="#f59e0b" />
                          </div>
                          <div>
                            <h2 className="section-title">Popular APIs</h2>
                            <p className="section-subtitle">Widely used APIs</p>
                          </div>
                        </div>

                        <div className="section-header-actions">
                          <button className="view-all-link" onClick={() => setActiveTab('apis')}>
                            <span>View all</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="api-cards-row">
                        {filteredPopularApis.length > 0 ? (
                          filteredPopularApis
                            .slice(0, 8)
                            .map((api) => (
                              <TrendingApiCard
                                key={api.id}
                                api={api}
                                onSelectApi={(item) => setSelectedApi(item)}
                              />
                            ))
                        ) : (
                          <div className="empty-filter-state card-base">
                            No popular APIs match "{searchQuery || selectedCategory}".
                          </div>
                        )}
                      </div>
                    </section>

                    {/* 6. Recommended for You Section */}
                    <section className="dashboard-section">
                      <div className="section-header">
                        <div className="section-title-group">
                          <div className="section-icon-wrapper recommended">
                            <Star size={16} color="#ec4899" />
                          </div>
                          <div>
                            <h2 className="section-title">Recommended for You</h2>
                            <p className="section-subtitle">Personalized / featured APIs</p>
                          </div>
                        </div>

                        <div className="section-header-actions">
                          <button className="view-all-link" onClick={() => setActiveTab('apis')}>
                            <span>View all</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="api-cards-row">
                        {filteredRecommendedApis.length > 0 ? (
                          filteredRecommendedApis
                            .slice(0, 8)
                            .map((api) => (
                              <TrendingApiCard
                                key={api.id}
                                api={api}
                                onSelectApi={(item) => setSelectedApi(item)}
                              />
                            ))
                        ) : (
                          <div className="empty-filter-state card-base">
                            No recommended APIs match "{searchQuery || selectedCategory}".
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </main>
              ) : activeTab === 'billing' ? (
                <main className="content-page-wrapper">
                  <BillingPage />
                </main>
              ) : activeTab === 'repositories' ? (
                <main>
                  <RepositoriesPage onBackToKlyra={() => setActiveTab('home')} />
                </main>
              ) : (
                <main className="content-page-wrapper">
                  <TabViews
                    activeTab={activeTab}
                    collections={collections}
                    apis={allApis}
                    onOpenCreateCollection={() => setIsCreateColOpen(true)}
                    onOpenTester={(api) => handleOpenTester(api)}
                    onSelectApi={(api) => setSelectedApi(api)}
                  />
                </main>
              )}
            </div>
          </div>
        </>
      )}

      {/* Global Modals & Dialogs */}
      {/* 1. API Detail Modal */}
      {selectedApi && (
        <ApiDetailModal
          api={selectedApi}
          onClose={() => setSelectedApi(null)}
          onOpenTester={(api) => {
            setSelectedApi(null);
            handleOpenTester(api);
          }}
        />
      )}

      {/* 2. Interactive API Tester Modal */}
      {isTesterOpen && (
        <ApiTesterModal
          api={testerApi}
          onClose={() => {
            setIsTesterOpen(false);
            setTesterApi(null);
          }}
        />
      )}

      {/* 3. Create Collection Modal */}
      {isCreateColOpen && (
        <CreateCollectionModal
          onClose={() => setIsCreateColOpen(false)}
          onSave={handleCreateCollection}
        />
      )}

      {/* 4. Command Palette (Ctrl + K) */}
      <CommandPalette
        apis={allApis}
        collections={collections}
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        onSelectApi={(api) => setSelectedApi(api)}
        onOpenTester={() => handleOpenTester()}
      />

      {/* 5. Auth Modal (Login / Sign Up / 2FA / Password Reset) */}
      {showAuthModal && (
        <AuthPage
          isModal={true}
          initialMode={authModalMode}
          initialToken={authModalToken}
          onClose={() => {
            setShowAuthModal(false);
            if (typeof window !== 'undefined' && window.location.search.includes('auth')) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
          onLoginSuccess={() => {
            setShowAuthModal(false);
            if (typeof window !== 'undefined' && window.location.search.includes('auth')) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            setActiveTab('home');
          }}
        />
      )}

      <style>{`
        .center-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
        }

        .dashboard-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .section-header ~ .section-header {
          margin-top: 15px;
        }

        .section-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-icon-wrapper {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .section-icon-wrapper.trending {
          background: rgba(139, 92, 246, 0.15);
        }

        .section-icon-wrapper.new {
          background: rgba(34, 211, 238, 0.15);
        }

        .section-icon-wrapper.popular {
          background: rgba(245, 158, 11, 0.15);
        }

        .section-icon-wrapper.recommended {
          background: rgba(236, 72, 153, 0.15);
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .section-subtitle {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .view-all-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-accent);
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s ease;
        }

        .view-all-link:hover {
          background: rgba(139, 92, 246, 0.1);
        }

        /* Single row of 6 cards - no horizontal scroll */
        .api-cards-row {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          width: 100%;
          overflow: visible;
        }

        .empty-filter-state {
          width: 100%;
          padding: 30px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
          grid-column: 1 / -1;
        }

        .content-page-wrapper {
          padding: 24px 32px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
        }

        /* Responsive: collapse to fewer columns on smaller screens */
        @media (max-width: 1500px) {
          .api-cards-row {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 1200px) {
          .api-cards-row {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 1024px) {
          .api-cards-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .api-cards-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
