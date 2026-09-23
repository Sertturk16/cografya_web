import { describe, expect, it } from "vitest";
import {
  mutationErrorCodeFromResponse,
  readErrorBody,
  type MutationErrorCode,
} from "./mutation-error";

const QUOTA = "errors.example.quotaExceeded";

describe("mutationErrorCodeFromResponse", () => {
  const metered: readonly [string, number, unknown, MutationErrorCode][] = [
    ["quota 403 with the domain's code", 403, { ok: false, code: QUOTA }, "quota-exceeded"],
    // Same status, different cause: the BFF's own Origin check.
    ["Origin-check 403", 403, { ok: false, code: "errors.transport.forbidden" }, "failed"],
    ["403 with no body", 403, null, "failed"],
    ["403 with a non-object body", 403, "quota", "failed"],
    ["quota code on a non-403 status", 400, { ok: false, code: QUOTA }, "failed"],
    [
      "session gone (401)",
      401,
      { ok: false, code: "errors.auth.unauthenticated" },
      "session-expired",
    ],
    ["401 with no body", 401, null, "session-expired"],
    ["api down (502)", 502, { ok: false, code: "errors.transport.unavailable" }, "failed"],
    ["proxy error page (500)", 500, null, "failed"],
  ];

  it.each(metered)("with a quota code: %s -> %s", (_label, status, body, expected) => {
    expect(mutationErrorCodeFromResponse(status, body, QUOTA)).toBe(expected);
  });

  it("never reports quota for a domain that has none, even on a 403 carrying some code", () => {
    expect(mutationErrorCodeFromResponse(403, { ok: false, code: QUOTA })).toBe("failed");
    expect(
      mutationErrorCodeFromResponse(403, { ok: false, code: "errors.transport.forbidden" }),
    ).toBe("failed");
    expect(mutationErrorCodeFromResponse(401, null)).toBe("session-expired");
  });
});

describe("readErrorBody", () => {
  it("parses a JSON body", async () => {
    const res = new Response(JSON.stringify({ ok: false, code: "x" }), { status: 403 });
    await expect(readErrorBody(res)).resolves.toEqual({ ok: false, code: "x" });
  });

  it("answers null for a non-JSON or empty body instead of throwing", async () => {
    await expect(readErrorBody(new Response("<html>", { status: 500 }))).resolves.toBeNull();
    await expect(readErrorBody(new Response(null, { status: 401 }))).resolves.toBeNull();
  });
});
