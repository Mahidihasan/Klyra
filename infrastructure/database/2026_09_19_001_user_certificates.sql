-- Immutable records for certificates earned from verified marketplace activity.
CREATE TABLE IF NOT EXISTS user_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certificate_type TEXT NOT NULL,
    verification_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_api_count INTEGER NOT NULL,
    active_subscriber_count INTEGER NOT NULL,
    api_version_count INTEGER NOT NULL,
    qualifying_api_ids UUID[] NOT NULL DEFAULT '{}',
    criteria_version SMALLINT NOT NULL DEFAULT 1,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT user_certificates_user_type_unique UNIQUE (user_id, certificate_type)
);

CREATE INDEX IF NOT EXISTS idx_user_certificates_user_id ON user_certificates(user_id);
