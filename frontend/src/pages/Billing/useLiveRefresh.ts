import { useEffect, useRef, useState } from 'react';

/** Connection state surfaced to the "Live" indicator. */
export type BillingLiveStatus = 'disabled' | 'connecting' | 'connected' | 'reconnecting';

/** Safety-net poll cadence in case the SSE stream silently stalls. */
export const BILLING_LIVE_FALLBACK_MS = 60000;

interface BillingLiveState {
  /** Bumped whenever this user's billing data changed (push-driven). */
  refreshKey: number;
  /** Live indicator state, from connecting -> connected -> reconnecting. */
  status: BillingLiveStatus;
}

/**
 * Push-driven realtime for the billing screens.
 *
 * Opens a single EventSource (SSE) to `/api/billing/events?userId=...`. Each
 * `data:` frame carries a `userId`; when it matches the current dev user the
 * returned `refreshKey` is bumped, and the active tab background-refreshes. The
 * backend only emits for the subscribed user, so the push is purposeful.
 *
 * The EventSource auto-reconnects, but a long, quiet reconnect can look stale,
 * so a slow fallback poll (60s, paused while the tab is hidden) keeps the data
 * from ever going obviously out of date.
 */
export function useLiveRefresh(
  enabled: boolean,
  userId?: string | null,
  fallbackMs: number = BILLING_LIVE_FALLBACK_MS,
): BillingLiveState {
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<BillingLiveStatus>('disabled');

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!enabled || !userId) {
      setStatus('disabled');
      return;
    }

    setStatus('connecting');
    let es: EventSource | null = null;
    // Becomes true after the first successful open, so a later reconnection
    // triggers an immediate resync rather than that very first (redundant) one.
    let everConnected = false;

    try {
      es = new EventSource(`/api/billing/events?userId=${encodeURIComponent(userId)}`);
    } catch {
      setStatus('reconnecting');
    }

    if (es) {
      es.onopen = () => {
        if (everConnected) {
          // Back online after a drop — fetch the freshest data right away.
          setRefreshKey((prev) => prev + 1);
        }
        everConnected = true;
        setStatus('connected');
      };

      es.onmessage = (event: MessageEvent<string>) => {
        // The backend already scopes to this connection, but double-check so a
        // misrouted broadcast can't refresh another user's page with its data.
        try {
          const payload = JSON.parse(event.data) as { userId?: string };
          if (payload.userId === userIdRef.current) {
            setRefreshKey((prev) => prev + 1);
          }
        } catch {
          // Ignore handshake/heartbeat frames that aren't JSON.
        }
      };

      // onerror fires on each failed reconnect attempt; the browser keeps
      // retrying on its own and onopen will fire again when we're back.
      es.onerror = () => setStatus('reconnecting');
    }

    // Slow fallback so a silently stalled stream can't leave a stale screen.
    const fallback = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setRefreshKey((prev) => prev + 1);
    }, fallbackMs);

    return () => {
      es?.close();
      window.clearInterval(fallback);
    };
  }, [enabled, userId, fallbackMs]);

  return { refreshKey, status };
}