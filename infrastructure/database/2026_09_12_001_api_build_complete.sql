-- API Build — complete normalized domain schema.
-- Extends the JSONB project record with first-class relational storage for every
-- entity surfaced by the product: endpoints, deployments, versions, pricing
-- plans, consumers, API keys, activity feed, request logs, monitoring state
-- (incidents + alert rules) and time-series usage metrics.
--
-- Every table references the project row (api_build_projects.id) with ON DELETE
-- CASCADE so deleting a project cleans up its entire domain in one transaction.
-- All statements are idempotent so the migration can be re-run safely.

-- ---------------------------------------------------------------------------
-- Endpoints — imported from a real OpenAPI/upstream spec; metrics refreshed by
-- the telemetry worker from live health probes (no fabricated numbers).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_endpoints (
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  id                TEXT         NOT NULL,
  method            TEXT         NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  path              TEXT         NOT NULL,
  summary           TEXT         NOT NULL DEFAULT '',
  description       TEXT         NOT NULL DEFAULT '',
  category          TEXT         NOT NULL DEFAULT 'General',
  auth_required     BOOLEAN      NOT NULL DEFAULT TRUE,
  rate_limit_per_min INTEGER     NOT NULL DEFAULT 100,
  status            TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active','beta','deprecated')),
  parameters        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  request_body      JSONB,
  responses         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  avg_latency_ms    NUMERIC      NOT NULL DEFAULT 0,
  p95_latency_ms    NUMERIC      NOT NULL DEFAULT 0,
  total_requests    BIGINT       NOT NULL DEFAULT 0,
  error_rate        NUMERIC      NOT NULL DEFAULT 0,
  is_healthy        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, method, path)
);
CREATE INDEX IF NOT EXISTS api_build_endpoints_project_idx ON api_build_endpoints (project_id);

-- ---------------------------------------------------------------------------
-- Deployments — one row per real deployment/build of the upstream API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_deployments (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  version           TEXT         NOT NULL,
  environment       TEXT         NOT NULL CHECK (environment IN ('development','staging','production')),
  source            TEXT         NOT NULL CHECK (source IN ('External API','GitHub','Docker','Klyra Hosted')),
  branch            TEXT,
  commit_hash       TEXT,
  commit_message    TEXT,
  region            TEXT         NOT NULL DEFAULT 'auto',
  status            TEXT         NOT NULL DEFAULT 'building' CHECK (status IN ('queued','building','healthy','failed','paused')),
  url               TEXT         NOT NULL DEFAULT '',
  deployed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  duration_sec      NUMERIC      NOT NULL DEFAULT 0,
  author            TEXT         NOT NULL DEFAULT 'system',
  logs              JSONB        NOT NULL DEFAULT '[]'::jsonb,
  env_vars          JSONB        NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS api_build_deployments_project_idx ON api_build_deployments (project_id, deployed_at DESC);

-- ---------------------------------------------------------------------------
-- Versions — semantic API versions with changelog and default flag.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_versions (
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  id                TEXT         NOT NULL,
  semver            TEXT         NOT NULL,
  status            TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','deployed','published','deprecated','Current','Beta','Legacy')),
  notes             TEXT         NOT NULL DEFAULT '',
  endpoints_count   INTEGER      NOT NULL DEFAULT 0,
  is_default        BOOLEAN      NOT NULL DEFAULT FALSE,
  released_at       TIMESTAMPTZ,
  changelog         JSONB        NOT NULL DEFAULT '{"added":[],"modified":[],"deprecated":[],"breaking":[]}'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, semver)
);
CREATE INDEX IF NOT EXISTS api_build_versions_project_idx ON api_build_versions (project_id);

-- ---------------------------------------------------------------------------
-- Plans — pricing tiers offered to consumers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_plans (
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  id                TEXT         NOT NULL,
  name              TEXT         NOT NULL,
  requests_per_month BIGINT      NOT NULL DEFAULT 0,
  price_monthly     NUMERIC      NOT NULL DEFAULT 0,
  rate_limit_per_min INTEGER     NOT NULL DEFAULT 0,
  overage_per_1k    NUMERIC      NOT NULL DEFAULT 0,
  trial_days        INTEGER      NOT NULL DEFAULT 0,
  subscribers       INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
-- ---------------------------------------------------------------------------
-- Consumers — subscribers/teams using the API under a plan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_consumers (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  name              TEXT         NOT NULL,
  email             TEXT         NOT NULL DEFAULT '',
  plan              TEXT         NOT NULL DEFAULT 'Free',
  status            TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','cancelled')),
  requests          BIGINT       NOT NULL DEFAULT 0,
  joined_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_build_consumers_project_idx ON api_build_consumers (project_id);

-- ---------------------------------------------------------------------------
-- API keys — credential metadata; only a SHA-256 hash of the secret is stored.
-- The plaintext `kly_live_...`/`kly_test_...` value is returned exactly once at
-- creation time, never again (industry-standard credential handling).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_api_keys (
  id                TEXT         NOT NULL,
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  label             TEXT         NOT NULL,
  prefix            TEXT         NOT NULL,
  secret_hash       TEXT         NOT NULL,
  consumer          TEXT         NOT NULL DEFAULT '',
  plan              TEXT         NOT NULL DEFAULT 'Free',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_used         TIMESTAMPTZ,
  revoked           BOOLEAN      NOT NULL DEFAULT FALSE,
-- ---------------------------------------------------------------------------
-- Activity — immutable audit feed of real user/system events.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_activity (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  label             TEXT         NOT NULL,
  kind              TEXT         NOT NULL DEFAULT 'info' CHECK (kind IN ('info','ok','warning','critical')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_build_activity_project_idx ON api_build_activity (project_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Logs — one row per observed request (written by the telemetry probes and by
-- the gateway/workspace). Bodies are capped at the application layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_logs (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  method            TEXT         NOT NULL,
  path              TEXT         NOT NULL,
  status_code       INTEGER      NOT NULL,
  latency_ms        NUMERIC      NOT NULL DEFAULT 0,
  consumer_name     TEXT         NOT NULL DEFAULT 'anonymous',
  key_prefix        TEXT         NOT NULL DEFAULT '',
  version           TEXT         NOT NULL DEFAULT '',
  region            TEXT         NOT NULL DEFAULT 'sg-edge',
  ip_address        TEXT         NOT NULL DEFAULT '',
  request_headers   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  query_params      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  request_body      TEXT         NOT NULL DEFAULT '',
  response_headers  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  response_body     TEXT         NOT NULL DEFAULT '',
  trace             JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- ---------------------------------------------------------------------------
-- Monitoring — incidents and alert rules.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_incidents (
  id                TEXT         NOT NULL,
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  title             TEXT         NOT NULL,
  severity          TEXT         NOT NULL CHECK (severity IN ('Critical','Major','Minor')),
  status            TEXT         NOT NULL DEFAULT 'Investigating' CHECK (status IN ('Investigating','Identified','Monitoring','Resolved')),
  started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  affected_endpoints JSONB       NOT NULL DEFAULT '[]'::jsonb,
  summary           TEXT         NOT NULL DEFAULT '',
  postmortem        TEXT,
  PRIMARY KEY (project_id, id)
);
CREATE INDEX IF NOT EXISTS api_build_incidents_project_idx ON api_build_incidents (project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS api_build_alert_rules (
  id                TEXT         NOT NULL,
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  name              TEXT         NOT NULL,
  metric            TEXT         NOT NULL CHECK (metric IN ('p95_latency','error_rate','uptime','rate_limit')),
  condition         TEXT         NOT NULL CHECK (condition IN ('>','<')),
  threshold         NUMERIC      NOT NULL,
  unit              TEXT         NOT NULL DEFAULT '',
  duration_sec      INTEGER      NOT NULL DEFAULT 300,
  channels          JSONB        NOT NULL DEFAULT '["email"]'::jsonb,
  enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  last_triggered    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, id)
);
CREATE INDEX IF NOT EXISTS api_build_alert_rules_project_idx ON api_build_alert_rules (project_id);

-- ---------------------------------------------------------------------------
-- Usage — time-series request buckets written by the telemetry worker and the
-- workspace "live" pump. Queried by the Usage/Analytics tabs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_build_usage (
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  bucket            TIMESTAMPTZ  NOT NULL,
  requests          BIGINT       NOT NULL DEFAULT 0,
  success           BIGINT       NOT NULL DEFAULT 0,
  client_error      BIGINT       NOT NULL DEFAULT 0,
  server_error      BIGINT       NOT NULL DEFAULT 0,
  rate_limited      BIGINT       NOT NULL DEFAULT 0,
  p95_ms            NUMERIC      NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, bucket)
);
CREATE INDEX IF NOT EXISTS api_build_usage_project_idx ON api_build_usage (project_id, bucket ASC);
CREATE INDEX IF NOT EXISTS api_build_logs_project_idx ON api_build_logs (project_id, created_at DESC);
  PRIMARY KEY (project_id, id)
);
CREATE INDEX IF NOT EXISTS api_build_api_keys_project_idx ON api_build_api_keys (project_id);
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, name)
);
CREATE INDEX IF NOT EXISTS api_build_plans_project_idx ON api_build_plans (project_id);