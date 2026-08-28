import "server-only";

/**
 * Shared, pure BFF-proxy plumbing (SIMP90-M1 / SIMP96-M1,
 * `Owner's Inbox/pr-review-archive/cografya_web-90-round1.md` +
 * `Owner's Inbox/pr-review-archive/cografya_web-96.md`). Extracted from
 * `lib/auth/transport.server.ts`, `lib/favorites/transport.server.ts`,
 * `lib/video-progress/transport.server.ts` and `lib/game-rounds/transport.server.ts`, which
 * each carried an independent, almost line-for-line copy of the same cookie-read,
 * body-size-bound, body-drain and response-header mechanics — the same "a second private copy
 * is exactly the kind of small thing that could silently drift" reasoning
 * `lib/http/same-origin.ts`'s own docblock already gives for extracting `isSameOrigin`,
 * applied here once a third and fourth copy crossed the same threshold.
 *
 * Every function here is a PURE, side-effect-free (besides reading the `Request`/`Response`
 * it is handed) helper — no domain-specific type, no api path, no cookie name. A caller that
 * needs a domain-specific byte bound (`MAX_REQUEST_BODY_BYTES`) keeps that constant, and its
 * own reasoning for the value, in its own module and passes it in explicitly; this module does
 * not pick a bound on any caller's behalf.
 *
 * TWO GENUINE BEHAVIORAL DIFFERENCES were found across the four original copies, and both are
 * preserved here rather than collapsed to one shape:
 *   - `readBoundedBody()` (this module) returns raw `Uint8Array` bytes — `lib/auth/`'s own
 *     shape, since it decodes to text itself one step later inside `readClientBody()`.
 *     `readBoundedBodyAsText()` is a thin wrapper for the other three domains, which all read
 *     straight to text with no intermediate byte-level step of their own.
 *   - `bffHeaders()` takes an optional `extra` map (`lib/game-rounds/`'s own shape, needed for
 *     its 429 `Retry-After` passthrough); the other three domains call it with no argument,
 *     which is byte-identical to their own original zero-argument version.
 */

/** Minimal `Cookie`-header parse. Deliberately NOT `next/headers`' `cookies()`: every caller of
 *  this module is handed the raw `Request` by its own `route.ts`, and parsing the header
 *  directly keeps every branch testable with a plain `Request`/`Headers` object and no Next
 *  request context. A malformed percent-encoding (`decodeURIComponent` throws `URIError`) is an
 *  ABSENT cookie, not an unhandled exception — this matches Next's own cookie parser
 *  (`@edge-runtime/cookies`), which does the same on catch. */
export function readCookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) {
      try {
        return decodeURIComponent(pair.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Whether the request's own `Content-Length` header already exceeds `maxBytes` — a cheap
 *  pre-check before any body is read. A missing or non-finite header never exceeds (there is
 *  nothing to compare); the caller's own `readBoundedBody`/`readBoundedBodyAsText` call is what
 *  catches a chunked body with no `Content-Length` at all. */
export function contentLengthExceeds(request: Request, maxBytes: number): boolean {
  const header = request.headers.get("content-length");
  if (header === null) return false;
  const value = Number(header);
  return Number.isFinite(value) && value > maxBytes;
}

/** `res.text()` never throws in practice for a well-formed `Response`, but a caller must not
 *  itself become the site of an uncaught rejection if it ever does — every BFF response must
 *  still go through its own module's fixed response builder. */
export async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/** Drains an unread response body so undici can return the connection to its pool
 *  (`CODE84-M2`): undici does not return a connection to its pool until the response body is
 *  consumed, so a burst of unread bodies (a 5xx during an api outage, a failed revoke) would
 *  otherwise hold connections open for as long as the response objects stay reachable.
 *  `cancel()` on an already-errored stream REJECTS (measured, `SEC84R2-M3`) — best-effort: a
 *  connection broken enough to make `cancel()` reject has nothing left to return to undici's
 *  pool either way. */
export async function drainBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Ignored — see the docblock above.
  }
}

/**
 * Reads `request.body` one chunk at a time and stops the INSTANT the accumulated byte count
 * exceeds `maxBytes`, instead of buffering the whole body first and measuring it afterwards
 * (`CODE84-I4`, measured against `lib/auth/transport.server.ts`'s own history: a 400 MiB
 * chunked body — no `Content-Length`, so `contentLengthExceeds` above cannot see it — took the
 * worker from 510 MB to 2163 MB RSS before the old per-file code's 413). `request.body` is
 * `null` on a bodyless `Request` (measured) — that is an EMPTY body, not a stream to read;
 * naively calling `.getReader()` on it would throw.
 *
 * Returns raw bytes — `lib/auth/transport.server.ts`'s own original shape, kept as the shared
 * function's shape because it is the more primitive of the two: text is one decode step away
 * from bytes, never the reverse. A caller that wants text calls `readBoundedBodyAsText` below
 * instead of decoding itself.
 */
export async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false }> {
  if (request.body === null) return { ok: true, bytes: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** Thin wrapper over {@link readBoundedBody} for the three domains (`favorites`,
 *  `video-progress`, `game-rounds`) whose original copies decoded straight to text with no
 *  intermediate byte-level step of their own. */
export async function readBoundedBodyAsText(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const read = await readBoundedBody(request, maxBytes);
  if (!read.ok) return { ok: false };
  return { ok: true, text: new TextDecoder().decode(read.bytes) };
}

/** The fixed three-header set every BFF response carries UNCONDITIONALLY — `Cache-Control:
 *  no-store` above all, so no branch in any of the four domains can forget it. `extra` is for
 *  `lib/game-rounds/transport.server.ts`'s own 429 `Retry-After` passthrough; every other
 *  caller passes none, which is byte-identical to each domain's own original zero-argument
 *  version. */
export function bffHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}
