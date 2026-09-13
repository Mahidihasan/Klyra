CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE provider_payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount              DECIMAL(10,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    status              payout_status NOT NULL DEFAULT 'PENDING',
    stripe_account_id   VARCHAR(255),
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT provider_payouts_amount_non_negative CHECK (amount >= 0)
);

ALTER TABLE provider_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_payouts_select ON provider_payouts FOR SELECT USING (provider_id = current_user_id() OR is_admin());
CREATE POLICY provider_payouts_admin ON provider_payouts TO app_admin USING (true);
