/**
 * Shared database plumbing for the admin modules.
 *
 * Extracted so the overview service and the users service share one pool cache
 * and one timeout policy rather than each keeping their own.
 *
 * `services/database.service.ts` builds its pool at module load and throws when
 * no connection is configured, so it is required lazily here — a top-level
 * import would take the whole admin module down instead of letting it degrade
 * to sample data.
 */

// Minimal shape of the bits of `pg.Pool` the admin modules use, so the lazily
// required module can be typed without importing pg's types at the top level.
export interface QueryablePool {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
  /** Present on a real pg.Pool; absent on the lightweight test doubles. */
  connect?(): Promise<PoolClient>;
}

export interface PoolClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
  release(): void;
}

/**
 * Run `fn` inside a real transaction on a single checked-out connection.
 *
 * Note this deliberately differs from `pool.query('BEGIN')` as used in
 * auth.service.ts: on a pool, BEGIN and the statements after it can land on
 * different connections, so the transaction silently doesn't cover them. Any
 * write that must stay in step with its audit row needs a dedicated client.
 */
export async function withTransaction<T>(
  pool: QueryablePool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (typeof pool.connect !== 'function') {
    // A double without connect() — run un-wrapped rather than fail the caller,
    // but say so, because atomicity is quietly gone.
    console.warn('[admin] pool has no connect(); running without a transaction');
    return fn(pool as PoolClient);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[admin] ROLLBACK failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** How long a single admin query may run before we give up and degrade. */
export const QUERY_TIMEOUT_MS = 4000;

let cachedPool: QueryablePool | null | undefined;

/**
 * Resolve the shared pg pool, or null when the database isn't configured.
 * Cached so a misconfigured environment doesn't re-throw on every request.
 */
export function loadPool(): QueryablePool | null {
  if (cachedPool !== undefined) return cachedPool;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../../services/database.service') as { pool: QueryablePool };
    cachedPool = mod.pool ?? null;
  } catch (err) {
    console.warn(
      '[admin] database unavailable, serving mock data:',
      err instanceof Error ? err.message : err,
    );
    cachedPool = null;
  }

  return cachedPool;
}

/** Reject rather than hang — a slow admin query shouldn't pin the request. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** pg returns BIGINT and NUMERIC as strings to avoid precision loss. */
export function toNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Normalise a pg timestamp (Date or string) to an ISO string. */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

/** Same as `toIso`, but preserves a genuine NULL instead of inventing an epoch. */
export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}
