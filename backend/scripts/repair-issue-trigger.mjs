// One-off repair: applies the fixed notify_repo_change() + issue-comment
// realtime trigger to the live database (function is CREATE OR REPLACE, so
// this is idempotent and safe to re-run).
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../../.env.development', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=["']?(.+?)["']?\s*$/m)?.[1];
if (!url) { console.error('DATABASE_URL not found in .env.development'); process.exit(1); }

const pool = new pg.Pool({ connectionString: url, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } });

await pool.query(`
CREATE OR REPLACE FUNCTION notify_repo_change()
RETURNS TRIGGER AS $$
DECLARE
    v_repo_id  UUID;
    v_payload  TEXT;
BEGIN
    IF TG_TABLE_NAME = 'kr_repositories' THEN
        v_repo_id := COALESCE((NEW).id, (OLD).id);
    ELSIF TG_TABLE_NAME = 'kr_issue_comments' THEN
        SELECT repo_id INTO v_repo_id FROM kr_issues
        WHERE id = COALESCE((NEW).issue_id, (OLD).issue_id);
    ELSE
        v_repo_id := COALESCE(NEW.repo_id, OLD.repo_id);
    END IF;
    IF v_repo_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
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

DROP TRIGGER IF EXISTS trg_repo_change_issues ON kr_issues;
CREATE TRIGGER trg_repo_change_issues
    AFTER INSERT OR UPDATE OR DELETE ON kr_issues
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

DROP TRIGGER IF EXISTS trg_repo_change_issue_comments ON kr_issue_comments;
CREATE TRIGGER trg_repo_change_issue_comments
    AFTER INSERT OR UPDATE OR DELETE ON kr_issue_comments
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();
`);

console.log('OK: notify_repo_change() updated; issues + issue_comments triggers active.');
await pool.end();
