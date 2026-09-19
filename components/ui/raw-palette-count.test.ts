import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectArbitraryHexOccurrences,
  collectPaletteOccurrences,
  EXCLUDED,
  hexOf,
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
const RAW_PALETTE_BUDGET = 740;

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

/**
 * The second arm, and the hole it closes.
 *
 * `RAW_PALETTE` matches a NOTATION. `bg-orange-600` and `bg-[#ea580c]` are the same colour, and
 * only the first is counted — so a file can reach zero by rewriting one as the other, and
 * `RAW_PALETTE_BUDGET = 0` at the end of this branch would assert something materially weaker
 * than it reads. `v2-marine-map-explorer.tsx` already does this three times.
 *
 * ## Why a pinned COUNT and not a colour classifier
 *
 * The obvious guard is "no arbitrary hex may BE a palette colour". It does not work, and the
 * measurement is worth recording so nobody rebuilds it. Ranking all 28 distinct arbitrary hexes
 * in the tree by CIEDE2000 distance to the nearest Tailwind value gives no separating threshold:
 * laundered `#2563eb` (blue-600) sits at 2.7 while the legitimate Terra tones `#201c18` and
 * `#1a2529` sit at 1.7 and 2.4, BELOW it. Maximum byte distance is worse — the laundered three
 * land 13-17 bytes from Tailwind v4's oklch values while genuine map tones land 6. A threshold
 * would either miss real laundering or condemn a measured map surface.
 *
 * A pinned count needs no classifier and closes the route exactly: moving an occurrence from
 * `bg-orange-600` to `bg-[#ea580c]` DECREASES the first arm and INCREASES this one, so the
 * second budget reds. The two arms stay separate because most of these 75 are legitimate map
 * surfaces (sea, neighbour land, inland water) measured against fixed backdrops and owned by
 * T-031d's `--map-*` / `--province-*` work; one number mixing them would be a number nobody
 * could act on.
 */
const ARBITRARY_HEX_BUDGET = 75;

/**
 * Arbitrary hexes that ARE a Tailwind palette value, by hand and by name — a list, not a
 * heuristic, because no heuristic separates them (see above).
 *
 * All three are `v2-marine-map-explorer.tsx`'s sea-surface-temperature legend swatches, which
 * the inventory files as the `--sst-band-*` set: a set that does not exist yet and that belongs
 * to that file's own task, not to this one. They are named here so the laundering is recorded
 * rather than merely counted, and asserted STILL PRESENT so the entry cannot outlive the bug.
 */
const LAUNDERED: ReadonlyArray<{ file: string; cls: string; was: string }> = [
  { file: "components/v2/v2-marine-map-explorer.tsx", cls: "bg-[#ea580c]", was: "orange-600" },
  { file: "components/v2/v2-marine-map-explorer.tsx", cls: "bg-[#0d9488]", was: "teal-600" },
  { file: "components/v2/v2-marine-map-explorer.tsx", cls: "bg-[#2563eb]", was: "blue-600" },
];

describe("the palette cannot be laundered into brackets", () => {
  const found = collectArbitraryHexOccurrences();

  it("finds no more than the pinned number of arbitrary-hex utilities", () => {
    const byFile = new Map<string, number>();
    for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    expect(
      found.length,
      `pinned ${ARBITRARY_HEX_BUDGET}, found ${found.length}. A RISE here with a fall in the ` +
        `raw-palette budget is a palette class rewritten as its hex, not progress. By file: ${[
          ...byFile.entries(),
        ]
          .sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} (${n})`)
          .join(", ")}`,
    ).toBeLessThanOrEqual(ARBITRARY_HEX_BUDGET);
  });

  it("collects something at all — positive control", () => {
    // The same anti-vacuity guard the first arm carries: a budget satisfied by an empty result
    // is not a budget.
    expect(collectArbitraryHexOccurrences(["components"]).length).toBeGreaterThan(0);
    expect(hexOf("bg-[#EA580C]")).toBe("#ea580c");
    expect(hexOf("fill-[#abc]")).toBe("#aabbcc");
  });

  it("still has a reason for every named laundered value", () => {
    // When v2-marine-map-explorer's --sst-band-* rows land, these disappear and this fails,
    // which is the reminder to delete the entry rather than let it go stale.
    for (const entry of LAUNDERED) {
      expect(
        found.some((o) => o.file === entry.file && o.cls === entry.cls),
        `${entry.cls} (${entry.was}) is gone from ${entry.file} — delete this entry`,
      ).toBe(true);
    }
  });
});
