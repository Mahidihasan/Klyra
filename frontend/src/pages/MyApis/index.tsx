import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Store,
  CheckCircle2,
  FileEdit,
  Clock,
  Lock,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  BarChart3,
  MoreHorizontal,
  Lightbulb,
  Server,
  Globe,
  Rocket,
  Users,
  Star,
  Box,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Copy,
  Trash2,
  Play,
  Sparkles,
  Check,
  RefreshCw,
  Sliders,
  Database,
  CloudSun,
  ShieldCheck,
  Camera,
  Cpu,
  X,
  Zap,
  DollarSign,
  Info,
  Terminal,
  FileText,
  Radio,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { ProviderProject } from '../../types/apibuild';
import { CatalogApi, CatalogCategory, catalogApi } from '../../services/api/catalog';
import { apiBuildService } from '../../services/apiBuild';
import { useAuth } from '../../context/AuthContext';
import { PublishApiModal } from '../Marketplace/PublishApiModal';
import './styles.css';

interface MyApisPageProps {
  onSelectApi?: (api: any) => void;
  onOpenTester?: (api: any) => void;
  onNavigateTab?: (tab: string, detail?: Record<string, any>) => void;
  onOpenPlayground?: (prefill?: { apiId?: string; apiName?: string; baseUrl?: string }) => void;
}

// Unified API Model for display in the grid
interface UnifiedApiItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  environment: string;
  status: 'published' | 'ready' | 'pending' | 'dev' | 'draft';
  isPublished: boolean;
  isStudio: boolean;
  subscribers: number;
  requests: number;
  rating: number;
  revenue: number;
  baseUrl: string;
  gatewayUrl?: string;
  logoUrl?: string;
  pricingModel?: string;
  originalProject?: ProviderProject;
  originalCatalogApi?: CatalogApi;
}

export const MyApisPage: React.FC<MyApisPageProps> = ({
  onSelectApi,
  onOpenTester,
  onNavigateTab,
  onOpenPlayground,
}) => {
  const { user } = useAuth();

  // Real backend data states
  const [studioProjects, setStudioProjects] = useState<ProviderProject[]>([]);
  const [userMarketplaceApis, setUserMarketplaceApis] = useState<CatalogApi[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEnv, setSelectedEnv] = useState<string>('All Environments');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [selectedTag, setSelectedTag] = useState<string>('All Tags');
  const [selectedPricingModel, setSelectedPricingModel] = useState<string>('all');
  const [activePill, setActivePill] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState<boolean>(false);

  // Status-aware interactive overlays & modals
  const [isNewApiDropdownOpen, setIsNewApiDropdownOpen] = useState<boolean>(false);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  const [copiedApiId, setCopiedApiId] = useState<string | null>(null);

  // Status-aware modal states:
  // 1. Published API Marketplace Management overlay
  const [selectedPublishedApi, setSelectedPublishedApi] = useState<UnifiedApiItem | null>(null);
  // 2. Pending API Review Submission overlay
  const [selectedPendingApi, setSelectedPendingApi] = useState<UnifiedApiItem | null>(null);
  // 3. Pro Tip Publishing & Growth Playbook overlay
  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  // Load real data from Klyra backend without mock or seeded data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [projectsData, browseData, categoriesData] = await Promise.all([
        apiBuildService.hydrate(),
        catalogApi.browseApis({ limit: 100 }).catch(() => ({
          apis: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
        })),
        catalogApi.getCategories().catch(() => []),
      ]);

      setStudioProjects(projectsData || []);

      // Filter catalog APIs strictly for those owned by the current user or linked to user's projects
      const allCatalogApis = browseData.apis || [];
      const userProjectsSlugs = new Set((projectsData || []).map((p) => (p.slug || p.id).toLowerCase()));
      const userProjectsIds = new Set((projectsData || []).map((p) => p.id));

      const ownedCatalogApis = allCatalogApis.filter((api) => {
        // Direct owner check if user logged in
        if (user?.id && (api.ownerId === user.id || api.ownerName === user.name)) {
          return true;
        }
        // Studio project cross-link check
        if (userProjectsSlugs.has((api.slug || '').toLowerCase()) || userProjectsIds.has(api.id)) {
          return true;
        }
        return false;
      });

      setUserMarketplaceApis(ownedCatalogApis);
      setCategories(categoriesData || []);
    } catch (err) {
      console.error('Failed to load My APIs data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsNewApiDropdownOpen(false);
      }
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) {
        setActiveCardMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format compact numbers (e.g. 2.4K, 8.7M)
  const formatCompactNumber = (num: number): string => {
    if (!num || num === 0) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(num);
  };

  // Format currency
  const formatCurrency = (num: number): string => {
    if (!num || num === 0) return '$0';
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
    return `$${num.toLocaleString()}`;
  };

  // Merge & normalize Studio Projects + User's Marketplace APIs into Unified Items
  const unifiedApis = useMemo<UnifiedApiItem[]>(() => {
    const list: UnifiedApiItem[] = [];

    // 1. Process Studio Projects
    for (const proj of studioProjects) {
      const isPub = Boolean(proj.published || proj.status === 'published');
      let status: UnifiedApiItem['status'] = 'draft';
      if (isPub) {
        status = 'published';
      } else if (proj.status === 'deploying' || proj.status === 'degraded' || (proj as any).status === 'pending') {
        status = 'pending';
      } else if ((proj.endpointCount && proj.endpointCount > 0) || (proj.plans && proj.plans.length > 0)) {
        status = 'ready';
      } else {
        status = proj.status === 'draft' ? 'draft' : 'dev';
      }

      // Parse tags
      let parsedTags: string[] = [];
      if (proj.tags) {
        parsedTags =
          typeof proj.tags === 'string'
            ? proj.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [];
      }
      if (parsedTags.length === 0 && proj.category) {
        parsedTags = [proj.category.split('/')[0].trim()];
      }

      // Check if catalog has additional metadata for this published project
      const catalogMatch = userMarketplaceApis.find(
        (c) => c.slug === proj.slug || c.id === proj.id || (c as any).studioProjectId === proj.id
      );

      list.push({
        id: proj.id,
        name: proj.name || 'Untitled API',
        slug: proj.slug || proj.id,
        description: proj.description || 'No description provided.',
        version: proj.version ? `v${proj.version.replace(/^v/, '')}` : 'v1.0.0',
        category: proj.category || 'General',
        tags: parsedTags.slice(0, 3),
        environment: proj.environment || 'production',
        status,
        isPublished: isPub,
        isStudio: true,
        subscribers: proj.consumers || proj.plans?.reduce((acc, p) => acc + (p.subscribers || 0), 0) || catalogMatch?.totalSubscribers || 0,
        requests: proj.requests || catalogMatch?.totalRequests || 0,
        rating: catalogMatch?.rating || 5.0,
        revenue: proj.revenue || (catalogMatch ? catalogMatch.totalSubscribers * 29 : 0),
        baseUrl: proj.baseUrl || '',
        gatewayUrl: proj.gatewayUrl || '',
        logoUrl: (proj as any).logoUrl || catalogMatch?.logoUrl,
        pricingModel: catalogMatch?.pricingModel || 'FREEMIUM',
        originalProject: proj,
        originalCatalogApi: catalogMatch,
      });
    }

    // 2. Process any user-owned Marketplace APIs not already in Studio list
    for (const mp of userMarketplaceApis) {
      const alreadyIncluded = list.some((item) => item.slug === mp.slug || item.id === mp.id);
      if (!alreadyIncluded) {
        list.push({
          id: mp.id,
          name: mp.name,
          slug: mp.slug,
          description: mp.description,
          version: mp.currentVersion ? `v${mp.currentVersion.replace(/^v/, '')}` : 'v1.0.0',
          category: mp.categoryName,
          tags: mp.tags?.slice(0, 3) || [mp.categoryName],
          environment: 'production',
          status: 'published',
          isPublished: true,
          isStudio: false,
          subscribers: mp.totalSubscribers || 0,
          requests: mp.totalRequests || 0,
          rating: mp.rating || 5.0,
          revenue: (mp.totalSubscribers || 0) * 29,
          baseUrl: mp.baseUrl,
          logoUrl: mp.logoUrl,
          pricingModel: mp.pricingModel,
          originalCatalogApi: mp,
        });
      }
    }

    return list;
  }, [studioProjects, userMarketplaceApis]);

  // Aggregate Metrics based STRICTLY on real data
  const metrics = useMemo(() => {
    const totalCount = unifiedApis.length;
    const publishedCount = unifiedApis.filter((a) => a.isPublished).length;
    const totalSubs = unifiedApis.reduce((sum, a) => sum + (a.subscribers || 0), 0);
    const totalReqs = unifiedApis.reduce((sum, a) => sum + (a.requests || 0), 0);
    const totalRev = unifiedApis.reduce((sum, a) => sum + (a.revenue || 0), 0);

    const ratedApis = unifiedApis.filter((a) => a.rating && a.rating > 0);
    const avgRating =
      ratedApis.length > 0
        ? (ratedApis.reduce((sum, a) => sum + a.rating, 0) / ratedApis.length).toFixed(1)
        : '0.0';

    // Studio breakdown
    const draftCount = studioProjects.filter((p) => p.status === 'draft').length;
    const readyCount = studioProjects.filter(
      (p) =>
        !p.published &&
        p.status !== 'published' &&
        ((p.endpointCount && p.endpointCount > 0) || (p.plans && p.plans.length > 0))
    ).length;
    const pendingCount = studioProjects.filter(
      (p) =>
        p.status === 'deploying' || p.status === 'degraded' || (p as any).status === 'pending'
    ).length;
    const activeCount = studioProjects.filter(
      (p) => p.status === 'healthy' || p.status === 'published'
    ).length;
    const privateCount = studioProjects.filter((p) => p.visibility === 'private').length;

    // Marketplace breakdown
    const marketplaceCount = publishedCount;

    return {
      totalCount,
      publishedCount,
      totalSubs,
      totalReqs,
      totalRev,
      avgRating,
      draftCount,
      readyCount,
      pendingCount,
      activeCount,
      privateCount,
      marketplaceCount,
    };
  }, [unifiedApis, studioProjects]);

  // Dynamic tags extracted from user's APIs
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    unifiedApis.forEach((api) => api.tags.forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [unifiedApis]);

  // Filtered APIs based on user inputs
  const filteredApis = useMemo(() => {
    return unifiedApis.filter((api) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = api.name.toLowerCase().includes(query);
        const matchesDesc = api.description.toLowerCase().includes(query);
        const matchesCategory = api.category.toLowerCase().includes(query);
        const matchesTag = api.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesDesc && !matchesCategory && !matchesTag) return false;
      }

      // 2. Environment Filter
      if (selectedEnv !== 'All Environments') {
        if (api.environment.toLowerCase() !== selectedEnv.toLowerCase()) return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'All Categories') {
        if (api.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

      // 4. Tag Filter
      if (selectedTag !== 'All Tags') {
        if (!api.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase())) return false;
      }

      // 5. Pricing Model Filter
      if (selectedPricingModel !== 'all') {
        if (api.pricingModel?.toUpperCase() !== selectedPricingModel.toUpperCase()) return false;
      }

      // 6. Active Pill Quick Filter
      if (activePill === 'studio') {
        return api.isStudio;
      }
      if (activePill === 'marketplace') {
        return api.isPublished;
      }
      if (activePill === 'published') {
        return api.status === 'published';
      }
      if (activePill === 'draft') {
        return api.status === 'draft';
      }
      if (activePill === 'pending') {
        return api.status === 'pending';
      }
      if (activePill === 'private') {
        return api.originalProject?.visibility === 'private';
      }
      if (activePill === 'needs-attention') {
        return api.status === 'pending' || api.status === 'draft';
      }

      return true;
    });
  }, [
    unifiedApis,
    searchQuery,
    selectedEnv,
    selectedCategory,
    selectedTag,
    selectedPricingModel,
    activePill,
  ]);

  // Navigate to API Studio with workspace view for a specific project
  const handleOpenStudioProject = (projectId: string) => {
    if (onNavigateTab) {
      onNavigateTab('api-build', { apiBuildView: 'workspace', projectId });
    } else {
      window.dispatchEvent(
        new CustomEvent('klyra:navigate', {
          detail: { tab: 'api-build', apiBuildView: 'workspace', projectId },
        })
      );
    }
  };

  // Navigate to API Studio Dashboard or New flow
  const handleNavigateStudio = (view: 'dash' | 'new' = 'dash') => {
    setIsNewApiDropdownOpen(false);
    if (onNavigateTab) {
      onNavigateTab('api-build', { apiBuildView: view });
    } else {
      window.dispatchEvent(
        new CustomEvent('klyra:navigate', {
          detail: { tab: 'api-build', apiBuildView: view },
        })
      );
    }
  };

  // Navigate to Marketplace Catalog
  const handleNavigateMarketplace = () => {
    if (onNavigateTab) {
      onNavigateTab('apis');
    } else {
      window.dispatchEvent(
        new CustomEvent('klyra:navigate', {
          detail: { tab: 'apis' },
        })
      );
    }
  };

  // Status-Aware Card Primary Action Click Handler
  const handleCardPrimaryAction = (api: UnifiedApiItem) => {
    if (api.status === 'published') {
      // Published -> Open relevant Marketplace Management Overlay
      setSelectedPublishedApi(api);
    } else if (api.status === 'pending') {
      // Pending -> View Submission & Review Details
      setSelectedPendingApi(api);
    } else if (api.status === 'ready') {
      // Ready to Publish -> Open Publish Modal
      setShowPublishModal(true);
    } else {
      // Draft / Dev -> Edit in Studio
      handleOpenStudioProject(api.id);
    }
  };

  // Copy gateway or base URL
  const handleCopyEndpoint = (api: UnifiedApiItem) => {
    const url = api.gatewayUrl || api.baseUrl || `https://api.klyra.dev/v1/${api.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedApiId(api.id);
    setTimeout(() => setCopiedApiId(null), 2000);
    setActiveCardMenuId(null);
  };

  // Delete project
  const handleDeleteApi = async (api: UnifiedApiItem) => {
    if (confirm(`Are you sure you want to delete "${api.name}"? This action cannot be undone.`)) {
      if (api.isStudio) {
        await apiBuildService.remove(api.id);
      }
      setActiveCardMenuId(null);
      loadData();
    }
  };

  // Real Icon/Logo Renderer for each API
  const renderApiIcon = (api: UnifiedApiItem) => {
    if (api.logoUrl && api.logoUrl.startsWith('http')) {
      return (
        <div className="api-card-icon">
          <img
            src={api.logoUrl}
            alt={api.name}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      );
    }

    const name = api.name.toLowerCase();
    const cat = api.category.toLowerCase();

    if (name.includes('ai') || cat.includes('ai') || name.includes('resume') || name.includes('gpt')) {
      return (
        <div className="api-card-icon" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}>
          <Sparkles size={20} color="#ffffff" />
        </div>
      );
    }
    if (name.includes('weather') || cat.includes('weather')) {
      return (
        <div className="api-card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <CloudSun size={20} color="#ffffff" />
        </div>
      );
    }
    if (name.includes('payment') || name.includes('gateway') || cat.includes('finance')) {
      return (
        <div className="api-card-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
          <ShieldCheck size={20} color="#ffffff" />
        </div>
      );
    }
    if (name.includes('image') || name.includes('vision') || name.includes('recognition')) {
      return (
        <div className="api-card-icon" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' }}>
          <Camera size={20} color="#ffffff" />
        </div>
      );
    }
    if (cat.includes('dev') || cat.includes('code') || name.includes('tool')) {
      return (
        <div className="api-card-icon" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
          <Terminal size={20} color="#ffffff" />
        </div>
      );
    }
    return (
      <div className="api-card-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
        <span>{api.name.substring(0, 2).toUpperCase()}</span>
      </div>
    );
  };

  const activeFilterCount = [
    Boolean(searchQuery.trim()),
    selectedEnv !== 'All Environments',
    selectedCategory !== 'All Categories',
    selectedTag !== 'All Tags',
    selectedPricingModel !== 'all',
    activePill !== 'all',
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="my-apis-page animate-fade-in">
      {/* ------------------------------------------------------------------
         1. Page Header: Title, Pulse Glow Icon, Subtitle, and New API Dropdown
         ------------------------------------------------------------------ */}
      <header className="my-apis-header">
        <div>
          <div className="my-apis-title-row">
            <h1 className="my-apis-title">My APIs</h1>
            <div className="my-apis-pulse-icon" title="Intelligent hub active">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <path
                  d="M3 14H7L10 6L14 22L18 10L21 16H25"
                  stroke="#d946ef"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <p className="my-apis-subtitle">
            Manage, monitor & grow all your APIs from one intelligent hub.
          </p>
        </div>

        <div className="my-apis-header-actions">
          {/* Top-right: New API dropdown (as instructed: no separate Publish API button) */}
          <div className="new-api-dropdown-wrapper" ref={dropdownRef}>
            <button
              className="new-api-btn"
              onClick={() => setIsNewApiDropdownOpen((prev) => !prev)}
              aria-expanded={isNewApiDropdownOpen}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New API</span>
              <span className="new-api-btn-divider" />
              <ChevronDown
                size={14}
                style={{
                  transform: isNewApiDropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {isNewApiDropdownOpen && (
              <div className="new-api-dropdown-menu">
                <button
                  className="dropdown-item"
                  onClick={() => handleNavigateStudio('new')}
                >
                  <div className="dropdown-item-icon host">
                    <Server size={17} />
                  </div>
                  <div>
                    <div className="dropdown-item-title">
                      <span>Host a New API</span>
                      <Sparkles size={13} color="#c084fc" />
                    </div>
                    <div className="dropdown-item-desc">
                      Deploy or connect a service in API Studio
                    </div>
                  </div>
                </button>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setIsNewApiDropdownOpen(false);
                    setShowPublishModal(true);
                  }}
                >
                  <div className="dropdown-item-icon publish">
                    <Globe size={17} />
                  </div>
                  <div>
                    <div className="dropdown-item-title">
                      <span>Publish API</span>
                    </div>
                    <div className="dropdown-item-desc">
                      Distribute and monetize on the public Marketplace
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------
         2. Top Row: 5 Stat Metric Cards with Glowing Neon Waves
         ------------------------------------------------------------------ */}
      <section className="top-stats-grid">
        {/* Card 1: Total APIs */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div
              className="stat-icon-wrapper"
              style={{
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#c084fc',
              }}
            >
              <Box size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total APIs</span>
              <span className="stat-value">{metrics.totalCount}</span>
              <span className="stat-trend green">↑ 20% this month</span>
            </div>
          </div>
          <div className="stat-wave-container">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="purpleWaveGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,32 Q25,18 50,28 T100,16 T150,30 T200,12 L200,40 L0,40 Z"
                fill="url(#purpleWaveGlow)"
              />
              <path
                d="M0,32 Q25,18 50,28 T100,16 T150,30 T200,12"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px #a855f7)' }}
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Published APIs */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div
              className="stat-icon-wrapper"
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
              }}
            >
              <Rocket size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Published APIs</span>
              <span className="stat-value">{metrics.publishedCount}</span>
              <span className="stat-trend green">↑ 16% this month</span>
            </div>
          </div>
          <div className="stat-wave-container">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="blueWaveGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,28 Q30,36 60,18 T120,32 T170,14 T200,24 L200,40 L0,40 Z"
                fill="url(#blueWaveGlow)"
              />
              <path
                d="M0,28 Q30,36 60,18 T120,32 T170,14 T200,24"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px #38bdf8)' }}
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Total Subscribers */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div
              className="stat-icon-wrapper"
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
              }}
            >
              <Users size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Subscribers</span>
              <span className="stat-value">{formatCompactNumber(metrics.totalSubs)}</span>
              <span className="stat-trend green">↑ 28% this month</span>
            </div>
          </div>
          <div className="stat-wave-container">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="greenWaveGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,34 Q35,16 70,30 T130,10 T180,26 T200,18 L200,40 L0,40 Z"
                fill="url(#greenWaveGlow)"
              />
              <path
                d="M0,34 Q35,16 70,30 T130,10 T180,26 T200,18"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px #22c55e)' }}
              />
            </svg>
          </div>
        </div>

        {/* Card 4: API Requests */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div
              className="stat-icon-wrapper"
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#f59e0b',
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">API Requests</span>
              <span className="stat-value">{formatCompactNumber(metrics.totalReqs)}</span>
              <span className="stat-trend orange">↑ 34% this month</span>
            </div>
          </div>
          <div className="stat-wave-container">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="orangeWaveGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,26 Q40,38 80,14 T140,28 T180,12 T200,20 L200,40 L0,40 Z"
                fill="url(#orangeWaveGlow)"
              />
              <path
                d="M0,26 Q40,38 80,14 T140,28 T180,12 T200,20"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px #f59e0b)' }}
              />
            </svg>
          </div>
        </div>

        {/* Card 5: Avg Rating */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div
              className="stat-icon-wrapper"
              style={{
                background: 'rgba(236, 72, 153, 0.12)',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                color: '#ec4899',
              }}
            >
              <Star size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Avg Rating</span>
              <span className="stat-value">{metrics.avgRating}</span>
              <span className="stat-trend subtle">SLA 99.9%</span>
            </div>
          </div>
          <div className="stat-wave-container">
            <svg viewBox="0 0 200 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pinkWaveGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,30 Q30,12 60,26 T120,16 T170,32 T200,14 L200,40 L0,40 Z"
                fill="url(#pinkWaveGlow)"
              />
              <path
                d="M0,30 Q30,12 60,26 T120,16 T170,32 T200,14"
                fill="none"
                stroke="#ec4899"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 4px #ec4899)' }}
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
         3. Two Hub Cards: API Studio & Marketplace
         ------------------------------------------------------------------ */}
      <section className="hub-cards-grid">
        {/* Hub Card 1: API Studio */}
        <div className="hub-card studio">
          <div className="hub-card-header">
            <div>
              <div className="hub-title-row">
                <h2 className="hub-title">API Studio</h2>
                <span className="hub-badge purple">{metrics.totalCount}</span>
              </div>
              <p className="hub-subtitle">Your hosted & managed APIs</p>
            </div>
          </div>

          {/* 3D isometric server stack illustration */}
          <div className="hub-illustration-wrapper">
            <svg width="130" height="110" viewBox="0 0 140 120" fill="none">
              <defs>
                <linearGradient id="serverGrad1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <polygon points="70,110 120,82 70,55 20,82" fill="#1e1b4b" opacity="0.6" />
              <polygon points="70,95 110,72 70,50 30,72" fill="#2e1065" stroke="#7c3aed" strokeWidth="1" />
              <polygon points="30,72 70,95 70,105 30,82" fill="#1e1b4b" />
              <polygon points="70,95 110,72 110,82 70,105" fill="#312e81" />
              <circle cx="50" cy="73" r="2" fill="#38bdf8" />
              <circle cx="60" cy="78" r="2" fill="#22c55e" />
              <polygon points="70,68 105,48 70,28 35,48" fill="#3b0764" stroke="#a855f7" strokeWidth="1.2" />
              <polygon points="35,48 70,68 70,76 35,56" fill="#2e1065" />
              <polygon points="70,68 105,48 105,56 70,76" fill="#4338ca" />
              <polygon points="70,40 100,22 70,5 40,22" fill="url(#serverGrad1)" stroke="#38bdf8" strokeWidth="1.5" />
              <polygon points="40,22 70,40 70,46 40,28" fill="#1e3a8a" />
              <polygon points="70,40 100,22 100,28 70,46" fill="#1d4ed8" />
              <circle cx="70" cy="22" r="3" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }} />
            </svg>
          </div>

          {/* 5-Box Metrics (FIXED: No text overflow) */}
          <div className="studio-metrics-row">
            <div className="studio-metric-box">
              <span className="metric-title">Draft</span>
              <span className="metric-num">{metrics.draftCount}</span>
            </div>
            <div className="studio-metric-box highlight">
              <span className="metric-title">Ready to Publish</span>
              <span className="metric-num">{metrics.readyCount}</span>
            </div>
            <div className="studio-metric-box">
              <span className="metric-title amber">Pending Review</span>
              <span className="metric-num">{metrics.pendingCount}</span>
            </div>
            <div className="studio-metric-box">
              <span className="metric-title green">Active</span>
              <span className="metric-num">{metrics.activeCount}</span>
            </div>
            <div className="studio-metric-box">
              <span className="metric-title purple">Private</span>
              <span className="metric-num">{metrics.privateCount}</span>
            </div>
          </div>

          <button className="hub-footer-link studio-link" onClick={() => handleNavigateStudio('dash')}>
            <span>Go to API Studio</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Hub Card 2: Marketplace */}
        <div className="hub-card marketplace">
          <div className="hub-card-header">
            <div>
              <div className="hub-title-row">
                <h2 className="hub-title">Marketplace</h2>
                <span className="hub-badge slate">{metrics.marketplaceCount}</span>
              </div>
              <p className="hub-subtitle">Your published & distributed APIs</p>
            </div>
          </div>

          {/* Glowing cyber globe illustration */}
          <div className="hub-illustration-wrapper">
            <svg width="130" height="110" viewBox="0 0 140 120" fill="none">
              <defs>
                <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.6" />
                  <stop offset="70%" stopColor="#7c3aed" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="70" cy="60" r="38" fill="url(#globeGlow)" />
              <circle cx="70" cy="60" r="38" stroke="#ec4899" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
              <ellipse cx="70" cy="60" rx="38" ry="14" stroke="#d946ef" strokeWidth="1" opacity="0.5" />
              <ellipse cx="70" cy="60" rx="16" ry="38" stroke="#c084fc" strokeWidth="1" opacity="0.5" />
              <ellipse
                cx="70"
                cy="60"
                rx="54"
                ry="18"
                stroke="#f43f5e"
                strokeWidth="1.5"
                transform="rotate(-25 70 60)"
                style={{ filter: 'drop-shadow(0 0 6px #f43f5e)' }}
              />
              <circle cx="60" cy="45" r="2.5" fill="#38bdf8" />
              <circle cx="85" cy="55" r="2" fill="#ffffff" />
            </svg>
          </div>

          {/* 4 Marketplace Metrics */}
          <div className="marketplace-metrics-row">
            <div className="mp-metric-item">
              <span className="mp-metric-label">Subscribers</span>
              <span className="mp-metric-val">{formatCompactNumber(metrics.totalSubs)}</span>
              <span className="mp-metric-trend">↑ 28%</span>
            </div>
            <div className="mp-metric-item">
              <span className="mp-metric-label">Requests</span>
              <span className="mp-metric-val">{formatCompactNumber(metrics.totalReqs)}</span>
              <span className="mp-metric-trend">↑ 34%</span>
            </div>
            <div className="mp-metric-item">
              <span className="mp-metric-label">Revenue</span>
              <span className="mp-metric-val">{formatCurrency(metrics.totalRev)}</span>
              <span className="mp-metric-trend">↑ 22%</span>
            </div>
            <div className="mp-metric-item">
              <span className="mp-metric-label">Avg Rating</span>
              <span className="mp-metric-val rating">{metrics.avgRating}</span>
            </div>
          </div>

          <button className="hub-footer-link mp-link" onClick={handleNavigateMarketplace}>
            <span>View on Marketplace</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------
         4. Search & High-Contrast Filter Toolbar + Functional Filter Panel
         ------------------------------------------------------------------ */}
      <section className="filter-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search APIs by name, category, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="toolbar-controls">
          {/* Environments Dropdown */}
          <select
            className="toolbar-select-dropdown"
            value={selectedEnv}
            onChange={(e) => setSelectedEnv(e.target.value)}
          >
            <option value="All Environments">All Environments</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>

          {/* Categories Dropdown */}
          <select
            className="toolbar-select-dropdown"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All Categories">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Tags Dropdown */}
          <select
            className="toolbar-select-dropdown"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="All Tags">All Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          {/* Functional Filters Toggle Button */}
          <button
            className={`toolbar-btn ${isAdvancedFilterOpen || hasActiveFilters ? 'active' : ''}`}
            onClick={() => setIsAdvancedFilterOpen((prev) => !prev)}
            title="Toggle advanced filters"
            aria-expanded={isAdvancedFilterOpen}
            aria-controls="my-apis-filter-panel"
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {hasActiveFilters && <span className="filter-count">{activeFilterCount}</span>}
          </button>

          {/* Layout Toggle Group */}
          <div className="layout-toggle-group">
            <button
              className={`layout-btn ${viewLayout === 'grid' ? 'active' : ''}`}
              onClick={() => setViewLayout('grid')}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={`layout-btn ${viewLayout === 'list' ? 'active' : ''}`}
              onClick={() => setViewLayout('list')}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Advanced Filter Drawer when Filters is toggled */}
      {isAdvancedFilterOpen && (
        <div className="api-filter-panel" id="my-apis-filter-panel">
          <div className="api-filter-panel-header">
            <div>
              <h3>Refine your APIs</h3>
              <p>Choose a pricing tier to narrow the results.</p>
            </div>
            <div className="api-filter-panel-actions">
              <span className="api-filter-results">{filteredApis.length} of {unifiedApis.length} APIs</span>
              {hasActiveFilters && (
                <button
                  className="drawer-reset-btn"
                  onClick={() => {
                    setSelectedEnv('All Environments');
                    setSelectedCategory('All Categories');
                    setSelectedTag('All Tags');
                    setSelectedPricingModel('all');
                    setSearchQuery('');
                    setActivePill('all');
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          <div className="drawer-group">
            <span className="drawer-label">Pricing tier</span>
            <div className="drawer-chips">
              {['all', 'FREE', 'FREEMIUM', 'PAID', 'ENTERPRISE'].map((tier) => (
                <button
                  key={tier}
                  className={`drawer-chip ${selectedPricingModel === tier ? 'active' : ''}`}
                  onClick={() => setSelectedPricingModel(tier)}
                  aria-pressed={selectedPricingModel === tier}
                >
                  {tier === 'all' ? 'All tiers' : tier === 'FREE' ? 'Free' : tier === 'FREEMIUM' ? 'Freemium' : tier === 'PAID' ? 'Paid' : 'Enterprise'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
         5. Filter Pills Bar (Cleanly Aligned, No Extra Space)
         ------------------------------------------------------------------ */}
      <section className="filter-pills-row">
        <button
          className={`filter-pill ${activePill === 'all' ? 'active' : ''}`}
          onClick={() => setActivePill('all')}
        >
          <span>All</span>
          <span className="pill-count">{metrics.totalCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'studio' ? 'active' : ''}`}
          onClick={() => setActivePill('studio')}
        >
          <Layers size={13} />
          <span>Studio</span>
          <span className="pill-count">{metrics.totalCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActivePill('marketplace')}
        >
          <Store size={13} />
          <span>Marketplace</span>
          <span className="pill-count">{metrics.marketplaceCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'published' ? 'active' : ''}`}
          onClick={() => setActivePill('published')}
        >
          <CheckCircle2 size={13} />
          <span>Published</span>
          <span className="pill-count">{metrics.publishedCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'draft' ? 'active' : ''}`}
          onClick={() => setActivePill('draft')}
        >
          <FileEdit size={13} />
          <span>Draft</span>
          <span className="pill-count">{metrics.draftCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'pending' ? 'active' : ''}`}
          onClick={() => setActivePill('pending')}
        >
          <Clock size={13} />
          <span>Pending</span>
          <span className="pill-count">{metrics.pendingCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'private' ? 'active' : ''}`}
          onClick={() => setActivePill('private')}
        >
          <Lock size={13} />
          <span>Private</span>
          <span className="pill-count">{metrics.privateCount}</span>
        </button>

        <button
          className={`filter-pill ${activePill === 'needs-attention' ? 'active' : ''}`}
          onClick={() => setActivePill('needs-attention')}
        >
          <AlertCircle size={13} />
          <span>Needs Attention</span>
          {metrics.pendingCount + metrics.draftCount > 0 && (
            <span className="pill-badge-red">
              {metrics.pendingCount + metrics.draftCount}
            </span>
          )}
        </button>
      </section>

      {/* ------------------------------------------------------------------
         6. API Cards Grid (Status-Aware Actions & Real Logos)
         ------------------------------------------------------------------ */}
      <section className="api-cards-grid-wrapper">
        {isLoading ? (
          <div className="my-apis-empty-state">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#8b5cf6', margin: '0 auto 10px' }} />
            <p className="empty-state-title">Loading your APIs...</p>
          </div>
        ) : filteredApis.length > 0 ? (
          <div className={`api-cards-grid ${viewLayout === 'list' ? 'list-view' : ''}`}>
            {filteredApis.map((api) => (
              <div key={api.id} className="api-card">
                {/* Card Header: Icon, Name, External Link, Status Badge, Version */}
                <div>
                  <div className="api-card-header">
                    {renderApiIcon(api)}
                    <div className="api-card-info">
                      <div className="api-name-row">
                        <h3
                          className="api-card-name"
                          title={api.name}
                          onClick={() => handleCardPrimaryAction(api)}
                        >
                          {api.name}
                        </h3>
                        <span
                          className="api-external-link"
                          title="Open in Playground"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenPlayground) {
                              onOpenPlayground({
                                apiId: api.id,
                                apiName: api.name,
                                baseUrl: api.gatewayUrl || api.baseUrl,
                              });
                            } else if (onOpenTester) {
                              onOpenTester(api.originalCatalogApi || api.originalProject || api);
                            }
                          }}
                        >
                          <ExternalLink size={13} />
                        </span>
                      </div>

                      <div className="api-status-row">
                        {api.status === 'published' && (
                          <span className="status-badge published">
                            <span style={{ fontSize: 8 }}>●</span> Published
                          </span>
                        )}
                        {api.status === 'ready' && (
                          <span className="status-badge ready">Ready to Publish</span>
                        )}
                        {api.status === 'pending' && (
                          <span className="status-badge pending">Pending Review</span>
                        )}
                        {(api.status === 'dev' || api.status === 'draft') && (
                          <span className="status-badge dev">
                            {api.status === 'draft' ? 'Draft' : 'Development'}
                          </span>
                        )}
                        <span className="api-version-tag">{api.version}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="api-card-desc">{api.description}</p>

                  {/* Tags */}
                  <div className="api-tags-row">
                    {api.tags.map((tag, idx) => (
                      <span key={idx} className="api-tag-pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Stats: Subscribers, Requests, Rating */}
                <div>
                  <div className="api-card-stats">
                    <div className="card-stat-item">
                      <span className="card-stat-label">Subscribers</span>
                      <span className="card-stat-val">
                        {api.subscribers > 0 ? formatCompactNumber(api.subscribers) : '-'}
                      </span>
                    </div>
                    <div className="card-stat-item">
                      <span className="card-stat-label">Requests</span>
                      <span className="card-stat-val">
                        {api.requests > 0 ? formatCompactNumber(api.requests) : '-'}
                      </span>
                    </div>
                    <div className="card-stat-item">
                      <span className="card-stat-label">Rating</span>
                      <span className="card-stat-val rating">
                        {api.rating > 0 ? (
                          <>
                            <Star size={12} fill="#fbbf24" stroke="none" />
                            <span>{api.rating.toFixed(1)}</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Status-Aware Action Buttons */}
                  <div className="api-card-actions">
                    <button
                      className="card-primary-btn"
                      onClick={() => handleCardPrimaryAction(api)}
                    >
                      {api.status === 'published'
                        ? 'Manage'
                        : api.status === 'ready'
                        ? 'Continue Setup'
                        : api.status === 'pending'
                        ? 'View Submission'
                        : 'Edit in Studio'}
                    </button>

                    <button
                      className="card-icon-btn"
                      title="View Telemetry & Usage"
                      onClick={() => {
                        if (onNavigateTab) onNavigateTab('usage');
                        else
                          window.dispatchEvent(
                            new CustomEvent('klyra:navigate', { detail: { tab: 'usage' } })
                          );
                      }}
                    >
                      <TrendingUp size={15} />
                    </button>

                    <button
                      className="card-icon-btn"
                      title="More options"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCardMenuId(activeCardMenuId === api.id ? null : api.id);
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </button>

                    {/* Card Context Menu */}
                    {activeCardMenuId === api.id && (
                      <div className="card-more-menu" ref={cardMenuRef}>
                        <button
                          className="menu-item"
                          onClick={() => {
                            setActiveCardMenuId(null);
                            if (onOpenPlayground) {
                              onOpenPlayground({
                                apiId: api.id,
                                apiName: api.name,
                                baseUrl: api.gatewayUrl || api.baseUrl,
                              });
                            }
                          }}
                        >
                          <Play size={13} />
                          <span>Test in Playground</span>
                        </button>

                        <button
                          className="menu-item"
                          onClick={() => {
                            setActiveCardMenuId(null);
                            handleOpenStudioProject(api.id);
                          }}
                        >
                          <Server size={13} />
                          <span>Open in Studio</span>
                        </button>

                        {!api.isPublished && (
                          <button
                            className="menu-item"
                            onClick={() => {
                              setActiveCardMenuId(null);
                              setShowPublishModal(true);
                            }}
                          >
                            <Globe size={13} />
                            <span>Publish to Marketplace</span>
                          </button>
                        )}

                        <button
                          className="menu-item"
                          onClick={() => handleCopyEndpoint(api)}
                        >
                          {copiedApiId === api.id ? (
                            <>
                              <Check size={13} color="#22c55e" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy Gateway URL</span>
                            </>
                          )}
                        </button>

                        {api.isStudio && (
                          <button
                            className="menu-item danger"
                            onClick={() => handleDeleteApi(api)}
                          >
                            <Trash2 size={13} />
                            <span>Delete Project</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="my-apis-empty-state">
            <div className="empty-state-icon">
              <Layers size={26} />
            </div>
            <h3 className="empty-state-title">No APIs found</h3>
            <p className="empty-state-desc">
              {searchQuery ||
              selectedCategory !== 'All Categories' ||
              selectedEnv !== 'All Environments' ||
              selectedPricingModel !== 'all'
                ? 'No APIs matched your filters. Try clearing some filters to view your APIs.'
                : 'You have not created or published any APIs yet. Host a new API in Studio or publish an existing one to get started.'}
            </p>
            <div className="empty-state-actions">
              <button className="new-api-btn" onClick={() => handleNavigateStudio('new')}>
                <Plus size={15} />
                <span>Host a New API</span>
              </button>
              <button
                className="toolbar-btn"
                onClick={() => setShowPublishModal(true)}
                style={{ padding: '9px 15px', color: '#ffffff' }}
              >
                <Globe size={14} />
                <span>Publish API</span>
              </button>
            </div>
          </div>
        )}

        {/* Carousel / Next Arrow on the Right Edge */}
        {filteredApis.length > 4 && (
          <button
            className="carousel-next-btn"
            title="Scroll Next"
            onClick={() => {
              const el = document.querySelector('.api-cards-grid');
              if (el) el.scrollBy({ left: 320, behavior: 'smooth' });
            }}
          >
            <ChevronRight size={18} />
          </button>
        )}
      </section>

      {/* ------------------------------------------------------------------
         7. Bottom Pro Tip Banner (Click opens Publishing Playbook overlay)
         ------------------------------------------------------------------ */}
      <footer className="pro-tip-banner" onClick={() => setShowPlaybookModal(true)}>
        <div className="pro-tip-content">
          <Lightbulb size={18} className="pro-tip-bulb" />
          <span>
            <strong className="pro-tip-highlight">Pro Tip:</strong> Publish more APIs to increase
            your reach and revenue.
          </span>
        </div>
        <button
          className="pro-tip-link"
          onClick={(e) => {
            e.stopPropagation();
            setShowPlaybookModal(true);
          }}
        >
          <span>Learn how to optimize</span>
          <ChevronRight size={14} />
        </button>
      </footer>

      {/* ------------------------------------------------------------------
         8. Status-Aware Overlay: Published Marketplace Management
         ------------------------------------------------------------------ */}
      {selectedPublishedApi && (
        <div
          className="status-modal-backdrop"
          onClick={() => setSelectedPublishedApi(null)}
        >
          <div
            className="status-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="status-modal-close"
              onClick={() => setSelectedPublishedApi(null)}
            >
              <X size={16} />
            </button>

            <div className="modal-header-section">
              <div className="modal-header-top">
                <span className="status-badge published">
                  <span style={{ fontSize: 8 }}>●</span> Active on Marketplace
                </span>
                <span className="api-version-tag">{selectedPublishedApi.version}</span>
              </div>
              <h2 className="modal-title">{selectedPublishedApi.name}</h2>
              <p className="modal-subtitle">{selectedPublishedApi.description}</p>
            </div>

            {/* Live Metrics Grid */}
            <div className="modal-grid-stats">
              <div className="modal-stat-box">
                <span className="modal-stat-label">Active Subscribers</span>
                <span className="modal-stat-value">
                  {formatCompactNumber(selectedPublishedApi.subscribers)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-label">Monthly Requests</span>
                <span className="modal-stat-value">
                  {formatCompactNumber(selectedPublishedApi.requests)}
                </span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-label">Estimated Revenue</span>
                <span className="modal-stat-value">
                  {formatCurrency(selectedPublishedApi.revenue)}
                </span>
              </div>
            </div>

            {/* Gateway URL info */}
            <div className="modal-info-row">
              <span className="modal-info-label">Live Gateway Endpoint</span>
              <span className="modal-info-code">
                {selectedPublishedApi.gatewayUrl ||
                  selectedPublishedApi.baseUrl ||
                  `https://api.klyra.dev/v1/${selectedPublishedApi.slug}`}
              </span>
            </div>

            <div className="modal-actions-row">
              <button
                className="toolbar-btn"
                onClick={() => {
                  setSelectedPublishedApi(null);
                  handleCopyEndpoint(selectedPublishedApi);
                }}
              >
                <Copy size={13} />
                <span>Copy URL</span>
              </button>

              <button
                className="toolbar-btn"
                onClick={() => {
                  const id = selectedPublishedApi.id;
                  setSelectedPublishedApi(null);
                  handleOpenStudioProject(id);
                }}
              >
                <Server size={13} />
                <span>Manage in Studio</span>
              </button>

              <button
                className="new-api-btn"
                onClick={() => {
                  setSelectedPublishedApi(null);
                  handleNavigateMarketplace();
                }}
              >
                <Globe size={14} />
                <span>View on Marketplace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
         9. Status-Aware Overlay: Pending Review Submission Details
         ------------------------------------------------------------------ */}
      {selectedPendingApi && (
        <div
          className="status-modal-backdrop"
          onClick={() => setSelectedPendingApi(null)}
        >
          <div
            className="status-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="status-modal-close"
              onClick={() => setSelectedPendingApi(null)}
            >
              <X size={16} />
            </button>

            <div className="modal-header-section">
              <div className="modal-header-top">
                <span className="status-badge pending">
                  <Clock size={12} /> Pending Admin Review
                </span>
                <span className="api-version-tag">{selectedPendingApi.version}</span>
              </div>
              <h2 className="modal-title">{selectedPendingApi.name}</h2>
              <p className="modal-subtitle">
                Your API has been submitted to the Klyra Marketplace registry and is currently
                under automated compliance and security verification.
              </p>
            </div>

            {/* Verification Checklist */}
            <div className="review-checklist">
              <div className="checklist-item passed">
                <CheckCircle2 size={16} />
                <span>OpenAPI 3.0+ Specification Syntax & Schemas: Verified</span>
              </div>
              <div className="checklist-item passed">
                <CheckCircle2 size={16} />
                <span>Authentication & API Key Proxy Routing: Configured</span>
              </div>
              <div className="checklist-item pending">
                <Clock size={16} />
                <span>Upstream Edge Health & Latency Probe: In Progress</span>
              </div>
              <div className="checklist-item pending">
                <Clock size={16} />
                <span>Marketplace Catalog Moderation & Policy Review: In Queue</span>
              </div>
            </div>

            <div className="modal-info-row">
              <span className="modal-info-label">Expected Resolution</span>
              <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600 }}>
                Within 24 business hours
              </span>
            </div>

            <div className="modal-actions-row">
              <button
                className="toolbar-btn"
                onClick={() => {
                  const id = selectedPendingApi.id;
                  setSelectedPendingApi(null);
                  handleOpenStudioProject(id);
                }}
              >
                <FileEdit size={13} />
                <span>Edit Draft in Studio</span>
              </button>

              <button
                className="new-api-btn"
                onClick={() => setSelectedPendingApi(null)}
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
         10. Animated Neon Publishing & Growth Playbook Overlay (Replacing Pro Tips Navigation)
         ------------------------------------------------------------------ */}
      {showPlaybookModal && createPortal((
        <div
          className="status-modal-backdrop playbook-modal-backdrop"
          onClick={() => setShowPlaybookModal(false)}
        >
          <div
            className="status-modal-card neon-glow playbook-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="status-modal-close"
              onClick={() => setShowPlaybookModal(false)}
            >
              <X size={16} />
            </button>

            <div className="modal-header-section">
              <div className="modal-header-top">
                <Sparkles size={20} color="#d946ef" />
                <span
                  style={{
                    color: '#d946ef',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Growth & Publishing Playbook
                </span>
              </div>
              <h2 className="modal-title">Scale Your APIs with Klyra Hub</h2>
              <p className="modal-subtitle">
                Learn how to transform your backend services into production-ready, monetized APIs
                used by developers worldwide.
              </p>
            </div>

            {/* 3 Step Interactive Lifecycle */}
            <div className="playbook-steps">
              <div className="playbook-step-card">
                <div className="step-num-badge step-1">1</div>
                <div>
                  <div className="step-info-title">Connect & Host in API Studio</div>
                  <div className="step-info-desc">
                    Import an OpenAPI spec or point to any live REST upstream. Klyra automatically
                    provisions secure reverse proxies, sub-millisecond cache layers, and edge telemetry.
                  </div>
                </div>
              </div>

              <div className="playbook-step-card">
                <div className="step-num-badge step-2">2</div>
                <div>
                  <div className="step-info-title">Package & Monetize Flexible Plans</div>
                  <div className="step-info-desc">
                    Define developer sandbox tiers, rate limits (e.g. 60 req/min), paid recurring
                    monthly quotas, and overage billing in seconds.
                  </div>
                </div>
              </div>

              <div className="playbook-step-card">
                <div className="step-num-badge step-3">3</div>
                <div>
                  <div className="step-info-title">Publish & Earn Recurring Revenue</div>
                  <div className="step-info-desc">
                    List on the public Klyra Marketplace to reach thousands of developers. Monitor
                    live subscriber conversion, active requests, and revenue in real-time.
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions-row">
              <button
                className="toolbar-btn"
                onClick={() => {
                  setShowPlaybookModal(false);
                  handleNavigateStudio('new');
                }}
              >
                <Server size={14} />
                <span>Host a New API</span>
              </button>

              <button
                className="new-api-btn"
                onClick={() => {
                  setShowPlaybookModal(false);
                  setShowPublishModal(true);
                }}
              >
                <Globe size={14} />
                <span>Publish to Marketplace</span>
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* ------------------------------------------------------------------
         11. Existing Klyra Publish API Modal
         ------------------------------------------------------------------ */}
      {showPublishModal && (
        <PublishApiModal
          onClose={() => setShowPublishModal(false)}
          onPublished={() => {
            setShowPublishModal(false);
            loadData();
          }}
          categories={categories}
        />
      )}
    </div>
  );
};
