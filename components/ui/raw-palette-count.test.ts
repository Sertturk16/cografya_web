import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARBITRARY_COLOR,
  collectArbitraryColorOccurrences,
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
 * A hex is not the only way to spell it. `LAUNDERING_SPELLINGS` below is the list this arm is
 * written against, and the first version of it caught only the plain-hex form.
 *
 * ## Why a pinned COUNT and not a colour classifier
 *
 * The obvious guard is "no arbitrary hex may BE a palette colour". It does not work. A NEGATIVE
 * RESULT WITH DATA, recorded so nobody rebuilds it: rank all 28 distinct arbitrary hexes in the
 * tree by CIEDE2000 to the nearest of the 230 Tailwind values the FIRST arm actually counts, and
 * there is no separating threshold.
 *
 *     #0d9488   0.76   teal-600     <- LAUNDERED
 *     #201c18   1.69   stone-900       legitimate Terra ink
 *     #070e17   1.67   gray-950        legitimate map tone
 *     #2563eb   2.68   blue-600     <- LAUNDERED, above two legitimate tones
 *     #ea580c   3.20   orange-600   <- LAUNDERED
 *
 * A cut at 0.76 catches one of the three and misses two; a cut above 2.68 condemns two measured
 * map surfaces. Maximum byte distance is worse still — the laundered three land 13-17 bytes from
 * Tailwind v4's oklch values (v4 states the palette in oklch; the laundered hexes are the v3
 * literals) while genuine map tones land 6.
 *
 * SCOPE MATTERS AND COST ME A FIGURE. An earlier version of this note put `#1a2529` at 2.4,
 * nearest `mist-800`. It is 6.20, nearest `zinc-800`. Tailwind 4.3's `theme.css` ships
 * `mauve`/`olive`/`mist`/`taupe` beyond the 22 classic families, and none of them is in
 * `FAMILIES`, so none is a laundering target — including them made a project-adjacent tone look
 * like a near-palette match. The comparison the argument rests on is unaffected.
 *
 * A pinned count needs no classifier and closes the route for every spelling in
 * `LAUNDERING_SPELLINGS`: moving an occurrence from `bg-orange-600` to any of them DECREASES
 * the first arm and INCREASES this one, so the second budget reds. What it does NOT do is
 * decide whether a bracketed value IS a palette colour — nothing here does, and the negative
 * result above says why. The two arms stay separate because most of these 75 are legitimate map
 * surfaces (sea, neighbour land, inland water) measured against fixed backdrops and owned by
 * T-031d's `--map-*` / `--province-*` work; one number mixing them would be a number nobody
 * could act on.
 */
const ARBITRARY_COLOR_BUDGET = 75;

/**
 * Every spelling of one colour that must not slip past both arms, with orange-600 as the
 * payload throughout.
 *
 * This list is the arm's real specification. The first version of it matched `-[#` only, and
 * ELEVEN of these lowered the raw-palette count without raising this one — including
 * `bg-[oklch(0.646 0.222 41.116)]`, which is Tailwind v4's OWN notation for orange-600 straight
 * out of its `theme.css`, and therefore the most natural laundering of the lot.
 *
 * Exposure to all eleven is zero in the tree today, so none of them moves the pinned number.
 * That is exactly why they are asserted here instead: a guard whose coverage rests on nothing
 * in the tree exercising it is a guard nobody will notice losing.
 */
const LAUNDERING_SPELLINGS: readonly string[] = [
  "bg-[#ea580c]",
  "dark:fill-[#ea580c]",
  "bg-[rgb(234 88 12)]",
  "bg-[rgb(234,88,12)]",
  "bg-[rgb(234 88 12 / 1)]",
  "bg-[rgba(234,88,12,1)]",
  "bg-[hsl(21 88% 48%)]",
  "bg-[oklch(0.646 0.222 41.116)]",
  "bg-[oklab(0.55 0.13 0.11)]",
  "bg-[lab(60 40 50)]",
  "bg-[lch(60 60 40)]",
  "bg-[color-mix(in_srgb,#ea580c_50%,white)]",
  "shadow-[0_0_0_2px_#ea580c]",
  "ring-[1px_solid_#ea580c]",
  "[color:#ea580c]",
  "[--tw-x:#ea580c]",
];

/**
 * Spellings that must NOT match, and every one of them is a deliberate decision rather than a
 * limitation. `[var(--x)]` is the GOAL state — `lib/theme/region-identity.ts` binds all seven
 * regions that way — and `var(--x, #hex)` is a token reference carrying a defensive fallback,
 * a shape `components/ui/token-binding.test.ts` already governs with its own exemptions. The
 * rest are ordinary bracketed values that are not colours at all.
 */
const NOT_A_LAUNDERED_COLOUR: readonly string[] = [
  "bg-[var(--region-marmara)]",
  "fill-[var(--region-marmara)]/80",
  "bg-[var(--map-sea,#dbe7e8)]",
  "text-[var(--color-success,#496f35)]",
  "min-h-[380px]",
  "aspect-[2.33/1]",
  "text-[10px]",
  "[&_h4]:text-inherit",
  'REGION_IDENTITY["ic-anadolu"]',
  "bg-[collab(1)]",
];

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
  const found = collectArbitraryColorOccurrences();

  it.each(LAUNDERING_SPELLINGS)("%s is seen", (cls) => {
    ARBITRARY_COLOR.lastIndex = 0;
    expect(ARBITRARY_COLOR.test(cls)).toBe(true);
  });

  it.each(NOT_A_LAUNDERED_COLOUR)("%s is deliberately not seen", (cls) => {
    ARBITRARY_COLOR.lastIndex = 0;
    expect(ARBITRARY_COLOR.test(cls)).toBe(false);
  });

  it("finds no more than the pinned number of bracketed colour values", () => {
    const byFile = new Map<string, number>();
    for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    expect(
      found.length,
      `pinned ${ARBITRARY_COLOR_BUDGET}, found ${found.length}. A RISE here with a fall in the ` +
        `raw-palette budget is a palette class rewritten as a literal value, not progress. By file: ${[
          ...byFile.entries(),
        ]
          .sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} (${n})`)
          .join(", ")}`,
    ).toBeLessThanOrEqual(ARBITRARY_COLOR_BUDGET);
  });

  it("collects something at all — positive control", () => {
    // The same anti-vacuity guard the first arm carries: a budget satisfied by an empty result
    // is not a budget.
    expect(collectArbitraryColorOccurrences(["components"]).length).toBeGreaterThan(0);
    expect(hexOf("bg-[#EA580C]")).toBe("#ea580c");
    expect(hexOf("fill-[#abc]")).toBe("#aabbcc");
    // A colour function has no hex to report, and the caller has to cope with that.
    expect(hexOf("bg-[rgb(234 88 12)]")).toBeNull();
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
