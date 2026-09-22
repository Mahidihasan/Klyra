import { pool as db } from '../src/services/database.service';

async function migrate() {
  try {
    await db.query(`
      DO $$ BEGIN
          CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS provider_payouts (
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
    `);
    console.log("Migration successful");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
