import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSessionState } from "./use-session.client";

/**
 * `fetchAuthSessionState` carries the whole logic under test; `useAuthSession` itself cannot
 * be rendered in this repo's `node`-only vitest environment (no jsdom, `FU-WEB-JSDOM`) — the
 * same split `lib/auth/submit.client.test.ts` already documents for `submitAuth`.
 */

function statusOnlyResponse(status: number): Response {
  return new Response(null, { status });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchAuthSessionState", () => {
  it("a clean 200 resolves authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(statusOnlyResponse(200))),
    );
    await expect(fetchAuthSessionState(new AbortController().signal)).resolves.toBe(
      "authenticated",
    );
  });

  it("a 401 resolves anonymous", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(statusOnlyResponse(401))),
    );
    await expect(fetchAuthSessionState(new AbortController().signal)).resolves.toBe("anonymous");
  });

  it("a 5xx resolves anonymous, not just a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(statusOnlyResponse(502))),
    );
    await expect(fetchAuthSessionState(new AbortController().signal)).resolves.toBe("anonymous");
  });

  it("a network failure resolves anonymous, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(fetchAuthSessionState(new AbortController().signal)).resolves.toBe("anonymous");
  });

  it("an abort resolves anonymous", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );
    const controller = new AbortController();
    const pending = fetchAuthSessionState(controller.signal);
    controller.abort();
    await expect(pending).resolves.toBe("anonymous");
  });

  it("sends the same-origin/no-store contract `login-form.tsx` originally sent", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(statusOnlyResponse(200)));
    vi.stubGlobal("fetch", fetchMock);
    await fetchAuthSessionState(new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }),
    );
  });
});

/**
 * SOURCE-SCAN for the "one shared hook, two consumers" property itself — no `fetch` mock can
 * see whether a second inline copy was written instead of importing this module.
 */
function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("useAuthSession — one shared hook, two real consumers", () => {
  it("login-form.tsx calls the shared hook rather than carrying its own session effect", () => {
    const loginForm = sourceOf("../../components/auth/login-form.tsx");
    expect(loginForm).toContain('from "@/lib/auth/use-session.client"');
    expect(loginForm).toContain("useAuthSession()");
    // The inline effect this hook replaces read `/api/auth/session` directly — its absence is
    // the mechanical proof the extraction actually happened rather than merely being imported
    // alongside a surviving duplicate.
    expect(loginForm).not.toContain('fetch("/api/auth/session"');
  });

  it("video-bench.tsx (the login gate) also calls the shared hook", () => {
    const bench = sourceOf("../../components/book/video-bench.tsx");
    expect(bench).toContain('from "@/lib/auth/use-session.client"');
    expect(bench).toContain("useAuthSession()");
    expect(bench).not.toContain('fetch("/api/auth/session"');
  });
});
