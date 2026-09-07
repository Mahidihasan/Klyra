-- 2026_09_07_002_repo_realtime.sql
-- ============================================================================
-- Repository realtime notifications (SSE via Postgres LISTEN/NOTIFY).
--
-- When any of the repository tables that show up on the Repository screens
-- change, we push a NOTIFY so the backend's SSE hub can immediately tell open
-- pages for that repository to refresh. The hub LISTENs on the 'repo_change'
-- channel and forwards the payload to matching per-repository subscribers.
--
-- These same triggers are also created at runtime by repos.db.ensureReposSchema()
-- (which self-bootstraps the kr_* tables), so this file is mainly for manual /
-- production application and as documentation of the trigger SQL. Applying it
-- when the tables already exist is safe: every object is CREATE OR REPLACE /
-- DROP TRIGGER IF EXISTS guarded.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_repo_change()
RETURNS TRIGGER AS $$
DECLARE
    v_repo_id  UUID;
    v_payload  TEXT;
BEGIN
    -- NEW on INSERT/UPDATE, OLD on DELETE. Repo-scoped tables carry repo_id.
    v_repo_id := COALESCE(NEW.repo_id, OLD.repo_id);
    IF v_repo_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Every table this fires on (kr_ci_runs, kr_deployments,
    -- kr_activity, kr_repositories) uses `id` as its primary key.
    v_payload := json_build_object(
        'repoId',  v_repo_id::text,
        'rowId',   COALESCE((NEW).id, (OLD).id)::text,
        'table',   TG_TABLE_NAME,
        'event',   TG_OP,
        'at',      clock_timestamp()
    )::text;

    PERFORM pg_notify('repo_change', v_payload);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- CI runs: the biggest realtime win — a run transitioning running -> success/failure.
DROP TRIGGER IF EXISTS trg_repo_change_ci_runs ON kr_ci_runs;
CREATE TRIGGER trg_repo_change_ci_runs
    AFTER INSERT OR UPDATE OR DELETE ON kr_ci_runs
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

-- Deployments: queued -> deploying -> success/failure.
DROP TRIGGER IF EXISTS trg_repo_change_deployments ON kr_deployments;
CREATE TRIGGER trg_repo_change_deployments
    AFTER INSERT OR UPDATE OR DELETE ON kr_deployments
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

-- Activity feed updates for any event (push, PR, release, detection...).
DROP TRIGGER IF EXISTS trg_repo_change_activity ON kr_activity;
CREATE TRIGGER trg_repo_change_activity
    AFTER INSERT OR UPDATE OR DELETE ON kr_activity
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

-- Repository metadata changes (deploy_status, visibility, description...).
DROP TRIGGER IF EXISTS trg_repo_change_repositories ON kr_repositories;
CREATE TRIGGER trg_repo_change_repositories
    AFTER INSERT OR UPDATE OR DELETE ON kr_repositories
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();