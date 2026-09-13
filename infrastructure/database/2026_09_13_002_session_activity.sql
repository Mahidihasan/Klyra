ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
UPDATE user_sessions SET last_active_at = created_at WHERE last_active_at IS NULL;
ALTER TABLE user_sessions ALTER COLUMN last_active_at SET NOT NULL;
ALTER TABLE user_sessions ALTER COLUMN last_active_at SET DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions (user_id, last_active_at DESC) WHERE revoked_at IS NULL;
