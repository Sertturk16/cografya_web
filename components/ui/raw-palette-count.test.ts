import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectArbitraryColorOccurrences,
  inlinesAColor,
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
 *
 * ## The last step, and what it bought
 *
 * 740 -> 568 was T-031c Task 5, the continent palette: `lib/map/continent-theme.ts` 112 -> 0,
 * `components/v2/v2-world-continents.tsx` 55 -> 0, `dunya/kita/[slug]/page.tsx` 3 -> 0 and
 * `dunya/kita/page.tsx` 2 -> 0, all four bound to `--continent-*` through
 * `lib/theme/continent-identity.ts`.
 *
 * 568 -> 438 is T-031c Task 6, the marine cluster, and it clears FIVE files at once because a
 * basin's colour was spelled in four of them and the fifth painted a sea it never named:
 * `components/v2/v2-marine-map-explorer.tsx` 61 -> 0, `deniz/kiyi-tipleri/page.tsx` 24 -> 0,
 * `components/v2/v2-marine-basin-cards.tsx` 21 -> 0, `lib/marine/sea-basins-detail.ts` 16 -> 0,
 * and 8 of `turkiye/bolge/[slug]/page.tsx`'s (57 -> 49) — its four per-sea chips, which were
 * one cyan for four different seas, plus the coastal-count badge above them, which named no sea
 * at all. 80 of the 130 are the `--basin-*` rows the inventory derived; 12 are `--sst-band-*`;
 * the rest are the decoration and warning rows on the same lines.
 *
 * The arbitrary-colour arm moved for the first time on this branch: 75 -> 72, and all three
 * are the marine map's temperature LEGEND (`bg-[#ea580c]`, `bg-[#0d9488]`, `bg-[#2563eb]`),
 * now a `bg-[...]` arbitrary value wrapping the band token. That legend was the SST ramp's
 * THIRD spelling in one file —
 * after the SVG pins and the table chips — and the one a reader actually uses to decode the
 * map, so it could have gone on describing a scale the pins no longer painted.
 *
 * A FALL here alongside a fall in the first arm is the good case; the failure this pairing
 * exists to catch is a fall in one WITH A RISE in the other. Two things that could have
 * produced such a rise did not: the three raw SVG pin hexes this task deleted were never
 * counted here (a bare hex in a TS string is not a bracketed class), and the three
 * `var(--sst-band-*, #hex)` fallbacks it added in their place are not either (a `var()`
 * fallback is stripped before the arm counts). Those fallbacks are pinned instead by
 * `components/ui/token-binding.test.ts`, in both directions.
 *
 * 438 -> 352 is T-031c Task 7, the earthquake cluster, and it clears four files:
 * `lib/earthquake/fault-lines-data.ts` 24 -> 0, `components/v2/v2-earthquake-explorer.tsx`
 * 21 -> 0, `deprem/page.tsx` 21 -> 0 and `deprem/fay-hatlari/page.tsx` 20 -> 0. 48 of the 86
 * are the `--fault-*` rows the inventory derived, 17 are the magnitude ramp binding to the
 * `--eq-mag-*` set that already existed, 9 are class names quoted inside one explanatory
 * comment (the literal spelling goes, the ruling stays), and the rest are semantic rows on the
 * same lines.
 *
 * `fault-lines-data.ts` is the file that made `lib/` a root in the first place: the hue lived
 * in `lib/`, invisible to a counter that walked only `components/` and `app/`, so the call
 * sites could have reached zero while the definition went on shipping the palette. Its 24 move
 * in the same commit as the 41 that spend them.
 *
 * The arbitrary arm does NOT move on this task — 72 before, 72 after — and that is the
 * interesting half. The explorer's marker ripple carried FOUR raw hexes in an SVG `stroke`
 * prop, a second spelling of the magnitude ramp that neither arm could see (a bare hex in a
 * prop is not a bracketed class), and they are gone without either number noticing. Nothing
 * replaced them with a fallback, because the ripple carries its step as a bracketed stroke
 * utility around the token now rather than as an SVG attribute, so no new entry joins the
 * `token-binding.test.ts` fallback census either.
 *
 * WRITING THAT SENTENCE THE OBVIOUS WAY 500'D EVERY ROUTE, for the second time on this branch.
 * The first draft spelled the utility out, with an ellipsis where the token name goes. Tailwind
 * scans source TEXT, so it compiled the prose into a real rule whose declaration read that
 * ellipsis verbatim, PostCSS failed on the delimiter, and `app/globals.css` stopped compiling
 * entirely. Typecheck, lint and 5599 tests stayed green throughout. The guard in
 * `components/ui/token-binding.test.ts` was widened in the same commit: it used to catch only a
 * `*` inside the token name, and now catches any bracketed utility whose `var()` argument is
 * not a custom-property name at all.
 *
 * A FALL here alongside a fall in the first arm is the good case; the failure this pairing
 * exists to catch is a fall in one WITH A RISE in the other.
 *
 * Both figures are read from these collectors, not arithmetic.
 */
const RAW_PALETTE_BUDGET = 352;

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
 * result above says why. The two arms stay separate because most of these 72 are legitimate map
 * surfaces (sea, neighbour land, inland water) measured against fixed backdrops and owned by
 * T-031d's `--map-*` / `--province-*` work; one number mixing them would be a number nobody
 * could act on.
 */
const ARBITRARY_COLOR_BUDGET = 72;

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
  // A `var()` beside the payload, not instead of it. These escaped the first TWO versions of
  // this arm: the second excluded a bracket whenever `var(` appeared anywhere inside it, so one
  // decorative `var(--ring)` immunised the whole utility and the palette value next to it.
  "bg-[color-mix(in_oklab,var(--x),#ea580c)]",
  "bg-[color-mix(in_oklab,#ea580c,var(--x))]",
  "bg-[rgb(var(--y)_88_12)]",
  "bg-[color-mix(in_srgb,var(--a)_50%,oklch(0.646_0.222_41.116))]",
  "shadow-[0_0_0_2px_#ea580c,0_0_0_4px_var(--ring)]",
  "[color:#ea580c;--x:var(--y)]",
  "bg-[linear-gradient(var(--a),#ea580c)]",
];

/**
 * Spellings that must NOT match, and every one of them is a deliberate decision rather than a
 * limitation. `[var(--x)]` is the GOAL state — `lib/theme/region-identity.ts` binds all seven
 * regions that way — and `var(--x, #hex)` is a token reference whose hex sits INSIDE the
 * `var()` as that token's own fallback, not beside it.
 *
 * Those fallbacks are not governed by `token-binding.test.ts`'s escape rule, whatever an earlier
 * version of this comment claimed: that rule is `var\(--color-[a-z-]+,\s*#hex\)` and all ten
 * live occurrences name `--map-sea`, so it never matches them. Their real exposure is DRIFT, and
 * it is pinned to `app/globals.css` by "every var() fallback still equals its token" in that same
 * file — the same fix `fillValue` gets in `region-identity.test.ts`.
 *
 * The rest are ordinary bracketed values that are not colours at all.
 */
const NOT_A_LAUNDERED_COLOUR: readonly string[] = [
  "bg-[var(--region-marmara)]",
  "fill-[var(--region-marmara)]/80",
  "bg-[var(--map-sea,#dbe7e8)]",
  "text-[var(--color-success,#496f35)]",
  // Nested, to prove the strip loops rather than running once.
  "bg-[var(--a,var(--b,#fff))]",
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
 * EMPTY, AND THAT IS THE RESULT RATHER THAN THE ABSENCE OF ONE. It held three entries until
 * T-031c Task 6: `v2-marine-map-explorer.tsx`'s sea-surface-temperature legend swatches
 * (`bg-[#ea580c]`, `bg-[#0d9488]`, `bg-[#2563eb]` — orange-600, teal-600 and blue-600 spelled
 * as literals). The `--sst-band-*` set they were waiting for now exists, the legend reads
 * the band tokens through a `bg-[...]` arbitrary value, and the assertion below did exactly
 * what its comment promised: it
 * went RED naming all three, which is how the entries came to be deleted instead of going
 * stale.
 *
 * The list stays, and stays asserted in both directions. A future laundering gets named here
 * and has to be removed by the task that fixes it, rather than counted and forgotten.
 */
const LAUNDERED: ReadonlyArray<{ file: string; cls: string; was: string }> = [];

describe("the palette cannot be laundered into brackets", () => {
  const found = collectArbitraryColorOccurrences();

  it.each(LAUNDERING_SPELLINGS)("%s is seen", (cls) => {
    expect(inlinesAColor(cls)).toBe(true);
  });

  it.each(NOT_A_LAUNDERED_COLOUR)("%s is deliberately not seen", (cls) => {
    expect(inlinesAColor(cls)).toBe(false);
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
    // Vacuous while LAUNDERED is empty, and deliberately kept: it is the half that fires when
    // a named entry is FIXED, and it fired for all three of the marine legend swatches in
    // T-031c Task 6. The other direction — a laundering that arrives unnamed — is the budget
    // assertion above, which is not vacuous.
    for (const entry of LAUNDERED) {
      expect(
        found.some((o) => o.file === entry.file && o.cls === entry.cls),
        `${entry.cls} (${entry.was}) is gone from ${entry.file} — delete this entry`,
      ).toBe(true);
    }
  });
});
