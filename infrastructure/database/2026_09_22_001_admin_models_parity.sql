-- 2026_09_22_001_admin_models_parity.sql
-- ============================================================================
-- Schema parity for the admin-facing Prisma models + enum drift repair.
--
-- Why: backend/prisma/schema.prisma (introspected from an old development
-- database) declares a set of admin models whose tables were created ad hoc
-- there (prisma db push / alter_enum.js) and were never captured by the
-- infrastructure/database migrations. On the live database those tables are
-- absent, so these endpoints would fail with P2021 (table does not exist):
--
--   admin.devops.routes.ts    -> prisma.featureFlag / prisma.webhookLog /
--                                prisma.cronJob
--   admin.finances.routes.ts  -> prisma.invoice / prisma.invoiceItem /
--                                prisma.dispute
--   admin.settings.routes.ts  -> prisma.coreSettings
--   admin.revenue.service.ts  -> SELECT ... FROM provider_payouts (raw SQL)
--
-- and two enums drifted away from the values the application writes:
--
--   audit_action  is missing 'ADMIN_KEY_RESET'   (admin.users.routes.ts
--                 INSERT + admin.reports.routes.ts severity mapping)
--   "Permission"  is missing 'MANAGE_SYSTEM_SETTINGS' and
--                 'MANAGE_SECURITY_CENTER'      (RBAC fallback lists +
--                 frontend RBACMatrix + scripts/seed-rbac.ts)
--
-- provider_payouts is ALSO provisioned by scripts/migrate_payouts.ts; having
-- it here as well means a fresh environment is complete with a single
-- `node scripts/migrate.mjs` run (same rationale as 0003b_repos_schema).
-- Every statement is guarded (IF NOT EXISTS / DO-block existence checks), so
-- the file is fully idempotent on any environment state.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum drift: values the application writes but the DB enum lacks.
--    (PG 12+ permits ADD VALUE inside a transaction as long as the new value
--    is not referenced by name in the same transaction — these statements
--    only add values, so the implicit multi-statement transaction is fine.)
-- ---------------------------------------------------------------------------

-- 'ADMIN_KEY_RESET' is inserted by admin.users.routes.ts when an admin
-- resets a user's API key, and classified as 'critical' in admin.reports.
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ADMIN_KEY_RESET';

-- RBAC parity with backend/prisma/schema.prisma (Permission enum, 59 values).
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'MANAGE_SYSTEM_SETTINGS';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'MANAGE_SECURITY_CENTER';

-- ---------------------------------------------------------------------------
-- 2. provider_payouts (raw-SQL table used by admin.revenue.service.ts).
--    Identical shape to scripts/migrate_payouts.ts. The broken
--    2026_09_11_001_payout_requests.sql file stays unregistered: it references
--    non-existent helper functions (current_user_id()/is_admin()).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payout_status' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS provider_payouts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount            DECIMAL(10,2) NOT NULL,
    currency          CHAR(3) NOT NULL DEFAULT 'USD',
    status            payout_status NOT NULL DEFAULT 'PENDING',
    stripe_account_id VARCHAR(255),
    processed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT provider_payouts_amount_non_negative CHECK (amount >= 0)
);

ALTER TABLE provider_payouts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Admin devops / finances / settings Prisma models.
--    None of these models has an @@map, so every table name below is
--    CASE-SENSITIVE (created exactly as Prisma would create it, including
--    camelCase columns like "updatedAt").
-- ---------------------------------------------------------------------------

-- model FeatureFlag (admin.devops.routes.ts: list / createMany defaults /
--        toggle isEnabled+rollout)
CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    id          TEXT NOT NULL,
    key         TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    rollout     INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlag_key_key" ON "FeatureFlag" (key);

-- model WebhookLog (admin.devops.routes.ts: list / detail / create)
CREATE TABLE IF NOT EXISTS "WebhookLog" (
    id          TEXT NOT NULL,
    event       TEXT NOT NULL,
    url         TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY (id)
);

-- model CronJob (admin.devops.routes.ts: list / createMany defaults /
--        trigger -> status/lastRun update)
CREATE TABLE IF NOT EXISTS "CronJob" (
    id          TEXT NOT NULL,
    name        TEXT NOT NULL,
    expression  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'OK',
    "lastRun"   TEXT NOT NULL DEFAULT 'Never',
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "CronJob_pkey" PRIMARY KEY (id)
);

-- model Invoice + model InvoiceItem (admin.finances.routes.ts forensics:
--        fetch-or-seed invoice, adjust total, toggle item.waived; the
--        relation include { items: true } requires the FK below)
CREATE TABLE IF NOT EXISTS "Invoice" (
    id          TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'PENDING',
    total       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
    id          TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    calls       INTEGER NOT NULL DEFAULT 0,
    rate        DOUBLE PRECISION NOT NULL,
    total       DOUBLE PRECISION NOT NULL,
    waived      BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_invoiceId_fkey'
  ) THEN
    ALTER TABLE "InvoiceItem"
      ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice" (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- model Dispute (admin.finances.routes.ts: fetch-or-seed pending dispute,
--        approve/reject via update status)
CREATE TABLE IF NOT EXISTS "Dispute" (
    id              TEXT NOT NULL,
    "userId"        TEXT NOT NULL DEFAULT 'USR_992',
    "claimText"     TEXT NOT NULL,
    "billedAmount"  DOUBLE PRECISION NOT NULL DEFAULT 2500.0,
    "actualBillable" DOUBLE PRECISION NOT NULL DEFAULT 602.05,
    discrepancy     DOUBLE PRECISION NOT NULL DEFAULT -1897.95,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Dispute_pkey" PRIMARY KEY (id)
);

-- model CoreSettings (admin.settings.routes.ts: singleton get-or-create +
--        update; the route always passes id: 'singleton' explicitly)
CREATE TABLE IF NOT EXISTS core_settings (
    id               TEXT NOT NULL,
    "platformName"   TEXT NOT NULL DEFAULT 'My SaaS Platform',
    "supportEmail"   TEXT NOT NULL DEFAULT 'support@example.com',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT FALSE,
    "systemTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "brandColor"     TEXT DEFAULT '#6366f1',
    "logoUrl"        TEXT,
    "faviconUrl"     TEXT,
    "ogImageUrl"     TEXT,
    "smtpHost"       TEXT,
    "smtpPort"       TEXT,
    "smtpUsername"   TEXT,
    "smtpPassword"   TEXT,
    "smtpFromAddress" TEXT,
    "webhookUrl"     TEXT,
    "webhookSecret"  TEXT,
    "webhookEvents"  TEXT[] NOT NULL DEFAULT '{}',
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT core_settings_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 4. Remaining introspected models with no code callers today, provisioned
--    so prisma.* queries against them can never fail with P2021.
-- ---------------------------------------------------------------------------

-- model ModerationReport (@@map "moderation_reports")
CREATE TABLE IF NOT EXISTS moderation_reports (
    id            UUID NOT NULL DEFAULT gen_random_uuid(),
    type          VARCHAR(50) NOT NULL,
    title         VARCHAR(200) NOT NULL,
    preview       TEXT,
    severity      VARCHAR(20) NOT NULL,
    reporter      VARCHAR(100) NOT NULL,
    target        VARCHAR(50) NOT NULL,
    "targetDetail" VARCHAR(255) NOT NULL,
    unread        BOOLEAN NOT NULL DEFAULT TRUE,
    "fullBody"    TEXT,
    "flaggedWords" JSONB NOT NULL DEFAULT '[]',
    "apiLogs"     JSONB NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT moderation_reports_pkey PRIMARY KEY (id)
);

-- model SecuritySettings (@@map "security_settings", @id @default("singleton"))
CREATE TABLE IF NOT EXISTS security_settings (
    id                 TEXT NOT NULL,
    require_2fa        BOOLEAN NOT NULL DEFAULT FALSE,
    session_timeout    INTEGER NOT NULL DEFAULT 30,
    block_vpn          BOOLEAN NOT NULL DEFAULT FALSE,
    max_failed_logins  INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT security_settings_pkey PRIMARY KEY (id)
);

-- model PlatformKey (@@map "platform_keys")
CREATE TABLE IF NOT EXISTS platform_keys (
    id            TEXT NOT NULL,
    name          VARCHAR(100) NOT NULL,
    masked_key    VARCHAR(100) NOT NULL,
    raw_key_hash  VARCHAR(255) NOT NULL,
    environment   VARCHAR(50) NOT NULL,
    last_used_at  TIMESTAMPTZ(6),
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT platform_keys_pkey PRIMARY KEY (id)
);

