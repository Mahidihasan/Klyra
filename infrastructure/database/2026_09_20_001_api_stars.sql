BEGIN;

CREATE TABLE api_stars (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id     UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT api_stars_api_user_unique UNIQUE (api_id, user_id)
);

CREATE INDEX idx_api_stars_api_id ON api_stars(api_id);
CREATE INDEX idx_api_stars_user_id ON api_stars(user_id);

COMMENT ON TABLE api_stars IS 'User stars for public marketplace APIs';

COMMIT;
