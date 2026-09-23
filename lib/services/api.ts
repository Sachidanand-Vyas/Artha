/**
 * HTTP client for the Artha FastAPI backend.
 *
 * - Base URL comes from the environment (NEXT_PUBLIC_* is what the browser
 *   can see; BACKEND_URL is the documented alias) with a localhost default
 *   matching the local dev setup: Next.js :3000 -> FastAPI :8000.
 * - A tiny in-memory TTL cache + in-flight dedupe means the same payload is
 *   not re-downloaded on every component render or when several components
 *   ask for the same data at once.
 * - Failures throw `ApiError` with a human-readable message so pages can
 *   render an error state instead of crashing.
 */

const RAW_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:8000";

/** Backend origin without a trailing slash, e.g. "http://localhost:8000". */
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True when the backend said the symbol/resource does not exist. */
export const isNotFound = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 404;

interface Entry {
  expires: number;
  value: unknown;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

const REQUEST_TIMEOUT_MS = 30_000;

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal:
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          : undefined,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the Artha backend at ${API_BASE}. ` +
        "Start it with: cd backend && uvicorn main:app --port 8000",
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body?.detail ?? "";
    } catch {
      /* non-JSON error body — fall through to the status message */
    }
    throw new ApiError(
      detail || `Backend request failed (HTTP ${res.status}) for ${path}`,
      res.status,
    );
  }
  return res.json();
}

/** GET with a small TTL cache and in-flight dedupe. */
export function apiGet<T>(path: string, ttlMs = 60_000): Promise<T> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);

  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const p = request(path)
    .then((value) => {
      cache.set(path, { expires: Date.now() + ttlMs, value });
      return value as T;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

/** POST with the same caching/dedupe semantics (keyed on the body). */
export function apiPost<T>(
  path: string,
  body: unknown,
  ttlMs = 60_000,
): Promise<T> {
  const key = `POST ${path} ${JSON.stringify(body)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((value) => {
      cache.set(key, { expires: Date.now() + ttlMs, value });
      return value as T;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
