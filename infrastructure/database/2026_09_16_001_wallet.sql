-- ============================================================================
-- 2026_09_16_001_wallet.sql
-- Wallet module: prepaid credit balance (wallets) + append-only ledger
-- (wallet_transactions).
--
-- Source: WALLET_ARCHITECTURE.md section 3.2.
--
-- Three deviations from that document, each forced by what schema.sql actually
-- defines. No shared database object is created, altered or dropped here.
--
--   1. update_updated_at_column() does not exist. This repository's trigger
--      function is set_updated_at() (schema.sql line 799), used by every
--      existing *_updated_at trigger.
--   2. current_user_id() does not exist. Every RLS policy in schema.sql inlines
--      current_setting('app.current_user_id', TRUE)::UUID instead.
--   3. is_admin() does not exist. schema.sql inlines
--      current_setting('app.current_user_role', TRUE) = 'ADMIN'.
--
-- Note: 2026_09_11_001_payout_requests.sql calls current_user_id() and
-- is_admin(), so that migration has the same defect and is presumably
-- unapplied or partially applied. Fixing it is out of Wallet's scope.
--
-- Every statement below is safe to re-run. That is not decoration: on 18 Sep
-- 2026 these three tables were dropped from the shared database twice, and the
-- first recovery attempt failed because DROP TABLE leaves the enum types
-- behind, so a bare CREATE TYPE aborted the file halfway through and left the
-- schema half-built. A migration you cannot run twice is a migration you
-- cannot recover with.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    CREATE TYPE wallet_transaction_type AS ENUM (
        'TOPUP',       -- user added funds
        'SPEND',       -- consumed by usage or an invoice
        'REFUND',      -- reversal of a SPEND
        'BONUS',       -- promotional credit
        'ADJUSTMENT'   -- manual correction by an admin
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE wallet_transaction_direction AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE wallet_transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance         DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0),
    CONSTRAINT wallets_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE wallets IS
    'One prepaid credit balance per user. Consumer-side money; the provider-side counterpart is provider_payouts.';
COMMENT ON COLUMN wallets.balance IS
    'Cached projection of wallet_transactions. Never written outside the same transaction as a ledger row.';
COMMENT ON COLUMN wallets.is_locked IS
    'Set by an admin to freeze spending during a dispute.';

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id           UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                wallet_transaction_type NOT NULL,
    direction           wallet_transaction_direction NOT NULL,
    status              wallet_transaction_status NOT NULL DEFAULT 'COMPLETED',
    amount              DECIMAL(12,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    balance_after       DECIMAL(12,2) NOT NULL,
    description         VARCHAR(255),
    -- What caused this movement: an invoice, an API, a Stripe session.
    reference_type      VARCHAR(50),
    reference_id        UUID,
    -- Stripe session or payment intent id. Unique so a replayed webhook
    -- cannot credit the same money twice.
    external_reference  VARCHAR(255) UNIQUE,
    metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT wallet_transactions_balance_non_negative CHECK (balance_after >= 0)
);

COMMENT ON TABLE wallet_transactions IS
    'Append-only ledger. Rows are never updated or deleted; corrections are new ADJUSTMENT rows.';
COMMENT ON COLUMN wallet_transactions.balance_after IS
    'Wallet balance immediately after this movement, recorded inside the same transaction.';
COMMENT ON COLUMN wallet_transactions.external_reference IS
    'Stripe identifier, unique to make top-up crediting idempotent under webhook retries.';

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_created
    ON wallet_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
    ON wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type
    ON wallet_transactions (type);

-- ---------------------------------------------------------------------------
-- 4. Triggers
--    set_updated_at() is the repository's existing trigger function
--    (schema.sql line 799). Naming follows trg_<table>_updated_at.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
CREATE TRIGGER trg_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security
--    Second line of defence only. The application already scopes every query
--    by the user id taken from the JWT.
--
--    Predicates are inlined exactly as every policy in schema.sql writes them,
--    because current_user_id() and is_admin() do not exist in this database.
-- ---------------------------------------------------------------------------

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_select ON wallets;
CREATE POLICY wallets_select ON wallets
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
DROP POLICY IF EXISTS wallets_admin ON wallets;
CREATE POLICY wallets_admin ON wallets TO app_admin USING (true);

DROP POLICY IF EXISTS wallet_transactions_select ON wallet_transactions;
CREATE POLICY wallet_transactions_select ON wallet_transactions
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
DROP POLICY IF EXISTS wallet_transactions_admin ON wallet_transactions;
CREATE POLICY wallet_transactions_admin ON wallet_transactions TO app_admin USING (true);
