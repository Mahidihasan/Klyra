import React from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, Plus, X } from 'lucide-react';

interface MarketplaceHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalResults: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  sortBy: string;
  onSortChange: (sort: any) => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  activeFilterCount: number;
  activeFilters: Array<{
    key: 'category' | 'pricingModel' | 'minRating' | 'maxLatency';
    label: string;
  }>;
  onRemoveFilter: (key: 'category' | 'pricingModel' | 'minRating' | 'maxLatency') => void;
  onClearFilters: () => void;
  onOpenPublish: () => void;
}

export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  searchQuery,
  onSearchChange,
  totalResults,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  isFilterOpen,
  onToggleFilter,
  activeFilterCount,
  activeFilters,
  onRemoveFilter,
  onClearFilters,
  onOpenPublish,
}) => {

  return (
    <div className="marketplace-header-bar">
      <div className="mp-top-row">
        <div className="mp-title-cluster">
          <div className="mp-title-aura" aria-hidden="true" />
          <div className="mp-title-line-wrap">
            <h1 className="mp-page-title">
              <span className="mp-title-text">API Marketplace</span>
            </h1>
            <span className="mp-title-tracker" aria-hidden="true" />
          </div>
          <p className="mp-page-subtitle">
            Find reliable APIs, compare live signals, and move from discovery to integration.
          </p>
        </div>

        <div className="mp-header-actions">
          <button
            className="mp-publish-btn"
            onClick={() => {
              if (onOpenPublish) {
                onOpenPublish();
              } else {
                window.dispatchEvent(
                  new CustomEvent('klyra:navigate', {
                    detail: { tab: 'api-build', apiBuildView: 'new' },
                  })
                );
              }
            }}
            title="Publish API to Marketplace"
          >
            <span className="mp-publish-shimmer" />
            <Plus size={15} />
            <span>Publish API</span>
          </button>
        </div>
      </div>

      <div className="mp-controls-row">
        {/* Search Bar */}
        <div className="mp-search-container">
          <Search size={16} className="mp-search-icon" />
          <input
            type="text"
            className="mp-search-input"
            placeholder="Search APIs by name, keyword, tag, or description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="mp-search-clear" onClick={() => onSearchChange('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="mp-actions-cluster">
          {/* Filter Toggle */}
          <button
            className={`mp-filter-toggle-btn ${
              isFilterOpen || activeFilterCount > 0 ? 'active' : ''
            }`}
            onClick={onToggleFilter}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeFilterCount > 0 && <span className="mp-filter-badge">{activeFilterCount}</span>}
          </button>

          {/* Sort Dropdown */}
          <div className="mp-sort-box">
            <span className="mp-sort-label">Sort:</span>
            <select
              className="mp-sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
            >
              <option value="trending">Trending</option>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newly Launched</option>
              <option value="latency">Fastest Latency</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>

          {/* View Switcher */}
          <div className="mp-view-switcher">
            <button
              className={`mp-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              title="Grid View"
              onClick={() => onViewModeChange('grid')}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`mp-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="List View"
              onClick={() => onViewModeChange('list')}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="mp-active-filters" aria-label="Active filters">
          <span className="mp-active-label">Filtered by</span>
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              className="mp-filter-chip"
              onClick={() => onRemoveFilter(filter.key)}
            >
              {filter.label}
              <X size={11} />
            </button>
          ))}
          <button className="mp-clear-filters" onClick={onClearFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* Results summary row */}
      <div className="mp-results-meta">
        <span className="mp-results-count">
          <b>{totalResults.toLocaleString()}</b> APIs in the catalog
        </span>
        <span className="mp-results-hint">
          {searchQuery
            ? `Searching for “${searchQuery}”`
            : 'Curated by relevance, quality, and usage'}
        </span>
      </div>

      <style>{`
        .marketplace-header-bar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 14px;
        }

        .mp-top-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .mp-title-cluster {
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .mp-title-aura {
          position: absolute;
          top: -10px;
          left: -12px;
          width: 220px;
          height: 44px;
          border-radius: 999px;
          background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.14) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 75%);
          filter: blur(14px);
          pointer-events: none;
          z-index: 0;
          will-change: transform, opacity;
          animation: mp-aura-breathe 7.5s ease-in-out infinite alternate;
          transition: opacity 0.4s ease, filter 0.4s ease;
        }

        .mp-title-cluster:hover .mp-title-aura {
          opacity: 0.9;
          filter: blur(12px);
        }

        .mp-title-line-wrap {
          position: relative;
          display: inline-flex;
          align-items: baseline;
          width: fit-content;
          z-index: 1;
        }

        .mp-page-title {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.025em;
          line-height: 1.18;
          margin: 0 0 3px 0;
          will-change: transform, opacity, filter;
          animation: mp-title-calibrate 0.85s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .mp-title-text {
          display: inline-block;
          background: linear-gradient(
            115deg,
            #f8fafc 0%,
            #f1f5f9 22%,
            #ffffff 38%,
            #c4b5fd 47%,
            #818cf8 51%,
            #c084fc 55%,
            #f1f5f9 64%,
            #f8fafc 85%,
            #f8fafc 100%
          );
          background-size: 280% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          will-change: background-position;
          animation: mp-quantum-refract 8.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s infinite;
        }

        .mp-title-tracker {
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 42px;
          height: 1.5px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(139, 92, 246, 0.25) 15%,
            rgba(196, 181, 253, 0.95) 50%,
            rgba(217, 70, 239, 0.35) 85%,
            transparent 100%
          );
          pointer-events: none;
          opacity: 0;
          will-change: transform, opacity, left;
          animation: mp-tracker-glide 8.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s infinite;
        }

        .mp-page-subtitle {
          font-size: 13px;
          line-height: 1.4;
          color: var(--text-secondary);
          max-width: 580px;
          margin: 0;
          animation: mp-sub-calibrate 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
        }

        .mp-cart-btn {
          height: 38px;
          padding: 0 14px;
          border-radius: var(--radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
          align-self: flex-start;
        }

        .mp-cart-btn:hover {
          color: var(--text-primary);
          border-color: rgba(139, 92, 246, 0.45);
          background: var(--bg-card-hover);
          transform: translateY(-1px);
        }

        .mp-cart-btn.has-items {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(99, 102, 241, 0.22) 100%);
          border-color: rgba(167, 139, 250, 0.6);
          color: #ffffff;
          box-shadow: 0 0 16px rgba(139, 92, 246, 0.25);
          animation: cartBreathingGlow 3s ease-in-out infinite;
        }

        .mp-cart-btn.just-added {
          animation: cartBouncePop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes cartBreathingGlow {
          0%, 100% {
            border-color: rgba(139, 92, 246, 0.45);
            box-shadow: 0 0 14px rgba(139, 92, 246, 0.2);
          }
          50% {
            border-color: rgba(192, 132, 252, 0.85);
            box-shadow: 0 0 24px rgba(192, 132, 252, 0.45), 0 0 6px rgba(139, 92, 246, 0.35);
          }
        }

        @keyframes cartBouncePop {
          0% { transform: scale(1); }
          30% { transform: scale(1.14); }
          60% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }

        .mp-cart-icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mp-cart-count {
          position: absolute;
          top: -8px;
          right: -10px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          min-width: 17px;
          height: 17px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
          box-shadow: 0 2px 6px rgba(236, 72, 153, 0.4);
          animation: badgePulse 2s ease-in-out infinite alternate;
        }

        @keyframes badgePulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }

        .mp-cart-beacon {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: beaconPulse 2s ease-in-out infinite;
        }

        @keyframes beaconPulse {
          0%, 100% { opacity: 0.7; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.3); }
        }

        .mp-publish-btn {
          position: relative;
          overflow: hidden;
          height: 38px;
          padding: 0 16px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
          align-self: flex-start;
        }

        .mp-publish-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
          filter: brightness(1.08);
        }

        .mp-publish-shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.28),
            transparent
          );
          transform: skewX(-20deg);
          animation: publishShimmerSweep 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          pointer-events: none;
        }

        @keyframes publishShimmerSweep {
          0% { left: -100%; }
          35%, 100% { left: 160%; }
        }


        .mp-controls-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .mp-search-container {
          flex: 1;
          min-width: 240px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .mp-search-icon {
          position: absolute;
          left: 13px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .mp-search-input {
          width: 100%;
          height: 38px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 0 34px 0 38px;
          color: var(--text-primary);
          font-size: 13px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .mp-search-input:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
          background: var(--bg-card-hover);
        }

        .mp-search-container:focus-within .mp-search-icon { color: var(--text-accent); }

        .mp-search-clear {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mp-actions-cluster {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .mp-filter-toggle-btn {
          height: 38px;
          padding: 0 13px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .mp-filter-toggle-btn:hover,
        .mp-filter-toggle-btn.active {
          color: var(--text-primary);
          border-color: rgba(139, 92, 246, 0.4);
          background: var(--bg-card-hover);
        }

        .mp-filter-badge {
          background: var(--accent-purple);
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 999px;
        }

        .mp-sort-box {
          display: flex;
          align-items: center;
          gap: 5px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          height: 38px;
          padding: 0 10px;
        }

        .mp-sort-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .mp-sort-select {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          outline: none;
        }

        .mp-sort-select option {
          background: #141524;
          color: #f8fafc;
        }

        .mp-view-switcher {
          display: flex;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          height: 38px;
          padding: 2px;
          box-sizing: border-box;
        }

        .mp-view-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--text-muted);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mp-view-btn:hover {
          color: var(--text-primary);
        }

        .mp-view-btn.active {
          background: rgba(139, 92, 246, 0.2);
          color: var(--accent-purple);
        }

        .mp-results-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-muted);
          border-top: 1px solid var(--border-subtle);
          padding-top: 8px;
          margin-top: -2px;
        }

        .mp-active-filters {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: -3px;
        }

        .mp-active-label {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          margin-right: 2px;
        }

        .mp-filter-chip {
          align-items: center;
          background: var(--accent-subtle);
          border: 1px solid var(--accent-subtle-border);
          border-radius: 999px;
          color: var(--text-accent);
          display: inline-flex;
          font-size: 11px;
          gap: 5px;
          padding: 3px 8px 3px 9px;
          transition: background 0.18s ease, border-color 0.18s ease;
        }

        .mp-filter-chip:hover { background: var(--bg-card-hover); border-color: var(--accent-purple); }

        .mp-clear-filters {
          color: var(--text-secondary);
          font-size: 11px;
          padding: 3px 5px;
        }

        .mp-clear-filters:hover { color: var(--text-primary); }

        .mp-results-count b { color: var(--text-primary); }

        .mp-results-hint {
          color: var(--text-muted);
          font-size: 11px;
        }

        @keyframes mp-title-calibrate {
          from {
            opacity: 0;
            transform: translateY(6px) translateZ(0);
            filter: blur(4px);
            letter-spacing: -0.01em;
          }
          to {
            opacity: 1;
            transform: translateY(0) translateZ(0);
            filter: blur(0);
            letter-spacing: -0.025em;
          }
        }

        @keyframes mp-sub-calibrate {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes mp-quantum-refract {
          0% { background-position: 100% 50%; }
          26% { background-position: 0% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes mp-tracker-glide {
          0% { left: 0%; opacity: 0; transform: scaleX(0.4); }
          3% { opacity: 0.9; transform: scaleX(1); }
          23% { left: calc(100% - 42px); opacity: 0.9; transform: scaleX(1); }
          26% { left: 100%; opacity: 0; transform: scaleX(0.3); }
          100% { left: 100%; opacity: 0; transform: scaleX(0.3); }
        }

        @keyframes mp-aura-breathe {
          0% { opacity: 0.4; transform: scale(0.96) translateX(-3px); }
          100% { opacity: 0.75; transform: scale(1.04) translateX(3px); }
        }

        @media (max-width: 640px) {
          .mp-page-title { font-size: 22px; }
          .mp-search-container { min-width: 100%; }
          .mp-actions-cluster { width: 100%; }
          .mp-filter-toggle-btn, .mp-sort-box { flex: 1; justify-content: center; }
          .mp-view-switcher { margin-left: auto; }
          .mp-results-hint { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mp-page-title,
          .mp-title-text,
          .mp-title-tracker,
          .mp-title-aura,
          .mp-page-subtitle {
            animation: none !important;
            background-position: 0% 50% !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
          .mp-title-tracker {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
