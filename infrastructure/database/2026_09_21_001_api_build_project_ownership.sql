-- Project records are private to the account that created them. Existing rows
-- deliberately remain unowned until a separate, reliable ownership migration.
ALTER TABLE api_build_projects
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS api_build_projects_owner_updated_idx
  ON api_build_projects (owner_id, updated_at DESC)
  WHERE owner_id IS NOT NULL;
