import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "a shown answer waits for the player".
 *
 * This is the headline fix of Kâşif PR-4a and it had no guard at all (→ PR #48 review
 * TA48-I1), which is the worst combination available: the behaviour it restores is a
 * PRODUCT decision the owner ranked first, and its removal would be invisible to every
 * other check we run. Re-adding a hold constant and a timer branch is a three-line edit
 * that types, lints and passes every existing test while quietly restoring the defect —
 * the answer flashing past a player who is still looking at the button they just pressed.
 *
 * WHAT IS PINNED, and it is deliberately the SHAPE rather than the milliseconds:
 *
 *   1. the auto-advance timer fires for a CORRECT answer only. A `revealed` outcome must
 *      not reach `setTimeout(goNext, …)` by any route;
 *   2. there is no reveal-hold constant left to reintroduce it with;
 *   3. the resolved state offers "Devam", wired to the guarded click handler — because a
 *      reveal that waits with no way forward is a worse bug than the one being fixed.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo runs a single `node` vitest
 * environment with no jsdom, and this is a client island driving real timers — the same
 * constraint `game-island.wrong-scope.test.ts` and `game-map.nav-guard.test.ts` document.
 * The guard makes no claim about what the DOM does; that is the PR's measured sample run
 * ("reveal does NOT auto-advance", captured at t+3700 ms).
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strip comments, then collapse whitespace: the prose above the code says all of these
 *  words, and Prettier is free to break the lines wherever it likes. */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const ISLAND = flatCode(sourceOf("./game-island.tsx"));

describe("the shown answer's exit", () => {
  // Anchors. Without them every assertion below could pass vacuously after a rename, which
  // is the one way a source-scan guard fails silently.
  it("still resolves questions through a hold constant and a timer", () => {
    expect(ISLAND).toContain("const CORRECT_HOLD_MS =");
    expect(ISLAND).toMatch(/window\.setTimeout\(goNext, CORRECT_HOLD_MS\)/);
  });

  it("auto-advances a CORRECT answer only", () => {
    expect(ISLAND).toMatch(/feedback\?\.kind !== "correct"\) return;/);
    // The pre-PR shape, in any spelling: a hold chosen by outcome kind.
    expect(ISLAND).not.toMatch(/feedback\.kind === "correct" \?/);
  });

  it("keeps no reveal hold to advance a shown answer with", () => {
    expect(ISLAND).not.toContain("REVEAL_HOLD_MS");
  });

  it("offers Devam as the way out of a resolved question", () => {
    expect(ISLAND).toMatch(/round\.status === "resolved" \?/);
    expect(ISLAND).toMatch(/onClick=\{onNextClick\}[\s\S]{0,80}?t\("next"\)/);
  });

  // The double-click hole the reveal fix opened: React reuses the button's DOM node, so
  // click 2 of a double-click runs the handler click 1 installed (→ CR48-I1).
  it("drops the second click of a double-click on Devam", () => {
    expect(ISLAND).toMatch(
      /const onNextClick = useCallback\(\s*\(event[^)]*\) => \{ if \(event\.detail > 1\) return;/,
    );
  });
});
