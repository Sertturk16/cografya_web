import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "./client";

// The real client reads the validated server env at module load. Stubbing the origin keeps
// this file off the ambient environment, exactly as `books.test.ts` argues.
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/**
 * THE REQUEST TIMEOUT, AND ONLY THE TIMEOUT (→ PR #61 review `SEC61-M6`).
 *
 * `fetch` has no default deadline, so a connected socket that never answers held every
 * caller open indefinitely. The other behaviours of `apiGet` — the status mapping, the 429
 * hint, the header wiring — are exercised through their consumers in `books.test.ts`,
 * `marine.test.ts` and `internal-token.test.ts`; what none of them could observe is a
 * request that neither resolves nor rejects, because a test for a hang has to control time.
 *
 * The budget's VALUE is deliberately not asserted as a magic number in two places: each
 * test advances past it via the same constant the module ships, read through its observable
 * effect (aborted / not yet aborted) rather than re-declared here.
 */

const TIMEOUT_MS = 15_000;

/** A `fetch` that connects and then never answers, exposing the signal it was handed. */
function stubHangingFetch(): { signal: () => AbortSignal | undefined } {
  let captured: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      captured = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }),
  );
  return { signal: () => captured };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiGet request budget", () => {
  it("hands fetch an abort signal that is still open when the request starts", async () => {
    vi.useFakeTimers();
    const stub = stubHangingFetch();

    // Floating on purpose: the request never settles until the budget fires, and the
    // rejection is asserted by the next test. Attached here so no unhandled rejection leaks.
    const pending = apiGet("/api/anything").catch(() => undefined);

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(stub.signal()?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(2);
    await pending;
  });

  it("aborts a request that never answers, and the rejection reaches the caller", async () => {
    vi.useFakeTimers();
    const stub = stubHangingFetch();

    const pending = apiGet("/api/anything");
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    // An abort is NOT an `ApiError`: no HTTP status exists behind it, so callers that map
    // specific statuses to `null` must not swallow it. Asserting the name rather than a bare
    // `toThrow()` is what pins that difference (the TEST61-M3 lesson).
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(stub.signal()?.aborted).toBe(true);
  });

  it("clears its timer once a request settles, leaving nothing pending", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    await expect(apiGet<{ ok: boolean }>("/api/anything")).resolves.toEqual({ ok: true });

    // Without the `finally` clearing it, the budget's timer would still be armed here — one
    // per request, each holding the event loop open for its full 15 s after the work is done.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer on a failing status too", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("upstream failure", { status: 502 }))),
    );

    // The throw leaves through a different path than the success above, and `finally` is
    // what makes the two agree — a `clearTimeout` placed after the `return` would not.
    await expect(apiGet("/api/anything")).rejects.toMatchObject({ name: "ApiError", status: 502 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
