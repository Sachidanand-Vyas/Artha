import { useCallback, useEffect, useState } from "react";

function depsEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Data-fetching hook with loading / error / data states.
 *
 * `loading` is true on mount, during `reload()`, and whenever the loader
 * deps change — derived by comparing a completion token against the current
 * deps, so there is no stale flash and out-of-order resolutions are ignored.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    error: Error | null;
    loading: boolean;
    completed: { deps: unknown[]; nonce: number } | null;
  }>({ data: null, error: null, loading: true, completed: null });

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    loader()
      .then((data) => {
        if (alive) {
          setState({ data, error: null, loading: false, completed: { deps: [...deps], nonce } });
        }
      })
      .catch((error: Error) => {
        if (alive) {
          setState({ data: null, error, loading: false, completed: { deps: [...deps], nonce } });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const inFlight =
    !state.completed || state.completed.nonce !== nonce || !depsEqual(state.completed.deps, deps);

  return { data: state.data, error: state.error, loading: state.loading || inFlight, reload };
}
