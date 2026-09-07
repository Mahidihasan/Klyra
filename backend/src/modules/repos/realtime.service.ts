import { Response } from 'express';
import { PoolClient } from 'pg';

import { pool } from '../../services/database.service';

/**
 * Repository realtime — Server-Sent Events backed by Postgres LISTEN/NOTIFY.
 * Mirrors the billing realtime hub so every screen inside a repository updates
 * the instant something changes (a CI run finishes, a deployment is triggered,
 * a detection scan completes, a push/PR lands) without a manual page reload.
 *
 * Each client opens one SSE connection to `/api/repos/:id/events`. The backend
 * keeps a *dedicated* database connection running `LISTEN repo_change`.
 * Triggers on the repo tables (see `2026_09_07_002_repo_realtime.sql` and
 * `repos.db.ensureReposSchema()`) push a NOTIFY, and the hub fans it out only
 * to subscribers of that repository. The SSE route itself enforces read access.
 *
 * NOTE (hosted Postgres): LISTEN/NOTIFY needs a stable session, so a dedicated
 * connection from pg.Pool is used. On Neon the direct (non-pooler) host must be
 * used. As with billing, clients degrade gracefully: if LISTEN can't be
 * established the stream still carries heartbeats and the UI's fallback poll
 * keeps the screens live within its interval.
 */

const CHANNEL = 'repo_change';

/** Heartbeat cadence so idle proxies / Node don't drop the stream. */
const HEARTBEAT_MS = 15000;
/** Re-attempt LISTEN after a dropped listener connection. */
const RECONNECT_MS = 5000;

const clientsByRepo = new Map<string, Set<Response>>();

let listener: PoolClient | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

function subscribersFor(repoId: string): Set<Response> {
  let set = clientsByRepo.get(repoId);
  if (!set) {
    set = new Set();
    clientsByRepo.set(repoId, set);
  }
  return set;
}

/** Send a frame to every open stream for a repository (never throws). */
function broadcast(repoId: string, payload: Record<string, unknown>): void {
  const set = clientsByRepo.get(repoId);
  if (!set) return;
  const event = JSON.stringify({ ...payload, repoId });
  const frame = `data: ${event}\n\n`;
  for (const res of set) {
    try { res.write(frame); } catch { /* cleaned up on 'close' */ }
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectRepoListener();
  }, RECONNECT_MS);
}

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const set of clientsByRepo.values()) {
      for (const res of set) {
        try { res.write(': heartbeat\n\n'); } catch { /* cleaned up on 'close' */ }
      }
    }
  }, HEARTBEAT_MS);
}

/**
 * Connect the dedicated listener and subscribe to repository changes. Safe to
 * call more than once; a lost connection triggers a periodic reconnect.
 */
export async function connectRepoListener(): Promise<void> {
  if (listener) return;

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[repo-realtime] could not acquire listener connection', err);
    scheduleReconnect();
    return;
  }

  client.on('notification', (msg) => {
    if (msg.channel !== CHANNEL) return;
    try {
      const payload = JSON.parse(msg.payload ?? '{}') as Record<string, unknown>;
      if (payload.repoId) broadcast(String(payload.repoId), payload);
    } catch (err) {
      console.error('[repo-realtime] bad notification payload', err);
    }
  });

  client.on('error', (err) => {
    console.error('[repo-realtime] listener connection error', err.message);
    listener = null;
    scheduleReconnect();
  });

  client.on('end', () => {
    listener = null;
    scheduleReconnect();
  });

  try {
    await client.query(`LISTEN ${CHANNEL}`);
  } catch (err) {
    console.error('[repo-realtime] LISTEN failed (pooled/hosted PG?)', err);
    listener = null;
    client.release();
    scheduleReconnect();
    return;
  }

  listener = client;
  startHeartbeat();
  console.log(`[repo-realtime] listening on ${CHANNEL}`);
}

/**
 * Opens an SSE stream for one repository. The caller must already have
 * validated that the authenticated user can read the repo — this only handles
 * the transport. Returns immediately.
 */
export function subscribeRepoEvents(repoId: string, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Announce the stream is open (no data to apply yet).
  res.write(': connected\n\n');

  const set = subscribersFor(repoId);
  set.add(res);

  const cleanup = () => {
    if (set.delete(res) && set.size === 0) {
      clientsByRepo.delete(repoId);
    }
    res.removeListener('close', cleanup);
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
}

/**
 * Application-level push used for transitions the DB triggers don't fully
 * capture (e.g. the moment a deployment is queued). Writes a NOTIFY on the
 * repo_change channel so the listener fans it out to that repo's subscribers.
 * Safe to call even if realtime isn't wired up (best-effort).
 */
export async function publishRepoChange(
  repoId: string,
  event: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const payload = JSON.stringify({ repoId, event, at: new Date().toISOString(), ...extra });
  try {
    await pool.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
  } catch (err) {
    console.error('[repo-realtime] could not publish change', err);
  }
}