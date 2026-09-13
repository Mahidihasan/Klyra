-- ---------------------------------------------------------------------------
-- API Build — Control Plane extension.
--
-- Introduces the two durable primitives required by the Phase 1 control plane:
--
--   1. api_build_operations — the universal asynchronous operation model.
--      Every long-running mutation (deploy, rollback, publish, import, bulk
--      update) is persisted as an operation row so the UI can show real
--      progress, logs, warnings and terminal states instead of simulating
--      work in the browser. Operations are restartable (retry) and
--      cancellable while queued/running.
--
--   2. api_build_resource_history — immutable resource snapshots. Each save of
--      a governed resource (project config, gateway settings, contract...) is
--      versioned with before/after values so the UI can render diffs and
--      offer restore-to-version.
--
-- All statements are idempotent so the migration can be re-run safely.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_build_operations (
  id                TEXT         PRIMARY KEY,
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  type              TEXT         NOT NULL CHECK (type IN (
                      'deploy','rollback','publish','import','sync','migrate',
                      'rotate_key','bulk_policy_update','health_probe','delete')),
  state             TEXT         NOT NULL DEFAULT 'queued' CHECK (state IN (
                      'queued','validating','running','succeeded','failed','cancelled')),
  progress          INTEGER      NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  actor             TEXT         NOT NULL DEFAULT 'system',
  resource          TEXT,
  environment       TEXT,
  payload           JSONB,
  logs              JSONB        NOT NULL DEFAULT '[]'::jsonb,
  warnings          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  errors            JSONB        NOT NULL DEFAULT '[]'::jsonb,
  result            JSONB,
  request_id        TEXT,
  reason            TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_build_operations_project_idx
  ON api_build_operations (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_build_resource_history (
  id                BIGSERIAL    PRIMARY KEY,
  project_id        TEXT         NOT NULL REFERENCES api_build_projects(id) ON DELETE CASCADE,
  resource_type     TEXT         NOT NULL,
  resource_id       TEXT         NOT NULL DEFAULT '',
  version_no        INTEGER      NOT NULL DEFAULT 1,
  actor             TEXT         NOT NULL DEFAULT 'system',
  reason            TEXT,
  before            JSONB,
  after             JSONB,
  summary           TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_build_resource_history_idx
  ON api_build_resource_history (project_id, resource_type, resource_id, version_no DESC);