-- ============================================================================
-- Marketplace Enhancements Migration
-- Adds performance metric caching, trending/popularity score columns,
-- icon identifiers for categories, and optimized catalog indexes.
-- ============================================================================

BEGIN;

-- 1. Performance metrics & algorithmic score columns on apis
ALTER TABLE apis ADD COLUMN IF NOT EXISTS latency_ms INTEGER DEFAULT 120;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS uptime_percentage DECIMAL(5,2) DEFAULT 99.95;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS trending_score DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS popularity_score DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS highlights TEXT[] DEFAULT '{}';

-- 2. Category icon identifier support for dynamic modern Lucide icons
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'Layers';

-- 3. Indexes for fast catalog browsing, trending queries, and search ranking
CREATE INDEX IF NOT EXISTS idx_apis_trending ON apis(trending_score DESC) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_popularity ON apis(popularity_score DESC) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_catalog_browse ON apis (status, is_public, category_id, rating DESC, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apis_pricing_filter ON apis (status, pricing_model) WHERE deleted_at IS NULL;

-- 4. Ensure default categories exist with modern icon identifiers
INSERT INTO categories (name, slug, description, icon_name, sort_order, is_active)
VALUES
  ('AI & ML', 'ai-ml', 'State-of-the-art machine learning, LLM, and computer vision models', 'Brain', 1, true),
  ('Finance', 'finance', 'Payment gateways, currency exchanges, crypto, and market telemetry', 'Wallet', 2, true),
  ('Weather', 'weather', 'Meteorological data, high-resolution radar, and historical weather', 'CloudSun', 3, true),
  ('Developer Tools', 'developer-tools', 'CI/CD, code analysis, repository automation, and debugging APIs', 'Terminal', 4, true),
  ('Communication', 'communication', 'SMS, transactional email, voice dispatch, and chat infrastructure', 'MessageSquare', 5, true),
  ('E-commerce', 'ecommerce', 'Inventory, catalog sync, product logistics, and checkout engines', 'ShoppingBag', 6, true),
  ('News', 'news', 'Global news feeds, content aggregation, and media intelligence', 'Newspaper', 7, true),
  ('Security & Auth', 'security', 'Identity verification, fraud detection, and zero-trust auth', 'Shield', 8, true),
  ('Cloud & DevOps', 'cloud-devops', 'Compute orchestration, object storage, and serverless backends', 'Layers', 9, true)
ON CONFLICT (slug) DO UPDATE SET
  icon_name = EXCLUDED.icon_name,
  description = EXCLUDED.description,
  is_active = true;

COMMIT;
