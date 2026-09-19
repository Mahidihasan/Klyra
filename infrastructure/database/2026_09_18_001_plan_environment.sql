-- ============================================================================
-- Plan environment — enterprise-grade pricing tiers for the API Studio Plans tab.
--
-- The base plan table (2026_09_12_001_api_build_complete.sql) only carried the
-- numeric levers (price, quota, rate limit, overage, trial). A plan is now a
-- complete commercial environment, so the table also stores:
--   * versions             — API versions the tier grants access to (multi-select)
--   * tagline              — storefront positioning copy
--   * features             — ordered feature list rendered on the plan card
--   * limits               — gateway-enforced caps (JSONB)
--   * custom_documentation — plan-specific terms / fair-use policy
--   * is_popular / highlight_label — storefront "Most Popular" highlight
--
-- Every statement is idempotent, so the migration runner can replay it safely.
-- The (project_id, name) unique key used by savePlan()'s upsert already exists
-- in the live schema (api_build_plans_project_id_name_key), so no constraint
-- work is needed here.
-- ============================================================================
ALTER TABLE api_build_plans
    ADD COLUMN IF NOT EXISTS versions             TEXT[]  NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS tagline              TEXT    NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS features             JSONB   NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS limits               JSONB   NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS custom_documentation TEXT    NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_popular           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS highlight_label      TEXT    NOT NULL DEFAULT '';

COMMENT ON COLUMN api_build_plans.versions IS 'API versions (semver) this tier grants access to; empty array means "default version only"';
COMMENT ON COLUMN api_build_plans.features IS 'Ordered feature strings shown on the plan card and marketplace listing';
COMMENT ON COLUMN api_build_plans.limits IS 'Gateway-enforced caps, e.g. {"dailyRequestCap":10000,"concurrentConnections":20,"supportTier":"standard"}';
COMMENT ON COLUMN api_build_plans.custom_documentation IS 'Plan-specific terms / fair-use policy shown to consumers on the pricing page';
COMMENT ON COLUMN api_build_plans.is_popular IS 'Marks the recommended tier on the storefront pricing page';

-- Storefront listing reads plans ordered by price; keep that lookup covered.
CREATE INDEX IF NOT EXISTS api_build_plans_project_price_idx
    ON api_build_plans (project_id, price_monthly);