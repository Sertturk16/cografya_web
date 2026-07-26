import "server-only";
import { serverEnv } from "@/lib/env.server";
import { buildApiRequestHeaders } from "./internal-token";

/**
 * ISR window for province content (seconds). Province data changes rarely, so an
 * hourly refresh keeps the SEO `lastmod`/facts fresh without hammering the api.
 * Applied as the `fetch` revalidate on every content read below, which makes the
 * consuming SSG pages ISR with this window.
 */
export const CONTENT_REVALIDATE_SECONDS = 3600;

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
  const res = await fetch(`${serverEnv.API_BASE_URL}${path}`, {
    headers: buildApiRequestHeaders(serverEnv.INTERNAL_REQUEST_TOKEN),
    next: { revalidate: options.revalidate ?? CONTENT_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API GET ${path} failed with status ${res.status}`);
  }

  return (await res.json()) as T;
}
