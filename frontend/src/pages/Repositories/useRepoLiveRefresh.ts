import { useEffect, useRef, useState } from 'react';

/** Connection state surfaced to the "Live" indicator. */
export type RepoLiveStatus = 'disabled' | 'connecting' | 'connected' | 'reconnecting';

/** Safety-net poll cadence in case the SSE stream silently stalls. */
export const REPO_LIVE_FALLBACK_MS = 20000;

interface RepoLiveState {
  /** Bumped whenever this repository's data changed (push-driven). */
  refreshKey: number;
  /** Live indicator state, from connecting -> connected -> reconnecting. */
  status: RepoLiveStatus;
}

/**
 * Push-driven realtime for a single repository screen.
 *
 * Opens one EventSource (SSE) to `/api/repos/:repoId/events`. Each `data:`
 * frame carries a `repoId`; when it matches the current repo the returned
 * `refreshKey` is bumped, and the active view background-refreshes. The backend
 * already scopes the stream to this repo and enforces read access on subscribe.
 *
 * The EventSource auto-reconnects, but a long, quiet reconnect can look stale,
 * so a slow fallback poll (20s, paused while the tab is hidden) keeps the data
 * from ever going obviously out of date.
 */
export function useRepoLiveRefresh(
  repoId: string | null,
  fallbackMs: number = REPO_LIVE_FALLBACK_MS,
): RepoLiveState {
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<RepoLiveStatus>('disabled');

  const repoIdRef = useRef(repoId);
  repoIdRef.current = repoId;

  useEffect(() => {
    if (!repoId) {
      setStatus('disabled');
      return;
    }

    setStatus('connecting');
    let es: EventSource | null = null;
    // Becomes true after the first successful open, so a later reconnection
    // triggers an immediate resync rather than that very first (redundant) one.
    let everConnected = false;

    try {
      es = new EventSource(`/api/repos/${encodeURIComponent(repoId)}/events`);
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
        try {
          const payload = JSON.parse(event.data) as { repoId?: string };
          if (payload.repoId === repoIdRef.current) {
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
  }, [repoId, fallbackMs]);

  return { refreshKey, status };
}