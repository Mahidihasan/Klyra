-- ============================================================================
-- API Keys system — full lifecycle for consumer keys.
--
-- Extends the existing api_keys table (infrastructure/database/schema.sql §5)
-- so a key can be pinned to:
--   * a marketplace API the user owns or is subscribed to  (api_id, already present)
--   * a specific API version of that API                   (api_version_id, new)
--   * an API Build project                                 (project_id, new)
--   * a specific API Build project version                 (project_version, new)
-- and suspended/blocked in addition to the existing ACTIVE/REVOKED/EXPIRED.
--
-- NOTE: ALTER TYPE ... ADD VALUE is applied in the same implicit transaction as
-- the statements below (the migration runner sends this file as one query). That
-- is allowed on PostgreSQL 12+, but only while the new label is not *used* yet —
-- so nothing below may reference 'SUSPENDED' (e.g. in an index predicate), or the
-- run fails with "unsafe use of new value of enum type". Same rationale as
-- 2026_09_13_001_account_reactivation.sql, which keeps its ADD VALUE standalone.
-- ============================================================================
ALTER TYPE api_key_status ADD VALUE IF NOT EXISTS 'SUSPENDED';

ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS api_version_id UUID REFERENCES api_versions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES api_build_projects(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS project_version TEXT;

COMMENT ON COLUMN api_keys.api_version_id IS 'Optional API version this key is pinned to; NULL means "current version at request time"';
COMMENT ON COLUMN api_keys.project_id IS 'API Build project this key targets; mutually exclusive with api_id';
COMMENT ON COLUMN api_keys.project_version IS 'API Build project version (semver text) this key is pinned to';

CREATE INDEX IF NOT EXISTS idx_api_keys_api_id ON api_keys(api_id) WHERE api_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_status ON api_keys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- The original schema defaulted `permissions` to a JSONB object ('{}') although the
-- domain treats it as an array of scope strings. Normalize so every row is an array,
-- which keeps the service's read/serialization path unambiguous.
ALTER TABLE api_keys ALTER COLUMN permissions SET DEFAULT '[]'::jsonb;
UPDATE api_keys SET permissions = '[]'::jsonb
    WHERE permissions IS NULL OR jsonb_typeof(permissions) = 'object';

-- The service stores scopes as a JSONB array of strings; the original schema
-- defaulted to an empty object. Align the default and normalize legacy rows so
-- every reader sees the same shape.
ALTER TABLE api_keys ALTER COLUMN permissions SET DEFAULT '[]'::JSONB;
UPDATE api_keys SET permissions = '[]'::JSONB WHERE permissions = '{}'::JSONB;
