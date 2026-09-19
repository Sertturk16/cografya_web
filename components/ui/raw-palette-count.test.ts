import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectPaletteOccurrences,
  EXCLUDED,
  RAW_PALETTE,
} from "../../scripts/palette-inventory.mjs";

/**
 * Raw Tailwind palette classes still in the product tree.
 *
 * ## Why a number and not just the escape rule
 *
 * `token-binding.test.ts` has enforced "no raw palette class" on a narrow surface for a long
 * time while this count moved 749 -> 895 -> 865 with nobody noticing, because it lived in a
 * comment. A comment is not a guard. This goes to 0; every step down is a commit.
 *
 * ## The one exclusion
 *
 * `turkiye/[slug]/page.tsx` belongs to T-033, which rewrites its climate markup wholesale.
 * Listing it here rather than silently skipping it is deliberate: when T-033 merges, this
 * test fails on the exclusion being stale, which is the reminder to delete it.
 */
const RAW_PALETTE_BUDGET = 764;

describe("the raw palette is being retired, and the number is held", () => {
  it("finds no more than the budget", () => {
    const found = collectPaletteOccurrences();
    const byFile = new Map<string, number>();
    for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    const worst = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    expect(
      found.length,
      `budget ${RAW_PALETTE_BUDGET}, found ${found.length}. Heaviest: ${worst
        .map(([f, n]) => `${f} (${n})`)
        .join(", ")}`,
    ).toBeLessThanOrEqual(RAW_PALETTE_BUDGET);
  });

  it("collects something at all — positive control", () => {
    // Narrow root, deliberately hand-spelled: proves the collector finds real hits on a
    // smaller tree, not just an empty result that would trivially satisfy any budget.
    expect(collectPaletteOccurrences(["components"]).length).toBeGreaterThan(0);
  });

  it("still has a reason for every exclusion", () => {
    // When T-033 merges and this file no longer carries any raw palette class, this fails,
    // which is the reminder to delete the exclusion.
    for (const path of EXCLUDED) {
      const hits = readFileSync(path, "utf8").match(RAW_PALETTE) ?? [];
      expect(
        hits.length,
        `${path} is excluded but carries no raw palette class any more — T-033 has landed, delete the exclusion`,
      ).toBeGreaterThan(0);
    }
  });
});
