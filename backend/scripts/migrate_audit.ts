import { pool as db } from '../src/services/database.service';

/**
 * Provisions the audit_logs table.
 *
 * NOTE: the shape here mirrors the BASELINE audit_logs table from
 * infrastructure/database/schema.sql (action is the audit_action enum,
 * entity_type/entity_id, old_values/new_values) — NOT the older
 * resource_type/severity variant, whose columns never existed in the
 * application's table. Everything is idempotent.
 */
async function migrate() {
  try {
    await db.query(`
      DO $$ BEGIN
          CREATE TYPE audit_action AS ENUM (
              'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT',
              'IMPORT', 'APPROVE', 'REJECT', 'SUSPEND', 'BAN'
          );
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS audit_logs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
          action          audit_action NOT NULL,
          entity_type     VARCHAR(50) NOT NULL,
          entity_id       UUID,
          old_values      JSONB,
          new_values      JSONB,
          ip_address      INET,
          user_agent      TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT audit_logs_entity_type_not_empty CHECK (char_length(entity_type) > 0)
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);
    console.log("Audit logs migration successful");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
