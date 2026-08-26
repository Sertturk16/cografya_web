import { describe, expect, it } from "vitest";
import { RETURN_PATH_FALLBACK, RETURN_PATH_MAX_LENGTH, safeReturnPath } from "./redirect";

describe("T-R1 — accepts and returns a same-origin relative path unchanged", () => {
  for (const accepted of ["/", "/turkiye/istanbul", "/en/turkiye/istanbul?a=1", "/oyun/81-il"]) {
    it(`accepts ${JSON.stringify(accepted)}`, () => {
      expect(safeReturnPath(accepted)).toBe(accepted);
    });
  }
});

describe("T-R2 — rejects every off-origin/scheme family to the fallback", () => {
  const rejected = [
    "//evil.com",
    "///evil.com",
    "//evil.com/path",
    "https://evil.com",
    "http://evil.com/x",
    "/\\evil.com",
    "\\\\evil.com",
    "\\/evil.com",
    "  //evil.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "//",
    "/\\",
    "https://cografya.invalid/ok",
  ];

  for (const raw of rejected) {
    it(`rejects ${JSON.stringify(raw)}`, () => {
      expect(safeReturnPath(raw)).toBe(RETURN_PATH_FALLBACK);
    });
  }
});

describe("T-R3 — the measured protocol-relative bypass (step 5)", () => {
  it("rejects /.//evil.com — origin check alone (step 4) is not enough", () => {
    expect(safeReturnPath("/.//evil.com")).toBe(RETURN_PATH_FALLBACK);
  });

  it("rejects /..//evil.com — same bypass family", () => {
    expect(safeReturnPath("/..//evil.com")).toBe(RETURN_PATH_FALLBACK);
  });
});

describe("T-R4 — fragment dropped, query kept", () => {
  it("drops the fragment", () => {
    expect(safeReturnPath("/a#b")).toBe("/a");
  });

  it("keeps the query and drops the fragment together", () => {
    expect(safeReturnPath("/a?x=1#b")).toBe("/a?x=1");
  });
});

describe("T-R5 — length and emptiness guard", () => {
  it("falls back on null", () => {
    expect(safeReturnPath(null)).toBe(RETURN_PATH_FALLBACK);
  });

  it("falls back on undefined", () => {
    expect(safeReturnPath(undefined)).toBe(RETURN_PATH_FALLBACK);
  });

  it("falls back on an empty string", () => {
    expect(safeReturnPath("")).toBe(RETURN_PATH_FALLBACK);
  });

  it(`falls back on a ${RETURN_PATH_MAX_LENGTH + 1}-character path (one over the limit)`, () => {
    const overLength = "/" + "a".repeat(RETURN_PATH_MAX_LENGTH);
    expect(overLength.length).toBe(RETURN_PATH_MAX_LENGTH + 1);
    expect(safeReturnPath(overLength)).toBe(RETURN_PATH_FALLBACK);
  });

  it(`accepts a path at exactly the ${RETURN_PATH_MAX_LENGTH}-character limit`, () => {
    const atLimit = "/" + "a".repeat(RETURN_PATH_MAX_LENGTH - 1);
    expect(atLimit.length).toBe(RETURN_PATH_MAX_LENGTH);
    expect(safeReturnPath(atLimit)).toBe(atLimit);
  });
});
