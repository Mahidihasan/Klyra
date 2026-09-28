// Wallet realtime — Server-Sent Events, fanned out in-process.
//
// Why not Postgres LISTEN/NOTIFY, the way modules/billing does it?
//
// Billing's own realtime.service documents the catch: LISTEN needs a stable
// session, and Neon's pooled `-pooler` endpoint does not dispatch
// notifications reliably. DATABASE_URL points at exactly that pooled host, so
// a NOTIFY-based hub here would be quietly dead in this environment.
//
// Wallet does not need it. Every balance change goes through applyTransaction,
// and every top-up session change goes through this same process, so the hub
// can be told directly by the code that made the change. No trigger, no extra
// migration, nothing to be unreliable.
//
// The limitation this accepts: with more than one backend instance, a change
// made on instance A does not wake a stream held by instance B. That is worth
// stating in the PR — the fix is a NOTIFY bridge, and it only becomes real
// when the deployment actually runs more than one instance.

import { Response } from 'express';

/** Heartbeat cadence so idle proxies and Node don't drop the stream. */
const HEARTBEAT_MS = 15000;

export type WalletChangeKind = 'transaction' | 'topup_session';

const clientsByUser = new Map<string, Set<Response>>();
let heartbeatTimer: NodeJS.Timeout | null = null;

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const set of clientsByUser.values()) {
      for (const res of set) {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          // Dying sockets are cleaned up by the 'close' handler.
        }
      }
    }
  }, HEARTBEAT_MS);
  // Don't hold the process open just to send heartbeats to nobody.
  heartbeatTimer.unref?.();
}

function stopHeartbeatIfIdle(): void {
  if (heartbeatTimer && clientsByUser.size === 0) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Tells this user's open wallet screens that something changed.
 *
 * Deliberately says only *that* something changed and of what kind — never the
 * new balance. The screen re-fetches through the authenticated endpoints, so a
 * misrouted frame can never be the thing that puts a figure on someone's
 * screen.
 */
export function publishWalletChange(userId: string, kind: WalletChangeKind): void {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;

  const frame = `data: ${JSON.stringify({
    userId,
    kind,
    at: new Date().toISOString(),
  })}\n\n`;

  for (const res of set) {
    try {
      res.write(frame);
    } catch {
      // Already dead; 'close' removes it. Don't throw while iterating.
    }
  }
}

/**
 * Opens an SSE stream for one user.
 *
 * The caller has already authenticated: this only handles the transport, and
 * the user id comes from the JWT, never from the request.
 */
export function subscribeWalletEvents(userId: string, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Announce the stream is open. A comment frame, so the client's parser
  // ignores it rather than treating it as a change.
  res.write(': connected\n\n');

  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  set.add(res);
  startHeartbeat();

  const cleanup = () => {
    const current = clientsByUser.get(userId);
    if (current && current.delete(res) && current.size === 0) {
      clientsByUser.delete(userId);
    }
    stopHeartbeatIfIdle();
    res.removeListener('close', cleanup);
    res.removeListener('finish', cleanup);
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
}

/** Open stream count, for the tests in Phase 7. */
export function subscriberCount(userId?: string): number {
  if (userId) return clientsByUser.get(userId)?.size ?? 0;
  let total = 0;
  for (const set of clientsByUser.values()) total += set.size;
  return total;
}
