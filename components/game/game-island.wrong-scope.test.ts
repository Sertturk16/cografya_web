import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * REGRESSION SHIELD — "a wrong answer marks the TARGET, never the clicked plate".
 *
 * The bug this guards lived at the CALL SITE, not in the logic. `lib/game/shape-state.ts`
 * decides what a shape shows and `shape-state.test.ts` pins that decision, but the shipped
 * defect was one identifier: the island set the wrong-mark from the clicked `plate` while
 * it set the correct-mark from the resolved `pickedTargetId`. In bölge mode a click answers
 * for a whole region, so the red flash covered one il and the green one covered eleven —
 * the two marks disagreed about what the player had picked. Reverting that single word
 * would reintroduce the whole bug with `shape-state.test.ts` still fully green, because
 * that file never imports the island (→ PR #38 review I3).
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. The repo's vitest environment is `node` with no
 * jsdom, and this island is a client component that drives real DOM attributes; rendering
 * it would mean standing up a harness this PR does not own. `game-map.nav-guard.test.ts`
 * established the same jsdom-free source-scan pattern in this folder for exactly this
 * situation. The guard makes no claim about what the DOM ends up looking like — it pins the
 * one identifier whose loss is invisible to every other check we run.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * Strip comments, then collapse every whitespace run to one space. The prose above the
 * `setWrongAnswer` call names both `plate` and `pickedTargetId`, so it must not be scanned;
 * flattening whitespace afterwards makes the assertions immune to Prettier's line breaking
 * without loosening what they actually match.
 */
function flatCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join(" ")
    .replace(/\s+/g, " ");
}

const ISLAND = flatCode(sourceOf("./game-island.tsx"));

describe("the game island's wrong-answer mark", () => {
  // Anchors. Without these the assertions below could pass vacuously after a rename, which
  // is the one way a source-scan guard fails silently.
  it("still resolves the clicked plate to a target before answering", () => {
    expect(ISLAND).toContain("const pickedTargetId = targetSet.plateToTarget[plate];");
    expect(ISLAND).toContain("setWrongAnswer(");
  });

  it("marks the RESOLVED TARGET, not the clicked plate", () => {
    expect(ISLAND).toMatch(/setWrongAnswer\(.{0,160}?targetId: pickedTargetId/);
    expect(ISLAND).not.toMatch(/setWrongAnswer\(.{0,160}?targetId: plate\b/);
  });

  it("feeds that same target id to the shape-state derivation", () => {
    expect(ISLAND).toMatch(/deriveShapeState\(\{.{0,320}?wrongTargetId: wrongAnswer\?\.targetId/);
  });
});
