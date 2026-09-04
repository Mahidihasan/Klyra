import { Pool, PoolConfig } from 'pg';

/**
 * Database connection service.
 *
 * Connection precedence:
 *   1. DATABASE_URL (primary) — used verbatim as a PostgreSQL connection string.
 *      This is the connection method for Neon (hosted Postgres), including the
 *      pooled `-pooler.` hostname. SSL is enabled by default.
 *   2. Discrete DB_USER / DB_HOST / DB_NAME / DB_PASSWORD / DB_PORT
 *      (fallback) — for a local PostgreSQL development instance without TLS.
 *   3. Otherwise — we fail fast with a clear configuration error. There is
 *      intentionally NO hardcoded credential fallback.
 */

const DATABASE_URL = process.env.DATABASE_URL?.trim();

/** Default pool sizing / timeouts (overridable via env for tuning). */
function poolCommon(): Pick<PoolConfig, 'max' | 'connectionTimeoutMillis' | 'idleTimeoutMillis'> {
  return {
    max: parseInt(process.env.PGPOOL_MAX || '10', 10),
    connectionTimeoutMillis: parseInt(process.env.PGPOOL_CONNECT_TIMEOUT_MS || '10000', 10),
    idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_TIMEOUT_MS || '30000', 10),
  };
}

/**
 * Resolve the TLS/SSL mode for a remote (DATABASE_URL) connection.
 * Validation is ON by default (secure); relax it only with an explicit opt-out
 * (e.g. when proxying through a self-signed cert during local debugging).
 */
function resolveDatabaseUrlSsl(): PoolConfig['ssl'] {
  if (process.env.PGSSLMODE === 'disable') return false;
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  return { rejectUnauthorized };
}

function buildPoolConfig(): PoolConfig {
  if (DATABASE_URL) {
    // Primary path: hosted Postgres (e.g. Neon) via a full connection string.
    return {
      connectionString: DATABASE_URL,
      ssl: resolveDatabaseUrlSsl(),
      ...poolCommon(),
    };
  }

  // Fallback path: local PostgreSQL development via discrete variables.
  const user = process.env.DB_USER;
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD;

  if (!user || !host || !database || !password) {
    throw new Error(
      'Database configuration error: neither DATABASE_URL nor the complete set of ' +
        'DB_USER / DB_HOST / DB_NAME / DB_PASSWORD variables is available. ' +
        'Please configure a connection (e.g. DATABASE_URL for Neon) before starting ' +
        'the backend. Refusing to fall back to hardcoded credentials.'
    );
  }

  return {
    user,
    host,
    database,
    password,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ...poolCommon(),
  };
}

function buildPool(): Pool {
  const config = buildPoolConfig();
  const pool = new Pool(config);

  // Log unexpected idle-client errors instead of crashing the process
  // silently (e.g. a dropped socket or a server-side disconnect).
  pool.on('error', (err: Error) => {
    console.error('[database] idle client error:', err.message);
  });

  return pool;
}

const pool = buildPool();

export { pool };