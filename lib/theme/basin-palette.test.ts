import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";
import { REGION_TINTS } from "./region-palette.test";
import { CONTINENT_TINTS } from "./continent-palette.test";
import { SST_BANDS } from "./sst-band-palette.test";

/**
 * The four `--basin-*` fills exactly as `app/globals.css` defines them.
 *
 * Duplicated here rather than parsed out of the stylesheet, for the same reason
 * `region-palette.test.ts` and `continent-palette.test.ts` duplicate theirs: this is the set
 * the assertions below are ABOUT, so a change to globals.css should make this file disagree
 * loudly rather than quietly re-measure whatever it now says. The loud disagreement is the
 * `matches --basin-* in app/globals.css` test below, which parses the stylesheet independently
 * and compares it against this table in both directions.
 *
 * Two of the four are the hues that already shipped (`v2-marine-basin-cards`,
 * `v2-marine-map-explorer`, `deniz/kiyi-tipleri` and `lib/marine/sea-basins-detail` all agreed
 * on cyan / amber / teal / rose). The other two moved one step down inside their own family
 * because the shipped set FAILED the floor — see the block in `app/globals.css`.
 */
export const BASIN_TINTS: Readonly<Record<string, string>> = {
  karadeniz: "#0092b8",
  marmara: "#e17100",
  ege: "#00786f",
  akdeniz: "#c70036",
};

const PAIRS: readonly (readonly [string, string])[] = Object.keys(BASIN_TINTS).flatMap(
  (a, i, all) => all.slice(i + 1).map((b) => [a, b] as const),
);

/** Worst pair per vision, measured 2026-09-19 on the set authored above. */
const WORST: Readonly<Record<Vision, number>> = {
  normal: 20.7,
  protanopia: 16.7,
  deuteranopia: 17.7,
  tritanopia: 12.7,
};

/**
 * The pair that binds each `WORST` figure, in `PAIRS` order (the order `Object.keys` yields on
 * `BASIN_TINTS`, so the first name in each pair is always the one that appears first there).
 */
const WORST_PAIR: Readonly<Record<Vision, readonly [string, string]>> = {
  normal: ["karadeniz", "ege"],
  protanopia: ["ege", "akdeniz"],
  deuteranopia: ["karadeniz", "ege"],
  tritanopia: ["karadeniz", "ege"],
};

/**
 * What the four basins wore before T-031c, so the claim "two moved, two did not" is checked
 * rather than asserted in prose — and so the FAILURE that forced the move stays reproducible
 * in the test that replaced it (see `the shipped set is why two hues moved` below).
 */
const SHIPPED_BEFORE: Readonly<Record<string, string>> = {
  karadeniz: "#0092b8", // cyan-600
  marmara: "#e17100", // amber-600
  ege: "#009689", // teal-600
  akdeniz: "#ec003f", // rose-600
};

describe("the four basin fills are a usable categorical set", () => {
  it("has 6 pairs — the whole set is compared, not a sample", () => {
    expect(PAIRS).toHaveLength(6);
  });

  it("matches --basin-* in app/globals.css exactly, both directions", () => {
    // Comments stripped before parsing, and that is load-bearing here rather than defensive:
    // the block above these declarations quotes #0092b8, #009689 and #ec003f in prose while
    // explaining which hues moved, so an un-stripped parse would pick a comment up as a
    // declaration and could be satisfied by one.
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const shipped: Record<string, string> = {};
    for (const match of css.matchAll(/--basin-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      shipped[match[1]!] = match[2]!.toLowerCase();
    }
    // A CSS change that renamed or dropped every basin would make this an empty-vs-empty pass
    // below, so it is checked separately first.
    expect(shipped, "app/globals.css declares no --basin-* custom properties").not.toEqual({});
    // The `-tint` and `-text` members are NOT hex, so the regex above cannot pick them up and
    // this stays an exact both-ways comparison of the four base fills: an added, removed or
    // renamed basin changes the key set, a changed value changes a value.
    expect(shipped).toEqual(BASIN_TINTS);
  });

  it.each(VISIONS)("holds the categorical floor under %s", (vision) => {
    for (const [a, b] of PAIRS) {
      const seen = deltaE00(simulate(BASIN_TINTS[a]!, vision), simulate(BASIN_TINTS[b]!, vision));
      expect(
        seen,
        `${a} / ${b} under ${vision} measured ${seen}, floor is ${CATEGORICAL_MIN}`,
      ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
    }
  });

  it.each(VISIONS)("still has exactly the recorded worst pair under %s", (vision) => {
    let worstValue = Number.POSITIVE_INFINITY;
    let worstPair: readonly [string, string] = PAIRS[0]!;
    for (const pair of PAIRS) {
      const [a, b] = pair;
      const seen = deltaE00(simulate(BASIN_TINTS[a]!, vision), simulate(BASIN_TINTS[b]!, vision));
      if (seen < worstValue) {
        worstValue = seen;
        worstPair = pair;
      }
    }
    // Pinned, not floored: a change that IMPROVES the set should also have to be noticed and
    // re-recorded. Both the pair AND the value are asserted — a palette change that moves the
    // binding pair while landing on the same number must still fail this.
    expect(worstPair, `worst pair under ${vision}`).toEqual(WORST_PAIR[vision]);
    expect(
      worstValue,
      `${worstPair[0]} / ${worstPair[1]} under ${vision} measured ${worstValue}, recorded worst is ${WORST[vision]}`,
    ).toBe(WORST[vision]);
  });

  it("discriminates: a pair that is clear to normal vision and collapses under deuteranopia", () => {
    // The same positive control `region-palette.test.ts` and `continent-palette.test.ts` carry,
    // and it is not redundant here: it is what distinguishes a working `simulate` from an
    // identity one for THIS file's runs. With only four members and six pairs this set is the
    // easiest of the three to pass by accident, so the control matters more here, not less.
    // #008000 / #a52a2a measure 65.6 apart normally and 4.6 under deuteranopia. Both halves
    // matter — the first says the pair is a fair test rather than two colours that were never
    // distinguishable, the second is what a no-op `simulate` would break.
    expect(
      deltaE00(simulate("#008000", "normal"), simulate("#a52a2a", "normal")),
    ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
    expect(
      deltaE00(simulate("#008000", "deuteranopia"), simulate("#a52a2a", "deuteranopia")),
    ).toBeLessThan(CATEGORICAL_MIN);
  });
});

/**
 * Why two hues moved, kept as a measurement rather than as a sentence.
 *
 * The four spellings that shipped before T-031c agreed with each other, which made the set look
 * settled. It was not: it failed the floor twice. If someone later proposes putting Ege back on
 * teal-600 or Akdeniz back on rose-600 "because that is what it always was", this is the test
 * that answers, with the figure.
 */
describe("the shipped set is why two hues moved", () => {
  it("fails the floor under tritanopia on cyan/teal and under deuteranopia on amber/rose", () => {
    const trit = deltaE00(
      simulate(SHIPPED_BEFORE.karadeniz!, "tritanopia"),
      simulate(SHIPPED_BEFORE.ege!, "tritanopia"),
    );
    expect(
      trit,
      `the shipped cyan-600 / teal-600 measured ${trit} under tritanopia, floor is ${CATEGORICAL_MIN}`,
    ).toBeLessThan(CATEGORICAL_MIN);
    const deut = deltaE00(
      simulate(SHIPPED_BEFORE.marmara!, "deuteranopia"),
      simulate(SHIPPED_BEFORE.akdeniz!, "deuteranopia"),
    );
    expect(
      deut,
      `the shipped amber-600 / rose-600 measured ${deut} under deuteranopia, floor is ${CATEGORICAL_MIN}`,
    ).toBeLessThan(CATEGORICAL_MIN);
  });

  it("moved exactly the two members those pairs bind, and left the other two alone", () => {
    expect(BASIN_TINTS.karadeniz, "karadeniz kept its shipped cyan-600").toBe(
      SHIPPED_BEFORE.karadeniz,
    );
    expect(BASIN_TINTS.marmara, "marmara kept its shipped amber-600").toBe(SHIPPED_BEFORE.marmara);
    expect(BASIN_TINTS.ege, "ege had to move off teal-600").not.toBe(SHIPPED_BEFORE.ege);
    expect(BASIN_TINTS.akdeniz, "akdeniz had to move off rose-600").not.toBe(
      SHIPPED_BEFORE.akdeniz,
    );
  });

  it("moved them the recorded distance, so 'one step down its own family' stays true", () => {
    // Both moves stay inside their shipped hue family — the point of the search that chose
    // them. A future edit that lands Ege on a blue or Akdeniz on a green would pass the floor
    // tests above and still be a different product; these figures are what say so.
    expect(deltaE00(SHIPPED_BEFORE.ege!, BASIN_TINTS.ege!), "ege moved").toBe(10.9);
    expect(deltaE00(SHIPPED_BEFORE.akdeniz!, BASIN_TINTS.akdeniz!), "akdeniz moved").toBe(7.9);
  });
});

/**
 * Basins meet regions on a screen, so unlike regions and continents they may NOT share values.
 *
 * `app/globals.css` records the ruling. `turkiye/bolge/[slug]` paints its hero, its badge and
 * its border from `--region-*` and renders that region's `coastalSeas` as `--basin-*` chips in
 * the same viewport — two encodings, one screen. Regions and continents share seven values
 * precisely because no route renders both; that argument is unavailable here, and this is the
 * test that keeps the conclusion from being re-derived the lazy way.
 */
describe("the basin set is disjoint from the two sets that share the Okabe-Ito palette", () => {
  it("shares no VALUE with --region-*, which it shares a page with", () => {
    const regionValues = new Set(Object.values(REGION_TINTS));
    for (const [slug, value] of Object.entries(BASIN_TINTS)) {
      expect(
        regionValues.has(value),
        `--basin-${slug} is ${value}, which is also a --region-* value; the two are painted ` +
          `in one viewport on turkiye/bolge/[slug]`,
      ).toBe(false);
    }
  });

  it("shares no VALUE with --continent-*, which is the same seven values re-assigned", () => {
    // Continents do not meet basins today, so this is the weaker of the two claims — but
    // `--continent-*` IS `--region-*` re-assigned, so a value shared with one is shared with
    // the other, and asserting only the region half would hide that.
    const continentValues = new Set(Object.values(CONTINENT_TINTS));
    for (const [slug, value] of Object.entries(BASIN_TINTS)) {
      expect(continentValues.has(value), `--basin-${slug} is ${value}, a --continent-* value`).toBe(
        false,
      );
    }
  });
});

/**
 * Basins meet the SST ramp inside ONE component, so the same disjointness rule applies there —
 * and this is the collision the palette inventory named in advance.
 *
 * `v2-marine-map-explorer` paints basin group headers and SST band chips on the same screen.
 * Before T-031c `--basin-ege` and `--sst-band-warm` would both have been teal-600: one value
 * carrying two different encodings. Moving Ege to teal-700 is what separates them.
 */
describe("the basin set is separable from the SST ramp it shares a component with", () => {
  it("shares no VALUE with --sst-band-*", () => {
    const bandValues = new Set(Object.values(SST_BANDS));
    for (const [slug, value] of Object.entries(BASIN_TINTS)) {
      expect(
        bandValues.has(value),
        `--basin-${slug} is ${value}, which is also an --sst-band-* value; both are painted ` +
          `by components/v2/v2-marine-map-explorer.tsx`,
      ).toBe(false);
    }
  });

  it.each(VISIONS)("keeps ege and the warm band apart under %s — the named collision", (vision) => {
    const seen = deltaE00(simulate(BASIN_TINTS.ege!, vision), simulate(SST_BANDS.warm!, vision));
    expect(
      seen,
      `--basin-ege / --sst-band-warm under ${vision} measured ${seen}; both are teal, both are ` +
        `painted by v2-marine-map-explorer, and the shipped set had them on the SAME value`,
    ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
  });

  it("records the pair that does NOT clear it, so it is not rediscovered as a surprise", () => {
    // `--basin-marmara` (amber-600) and `--sst-band-hot` (orange-600) are 11.8 apart to normal
    // vision and 1.6 apart to a deuteranope. This is pinned rather than fixed, and
    // `app/globals.css` carries the reasoning: cross-set ΔE00 is not the bar — the two never
    // encode the same axis and both marks carry their own text — while Marmara clears the
    // categorical floor and every alternative measured worse against the shipped identity.
    // If a future change makes this WORSE, or silently makes it better, this figure moves and
    // the reasoning gets re-read.
    expect(
      deltaE00(
        simulate(BASIN_TINTS.marmara!, "deuteranopia"),
        simulate(SST_BANDS.hot!, "deuteranopia"),
      ),
    ).toBe(1.6);
    expect(deltaE00(BASIN_TINTS.marmara!, SST_BANDS.hot!)).toBe(11.8);
  });
});
