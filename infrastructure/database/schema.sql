-- ============================================================================
-- API Marketplace Platform - Production Database Schema
-- PostgreSQL 15+
-- ============================================================================

-- Application roles for least-privilege access.
-- NOTE: CREATE ROLE cannot run inside a transaction block, so this is
-- executed before the main transaction begins.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_provider') THEN
        CREATE ROLE app_provider NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin NOLOGIN;
    END IF;
END $$;

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- 2. ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'USER',
    'PROVIDER',
    'MODERATOR',
    'ADMIN'
);

CREATE TYPE user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'BANNED'
);

CREATE TYPE api_status AS ENUM (
    'DRAFT',
    'PENDING',
    'PUBLISHED',
    'REJECTED',
    'ARCHIVED'
);

CREATE TYPE api_pricing_model AS ENUM (
    'FREE',
    'FREEMIUM',
    'PAID',
    'ENTERPRISE'
);

CREATE TYPE api_key_status AS ENUM (
    'ACTIVE',
    'REVOKED',
    'EXPIRED'
);

CREATE TYPE subscription_status AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAUSED',
    'CANCELLED',
    'EXPIRED'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);

CREATE TYPE invoice_status AS ENUM (
    'DRAFT',
    'SENT',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'VOID'
);

CREATE TYPE notification_type AS ENUM (
    'EMAIL',
    'IN_APP',
    'PUSH',
    'WEBHOOK'
);

CREATE TYPE notification_category AS ENUM (
    'BILLING',
    'SYSTEM',
    'API',
    'SECURITY',
    'MARKETING'
);

CREATE TYPE audit_action AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'EXPORT',
    'IMPORT',
    'APPROVE',
    'REJECT',
    'SUSPEND',
    'BAN'
);

CREATE TYPE request_method AS ENUM (
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS'
);

CREATE TYPE environment_type AS ENUM (
    'DEVELOPMENT',
    'STAGING',
    'PRODUCTION',
    'TEST'
);

CREATE TYPE billing_interval AS ENUM (
    'MONTHLY',
    'YEARLY',
    'ONE_TIME'
);

CREATE TYPE verification_type AS ENUM (
    'VERIFY_EMAIL',
    'RESET_PASSWORD'
);

CREATE TYPE doc_content_type AS ENUM (
    'MARKDOWN',
    'OPENAPI',
    'HTML'
);

CREATE TYPE rate_limit_period AS ENUM (
    'SECOND',
    'MINUTE',
    'HOUR',
    'DAY'
);

-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT NOT NULL,
    password_hash       TEXT NOT NULL,
    name                VARCHAR(100) NOT NULL,
    role                user_role NOT NULL DEFAULT 'USER',
    avatar_url          VARCHAR(500),
    avatar_public_id    VARCHAR(200),
    avatar_metadata     JSONB,
    bio                 TEXT,
    company             VARCHAR(255),
    website             VARCHAR(500),
    email_verified_at   TIMESTAMPTZ,
    status              user_status NOT NULL DEFAULT 'ACTIVE',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret   TEXT,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT users_website_format CHECK (website IS NULL OR website ~* '^https?://')
);

COMMENT ON TABLE users IS 'Platform user accounts with authentication and profile data';
COMMENT ON COLUMN users.password_hash IS 'Hashed password using bcrypt or argon2 - never store plaintext';
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret for 2FA - encrypted at rest';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - records are retained for audit';
COMMENT ON COLUMN users.avatar_url IS 'Cloudinary asset URL for the profile avatar';
COMMENT ON COLUMN users.avatar_public_id IS 'Cloudinary public_id used to manage/delete the avatar asset';
COMMENT ON COLUMN users.avatar_metadata IS 'Cloudinary asset metadata (version, format, dimensions, bytes, secure_url)';

CREATE TABLE user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NOT NULL,
    user_agent          TEXT,
    ip_address          INET,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_sessions_refresh_token_unique UNIQUE (refresh_token_hash)
);

COMMENT ON TABLE user_sessions IS 'Tracks active user sessions and refresh tokens for authentication';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'SHA-256 hash of the refresh token - never store raw tokens';

CREATE TABLE email_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          TEXT NOT NULL,
    type                verification_type NOT NULL DEFAULT 'VERIFY_EMAIL',
    expires_at          TIMESTAMPTZ NOT NULL,
    used_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_verifications_token_unique UNIQUE (token_hash)
);

COMMENT ON TABLE email_verifications IS 'Handles email verification and password reset token lifecycle';

-- ============================================================================
-- 4. MARKETPLACE TABLES
-- ============================================================================

CREATE TABLE categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(150) NOT NULL,
    description         TEXT,
    icon_url            VARCHAR(500),
    icon_public_id      VARCHAR(200),
    icon_metadata       JSONB,
    parent_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT categories_slug_unique UNIQUE (slug),
    CONSTRAINT categories_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE categories IS 'API categories supporting hierarchical parent-child relationships';
COMMENT ON COLUMN categories.icon_url IS 'Cloudinary asset URL for the category icon';
COMMENT ON COLUMN categories.icon_public_id IS 'Cloudinary public_id used to manage/delete the icon asset';
COMMENT ON COLUMN categories.icon_metadata IS 'Cloudinary asset metadata (version, format, dimensions, bytes, secure_url)';

CREATE TABLE apis (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    current_version     VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    base_url            VARCHAR(500) NOT NULL,
    docs_url            VARCHAR(500),
    logo_url            VARCHAR(500),
    logo_public_id      VARCHAR(200),
    logo_metadata       JSONB,
    category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pricing_model       api_pricing_model NOT NULL DEFAULT 'FREE',
    pricing             JSONB NOT NULL DEFAULT '{}'::JSONB,
    status              api_status NOT NULL DEFAULT 'DRAFT',
    is_public           BOOLEAN NOT NULL DEFAULT FALSE,
    api_spec            JSONB,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    rating              DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_reviews       INTEGER NOT NULL DEFAULT 0,
    total_subscribers   INTEGER NOT NULL DEFAULT 0,
    total_requests      BIGINT NOT NULL DEFAULT 0,
    last_published_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT apis_slug_unique UNIQUE (slug),
    CONSTRAINT apis_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT apis_rating_range CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT apis_total_reviews_non_negative CHECK (total_reviews >= 0),
    CONSTRAINT apis_total_subscribers_non_negative CHECK (total_subscribers >= 0),
    CONSTRAINT apis_total_requests_non_negative CHECK (total_requests >= 0),
    CONSTRAINT apis_base_url_format CHECK (base_url ~* '^https?://')
);

COMMENT ON TABLE apis IS 'Core API marketplace table with publishing, pricing, and performance metrics';
COMMENT ON COLUMN apis.pricing IS 'JSONB pricing structure: { "free": {...}, "tiers": [{"name": "...", "price": 0, "features": [...]}] }';
COMMENT ON COLUMN apis.api_spec IS 'OpenAPI specification in JSON format for API documentation and testing';
COMMENT ON COLUMN apis.logo_url IS 'Cloudinary asset URL for the API logo';
COMMENT ON COLUMN apis.logo_public_id IS 'Cloudinary public_id used to manage/delete the logo asset';
COMMENT ON COLUMN apis.logo_metadata IS 'Cloudinary asset metadata (version, format, dimensions, bytes, secure_url)';

CREATE TABLE api_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    version             VARCHAR(20) NOT NULL,
    api_spec            JSONB,
    changelog           TEXT,
    is_deprecated       BOOLEAN NOT NULL DEFAULT FALSE,
    is_current          BOOLEAN NOT NULL DEFAULT FALSE,
    released_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT api_versions_api_version_unique UNIQUE (api_id, version),
    CONSTRAINT api_versions_version_format CHECK (version ~* '^\d+\.\d+\.\d+$')
);

COMMENT ON TABLE api_versions IS 'Tracks API version history with version-specific specifications';
COMMENT ON COLUMN api_versions.is_current IS 'Only one version per API should be marked as current';

CREATE TABLE api_documentation (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    api_version_id      UUID REFERENCES api_versions(id) ON DELETE SET NULL,
    title               VARCHAR(200) NOT NULL,
    content             TEXT NOT NULL,
    content_type        doc_content_type NOT NULL DEFAULT 'MARKDOWN',
    is_published        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE api_documentation IS 'Stores API documentation content linked to specific API versions';

CREATE TABLE api_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    rating              INTEGER NOT NULL,
    title               VARCHAR(200),
    content             TEXT,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT api_reviews_user_api_unique UNIQUE (user_id, api_id),
    CONSTRAINT api_reviews_rating_range CHECK (rating >= 1 AND rating <= 5)
);

COMMENT ON TABLE api_reviews IS 'User reviews and ratings for APIs - one review per user per API';

-- ============================================================================
-- 5. API KEY MANAGEMENT
-- ============================================================================

CREATE TABLE api_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_id              UUID REFERENCES apis(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    key_hash            TEXT NOT NULL,
    key_prefix          VARCHAR(10) NOT NULL,
    permissions         JSONB NOT NULL DEFAULT '{}'::JSONB,
    rate_limit          INTEGER NOT NULL DEFAULT 60,
    rate_limit_period   rate_limit_period NOT NULL DEFAULT 'MINUTE',
    expires_at          TIMESTAMPTZ,
    last_used_at        TIMESTAMPTZ,
    status              api_key_status NOT NULL DEFAULT 'ACTIVE',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at          TIMESTAMPTZ,
    CONSTRAINT api_keys_hash_unique UNIQUE (key_hash),
    CONSTRAINT api_keys_rate_limit_positive CHECK (rate_limit > 0),
    CONSTRAINT api_keys_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE api_keys IS 'API key management with permissions, rate limiting, and lifecycle tracking';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key - the raw key is shown only once at creation';
COMMENT ON COLUMN api_keys.key_prefix IS 'Short display prefix for identifying keys without exposing the full key';

-- ============================================================================
-- 6. PLAYGROUND & TESTING
-- ============================================================================

CREATE TABLE collections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_id              UUID REFERENCES apis(id) ON DELETE SET NULL,
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    is_public           BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT collections_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE collections IS 'Organizes saved requests into shareable collections';

CREATE TABLE request_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_id              UUID REFERENCES apis(id) ON DELETE SET NULL,
    api_key_id          UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    collection_id       UUID REFERENCES collections(id) ON DELETE SET NULL,
    method              request_method NOT NULL,
    url                 TEXT NOT NULL,
    headers             JSONB NOT NULL DEFAULT '{}'::JSONB,
    query_params        JSONB NOT NULL DEFAULT '{}'::JSONB,
    body                JSONB,
    response_status     INTEGER,
    response_body       JSONB,
    response_headers    JSONB,
    latency_ms          INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_history_url_not_empty CHECK (char_length(url) > 0)
);

COMMENT ON TABLE request_history IS 'Complete history of all playground API requests for debugging and audit';

CREATE TABLE saved_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_id              UUID REFERENCES apis(id) ON DELETE SET NULL,
    name                VARCHAR(200) NOT NULL,
    method              request_method NOT NULL,
    url                 TEXT NOT NULL,
    headers             JSONB NOT NULL DEFAULT '{}'::JSONB,
    query_params        JSONB NOT NULL DEFAULT '{}'::JSONB,
    body                JSONB,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT saved_requests_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE saved_requests IS 'User-saved API requests for reuse in the playground';

CREATE TABLE environments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    type                environment_type NOT NULL DEFAULT 'DEVELOPMENT',
    variables           JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT environments_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE environments IS 'Environment variable sets for playground requests (dev, staging, prod)';
COMMENT ON COLUMN environments.variables IS 'Key-value pairs of environment variables - sensitive values should be encrypted';

-- ============================================================================
-- 7. SUBSCRIPTION & BILLING
-- ============================================================================

CREATE TABLE subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(150) NOT NULL,
    description         TEXT,
    price               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    billing_interval    billing_interval NOT NULL DEFAULT 'MONTHLY',
    features            JSONB NOT NULL DEFAULT '[]'::JSONB,
    rate_limit          INTEGER,
    rate_limit_period   rate_limit_period,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT subscription_plans_api_slug_unique UNIQUE (api_id, slug),
    CONSTRAINT subscription_plans_price_non_negative CHECK (price >= 0),
    CONSTRAINT subscription_plans_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE subscription_plans IS 'Defines subscription tiers and pricing for each API';

CREATE TABLE user_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status              subscription_status NOT NULL DEFAULT 'ACTIVE',
    period_start        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_end          TIMESTAMPTZ,
    auto_renew          BOOLEAN NOT NULL DEFAULT TRUE,
    stripe_subscription_id VARCHAR(255),
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_subscriptions_user_api_unique UNIQUE (user_id, api_id)
);

COMMENT ON TABLE user_subscriptions IS 'Tracks user subscriptions to APIs with billing periods';
COMMENT ON COLUMN user_subscriptions.stripe_subscription_id IS 'External Stripe subscription reference for payment processing';

CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id     UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    invoice_number      VARCHAR(50) NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    status              invoice_status NOT NULL DEFAULT 'DRAFT',
    stripe_invoice_id   VARCHAR(255),
    pdf_url             VARCHAR(500),
    pdf_public_id       VARCHAR(200),
    pdf_metadata        JSONB,
    due_date            TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoices_number_unique UNIQUE (invoice_number),
    CONSTRAINT invoices_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT invoices_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE invoices IS 'Generated invoices for subscription billing';
COMMENT ON COLUMN invoices.pdf_url IS 'Cloudinary asset URL for the generated invoice PDF';
COMMENT ON COLUMN invoices.pdf_public_id IS 'Cloudinary public_id used to manage/delete the PDF asset';
COMMENT ON COLUMN invoices.pdf_metadata IS 'Cloudinary asset metadata (version, format, bytes, secure_url)';

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id     UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,
    amount              DECIMAL(10,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    status              payment_status NOT NULL DEFAULT 'PENDING',
    stripe_payment_id   VARCHAR(255),
    payment_method      VARCHAR(50),
    payment_method_details JSONB,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT payments_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE payments IS 'Payment processing records with Stripe integration';
COMMENT ON COLUMN payments.payment_method_details IS 'Non-sensitive payment method details (last 4 digits, brand) - never store full card data';

-- ============================================================================
-- 8. ANALYTICS & MONITORING
-- ============================================================================

CREATE TABLE api_analytics (
    id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    api_key_id          UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    request_method      request_method NOT NULL,
    endpoint            TEXT NOT NULL,
    status_code         INTEGER,
    latency_ms          INTEGER,
    user_agent          TEXT,
    ip_address          INET,
    country_code        CHAR(2),
    is_error            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE api_analytics IS 'Raw API call analytics - partitioned by month for scalability to millions of records';

-- Default partition catches any rows outside explicitly created monthly
-- partitions. Monthly partitions are created via create_analytics_partition().
CREATE TABLE api_analytics_default PARTITION OF api_analytics DEFAULT;

CREATE TABLE api_analytics_daily (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id              UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    total_requests      BIGINT NOT NULL DEFAULT 0,
    total_errors        BIGINT NOT NULL DEFAULT 0,
    total_latency_ms    BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms      DECIMAL(10,2) NOT NULL DEFAULT 0,
    unique_users        INTEGER NOT NULL DEFAULT 0,
    unique_api_keys     INTEGER NOT NULL DEFAULT 0,
    status_code_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,
    endpoint_breakdown  JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT api_analytics_daily_api_date_unique UNIQUE (api_id, date)
);

COMMENT ON TABLE api_analytics_daily IS 'Daily aggregated analytics for fast dashboard queries';

-- ============================================================================
-- 9. NOTIFICATIONS & COMMUNICATION
-- ============================================================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                notification_type NOT NULL DEFAULT 'IN_APP',
    category            notification_category NOT NULL DEFAULT 'SYSTEM',
    title               VARCHAR(200) NOT NULL,
    content             TEXT,
    data                JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_title_not_empty CHECK (char_length(trim(title)) > 0)
);

COMMENT ON TABLE notifications IS 'User notifications across email, in-app, push, and webhook channels';

CREATE TABLE notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    billing_notifications   BOOLEAN NOT NULL DEFAULT TRUE,
    system_notifications    BOOLEAN NOT NULL DEFAULT TRUE,
    api_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
    security_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_preferences_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE notification_preferences IS 'Per-user notification channel and category preferences';

-- ============================================================================
-- 10. ADMIN & LOGGING
-- ============================================================================

CREATE TABLE audit_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    action              audit_action NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    entity_id           UUID,
    old_values          JSONB,
    new_values          JSONB,
    ip_address          INET,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_logs_entity_type_not_empty CHECK (char_length(entity_type) > 0)
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all admin and system actions for compliance';

CREATE TABLE system_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key                 VARCHAR(100) NOT NULL,
    value               JSONB NOT NULL,
    description         TEXT,
    is_public           BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT system_settings_key_unique UNIQUE (key),
    CONSTRAINT system_settings_key_not_empty CHECK (char_length(trim(key)) > 0)
);

COMMENT ON TABLE system_settings IS 'Platform-wide configuration settings with public/private visibility';

-- ============================================================================
-- 11. INDEXES
-- ============================================================================

CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email_trgm ON users USING GIN (email gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_created_at ON user_sessions(created_at DESC);

CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at) WHERE used_at IS NULL;

CREATE INDEX idx_categories_parent_id ON categories(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_active ON categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_sort_order ON categories(sort_order) WHERE deleted_at IS NULL;

CREATE INDEX idx_apis_category_id ON apis(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_apis_owner_id ON apis(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_apis_status ON apis(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_apis_rating ON apis(rating DESC) WHERE deleted_at IS NULL AND status = 'PUBLISHED';
CREATE INDEX idx_apis_pricing_model ON apis(pricing_model) WHERE deleted_at IS NULL;
CREATE INDEX idx_apis_published ON apis(last_published_at DESC) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX idx_apis_tags ON apis USING GIN (tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_apis_name_trgm ON apis USING GIN (name gin_trgm_ops);
CREATE INDEX idx_apis_description_trgm ON apis USING GIN (description gin_trgm_ops);
CREATE INDEX idx_apis_created_at ON apis(created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_api_versions_api_id ON api_versions(api_id);
CREATE INDEX idx_api_versions_current ON api_versions(api_id) WHERE is_current = TRUE;
CREATE INDEX idx_api_versions_deprecated ON api_versions(api_id) WHERE is_deprecated = TRUE;

CREATE INDEX idx_api_documentation_api_id ON api_documentation(api_id);
CREATE INDEX idx_api_documentation_version_id ON api_documentation(api_version_id);
CREATE INDEX idx_api_documentation_published ON api_documentation(api_id) WHERE is_published = TRUE;

CREATE INDEX idx_api_reviews_user_id ON api_reviews(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_reviews_api_id ON api_reviews(api_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_reviews_rating ON api_reviews(api_id, rating) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_reviews_approved ON api_reviews(api_id) WHERE is_approved = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_api_reviews_created_at ON api_reviews(created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_api_id ON api_keys(api_id);
CREATE INDEX idx_api_keys_status ON api_keys(user_id, status) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at DESC) WHERE status = 'ACTIVE';

CREATE INDEX idx_request_history_user_id ON request_history(user_id);
CREATE INDEX idx_request_history_api_id ON request_history(api_id);
CREATE INDEX idx_request_history_api_key_id ON request_history(api_key_id);
CREATE INDEX idx_request_history_collection_id ON request_history(collection_id);
CREATE INDEX idx_request_history_created_at ON request_history(user_id, created_at DESC);
CREATE INDEX idx_request_history_method ON request_history(method);

CREATE INDEX idx_saved_requests_user_id ON saved_requests(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_requests_api_id ON saved_requests(api_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_requests_created_at ON saved_requests(user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_collections_user_id ON collections(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_collections_api_id ON collections(api_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_collections_public ON collections(is_public) WHERE is_public = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_collections_favorite ON collections(user_id) WHERE is_favorite = TRUE AND deleted_at IS NULL;

CREATE INDEX idx_environments_user_id ON environments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_environments_type ON environments(user_id, type) WHERE deleted_at IS NULL;

CREATE INDEX idx_subscription_plans_api_id ON subscription_plans(api_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subscription_plans_active ON subscription_plans(api_id) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_subscription_plans_billing ON subscription_plans(billing_interval) WHERE deleted_at IS NULL;

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_api_id ON user_subscriptions(api_id);
CREATE INDEX idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_active ON user_subscriptions(user_id) WHERE status IN ('ACTIVE', 'TRIALING');
CREATE INDEX idx_user_subscriptions_period_end ON user_subscriptions(period_end) WHERE status = 'ACTIVE';

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('SENT', 'PARTIALLY_PAID');
CREATE INDEX idx_invoices_created_at ON invoices(user_id, created_at DESC);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(user_id, created_at DESC);

CREATE INDEX idx_api_analytics_api_id ON api_analytics(api_id, created_at DESC);
CREATE INDEX idx_api_analytics_api_key_id ON api_analytics(api_key_id, created_at DESC);
CREATE INDEX idx_api_analytics_user_id ON api_analytics(user_id, created_at DESC);
CREATE INDEX idx_api_analytics_created_at ON api_analytics(created_at DESC);
CREATE INDEX idx_api_analytics_status_code ON api_analytics(api_id, status_code, created_at DESC);
CREATE INDEX idx_api_analytics_endpoint ON api_analytics(api_id, endpoint, created_at DESC);
CREATE INDEX idx_api_analytics_error ON api_analytics(api_id, created_at DESC) WHERE is_error = TRUE;

CREATE INDEX idx_api_analytics_daily_api_id ON api_analytics_daily(api_id, date DESC);
CREATE INDEX idx_api_analytics_daily_date ON api_analytics_daily(date DESC);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_category ON notifications(user_id, category);
CREATE INDEX idx_notifications_created_at ON notifications(user_id, created_at DESC);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX idx_system_settings_public ON system_settings(is_public) WHERE is_public = TRUE;

-- ============================================================================
-- 12. TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_updated_at() IS 'Trigger function that automatically sets updated_at to current timestamp on UPDATE';

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_apis_updated_at BEFORE UPDATE ON apis
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_api_versions_updated_at BEFORE UPDATE ON api_versions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_api_documentation_updated_at BEFORE UPDATE ON api_documentation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_api_reviews_updated_at BEFORE UPDATE ON api_reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_saved_requests_updated_at BEFORE UPDATE ON saved_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_environments_updated_at BEFORE UPDATE ON environments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_api_analytics_daily_updated_at BEFORE UPDATE ON api_analytics_daily
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION update_api_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_api_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_api_id := OLD.api_id;
    ELSE
        v_api_id := NEW.api_id;
    END IF;

    UPDATE apis
    SET rating = COALESCE(
            (SELECT ROUND(AVG(rating)::numeric, 2)
             FROM api_reviews
             WHERE api_id = v_api_id AND deleted_at IS NULL AND is_approved = TRUE),
            0.00
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM api_reviews
            WHERE api_id = v_api_id AND deleted_at IS NULL AND is_approved = TRUE
        )
    WHERE id = v_api_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_api_rating() IS 'Recalculates API rating and review count when reviews are inserted, updated, or deleted';

CREATE TRIGGER trg_api_reviews_rating
    AFTER INSERT OR UPDATE OR DELETE ON api_reviews
    FOR EACH ROW EXECUTE FUNCTION update_api_rating();

CREATE OR REPLACE FUNCTION update_api_subscriber_count()
RETURNS TRIGGER AS $$
DECLARE
    v_api_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_api_id := OLD.api_id;
    ELSE
        v_api_id := NEW.api_id;
    END IF;

    UPDATE apis
    SET total_subscribers = (
        SELECT COUNT(*)
        FROM user_subscriptions
        WHERE api_id = v_api_id AND status IN ('ACTIVE', 'TRIALING')
    )
    WHERE id = v_api_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_api_subscriber_count() IS 'Updates API subscriber count when subscriptions change status';

CREATE TRIGGER trg_user_subscriptions_subscriber_count
    AFTER INSERT OR UPDATE OR DELETE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_api_subscriber_count();

CREATE OR REPLACE FUNCTION prevent_duplicate_current_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE api_versions
        SET is_current = FALSE
        WHERE api_id = NEW.api_id AND id <> NEW.id AND is_current = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_duplicate_current_version() IS 'Ensures only one version is marked as current per API';

CREATE TRIGGER trg_api_versions_current
    BEFORE INSERT OR UPDATE OF is_current ON api_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_current_version();

CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_notification_preferences() IS 'Automatically creates default notification preferences when a new user is registered';

CREATE TRIGGER trg_users_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_notification_preferences();

-- ============================================================================
-- 13. MATERIALIZED VIEWS
-- ============================================================================

CREATE MATERIALIZED VIEW mv_api_performance_summary AS
SELECT
    a.id AS api_id,
    a.name AS api_name,
    a.slug AS api_slug,
    a.owner_id,
    a.category_id,
    a.status,
    COALESCE(SUM(ad.total_requests), 0) AS total_requests,
    COALESCE(SUM(ad.total_errors), 0) AS total_errors,
    CASE
        WHEN SUM(ad.total_requests) > 0
        THEN ROUND((SUM(ad.total_errors)::numeric / SUM(ad.total_requests)::numeric) * 100, 2)
        ELSE 0
    END AS error_rate,
    CASE
        WHEN SUM(ad.total_requests) > 0
        THEN ROUND(SUM(ad.total_latency_ms)::numeric / SUM(ad.total_requests)::numeric, 2)
        ELSE 0
    END AS avg_latency_ms,
    COALESCE(SUM(ad.unique_users), 0) AS unique_users,
    COALESCE(SUM(ad.unique_api_keys), 0) AS unique_api_keys,
    MAX(ad.date) AS last_activity_date,
    a.rating,
    a.total_reviews,
    a.total_subscribers,
    a.created_at
FROM apis a
LEFT JOIN api_analytics_daily ad ON ad.api_id = a.id
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.name, a.slug, a.owner_id, a.category_id, a.status, a.rating, a.total_reviews, a.total_subscribers, a.created_at;

COMMENT ON MATERIALIZED VIEW mv_api_performance_summary IS 'Aggregated API performance metrics for dashboards and provider analytics';

CREATE UNIQUE INDEX idx_mv_api_performance_summary_api_id ON mv_api_performance_summary(api_id);
CREATE INDEX idx_mv_api_performance_summary_owner ON mv_api_performance_summary(owner_id);
CREATE INDEX idx_mv_api_performance_summary_category ON mv_api_performance_summary(category_id);
CREATE INDEX idx_mv_api_performance_summary_rating ON mv_api_performance_summary(rating DESC);

CREATE MATERIALIZED VIEW mv_marketplace_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS total_published_apis,
    COUNT(*) FILTER (WHERE status = 'DRAFT') AS total_draft_apis,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS total_pending_apis,
    COUNT(*) FILTER (WHERE status = 'ARCHIVED') AS total_archived_apis,
    COUNT(DISTINCT owner_id) AS total_providers,
    COALESCE(SUM(total_subscribers), 0) AS total_subscriptions,
    COALESCE(SUM(total_requests), 0) AS total_requests,
    COALESCE(ROUND(AVG(rating) FILTER (WHERE total_reviews > 0), 2), 0) AS avg_rating,
    COALESCE(SUM(total_reviews), 0) AS total_reviews,
    COUNT(DISTINCT category_id) AS total_categories,
    NOW() AS computed_at
FROM apis
WHERE deleted_at IS NULL;

COMMENT ON MATERIALIZED VIEW mv_marketplace_stats IS 'Overall marketplace statistics for the platform dashboard';

CREATE MATERIALIZED VIEW mv_user_activity_summary AS
SELECT
    u.id AS user_id,
    u.email,
    u.name,
    u.role,
    u.status,
    u.created_at AS registered_at,
    u.last_login_at,
    COUNT(DISTINCT a.id) AS apis_published,
    COUNT(DISTINCT us.id) FILTER (WHERE us.status IN ('ACTIVE', 'TRIALING')) AS active_subscriptions,
    COUNT(DISTINCT ak.id) FILTER (WHERE ak.status = 'ACTIVE') AS active_api_keys,
    COUNT(DISTINCT rh.id) AS total_requests_made,
    COUNT(DISTINCT c.id) AS collections_created,
    COUNT(DISTINCT n.id) FILTER (WHERE n.is_read = FALSE) AS unread_notifications
FROM users u
LEFT JOIN apis a ON a.owner_id = u.id AND a.deleted_at IS NULL
LEFT JOIN user_subscriptions us ON us.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = u.id
LEFT JOIN request_history rh ON rh.user_id = u.id
LEFT JOIN collections c ON c.user_id = u.id AND c.deleted_at IS NULL
LEFT JOIN notifications n ON n.user_id = u.id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.name, u.role, u.status, u.created_at, u.last_login_at;

COMMENT ON MATERIALIZED VIEW mv_user_activity_summary IS 'User activity metrics for admin dashboards and user analytics';

CREATE UNIQUE INDEX idx_mv_user_activity_summary_user_id ON mv_user_activity_summary(user_id);

CREATE MATERIALIZED VIEW mv_top_apis AS
SELECT
    a.id AS api_id,
    a.name,
    a.slug,
    a.description,
    a.logo_url,
    a.rating,
    a.total_reviews,
    a.total_subscribers,
    a.total_requests,
    c.name AS category_name,
    u.name AS provider_name,
    a.created_at
FROM apis a
JOIN categories c ON c.id = a.category_id
JOIN users u ON u.id = a.owner_id
WHERE a.status = 'PUBLISHED' AND a.deleted_at IS NULL
ORDER BY a.rating DESC, a.total_reviews DESC
LIMIT 100;

COMMENT ON MATERIALIZED VIEW mv_top_apis IS 'Top 100 performing APIs by rating for marketplace discovery';

CREATE UNIQUE INDEX idx_mv_top_apis_api_id ON mv_top_apis(api_id);

-- ============================================================================
-- 14. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_verifications_select_own ON email_verifications
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY email_verifications_insert_own ON email_verifications
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY email_verifications_update_own ON email_verifications
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY email_verifications_delete_own ON email_verifications
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY categories_select ON categories
    FOR SELECT USING (is_active = TRUE OR
                      current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR'));
CREATE POLICY categories_insert_admin ON categories
    FOR INSERT WITH CHECK (current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR'));
CREATE POLICY categories_update_admin ON categories
    FOR UPDATE USING (current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR'));
CREATE POLICY categories_delete_admin ON categories
    FOR DELETE USING (current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY api_versions_select ON api_versions
    FOR SELECT USING (
        api_id IN (
            SELECT id FROM apis WHERE status = 'PUBLISHED'
            UNION
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR')
    );
CREATE POLICY api_versions_insert_owner ON api_versions
    FOR INSERT WITH CHECK (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY api_versions_update_owner ON api_versions
    FOR UPDATE USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY api_versions_delete_owner ON api_versions
    FOR DELETE USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

CREATE POLICY api_documentation_select ON api_documentation
    FOR SELECT USING (
        is_published = TRUE OR
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR')
    );
CREATE POLICY api_documentation_insert_owner ON api_documentation
    FOR INSERT WITH CHECK (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY api_documentation_update_owner ON api_documentation
    FOR UPDATE USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY api_documentation_delete_owner ON api_documentation
    FOR DELETE USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

CREATE POLICY api_reviews_select ON api_reviews
    FOR SELECT USING (
        is_approved = TRUE OR
        user_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR')
    );
CREATE POLICY api_reviews_insert_own ON api_reviews
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY api_reviews_update_own ON api_reviews
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR'));
CREATE POLICY api_reviews_delete_own ON api_reviews
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR'));

CREATE POLICY request_history_select_own ON request_history
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY request_history_insert_own ON request_history
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY request_history_delete_own ON request_history
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY saved_requests_select_own ON saved_requests
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY saved_requests_insert_own ON saved_requests
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY saved_requests_update_own ON saved_requests
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY saved_requests_delete_own ON saved_requests
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY collections_select ON collections
    FOR SELECT USING (
        is_public = TRUE OR
        user_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY collections_insert_own ON collections
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY collections_update_own ON collections
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY collections_delete_own ON collections
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY environments_select_own ON environments
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY environments_insert_own ON environments
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY environments_update_own ON environments
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY environments_delete_own ON environments
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY subscription_plans_select ON subscription_plans
    FOR SELECT USING (
        is_active = TRUE OR
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY subscription_plans_insert_owner ON subscription_plans
    FOR INSERT WITH CHECK (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY subscription_plans_update_owner ON subscription_plans
    FOR UPDATE USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY subscription_plans_delete_owner ON subscription_plans
    FOR DELETE USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

CREATE POLICY user_subscriptions_select ON user_subscriptions
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', TRUE)::UUID OR
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY user_subscriptions_insert_own ON user_subscriptions
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY user_subscriptions_update_own ON user_subscriptions
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY user_subscriptions_delete_own ON user_subscriptions
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY invoices_select ON invoices
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY invoices_insert_admin ON invoices
    FOR INSERT WITH CHECK (current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY invoices_update_admin ON invoices
    FOR UPDATE USING (current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY payments_select ON payments
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY payments_insert_admin ON payments
    FOR INSERT WITH CHECK (current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY payments_update_admin ON payments
    FOR UPDATE USING (current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY notifications_insert_admin ON notifications
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'SYSTEM'));
CREATE POLICY notifications_delete_own ON notifications
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY notifications_select_own ON notifications
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY notification_preferences_select_own ON notification_preferences
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY notification_preferences_insert_own ON notification_preferences
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY notification_preferences_update_own ON notification_preferences
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY users_select_own ON users
    FOR SELECT USING (id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY users_insert_public ON users
    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY user_sessions_select_own ON user_sessions
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY user_sessions_delete_own ON user_sessions
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY apis_select ON apis
    FOR SELECT USING (
        status = 'PUBLISHED' OR
        owner_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR')
    );
CREATE POLICY apis_insert_owner ON apis
    FOR INSERT WITH CHECK (
        owner_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY apis_update_owner ON apis
    FOR UPDATE USING (
        owner_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) IN ('ADMIN', 'MODERATOR')
    );
CREATE POLICY apis_delete_owner ON apis
    FOR DELETE USING (
        owner_id = current_setting('app.current_user_id', TRUE)::UUID OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

CREATE POLICY api_keys_select_own ON api_keys
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY api_keys_insert_own ON api_keys
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                           current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY api_keys_update_own ON api_keys
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');
CREATE POLICY api_keys_delete_own ON api_keys
    FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID OR
                      current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY api_analytics_select ON api_analytics
    FOR SELECT USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

CREATE POLICY api_analytics_daily_select ON api_analytics_daily
    FOR SELECT USING (
        api_id IN (
            SELECT id FROM apis WHERE owner_id = current_setting('app.current_user_id', TRUE)::UUID
        ) OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );

CREATE POLICY audit_logs_select_admin ON audit_logs
    FOR SELECT USING (current_setting('app.current_user_role', TRUE) = 'ADMIN');

CREATE POLICY system_settings_select ON system_settings
    FOR SELECT USING (
        is_public = TRUE OR
        current_setting('app.current_user_role', TRUE) = 'ADMIN'
    );
CREATE POLICY system_settings_update_admin ON system_settings
    FOR UPDATE USING (current_setting('app.current_user_role', TRUE) = 'ADMIN');

-- ============================================================================
-- 15. MAINTENANCE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_api_performance_summary;
    REFRESH MATERIALIZED VIEW mv_marketplace_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_apis;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_materialized_views() IS 'Refreshes all materialized views concurrently. Schedule via cron/pg_cron.';

CREATE OR REPLACE FUNCTION create_analytics_partition(p_month DATE)
RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_start_date := date_trunc('month', p_month)::DATE;
    v_end_date := (date_trunc('month', p_month) + INTERVAL '1 month')::DATE;
    v_partition_name := 'api_analytics_' || to_char(v_start_date, 'YYYY_MM');

    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = v_partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF api_analytics FOR VALUES FROM (%L) TO (%L)',
            v_partition_name, v_start_date, v_end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_analytics_partition(DATE) IS 'Creates a new monthly partition for api_analytics. Call monthly via cron.';

CREATE OR REPLACE FUNCTION drop_analytics_partition(p_month DATE)
RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
BEGIN
    v_partition_name := 'api_analytics_' || to_char(date_trunc('month', p_month), 'YYYY_MM');

    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = v_partition_name
    ) THEN
        EXECUTE format('DROP TABLE %I', v_partition_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION drop_analytics_partition(DATE) IS 'Drops an old monthly partition for api_analytics. Call monthly via cron for data retention.';

-- ============================================================================
-- 16. DATABASE-LEVEL SECURITY
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_provider;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_provider;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_admin;

COMMIT;