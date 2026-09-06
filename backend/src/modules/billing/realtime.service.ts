import { Response } from 'express';
import { PoolClient } from 'pg';

import { pool } from '../../services/database.service';

/**
 * Billing realtime — Server-Sent Events backed by Postgres LISTEN/NOTIFY.
 *
 * Every Billing page that wants live updates opens one SSE connection. The
 * backend keeps a *dedicated* database connection that runs `LISTEN
 * billing_change`; when any invoice/payment row (or saved billing information)
 * changes for a user, the triggers in the migration + the app-level notifier
 * below push a NOTIFY that the hub fans out only to that user's subscribers.
 *
 * NOTE (hosted Postgres): LISTEN/NOTIFY needs a stable session, so this relies
 * on a dedicated connection from pg.Pool. On Neon that means the non-pooler
 * (direct) host must be used — the transaction-pooled `-pooler` endpoint does
 * not dispatch notifications reliably. The client degrades gracefully: if the
 * LISTEN cannot be established the stream still carries heartbeats and the UI's
 * slow fallback poll keeps the screens live within its interval.
 */

const CHANNEL = 'billing_change';

/** Heartbeat cadence so idle proxies / Node don't drop the stream. */
const HEARTBEAT_MS = 15000;
/** Re-attempt LISTEN after a dropped listener connection. */
const RECONNECT_MS = 5000;

const clientsByUser = new Map<string, Set<Response>>();

let listener: PoolClient | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

function subscribersFor(userId: string): Set<Response> {
  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  return set;
}

function broadcast(userId: string, payload: Record<string, unknown>): void {
  const set = clientsByUser.get(userId);
  if (!set) return;

  const event = JSON.stringify({ ...payload, userId });
  const frame = `data: ${event}\n\n`;

  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      // The socket is already dead — it is removed on the 'close' handler,
      // but avoid throwing while iterating the set.
    }
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectListener();
  }, RECONNECT_MS);
}

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const set of clientsByUser.values()) {
      for (const res of set) {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          // Dying sockets are cleaned up on 'close'.
        }
      }
    }
  }, HEARTBEAT_MS);
}

/**
 * Connect the dedicated listener and subscribe to billing changes. Safe to call
 * more than once; a lost connection triggers a periodic reconnect.
 */
export async function connectListener(): Promise<void> {
  if (listener) return;

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[billing-realtime] could not acquire listener connection', err);
    scheduleReconnect();
    return;
  }

  client.on('notification', (msg) => {
    if (msg.channel !== CHANNEL) return;
    try {
      const payload = JSON.parse(msg.payload ?? '{}') as Record<string, unknown>;
      if (payload.userId) broadcast(String(payload.userId), payload);
    } catch (err) {
      console.error('[billing-realtime] bad notification payload', err);
    }
  });

  client.on('error', (err) => {
    console.error('[billing-realtime] listener connection error', err.message);
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
    console.error('[billing-realtime] LISTEN failed (pooled/hosted PG?)', err);
    listener = null;
    client.release();
    scheduleReconnect();
    return;
  }

  listener = client;
  startHeartbeat();
  console.log(`[billing-realtime] listening on ${CHANNEL}`);
}

/**
 * Opens an SSE stream for one user. The caller must already have validated the
 * authenticated user id — this only handles the transport.
 */
export function subscribeBillingEvents(userId: string, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Announce the stream is open (no data to apply yet).
  res.write(': connected\n\n');

  const set = subscribersFor(userId);
  set.add(res);

  const cleanup = () => {
    if (set.delete(res) && set.size === 0) {
      clientsByUser.delete(userId);
    }
    res.removeListener('close', cleanup);
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
}

/**
 * Application-level push for writes the DB triggers don't cover (the billing
 * information lives inside users.metadata and is written by this service).
 */
export async function publishBillingChange(
  userId: string,
  table: string,
  event: string,
): Promise<void> {
  const payload = JSON.stringify({
    userId,
    table,
    event,
    at: new Date().toISOString(),
  });
  try {
    await pool.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
  } catch (err) {
    console.error('[billing-realtime] could not publish change', err);
  }
}