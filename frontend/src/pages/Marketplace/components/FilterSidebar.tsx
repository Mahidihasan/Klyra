import React from 'react';
import {
  Brain,
  Wallet,
  CloudSun,
  Terminal,
  MessageSquare,
  ShoppingBag,
  Newspaper,
  Shield,
  Layers,
  Star,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CatalogCategory } from '../../../services/api/catalog';

const ICON_MAP: Record<string, React.FC<any>> = {
  Brain,
  Wallet,
  CloudSun,
  Terminal,
  MessageSquare,
  ShoppingBag,
  Newspaper,
  Shield,
  Layers,
  Star,
};

interface FilterState {
  category: string;
  pricingModel: string;
  minRating: number;
  maxLatency: number;
}

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  categories: CatalogCategory[];
  totalResults: number;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  categories,
  totalResults,
}) => {
  const [draftFilters, setDraftFilters] = React.useState(filters);
  const [expandedSections, setExpandedSections] = React.useState({
    category: true,
    pricing: true,
    rating: true,
    latency: false,
  });

  React.useEffect(() => {
    if (isOpen) setDraftFilters(filters);
  }, [isOpen, filters]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const clearAll = () => {
    const defaultFilters = { category: 'all', pricingModel: 'all', minRating: 0, maxLatency: 0 };
    setDraftFilters(defaultFilters);
    onApplyFilters(defaultFilters);
  };

  const pricingOptions = [
    { value: 'all', label: 'All Plans' },
    { value: 'FREE', label: 'Free' },
    { value: 'FREEMIUM', label: 'Freemium' },
    { value: 'PAID', label: 'Paid' },
    { value: 'ENTERPRISE', label: 'Enterprise' },
  ];

  const activeCount =
    (draftFilters.category !== 'all' ? 1 : 0) +
    (draftFilters.pricingModel !== 'all' ? 1 : 0) +
    (draftFilters.minRating > 0 ? 1 : 0) +
    (draftFilters.maxLatency > 0 ? 1 : 0);

  const ratingOptions = [
    { value: 0, label: 'Any Rating' },
    { value: 4.5, label: '4.5+ Stars' },
    { value: 4.0, label: '4.0+ Stars' },
    { value: 3.5, label: '3.5+ Stars' },
    { value: 3.0, label: '3.0+ Stars' },
  ];

  const latencyOptions = [
    { value: 0, label: 'Any Latency' },
    { value: 50, label: '< 50ms (Ultra Fast)' },
    { value: 100, label: '< 100ms (Fast)' },
    { value: 200, label: '< 200ms (Normal)' },
    { value: 500, label: '< 500ms' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="fs-backdrop" onClick={onClose} />}

      <aside className={`filter-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="fs-header">
          <div>
            <h3 className="fs-title">Refine discovery</h3>
            <p className="fs-result-count">{totalResults.toLocaleString()} APIs match</p>
          </div>
          <div className="fs-header-actions">
            {activeCount > 0 && (
              <button className="fs-clear-btn" onClick={clearAll}>
                Clear all ({activeCount})
              </button>
            )}
            <button className="fs-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="fs-body">
          {/* Categories */}
          <div className="fs-section">
            <button className="fs-section-toggle" onClick={() => toggleSection('category')}>
              <span>Categories</span>
              {expandedSections.category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.category && (
              <div className="fs-section-content">
                <button
                  className={`fs-cat-btn ${draftFilters.category === 'all' ? 'active' : ''}`}
                  onClick={() => updateFilter('category', 'all')}
                >
                  <Layers size={14} />
                  <span>All Categories</span>
                  <span className="fs-cat-count">
                    {categories.reduce((sum, c) => sum + c.apiCount, 0)}
                  </span>
                </button>
                {categories.map((cat) => {
                  const IconComp = ICON_MAP[cat.iconName] || Layers;
                  return (
                    <button
                      key={cat.id}
                      className={`fs-cat-btn ${draftFilters.category === cat.slug ? 'active' : ''}`}
                      onClick={() => updateFilter('category', cat.slug)}
                    >
                      <IconComp size={14} />
                      <span>{cat.name}</span>
                      <span className="fs-cat-count">{cat.apiCount}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="fs-section">
            <button className="fs-section-toggle" onClick={() => toggleSection('pricing')}>
              <span>Pricing</span>
              {expandedSections.pricing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.pricing && (
              <div className="fs-section-content">
                {pricingOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`fs-radio-item ${
                      draftFilters.pricingModel === opt.value ? 'active' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="pricing"
                      checked={draftFilters.pricingModel === opt.value}
                      onChange={() => updateFilter('pricingModel', opt.value)}
                    />
                    <span className="fs-radio-dot" />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="fs-section">
            <button className="fs-section-toggle" onClick={() => toggleSection('rating')}>
              <span>Minimum Rating</span>
              {expandedSections.rating ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.rating && (
              <div className="fs-section-content">
                {ratingOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`fs-radio-item ${
                      draftFilters.minRating === opt.value ? 'active' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="rating"
                      checked={draftFilters.minRating === opt.value}
                      onChange={() => updateFilter('minRating', opt.value)}
                    />
                    <span className="fs-radio-dot" />
                    <span className="fs-rating-label">
                      {opt.value > 0 && (
                        <span className="fs-stars">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={11}
                              fill={i < Math.floor(opt.value) ? '#f59e0b' : 'none'}
                              stroke={i < Math.floor(opt.value) ? '#f59e0b' : '#64748b'}
                            />
                          ))}
                        </span>
                      )}
                      <span>{opt.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Latency */}
          <div className="fs-section">
            <button className="fs-section-toggle" onClick={() => toggleSection('latency')}>
              <span>Performance &amp; Latency</span>
              {expandedSections.latency ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.latency && (
              <div className="fs-section-content">
                {latencyOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`fs-radio-item ${
                      draftFilters.maxLatency === opt.value ? 'active' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="latency"
                      checked={draftFilters.maxLatency === opt.value}
                      onChange={() => updateFilter('maxLatency', opt.value)}
                    />
                    <span className="fs-radio-dot" />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="fs-footer">
          <span>
            {totalResults.toLocaleString()} result{totalResults === 1 ? '' : 's'}
          </span>
          <div className="fs-footer-actions">
            <button className="fs-reset-btn" onClick={clearAll}>
              Reset
            </button>
            <button className="fs-apply-btn" onClick={() => onApplyFilters(draftFilters)}>
              Apply Filters
            </button>
          </div>
        </div>

        <style>{`
          .filter-sidebar {
            width: min(380px, 100vw);
            min-width: min(380px, 100vw);
            height: calc(100vh - var(--topbar-height));
            max-height: none;
            right: 0;
            top: var(--topbar-height);
            bottom: 0;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-lg) 0 0 var(--radius-lg);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: width 0.28s ease, min-width 0.28s ease, opacity 0.2s ease, transform 0.28s ease;
            position: fixed;
            z-index: 1000;
            transform: translateX(100%);
            box-shadow: -18px 0 44px rgba(0, 0, 0, 0.32);
          }

          .filter-sidebar.open { transform: translateX(0); }

          @media (max-width: 900px) {
            .filter-sidebar {
              top: 0;
              bottom: 0;
              height: 100vh;
              border-radius: var(--radius-lg) 0 0 var(--radius-lg);
            }
            .fs-backdrop {
              position: fixed;
              inset: 0;
              z-index: 999;
              background: rgba(3, 4, 10, 0.62);
              backdrop-filter: blur(3px);
            }
          }

          @media (min-width: 901px) {
            .filter-sidebar:not(.open) { pointer-events: none; }
            .fs-close-btn { display: none; }
            .fs-backdrop { position: fixed; inset: 0; z-index: 999; background: rgba(3, 4, 10, 0.35); backdrop-filter: blur(2px); }
          }

          .fs-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            border-bottom: 1px solid var(--border-subtle);
          }

          .fs-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .fs-result-count {
            margin-top: 2px;
            color: var(--text-muted);
            font-size: 11px;
          }

          .fs-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .fs-clear-btn {
            font-size: 11px;
            color: var(--accent-purple);
            background: none;
            border: none;
            cursor: pointer;
            font-weight: 500;
          }

          .fs-clear-btn:hover { text-decoration: underline; }

          .fs-close-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            display: flex;
            align-items: center;
          }

          .fs-body {
            flex: 1;
            min-height: 0;
            padding: 8px 0;
            overflow-y: auto;
            max-height: none;
          }

          .fs-footer {
            align-items: center;
            border-top: 1px solid var(--border-subtle);
            color: var(--text-muted);
            display: flex;
            font-size: 11px;
            justify-content: space-between;
            padding: 12px 16px;
            flex-shrink: 0;
          }

          .fs-apply-btn {
            background: var(--accent-gradient);
            border-radius: var(--radius-sm);
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 6px 12px;
          }

          .fs-apply-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }

          .fs-footer-actions {
            align-items: center;
            display: flex;
            gap: 8px;
          }

          .fs-reset-btn {
            border: 1px solid var(--border-card);
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            font-size: 11px;
            padding: 6px 10px;
          }

          .fs-reset-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }

          .fs-section {
            border-bottom: 1px solid var(--border-subtle);
          }

          .fs-section:last-child { border-bottom: none; }

          .fs-section-toggle {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .fs-section-toggle:hover { color: var(--text-accent); }

          .fs-section-content {
            padding: 0 12px 12px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .fs-cat-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: var(--radius-md);
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 12.5px;
            cursor: pointer;
            transition: all 0.15s ease;
            width: 100%;
            text-align: left;
          }

          .fs-cat-btn:hover {
            background: var(--bg-card-hover);
            color: var(--text-primary);
          }

          .fs-cat-btn.active {
            background: var(--accent-subtle);
            color: var(--accent-purple);
            font-weight: 600;
          }

          .fs-cat-count {
            margin-left: auto;
            font-size: 11px;
            color: var(--text-muted);
            background: var(--bg-pill);
            padding: 1px 6px;
            border-radius: 999px;
          }

          .fs-radio-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: 12.5px;
            color: var(--text-secondary);
            transition: all 0.15s ease;
          }

          .fs-radio-item:hover {
            background: var(--bg-card-hover);
            color: var(--text-primary);
          }

          .fs-radio-item.active {
            color: var(--text-primary);
          }

          .fs-radio-item input[type="radio"] {
            display: none;
          }

          .fs-radio-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid var(--border-card);
            flex-shrink: 0;
            transition: all 0.2s ease;
            position: relative;
          }

          .fs-radio-item.active .fs-radio-dot {
            border-color: var(--accent-purple);
          }

          .fs-radio-item.active .fs-radio-dot::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--accent-purple);
          }

          .fs-rating-label {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .fs-stars {
            display: flex;
            gap: 1px;
          }
        `}</style>
      </aside>
    </>
  );
};
