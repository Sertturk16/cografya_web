import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
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

describe("useAuthSession — one shared hook, every consumer", () => {
  /**
   * This named `login-form.tsx` and `video-bench.tsx`: the two files the hook was extracted from,
   * asserted to import it AND to no longer carry the inline `fetch("/api/auth/session")` the
   * extraction replaced. The absence half is the mechanical proof — importing the hook beside a
   * surviving duplicate would satisfy the import half alone.
   *
   * T-032 PR4 deleted `components/auth/`, and V2 grew the consumer list to ten. Naming them would
   * be the same maintenance trap the JRC credit list turned out to be, so the list is DERIVED:
   * every file that reads the session must read it through the hook, whichever file it is.
   */
  const roots = ["components", "app", "lib"];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
    });
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const sources = roots
    .flatMap((r) => walk(join(repoRoot, r)))
    .map((file) => ({ name: file.slice(repoRoot.length), source: readFileSync(file, "utf8") }));

  it("has consumers at all", () => {
    // Anti-vacuity: the whole file is about a shared hook, so zero consumers means zero checks.
    const consumers = sources.filter(({ source }) => source.includes("useAuthSession()"));
    expect(consumers.length, "files calling useAuthSession()").toBeGreaterThan(1);
  });

  it("is the ONLY way anything reads the session endpoint", () => {
    // The inline effect this hook replaced read `/api/auth/session` directly. Anywhere but the
    // hook's own module, that is a duplicate of the logic the extraction removed.
    const offenders = sources
      .filter(
        ({ name, source }) =>
          source.includes('fetch("/api/auth/session"') && !name.includes("use-session.client"),
      )
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("is imported by every file that calls it", () => {
    for (const { name, source } of sources) {
      // The hook's own module defines it; it does not import itself.
      if (!source.includes("useAuthSession()") || name.includes("use-session.client")) continue;
      expect(source, `${name} calls useAuthSession() without importing it`).toContain(
        'from "@/lib/auth/use-session.client"',
      );
    }
  });
});
