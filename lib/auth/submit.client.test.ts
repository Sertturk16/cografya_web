import { afterEach, describe, expect, it, vi } from "vitest";
import { RETURN_PATH_FALLBACK } from "./redirect";
import { AUTH_FETCH_TIMEOUT_MS, submitAuth } from "./submit.client";

/**
 * Review `VAL85-R3` (aliases `TEST85-I1`): `submitAuth`/`parseBffBody` are the one place all
 * three PR-1 islands interpret every BFF response, and shipped with no direct test — only
 * exercised indirectly through component code this repo's `node`-only vitest environment
 * cannot render (`FU-WEB-JSDOM`). `parseBffBody` itself stays UNEXPORTED (the validator's own
 * instruction): testing it through `submitAuth` with a stubbed `fetch` — the same
 * `vi.stubGlobal("fetch", …)` idiom `transport.server.test.ts` and `lib/api/client.test.ts`
 * already use — exercises the real, closed module surface instead of widening it for tests
 * alone.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitAuth — ok:true", () => {
  it("no redirectTo — resolves ok:true with redirectTo undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true }))),
    );
    await expect(submitAuth("logout", {})).resolves.toEqual({ ok: true, redirectTo: undefined });
  });

  it("a safe relative redirectTo passes through unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse(200, { ok: true, redirectTo: "/turkiye/istanbul" })),
      ),
    );
    await expect(submitAuth("login", {})).resolves.toEqual({
      ok: true,
      redirectTo: "/turkiye/istanbul",
    });
  });

  it(
    "review VAL85-M1 — an off-origin redirectTo is re-sanitised through safeReturnPath, " +
      "never trusted as a passthrough string",
    async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(jsonResponse(200, { ok: true, redirectTo: "https://evil.example/x" })),
        ),
      );
      await expect(submitAuth("login", {})).resolves.toEqual({
        ok: true,
        redirectTo: RETURN_PATH_FALLBACK,
      });
    },
  );
});

describe("submitAuth — ok:false", () => {
  it("a known code resolves ok:false with that code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse(401, { ok: false, code: "errors.auth.invalidCredentials" })),
      ),
    );
    await expect(submitAuth("login", {})).resolves.toEqual({
      ok: false,
      code: "errors.auth.invalidCredentials",
    });
  });

  it(
    "review SEC85-M2/CODE85-M3 — a code outside AUTH_ERROR_MESSAGE_KEYS falls back to " +
      "errors.transport.unavailable rather than being cast unchecked",
    async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(400, { ok: false, code: "not-a-real-code" }))),
      );
      await expect(submitAuth("login", {})).resolves.toEqual({
        ok: false,
        code: "errors.transport.unavailable",
      });
    },
  );

  it("an Object.prototype member as the code is rejected the same way (constructor, toString)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(400, { ok: false, code: "constructor" }))),
    );
    await expect(submitAuth("login", {})).resolves.toEqual({
      ok: false,
      code: "errors.transport.unavailable",
    });
  });
});

describe("submitAuth — malformed or unreachable", () => {
  it("a body missing the ok field normalises to errors.transport.unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { unexpected: true }))),
    );
    await expect(submitAuth("login", {})).resolves.toEqual({
      ok: false,
      code: "errors.transport.unavailable",
    });
  });

  it("a non-object body normalises to errors.transport.unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, "just a string"))),
    );
    await expect(submitAuth("login", {})).resolves.toEqual({
      ok: false,
      code: "errors.transport.unavailable",
    });
  });

  it("a rejected fetch (network failure) normalises to errors.transport.unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(submitAuth("login", {})).resolves.toEqual({
      ok: false,
      code: "errors.transport.unavailable",
    });
  });
});

describe("submitAuth — request budget (review VAL85-V3/SEC85-M3)", () => {
  /** A `fetch` that connects and never answers, exposing the signal it was handed — the same
   *  shape `lib/api/client.test.ts` uses for `apiGet`'s identical budget. */
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

  it("hands fetch an abort signal that is still open when the request starts", async () => {
    vi.useFakeTimers();
    const stub = stubHangingFetch();
    const pending = submitAuth("login", {}).catch(() => undefined);

    await vi.advanceTimersByTimeAsync(AUTH_FETCH_TIMEOUT_MS - 1);
    expect(stub.signal()?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(2);
    await pending;
  });

  it("aborts a request that never answers and resolves ok:false rather than hanging forever", async () => {
    vi.useFakeTimers();
    stubHangingFetch();

    const settled = expect(submitAuth("login", {})).resolves.toEqual({
      ok: false,
      code: "errors.transport.unavailable",
    });

    await vi.advanceTimersByTimeAsync(AUTH_FETCH_TIMEOUT_MS);
    await settled;
  });
});
