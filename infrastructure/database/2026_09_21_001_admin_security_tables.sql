-- 2026_09_21_001_admin_security_tables.sql
-- ============================================================================
-- Admin/security tables that Prisma expects but the SQL baseline never had.
--
-- Why: backend/prisma/schema.prisma was INTROSPECTED from an old development
-- database whose extra tables were created ad hoc (backend/alter_enum.js,
-- backend/migrate_roles.js, prisma db push) and never captured by
-- infrastructure/database migrations. On a fresh database (e.g. new Neon)
-- the login/verify flow then failed with:
--
--   Invalid `prisma.session.create()` invocation
--     (auth.service.ts:958 completeLogin -> P2021 table "Session" missing)
--
-- and, because auth.middleware.isActiveAuthenticatedUser validates the JWT's
-- adminSessionId via prisma.session.findUnique, EVERY authenticated request
-- would have been rejected as well.
--
-- This migration provisions, idempotently and in Prisma-compatible shape:
--   1. user_role enum value 'SUPER_ADMIN'   (was only added by alter_enum.js)
--   2. "Permission" enum                    (exact case, used by RBAC)
--   3. role_permissions table               (model RolePermission)
--   4. "Session" table                      (model Session — no @@map, so the
--                                            table name is case-sensitive)
-- Existing databases that already have these objects are unaffected: every
-- statement is guarded (IF NOT EXISTS / DO-block existence checks).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. user_role.SUPER_ADMIN (parity with backend/alter_enum.js)
-- ---------------------------------------------------------------------------
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- ---------------------------------------------------------------------------
-- 2. "Permission" enum (Prisma enum without @@map -> exact-case type name)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Permission' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "Permission" AS ENUM (
      'VIEW_ANALYTICS_DASHBOARD',
      'VIEW_TRANSACTIONS',
      'VIEW_STAFF',
      'MANAGE_STAFF',
      'VIEW_USERS',
      'EDIT_USER',
      'SUSPEND_BAN_USERS',
      'IMPERSONATE_USERS',
      'VIEW_KYC_REQUESTS',
      'APPROVE_REJECT_KYC',
      'VIEW_APIS',
      'APPROVE_REJECT_APIS',
      'DEPRECATE_DELETE_APIS',
      'CURATE_MARKETPLACE_FEATURED',
      'MANAGE_API_KEYS',
      'CONFIGURE_GATEWAY_LIMITS',
      'VIEW_SECURITY_LOGS',
      'EXPORT_SECURITY_LOGS',
      'VIEW_SYSTEM_SETTINGS',
      'MANAGE_SYSTEM_SETTINGS',
      'VIEW_WEBHOOKS',
      'MANAGE_WEBHOOKS',
      'MANAGE_ROLES_PERMISSIONS',
      'VIEW_BILLING_INVOICES',
      'DOWNLOAD_INVOICES',
      'PROCESS_REFUNDS',
      'VIEW_SUBSCRIPTIONS',
      'MANAGE_SUBSCRIPTION_PLANS',
      'MANAGE_PROMOTIONS',
      'VIEW_TACTICAL_BOARD',
      'EXECUTE_EMERGENCY_FREEZE',
      'VIEW_INVOICE_FORENSICS',
      'INVOICE_FORENSICS_WAIVE',
      'VIEW_DISPUTES',
      'DISPUTE_MANAGER_VERIFICATION',
      'VIEW_SUPPORT_TICKETS',
      'MANAGE_SUPPORT_TICKETS',
      'EDIT_EMAIL_TEMPLATES',
      'VIEW_DATABASE_METRICS',
      'MANAGE_DATABASE_BACKUPS',
      'EXECUTE_QUERY_OVERRIDES',
      'FLUSH_REDIS_CACHE',
      'VIEW_SERVER_HEALTH',
      'MANAGE_CONTAINERS_PODS',
      'RESTART_CORE_SERVICES',
      'VIEW_DEPLOYMENT_LOGS',
      'ACCESS_ENGINE_ROOM',
      'TOGGLE_MAINTENANCE_MODE',
      'MANAGE_CRON_JOBS',
      'TRIGGER_MANUAL_PIPELINE',
      'VIEW_MODERATION_INBOX',
      'MANAGE_MODERATION_ACTIONS',
      'VIEW_SYSTEM_LOGS',
      'MANAGE_CORE_SETTINGS',
      'VIEW_AI_THREAT_DETECTION',
      'VIEW_SECURITY_CENTER',
      'MANAGE_SECURITY_CENTER',
      'ACCESS_RBAC_MATRIX',
      'VIEW_DANGER_ZONE',
      'EXECUTE_DANGER_ZONE_ACTIONS'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. role_permissions (model RolePermission, @@map "role_permissions")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role        user_role NOT NULL,
  permissions "Permission"[] NOT NULL,
  created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role)
);

-- ---------------------------------------------------------------------------
-- 4. "Session" (model Session — no @@map, so the table name is case-sensitive;
--    id is client-side @default(uuid()), hence no DB default)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Session" (
  id             TEXT NOT NULL,
  user_id        UUID NOT NULL,
  device         VARCHAR(255) NOT NULL,
  browser        VARCHAR(255) NOT NULL,
  ip_address     INET NOT NULL,
  location       VARCHAR(255),
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  is_revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "Session_user_id_idx" ON "Session" (user_id);
CREATE INDEX IF NOT EXISTS "Session_is_revoked_idx" ON "Session" (is_revoked);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Session_user_id_fkey'
  ) THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_user_id_fkey"
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;