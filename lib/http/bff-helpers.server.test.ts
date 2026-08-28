import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bffHeaders,
  contentLengthExceeds,
  drainBody,
  readBoundedBody,
  readBoundedBodyAsText,
  readCookieValue,
  safeReadText,
} from "./bff-helpers.server";

/**
 * Dedicated coverage for the shared BFF-proxy helpers extracted in SIMP90-M1/SIMP96-M1
 * (`Owner's Inbox/pr-review-archive/cografya_web-90-round1.md` +
 * `Owner's Inbox/pr-review-archive/cografya_web-96.md`), mirroring `same-origin.test.ts`'s own
 * precedent for this directory: a genuinely shared, domain-agnostic module gets its own direct
 * test file rather than relying solely on indirect coverage through each of the four call
 * sites. Several branches here (a malformed cookie PAIR with no `=`, a rejecting `cancel()`, a
 * throwing `res.text()`) were never directly exercised by any of the four transport test
 * files even before this extraction — closed here rather than carried forward as a silent gap.
 */

function requestWithCookie(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("cookie", header);
  return new Request("https://example.invalid/", { headers });
}

function requestWithContentLength(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("content-length", header);
  return new Request("https://example.invalid/", { headers });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readCookieValue", () => {
  it("returns the matching cookie's decoded value", () => {
    expect(readCookieValue(requestWithCookie("cg_access=token-value"), "cg_access")).toBe(
      "token-value",
    );
  });

  it("returns undefined when the cookie header is absent", () => {
    expect(readCookieValue(requestWithCookie(null), "cg_access")).toBeUndefined();
  });

  it("returns undefined when the named cookie is not among several present", () => {
    expect(readCookieValue(requestWithCookie("a=1; cg_access=token; b=2"), "cg_access")).toBe(
      "token",
    );
    expect(readCookieValue(requestWithCookie("a=1; b=2"), "cg_access")).toBeUndefined();
  });

  it("skips a malformed pair with no '=' rather than throwing, and still finds the real cookie", () => {
    expect(readCookieValue(requestWithCookie("garbage; cg_access=token"), "cg_access")).toBe(
      "token",
    );
  });

  it.each(["%", "%zz", "abc%zz", "%E0%A4%A"])(
    "a malformed percent-encoding (%s) is treated as absent, never thrown",
    (malformed) => {
      expect(
        readCookieValue(requestWithCookie(`cg_access=${malformed}`), "cg_access"),
      ).toBeUndefined();
    },
  );

  it("trims surrounding whitespace around the name and value", () => {
    expect(readCookieValue(requestWithCookie(" cg_access = token "), "cg_access")).toBe("token");
  });
});

describe("contentLengthExceeds", () => {
  it("is false when the header is absent", () => {
    expect(contentLengthExceeds(requestWithContentLength(null), 100)).toBe(false);
  });

  it("is false when the header is at or below the bound", () => {
    expect(contentLengthExceeds(requestWithContentLength("100"), 100)).toBe(false);
    expect(contentLengthExceeds(requestWithContentLength("50"), 100)).toBe(false);
  });

  it("is true when the header exceeds the bound", () => {
    expect(contentLengthExceeds(requestWithContentLength("101"), 100)).toBe(true);
  });

  it("is false for a non-numeric header (Number(...) is NaN, not finite)", () => {
    expect(contentLengthExceeds(requestWithContentLength("not-a-number"), 100)).toBe(false);
  });

  it("respects a different maxBytes per call, independent of any module-level state", () => {
    const request = requestWithContentLength("5000");
    expect(contentLengthExceeds(request, 4096)).toBe(true);
    expect(contentLengthExceeds(request, 8192)).toBe(false);
  });
});

describe("safeReadText", () => {
  it("returns the body text on a normal Response", async () => {
    const res = new Response("hello world");
    await expect(safeReadText(res)).resolves.toBe("hello world");
  });

  it("returns an empty string rather than throwing when res.text() rejects", async () => {
    const res = new Response("irrelevant");
    vi.spyOn(res, "text").mockRejectedValueOnce(new Error("stream error"));
    await expect(safeReadText(res)).resolves.toBe("");
  });
});

describe("drainBody", () => {
  it("calls cancel() on the response body", async () => {
    const res = new Response("some body");
    const body = res.body;
    expect(body).not.toBeNull();
    const cancelSpy = vi.spyOn(body as ReadableStream<Uint8Array>, "cancel");
    await drainBody(res);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the response has no body", async () => {
    const res = new Response(null, { status: 204 });
    expect(res.body).toBeNull();
    await expect(drainBody(res)).resolves.toBeUndefined();
  });

  it("swallows a rejecting cancel() rather than throwing (best-effort)", async () => {
    const res = new Response("some body");
    const body = res.body;
    expect(body).not.toBeNull();
    vi.spyOn(body as ReadableStream<Uint8Array>, "cancel").mockRejectedValueOnce(
      new Error("already errored"),
    );
    await expect(drainBody(res)).resolves.toBeUndefined();
  });
});

describe("readBoundedBody", () => {
  it("returns an empty byte array for a bodyless request", async () => {
    const request = new Request("https://example.invalid/", { method: "GET" });
    expect(request.body).toBeNull();
    const result = await readBoundedBody(request, 1024);
    expect(result).toEqual({ ok: true, bytes: new Uint8Array(0) });
  });

  it("returns the full byte content for a body within the bound", async () => {
    const request = new Request("https://example.invalid/", {
      method: "POST",
      body: "hello",
    });
    const result = await readBoundedBody(request, 1024);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(new TextDecoder().decode(result.bytes)).toBe("hello");
    }
  });

  it("rejects a body exceeding maxBytes without buffering it all (stream is cancelled)", async () => {
    const CHUNK_BYTES = 16;
    let pullCount = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount > 1000) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    });
    const request = new Request("https://example.invalid/", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const result = await readBoundedBody(request, 32);
    expect(result).toEqual({ ok: false });
    expect(pullCount).toBeLessThan(64);
  });
});

describe("readBoundedBodyAsText", () => {
  it("decodes the bounded bytes as text", async () => {
    const request = new Request("https://example.invalid/", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });
    const result = await readBoundedBodyAsText(request, 1024);
    expect(result).toEqual({ ok: true, text: JSON.stringify({ a: 1 }) });
  });

  it("returns an empty text for a bodyless request", async () => {
    const request = new Request("https://example.invalid/", { method: "GET" });
    const result = await readBoundedBodyAsText(request, 1024);
    expect(result).toEqual({ ok: true, text: "" });
  });

  it("propagates the ok:false outcome from readBoundedBody without decoding anything", async () => {
    const request = new Request("https://example.invalid/", {
      method: "POST",
      body: "this body is definitely over the tiny bound",
    });
    const result = await readBoundedBodyAsText(request, 4);
    expect(result).toEqual({ ok: false });
  });
});

describe("bffHeaders", () => {
  it("carries the fixed three-header set with no argument", () => {
    expect(bffHeaders()).toEqual({
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    });
  });

  it("merges a non-colliding extra header in (the game-rounds Retry-After shape)", () => {
    expect(bffHeaders({ "Retry-After": "30" })).toEqual({
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "Retry-After": "30",
    });
  });

  it("is unaffected by a default (no-arg) call sharing no keys with any extra map", () => {
    // Regression pin for the exact call shape every non-game-rounds caller uses today —
    // zero-argument, byte-identical to each domain's own original hand-written object.
    expect(bffHeaders()).toEqual(bffHeaders({}));
  });
});
