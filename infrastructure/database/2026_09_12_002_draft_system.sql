-- Draft & Unsaved State System
-- Introduces versioning and draft configuration storage to enable:
-- - Draft/unsaved state separate from live config
-- - Optimistic concurrency control via version field
-- - Non-destructive change staging
-- - Audit trail of all mutations

-- ============================================================================
-- Add versioning to api_build_projects for optimistic concurrency
-- ============================================================================
ALTER TABLE api_build_projects 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS draft_config JSONB,
ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS draft_by VARCHAR(256),
ADD COLUMN IF NOT EXISTS saved_by VARCHAR(256);

-- ============================================================================
-- Create audit log table for immutable change history
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_build_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(160) NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  actor_id VARCHAR(256) NOT NULL,
  actor_email VARCHAR(256),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resource_type VARCHAR(50) NOT NULL, -- 'project', 'endpoint', 'policy', etc.
  resource_id VARCHAR(256),
  operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete', 'deploy', etc.
  before JSONB,
  after JSONB,
  change_summary TEXT,
  request_id VARCHAR(256),
  context JSONB -- Additional context (reason, approval, etc.)
);

CREATE INDEX IF NOT EXISTS api_build_audit_log_project_idx 
ON api_build_audit_log (project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS api_build_audit_log_actor_idx 
ON api_build_audit_log (actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS api_build_audit_log_resource_idx 
ON api_build_audit_log (resource_type, resource_id);

-- ============================================================================
-- Create draft changes tracking table for Change Center
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_build_draft_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(160) NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  change_id VARCHAR(256) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'add', 'modify', 'delete'
  category VARCHAR(50) NOT NULL, -- 'contract', 'gateway', 'security', 'environment'
  resource VARCHAR(256) NOT NULL,
  before JSONB,
  after JSONB,
  impact JSONB, -- affected_consumers, is_breaking, risk_level
  is_selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_build_draft_changes_project_idx 
ON api_build_draft_changes (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS api_build_draft_changes_unique_idx 
ON api_build_draft_changes (project_id, change_id);

-- ============================================================================
-- Ensure api_build_projects has timestamps for draft tracking
-- ============================================================================
ALTER TABLE api_build_projects 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- Add trigger to auto-update updated_at on project changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_api_build_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF NOT EXISTS api_build_projects_updated_at_trigger 
ON api_build_projects;

CREATE TRIGGER api_build_projects_updated_at_trigger
BEFORE UPDATE ON api_build_projects
FOR EACH ROW
EXECUTE FUNCTION update_api_build_projects_updated_at();
