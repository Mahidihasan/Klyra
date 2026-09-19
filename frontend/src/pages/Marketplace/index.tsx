import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CatalogApi,
  CatalogCategory,
  BrowseApisQuery,
  catalogApi,
} from '../../services/api/catalog';
import { MarketplaceHeader } from './components/MarketplaceHeader';
import { FilterSidebar } from './components/FilterSidebar';
import { ApiGridView } from './components/ApiGridView';
import { ApiListView } from './components/ApiListView';
import { ApiDetailPage } from './ApiDetailPage';
import { ProviderProfileModal } from './ProviderProfileModal';
import { PublishApiModal } from './PublishApiModal';

interface MarketplacePageProps {
  initialSearch?: string;
  initialCategory?: string;
  onOpenTester?: (api: any) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  initialSearch = '',
  initialCategory = '',
  onOpenTester,
}) => {
  return (
    <MarketplaceContent
      initialSearch={initialSearch}
      initialCategory={initialCategory}
      onOpenTester={onOpenTester}
    />
  );
};

const MarketplaceContent: React.FC<MarketplacePageProps> = ({
  initialSearch = '',
  initialCategory = '',
  onOpenTester,
}) => {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Data state
  const [apis, setApis] = useState<CatalogApi[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Query state
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<string>('trending');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    category: initialCategory || 'all',
    pricingModel: 'all',
    minRating: 0,
    maxLatency: 0,
  });

  // Modal state
  const [selectedApi, setSelectedApi] = useState<CatalogApi | null>(null);
  const [providerModalId, setProviderModalId] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    catalogApi
      .getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Fetch APIs whenever query state changes
  const fetchApis = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsLoading(true);
    try {
      const query: BrowseApisQuery = {
        page: currentPage,
        limit: 16,
        search: searchQuery || undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        pricingModel: filters.pricingModel !== 'all' ? filters.pricingModel : undefined,
        minRating: filters.minRating > 0 ? filters.minRating : undefined,
        maxLatency: filters.maxLatency > 0 ? filters.maxLatency : undefined,
        sort: sortBy as any,
      };
      const result = await catalogApi.browseApis(query, controller.signal);
      if (requestId !== requestIdRef.current) return;
      setApis(result.apis);
      setTotalResults(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch {
      // Fallback handled in catalogApi
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [searchQuery, filters, sortBy, currentPage]);

  useEffect(() => {
    void fetchApis();
    return () => requestControllerRef.current?.abort();
  }, [fetchApis]);

  // Debounced search
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleApplyFilters = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handleSelectApi = async (api: CatalogApi) => {
    // Fetch full details including pricing plans
    try {
      const fullApi = await catalogApi.getApiBySlugOrId(api.slug || api.id);
      setSelectedApi(fullApi);
    } catch {
      setSelectedApi(api);
    }
  };

  const activeFilterCount =
    (filters.category !== 'all' ? 1 : 0) +
    (filters.pricingModel !== 'all' ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.maxLatency > 0 ? 1 : 0);

  const activeFilters = [
    filters.category !== 'all' && {
      key: 'category' as const,
      label:
        categories.find((category) => category.slug === filters.category)?.name || filters.category,
    },
    filters.pricingModel !== 'all' && {
      key: 'pricingModel' as const,
      label:
        filters.pricingModel === 'FREE'
          ? 'Free'
          : filters.pricingModel === 'FREEMIUM'
          ? 'Freemium'
          : filters.pricingModel === 'PAID'
          ? 'Paid'
          : 'Enterprise',
    },
    filters.minRating > 0 && { key: 'minRating' as const, label: `${filters.minRating}+ stars` },
    filters.maxLatency > 0 && { key: 'maxLatency' as const, label: `< ${filters.maxLatency}ms` },
  ].filter(Boolean) as Array<{ key: keyof typeof filters; label: string }>;

  // If an API is selected, show detail page
  if (selectedApi) {
    return (
      <div className="mp-page-container">
        <ApiDetailPage
          api={selectedApi}
          onBack={() => setSelectedApi(null)}
          onOpenProvider={(id) => setProviderModalId(id)}
          onOpenTester={onOpenTester ? (api) => onOpenTester(api) : undefined}
        />

        {providerModalId && (
          <ProviderProfileModal
            providerId={providerModalId}
            onClose={() => setProviderModalId(null)}
            onSelectApi={(api) => {
              setProviderModalId(null);
              handleSelectApi(api);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mp-page-container">
      {/* Header: Title, Search, Filters Toggle, Sort, View Switcher */}
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        totalResults={totalResults}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        isFilterOpen={isFilterOpen}
        onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
        activeFilterCount={activeFilterCount}
        activeFilters={activeFilters}
        onRemoveFilter={(key) =>
          handleApplyFilters({
            ...filters,
            [key]: key === 'category' || key === 'pricingModel' ? 'all' : 0,
          })
        }
        onClearFilters={() =>
          handleApplyFilters({ category: 'all', pricingModel: 'all', minRating: 0, maxLatency: 0 })
        }
        onOpenPublish={() => setShowPublish(true)}
      />

      {/* Main Content Area */}
      <div className="mp-content-area">
        {/* Filter Sidebar */}
        <FilterSidebar
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={filters}
          onApplyFilters={handleApplyFilters}
          categories={categories}
          totalResults={totalResults}
        />

        {/* Results */}
        <div className="mp-results-area">
          {viewMode === 'grid' ? (
            <ApiGridView
              apis={apis}
              onSelectApi={handleSelectApi}
              onOpenProvider={(id) => setProviderModalId(id)}
              isLoading={isLoading}
            />
          ) : (
            <ApiListView
              apis={apis}
              onSelectApi={handleSelectApi}
              onOpenProvider={(id) => setProviderModalId(id)}
              isLoading={isLoading}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mp-pagination">
              <button
                className="mp-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`mp-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="mp-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Provider Profile Modal */}
      {providerModalId && (
        <ProviderProfileModal
          providerId={providerModalId}
          onClose={() => setProviderModalId(null)}
          onSelectApi={(api) => {
            setProviderModalId(null);
            handleSelectApi(api);
          }}
        />
      )}

      {/* Publish API Modal */}
      {showPublish && (
        <PublishApiModal
          onClose={() => setShowPublish(false)}
          onPublished={() => {
            fetchApis();
          }}
          categories={categories}
        />
      )}

      <style>{`
        .mp-page-container {
          padding: 0 0 20px 0;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .mp-content-area {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .mp-results-area {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Pagination */
        .mp-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 16px 0;
        }

        .mp-page-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-card);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mp-page-btn:hover:not(:disabled) {
          border-color: rgba(139, 92, 246, 0.4);
          color: var(--text-primary);
        }

        .mp-page-btn.active {
          background: var(--accent-gradient);
          color: #fff;
          border-color: transparent;
          font-weight: 700;
        }

        .mp-page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .mp-page-container { padding: 0 0 16px 0; }
        }
      `}</style>
    </div>
  );
};

export default MarketplacePage;
