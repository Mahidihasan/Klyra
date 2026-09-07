import { pool } from '../../services/database.service';

let schemaReady: Promise<void> | null = null;

/**
 * Ensures the repository system schema exists (idempotent).
 */
export function ensureReposSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kr_users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          avatar_color TEXT DEFAULT '#8b5cf6',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_tokens (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES kr_users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_repositories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT UNIQUE NOT NULL,
          owner_id INTEGER NOT NULL REFERENCES kr_users(id),
          description TEXT DEFAULT '',
          visibility TEXT NOT NULL DEFAULT 'private',
          license TEXT DEFAULT 'MIT',
          language TEXT DEFAULT 'TypeScript',
          framework TEXT DEFAULT '',
          default_branch TEXT NOT NULL DEFAULT 'main',
          deploy_status TEXT NOT NULL DEFAULT 'not_deployed',
          detect_json JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_collaborators (
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES kr_users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'developer',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (repo_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS kr_branches (
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          protected BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INTEGER REFERENCES kr_users(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (repo_id, name)
        );
        CREATE TABLE IF NOT EXISTS kr_pull_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          number INTEGER NOT NULL,
          title TEXT NOT NULL,
          body TEXT DEFAULT '',
          source_branch TEXT NOT NULL,
          target_branch TEXT NOT NULL,
          author_id INTEGER NOT NULL REFERENCES kr_users(id),
          status TEXT NOT NULL DEFAULT 'open',
          reviewers JSONB DEFAULT '[]',
          merged_by INTEGER REFERENCES kr_users(id),
          merged_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (repo_id, number)
        );
        CREATE TABLE IF NOT EXISTS kr_pr_reviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pr_id UUID NOT NULL REFERENCES kr_pull_requests(id) ON DELETE CASCADE,
          reviewer_id INTEGER NOT NULL REFERENCES kr_users(id),
          state TEXT NOT NULL,
          body TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_pr_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pr_id UUID NOT NULL REFERENCES kr_pull_requests(id) ON DELETE CASCADE,
          author_id INTEGER NOT NULL REFERENCES kr_users(id),
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_issues (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          number INTEGER NOT NULL,
          title TEXT NOT NULL,
          body TEXT DEFAULT '',
          author_id INTEGER NOT NULL REFERENCES kr_users(id),
          status TEXT NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          closed_at TIMESTAMPTZ,
          UNIQUE (repo_id, number)
        );
        CREATE TABLE IF NOT EXISTS kr_issue_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          issue_id UUID NOT NULL REFERENCES kr_issues(id) ON DELETE CASCADE,
          author_id INTEGER NOT NULL REFERENCES kr_users(id),
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_tags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          commit_sha TEXT,
          message TEXT DEFAULT '',
          created_by INTEGER REFERENCES kr_users(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (repo_id, name)
        );
        CREATE TABLE IF NOT EXISTS kr_releases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          tag_name TEXT NOT NULL,
          name TEXT NOT NULL,
          notes TEXT DEFAULT '',
          prerelease BOOLEAN NOT NULL DEFAULT FALSE,
          status TEXT NOT NULL DEFAULT 'draft',
          latest BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INTEGER REFERENCES kr_users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_ci_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          commit_sha TEXT,
          branch TEXT,
          type TEXT NOT NULL DEFAULT 'build',
          status TEXT NOT NULL DEFAULT 'pending',
          log TEXT DEFAULT '',
          summary TEXT DEFAULT '',
          started_at TIMESTAMPTZ DEFAULT NOW(),
          finished_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS kr_deployments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          release_id UUID REFERENCES kr_releases(id) ON DELETE SET NULL,
          environment TEXT NOT NULL DEFAULT 'production',
          status TEXT NOT NULL DEFAULT 'pending',
          log TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          finished_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS kr_marketplace_listings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          release_id UUID REFERENCES kr_releases(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          tagline TEXT DEFAULT '',
          description TEXT DEFAULT '',
          category TEXT DEFAULT 'other',
          pricing_type TEXT NOT NULL DEFAULT 'free',
          price_cents INTEGER DEFAULT 0,
          docs_url TEXT DEFAULT '',
          requirements TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft',
          created_by INTEGER REFERENCES kr_users(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          published_at TIMESTAMPTZ
        );
        -- ============================================================================
        -- BILLING (plans, subscriptions, invoices, payments)
        -- Auto-provisioned with the kr_* runtime schema so developers can use
        -- billing out of the box without further migrations.
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS kr_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID REFERENCES kr_repositories(id) ON DELETE CASCADE,
          listing_id UUID REFERENCES kr_marketplace_listings(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          description TEXT DEFAULT '',
          billing_interval TEXT NOT NULL DEFAULT 'monthly', -- monthly | yearly | one_time
          price_cents INTEGER NOT NULL DEFAULT 0,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          features JSONB NOT NULL DEFAULT '[]',
          rate_limit INTEGER,
          rate_limit_period TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ,
          UNIQUE (listing_id, slug)
        );
        CREATE TABLE IF NOT EXISTS kr_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER NOT NULL REFERENCES kr_users(id) ON DELETE CASCADE,
          plan_id UUID NOT NULL REFERENCES kr_plans(id) ON DELETE RESTRICT,
          status TEXT NOT NULL DEFAULT 'active', -- active | trialing | past_due | paused | canceled
          period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          period_end TIMESTAMPTZ,
          auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
          stripe_subscription_id TEXT,
          cancelled_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, plan_id)
        );
        CREATE TABLE IF NOT EXISTS kr_invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER NOT NULL REFERENCES kr_users(id) ON DELETE CASCADE,
          subscription_id UUID REFERENCES kr_subscriptions(id) ON DELETE SET NULL,
          invoice_number TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | partially_paid | paid | void | overdue
          stripe_invoice_id TEXT,
          pdf_url TEXT,
          due_date TIMESTAMPTZ,
          paid_at TIMESTAMPTZ,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (invoice_number)
        );
        CREATE TABLE IF NOT EXISTS kr_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER NOT NULL REFERENCES kr_users(id) ON DELETE CASCADE,
          subscription_id UUID REFERENCES kr_subscriptions(id) ON DELETE SET NULL,
          invoice_id UUID REFERENCES kr_invoices(id) ON DELETE SET NULL,
          amount_cents INTEGER NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          status TEXT NOT NULL DEFAULT 'pending', -- pending | succeeded | failed | refunded
          stripe_payment_id TEXT,
          payment_method TEXT,
          payment_method_details JSONB,
          failure_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS kr_activity (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID NOT NULL REFERENCES kr_repositories(id) ON DELETE CASCADE,
          actor_id INTEGER REFERENCES kr_users(id),
          type TEXT NOT NULL,
                    payload JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Realtime triggers (see 2026_09_07_002_repo_realtime.sql). Defined here
        -- too so SSE updates work out-of-the-box when the schema self-bootstraps.
        CREATE OR REPLACE FUNCTION notify_repo_change()
        RETURNS TRIGGER AS $$
        DECLARE
            v_repo_id  UUID;
            v_payload  TEXT;
        BEGIN
            v_repo_id := COALESCE(NEW.repo_id, OLD.repo_id);
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

        DROP TRIGGER IF EXISTS trg_repo_change_ci_runs ON kr_ci_runs;
        CREATE TRIGGER trg_repo_change_ci_runs
            AFTER INSERT OR UPDATE OR DELETE ON kr_ci_runs
            FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

        DROP TRIGGER IF EXISTS trg_repo_change_deployments ON kr_deployments;
        CREATE TRIGGER trg_repo_change_deployments
            AFTER INSERT OR UPDATE OR DELETE ON kr_deployments
            FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

        DROP TRIGGER IF EXISTS trg_repo_change_activity ON kr_activity;
        CREATE TRIGGER trg_repo_change_activity
            AFTER INSERT OR UPDATE OR DELETE ON kr_activity
            FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

        DROP TRIGGER IF EXISTS trg_repo_change_repositories ON kr_repositories;
        CREATE TRIGGER trg_repo_change_repositories
            AFTER INSERT OR UPDATE OR DELETE ON kr_repositories
            FOR EACH ROW EXECUTE FUNCTION notify_repo_change();
      `);
    })();
  }
  return schemaReady;
}