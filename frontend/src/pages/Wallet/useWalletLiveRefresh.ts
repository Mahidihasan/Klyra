import { useEffect, useRef, useState } from 'react';

import { WALLET_EVENTS_URL, walletAuthHeaders } from '../../services/api/wallet';

/** Connection state behind the "Live" indicator. */
export type WalletLiveStatus = 'connecting' | 'connected' | 'reconnecting';

/** Safety-net poll in case the stream stalls without erroring. */
export const WALLET_LIVE_FALLBACK_MS = 60000;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

interface WalletLiveState {
  /** Bumped whenever this user's wallet changed. */
  refreshKey: number;
  status: WalletLiveStatus;
}

/**
 * Push-driven refresh for the wallet screens.
 *
 * Uses fetch rather than EventSource on purpose. `/api/wallet/events` sits
 * behind requireAuth, EventSource cannot send an Authorization header, and
 * billing's workaround — the user id in the query string — is the pattern
 * these endpoints are specifically not allowed to copy. Reading the stream
 * with fetch keeps the token in a header and out of URLs and server logs.
 *
 * The cost is that reconnection is ours to handle rather than the browser's,
 * which is the loop below. A slow fallback poll covers a stream that stalls
 * without ever erroring, and coming back to a hidden tab forces a resync so
 * the screen is never quietly out of date.
 */
export function useWalletLiveRefresh(
  enabled = true,
  fallbackMs: number = WALLET_LIVE_FALLBACK_MS,
): WalletLiveState {
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<WalletLiveStatus>('connecting');

  // Kept in a ref so the read loop never becomes a reason to re-run the effect.
  const bump = useRef(() => setRefreshKey((prev) => prev + 1));

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;

    const connect = async () => {
      if (stopped) return;
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');

      try {
        const res = await fetch(WALLET_EVENTS_URL, {
          headers: { ...walletAuthHeaders(), Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

        // Reconnecting means the screen may have missed something while it was
        // away, so resync on every open but the first — that one is redundant,
        // the tab has just loaded its data.
        if (attempt > 0) bump.current();
        attempt = 0;
        setStatus('connected');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line.
          let split = buffer.indexOf('\n\n');
          while (split !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            split = buffer.indexOf('\n\n');

            for (const line of frame.split('\n')) {
              // ':' frames are comments — the handshake and heartbeats.
              if (!line.startsWith('data:')) continue;
              try {
                JSON.parse(line.slice(5).trim());
                bump.current();
              } catch {
                // Not JSON; nothing to act on.
              }
            }
          }
        }

        throw new Error('stream ended');
      } catch (error) {
        if (stopped || controller.signal.aborted) return;

        setStatus('reconnecting');
        attempt += 1;
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
        retryTimer = window.setTimeout(connect, delay);
      }
    };

    void connect();

    const fallback = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      bump.current();
    }, fallbackMs);

    // Coming back to the tab: fetch the freshest figures immediately rather
    // than waiting for the next push or the next fallback tick.
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump.current();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(retryTimer);
      window.clearInterval(fallback);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, fallbackMs]);

  return { refreshKey, status };
}
