import { NextFunction, Request, Response } from 'express';

const CACHE_TTL_MS = 35_000;
const CACHE_MAX_ENTRIES = 500;

type CacheEntry = { expiresAt: number; status: number; body: unknown };
type PendingEntry = { generation: number; promise: Promise<CacheEntry | null>; resolve: (entry: CacheEntry | null) => void };

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, PendingEntry>();
let generation = 0;

function cacheKey(req: Request): string {
  const user = req.user as ({ id?: string | number; userId?: string | number; role?: string } | undefined);
  const identity = `${user?.id ?? user?.userId ?? req.header('x-klyra-role') ?? 'admin'}:${user?.role ?? ''}`;
  return `${identity}:${req.originalUrl}`;
}

function save(key: string, entry: CacheEntry) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, entry);
}

/** Short-lived, process-local cache for authenticated admin GETs. Successful
 * writes invalidate all entries so related screens refresh on their next read. */
export function adminCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        generation += 1;
        cache.clear();
        pending.clear();
      }
    });
    return next();
  }

  const key = cacheKey(req);
  const forceRefresh = req.query.refresh === '1' || req.header('cache-control') === 'no-cache';
  if (!forceRefresh) {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return res.status(entry.status).json(entry.body);
    if (entry) cache.delete(key);
    const active = pending.get(key);
    if (active) {
      void active.promise.then((result) => {
        if (result) res.status(result.status).json(result.body);
        else next();
      });
      return;
    }
  }

  let resolvePending!: (entry: CacheEntry | null) => void;
  const requestGeneration = generation;
  const requestPromise = new Promise<CacheEntry | null>((resolve) => { resolvePending = resolve; });
  const flight: PendingEntry = { generation: requestGeneration, promise: requestPromise, resolve: resolvePending };
  if (!forceRefresh) pending.set(key, flight);

  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    const entry = res.statusCode >= 200 && res.statusCode < 300
      ? { status: res.statusCode, body, expiresAt: Date.now() + CACHE_TTL_MS }
      : null;
    if (entry && requestGeneration === generation && req.method === 'GET') save(key, entry);
    if (pending.get(key) === flight) pending.delete(key);
    flight.resolve(entry);
    return json(body);
  }) as Response['json'];

  res.once('close', () => {
    if (pending.get(key) === flight) pending.delete(key);
    flight.resolve(null);
  });
  next();
}
