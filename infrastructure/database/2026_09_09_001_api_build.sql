-- API Build projects and a durable deployment work queue.
CREATE TABLE IF NOT EXISTS api_build_projects (
  id TEXT PRIMARY KEY,
  project JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_build_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deploy')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_build_jobs_next_idx ON api_build_jobs (status, created_at) WHERE status = 'queued';
