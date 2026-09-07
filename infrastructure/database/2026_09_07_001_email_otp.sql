-- 2026_09_07_001_email_otp.sql
-- ============================================================================
-- Email OTP verification support.
--
-- Extends the existing email_verifications table (which already stores hashed
-- single-use tokens with type/expires_at/used_at) so it can also carry
-- one-time passcodes:
--
--   - attempts: number of failed verification attempts for the current OTP
--     (invalidated after MAX_OTP_ATTEMPTS failures, enforced in otp.service.ts)
--
-- Purpose values in the existing `type` column:
--   VERIFY_EMAIL  -> EMAIL_VERIFICATION OTP
--   RESET_PASSWORD -> PASSWORD_RESET OTP
-- ============================================================================

ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- Common lookups: active OTP for a user + purpose (latest row wins),
-- expiry scans, and hourly resend-rate accounting.
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_type_created
  ON email_verifications (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verifications_type_expires
  ON email_verifications (type, expires_at);

COMMENT ON COLUMN email_verifications.attempts IS
  'Failed verification attempts for the current OTP; OTP is invalidated after the configured maximum.';