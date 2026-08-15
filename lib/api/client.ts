import "server-only";
import { serverEnv } from "@/lib/env.server";
import { buildApiRequestHeaders, describeThrottleExemption } from "./internal-token";

/**
 * ISR window for province content (seconds). Province data changes rarely, so an
 * hourly refresh keeps the SEO `lastmod`/facts fresh without hammering the api.
 * Applied as the `fetch` revalidate on every content read below, which makes the
 * consuming SSG pages ISR with this window.
 */
export const CONTENT_REVALIDATE_SECONDS = 3600;

/**
 * Wall-clock budget for ONE api request, network + body read (`AbortController`).
 *
 * WHY IT EXISTS (→ PR #61 review `SEC61-M6`). `fetch` has no default timeout: a connected
 * socket that never answers hangs the caller for as long as the platform allows. That was
 * survivable while every call site issued a single request, and stopped being survivable
 * when `lib/api/books.ts` added a SEQUENTIAL pagination loop — one stalled page stalls a
 * `next build`, with nothing failing and nothing logged. The fix belongs here rather than in
 * that loop because every call site inherits it from one place.
 *
 * The budget bounds the loop too, without a second mechanism: the loop's own hard page
 * ceiling times this budget is its worst case, so "unbounded" becomes a finite number that
 * can be reasoned about.
 *
 * ONE PATH IT DOES NOT REACH, STATED SO THE COVERAGE CLAIM ABOVE IS NOT READ AS TOTAL
 * (→ PR #62 review `SEC62-M1`/`CODE62-M3`). Next's patched `fetch` deliberately drops the
 * caller's signal when it is refreshing a stale cache entry —
 * `next/dist/server/lib/patch-fetch.js`, `doOriginalFetch(isStale)`: *"don't pass through
 * signal when revalidating"*, then `signal: isStale ? undefined : signal` (verified byte-exact
 * in the installed 16.2.10). So an ISR revalidation of an already-cached entry runs
 * unbudgeted, and this timeout covers the cold read and every uncached call rather than
 * literally every request. That is not a regression — before this constant there was no
 * budget on any path — and closing it would need a `Promise.race` wrapper around the call,
 * which is a design decision, not a fix to slip into a review round.
 *
 * 15 s is deliberately generous. This api is our own service on the same network, and the
 * value guards a HANG, not slowness — a threshold tight enough to also catch "slow" would
 * turn a cold start or a first uncached province read into a build failure, which is the
 * failure this is not trying to have. An abort surfaces as `fetch`'s own `AbortError`
 * (a `DOMException`, NOT an `ApiError`): there is no HTTP status behind it, so it must not
 * be mistaken for one — `getBookBySlug`'s 404/400 mapping deliberately does not swallow it.
 */
const API_REQUEST_TIMEOUT_MS = 15_000;

/** Thrown on a non-OK api response; carries the HTTP status for 404 handling. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiGetOptions {
  /** ISR revalidate window in seconds (defaults to CONTENT_REVALIDATE_SECONDS). */
  revalidate?: number;
}

/**
 * Server-side typed GET against the api. Returns the parsed JSON cast to the
 * caller-supplied contract type `T` (the shape is guaranteed by the shared
 * OpenAPI contract). Throws `ApiError` on any non-OK status so callers can
 * distinguish 404 (→ notFound) from a real failure (→ let ISR keep the last
 * good render / surface the error boundary).
 *
 * This is the ONLY place the web app talks to the api, which is why the trusted-client
 * throttle-exemption header is attached here: one chokepoint, and it is `server-only`, so
 * the secret cannot reach the browser (see `./internal-token`).
 */
export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  // The timer is cleared in `finally`, which is why the whole request — including the body
  // read below — sits inside the `try`: a response whose headers arrive instantly and whose
  // body then stalls is the same hang, and clearing the timer at `res` would let it through.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${serverEnv.API_BASE_URL}${path}`, {
      headers: buildApiRequestHeaders(serverEnv.INTERNAL_REQUEST_TOKEN),
      signal: controller.signal,
      next: { revalidate: options.revalidate ?? CONTENT_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      // A 429 is the ONE status whose cause is ambiguous from the outside (throttled because
      // no exemption is configured? because the two secrets drifted?), and it is the failure
      // this wiring exists to prevent — so it carries a state-only hint. Never the value.
      const hint =
        res.status === 429
          ? ` — ${describeThrottleExemption(serverEnv.INTERNAL_REQUEST_TOKEN)}`
          : "";

      throw new ApiError(res.status, `API GET ${path} failed with status ${res.status}${hint}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
