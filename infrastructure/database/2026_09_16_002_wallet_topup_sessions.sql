-- ============================================================================
-- 2026_09_16_002_wallet_topup_sessions.sql
-- Wallet module: in-flight top-up tracking.
--
-- Why this table exists.
--
-- The Overview screen shows money the user has paid for but that has not been
-- credited yet ("$50.00 pending — completes shortly"). That state cannot live
-- in wallet_transactions: the ledger is append-only, so a PENDING row could
-- never be transitioned to COMPLETED, and it would break the invariant that
-- SUM(ledger) equals wallets.balance.
--
-- So intent and money are kept apart. This table records the intent to add
-- funds and is mutable; wallet_transactions records money that actually moved
-- and is not. A completed session points at the ledger row it produced.
--
-- Same conventions as 2026_09_16_001_wallet.sql: set_updated_at() for the
-- trigger, inlined current_setting() in the policies, because
-- update_updated_at_column(), current_user_id() and is_admin() do not exist in
-- this database. No shared object is created, altered or dropped.
--
-- Re-runnable, for the same reason as 001: recovery is only possible if the
-- file can be applied again over a schema that partly survived.
-- ============================================================================

DO $$
BEGIN
    CREATE TYPE wallet_topup_session_status AS ENUM (
        'PENDING',     -- Checkout session created, no payment confirmed yet
        'COMPLETED',   -- webhook verified the payment and credited the wallet
        'EXPIRED',     -- Stripe's session window closed without payment
        'FAILED'       -- Stripe reported the payment as failed
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS wallet_topup_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id           UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount              DECIMAL(12,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    status              wallet_topup_session_status NOT NULL DEFAULT 'PENDING',
    -- Stripe Checkout session id. Unique so a replayed webhook resolves to the
    -- one session it belongs to, and matches wallet_transactions.external_reference.
    stripe_session_id   VARCHAR(255) NOT NULL UNIQUE,
    -- The ledger row this session produced, once the webhook has credited.
    transaction_id      UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    completed_at        TIMESTAMPTZ,
    -- Stripe's own expiry for the session; a pending session past this is stale.
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_topup_sessions_amount_positive CHECK (amount > 0),
    CONSTRAINT wallet_topup_sessions_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    -- A completed session must say when, and point at the money it made.
    CONSTRAINT wallet_topup_sessions_completed_consistent CHECK (
        status <> 'COMPLETED'
        OR (completed_at IS NOT NULL AND transaction_id IS NOT NULL)
    )
);

COMMENT ON TABLE wallet_topup_sessions IS
    'Intent to add funds. Mutable, unlike wallet_transactions. Never counted in wallets.balance.';
COMMENT ON COLUMN wallet_topup_sessions.stripe_session_id IS
    'Checkout session id; the same value is used as wallet_transactions.external_reference when credited.';
COMMENT ON COLUMN wallet_topup_sessions.transaction_id IS
    'Ledger row produced by this session. NULL until the webhook credits.';

CREATE INDEX IF NOT EXISTS idx_wallet_topup_sessions_user_created
    ON wallet_topup_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_topup_sessions_pending
    ON wallet_topup_sessions (user_id)
    WHERE status = 'PENDING';

DROP TRIGGER IF EXISTS trg_wallet_topup_sessions_updated_at ON wallet_topup_sessions;
CREATE TRIGGER trg_wallet_topup_sessions_updated_at
    BEFORE UPDATE ON wallet_topup_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE wallet_topup_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_topup_sessions_select ON wallet_topup_sessions;
CREATE POLICY wallet_topup_sessions_select ON wallet_topup_sessions
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
DROP POLICY IF EXISTS wallet_topup_sessions_admin ON wallet_topup_sessions;
CREATE POLICY wallet_topup_sessions_admin ON wallet_topup_sessions TO app_admin USING (true);
