import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The loader's retry semantics, held structurally.
 *
 * PR #63 removed an asymmetry here: one of the two rejection paths cleared the memoised
 * promise and the other did not, so a single transient failure could memoise a REJECTED
 * promise for the rest of the page visit (→ `CODE63-M3` / `SEC63-M3`). Nothing pinned the
 * result, which means the asymmetry can return exactly as silently as it arrived
 * (→ `TA63R2-M4`).
 *
 * What that costs when it returns: one content blocker serving an empty body, or one offline
 * moment, and every later İzle press on any of the 30 blocks resolves to the same rejection —
 * jump-to-question is dead for the session while the player still plays, so nothing observes
 * it. Neither typecheck, lint, build nor a screenshot can.
 *
 * WHY A SOURCE SCAN. `loadIframeApi` touches `document` and `window`, and `vitest.config.ts`
 * runs a bare `node` environment with no jsdom (tracked FU-WEB-JSDOM), so the behavioural test
 * is genuinely unavailable in this repo today. The cheap half is not, and this is it. The same
 * constraint produced `components/book/deneme-video.src-invariant.test.ts`, whose shape this
 * follows.
 *
 * The invariant is stated as "every rejection is preceded by the reset" rather than as a
 * count, deliberately: a third rejection path — the timeout race the review offered as an
 * optional improvement — should extend this guard, not fail it.
 */

/** Comments out, whitespace collapsed. The file docblock says "clear the memo" in prose and
 *  must not be able to satisfy an assertion about the code. */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const LOADER = flatCode(readFileSync(new URL("./iframe-api.ts", import.meta.url), "utf8"));

describe("the iframe_api loader's memo", () => {
  it("is still what a second caller gets back", () => {
    // Anchor: `pending` has to BE the memo for the assertion below to mean anything.
    expect(LOADER).toContain("if (pending !== null) return pending;");
  });

  it("is cleared before every rejection, on all paths", () => {
    const segments = LOADER.split("reject(");
    // Anchor: both rejection paths are present. A file with one (or none) would pass the loop
    // below vacuously.
    expect(segments.length - 1).toBeGreaterThan(1);
    for (const before of segments.slice(0, -1)) {
      expect(before.trimEnd().endsWith("pending = null;")).toBe(true);
    }
  });
});
