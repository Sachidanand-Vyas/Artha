import { useCallback, useEffect, useRef, useState } from "react";

/**
 * POLLING LOADER — refreshes data while the page is open.
 *
 * Behaviour (task requirement: auto-refresh every 30–60s, honest states):
 *  - fetches immediately when the subject (deps) changes, then every
 *    `intervalMs` (default 45s),
 *  - stops polling while the tab is hidden and refreshes on re-focus if the
 *    interval has already elapsed,
 *  - `lastUpdated` is the client-clock time of the last SUCCESSFUL refresh —
 *    it is never set optimistically, so it can never be fabricated,
 *  - on failure the previous `data` is RETAINED, `error` is set (callers show
 *    a stale/unavailable state) and the next tick tries again,
 *  - background refreshes never flip `loading` back to true, so pages don't
 *    flash skeletons every 45 seconds.
 *
 * This is for CURRENT quotes/valuations only — expensive historical charts,
 * fundamentals and technicals must keep using `useAsync`.
 */

/** Default refresh interval — inside the required 30–60 second window. */
export const DEFAULT_REFRESH_MS = 45_000;

export interface PollResult<T> {
  data: T | null;
  error: Error | null;
  /** True until the first load completes (or deps change) — never during background refreshes. */
  loading: boolean;
  /** Epoch ms of the last successful refresh; null until one succeeds. */
  lastUpdated: number | null;
  /** The latest refresh failed — `data` (if any) is last-known and may be stale. */
  stale: boolean;
  /** Force a reload (shows the loading state again). */
  reload: () => void;
}

export function usePoll<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs: number = DEFAULT_REFRESH_MS,
): PollResult<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    error: Error | null;
    loading: boolean;
    lastUpdated: number | null;
  }>({ data: null, error: null, loading: true, lastUpdated: null });

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  // Guards stale/out-of-order responses when deps change mid-flight.
  const epochRef = useRef(0);
  const inflightRef = useRef(false);
  const lastAttemptRef = useRef(0);

  const run = useCallback(async (background: boolean) => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    const epoch = epochRef.current;
    lastAttemptRef.current = Date.now();
    if (!background) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }
    try {
      const data = await loaderRef.current();
      if (epoch !== epochRef.current) return; // subject changed — drop the result
      setState({ data, error: null, loading: false, lastUpdated: Date.now() });
    } catch (err) {
      if (epoch !== epochRef.current) return;
      // Keep previous data: the caller shows it with a stale/unavailable note.
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err : new Error(String(err)),
        loading: false,
      }));
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    epochRef.current += 1;
    setState({ data: null, error: null, loading: true, lastUpdated: null });
    void run(false);

    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return; // tab hidden -> skip
      void run(true);
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastAttemptRef.current >= intervalMs) void run(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, intervalMs]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    lastUpdated: state.lastUpdated,
    stale: state.error !== null,
    reload,
  };
}

/** "12:03:45" — local time of a successful refresh (client clock, never fabricated). */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
