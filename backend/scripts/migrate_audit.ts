import { db } from '../src/database';

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
          action          VARCHAR(100) NOT NULL,
          resource_type   VARCHAR(100) NOT NULL,
          resource_id     VARCHAR(255),
          details         JSONB,
          severity        VARCHAR(50) DEFAULT 'INFO',
          ip_address      VARCHAR(45),
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    `);
    console.log("Audit logs migration successful");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
