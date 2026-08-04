import { describe, expect, it } from "vitest";
import { pickHubDescription } from "./hub-description";

/**
 * Structural invariants of the hub meta-description selection (PR #44 review TA-2).
 * Synthetic strings only — the real copy lives in `messages/{tr,en}.json` and is an
 * editorial concern, not a test fixture (CONVENTIONS §2).
 */
const WITH_COUNT = "with-count-variant";
const FALLBACK = "count-less-variant";

describe("pickHubDescription", () => {
  it("publishes the count-bearing variant when the page lists entities", () => {
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 1)).toBe(WITH_COUNT);
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 81)).toBe(WITH_COUNT);
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 196)).toBe(WITH_COUNT);
  });

  it("falls back to the count-less variant when the page lists nothing", () => {
    // The api-outage path: a description promising "81 il" over an empty page is exactly
    // what SEO-POLICY §B2.6 treats as a BLOCKER, so this branch is the guard, not a nicety.
    expect(pickHubDescription(WITH_COUNT, FALLBACK, 0)).toBe(FALLBACK);
  });

  it("never publishes the count-bearing variant for a nonsensical count", () => {
    // Unreachable through the real call path (an array length), pinned so a future caller
    // passing a difference or an index cannot silently produce "…-3 il…" in <head>.
    expect(pickHubDescription(WITH_COUNT, FALLBACK, -1)).toBe(FALLBACK);
  });
});
