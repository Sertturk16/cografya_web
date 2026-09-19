import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";
import { REGION_TINTS } from "./region-palette.test";

/**
 * The seven `--continent-*` fills exactly as `app/globals.css` defines them.
 *
 * Duplicated here rather than parsed out of the stylesheet, for the same reason
 * `region-palette.test.ts` duplicates its set: this is the set the assertions below are ABOUT,
 * so a change to globals.css should make this file disagree loudly rather than quietly
 * re-measure whatever it now says. The loud disagreement is the
 * `matches --continent-* in app/globals.css` test below, which parses the stylesheet
 * independently and compares it against this table in both directions.
 */
export const CONTINENT_TINTS: Readonly<Record<string, string>> = {
  avrupa: "#0072b2",
  asya: "#e69f00",
  afrika: "#009e73",
  "kuzey-amerika": "#56b4e9",
  "guney-amerika": "#d55e00",
  okyanusya: "#cc79a7",
  antarktika: "#f0e442",
};

const PAIRS: readonly (readonly [string, string])[] = Object.keys(CONTINENT_TINTS).flatMap(
  (a, i, all) => all.slice(i + 1).map((b) => [a, b] as const),
);

/** Worst pair per vision, measured 2026-09-19 on the set authored above. */
const WORST: Readonly<Record<Vision, number>> = {
  normal: 21.7,
  protanopia: 12.3,
  deuteranopia: 11.5,
  tritanopia: 11.1,
};

/**
 * The pair that binds each `WORST` figure, in `PAIRS` order (the order `Object.keys` yields on
 * `CONTINENT_TINTS`, so the first name in each pair is always the one that appears first there).
 */
const WORST_PAIR: Readonly<Record<Vision, readonly [string, string]>> = {
  normal: ["asya", "antarktika"],
  protanopia: ["avrupa", "okyanusya"],
  deuteranopia: ["asya", "antarktika"],
  tritanopia: ["asya", "okyanusya"],
};

describe("the seven continent fills are a usable categorical set", () => {
  it("has 21 pairs — the whole set is compared, not a sample", () => {
    expect(PAIRS).toHaveLength(21);
  });

  it("matches --continent-* in app/globals.css exactly, both directions", () => {
    // Comments stripped before parsing, so a prose mention of `--continent-` inside a comment —
    // and the block above these declarations is mostly prose about them — cannot be mistaken
    // for a declaration.
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const shipped: Record<string, string> = {};
    for (const match of css.matchAll(/--continent-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      shipped[match[1]!] = match[2]!.toLowerCase();
    }
    // A CSS change that renamed or dropped every continent would make this an empty-vs-empty
    // pass below, so it is checked separately first.
    expect(shipped, "app/globals.css declares no --continent-* custom properties").not.toEqual({});
    // The `-tint` and `-text` members are NOT hex, so the regex above cannot pick them up and
    // this stays an exact both-ways comparison of the seven base fills: an added, removed or
    // renamed continent changes the key set, a changed value changes a value.
    expect(shipped).toEqual(CONTINENT_TINTS);
  });

  it.each(VISIONS)("holds the categorical floor under %s", (vision) => {
    for (const [a, b] of PAIRS) {
      const seen = deltaE00(
        simulate(CONTINENT_TINTS[a]!, vision),
        simulate(CONTINENT_TINTS[b]!, vision),
      );
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
      const seen = deltaE00(
        simulate(CONTINENT_TINTS[a]!, vision),
        simulate(CONTINENT_TINTS[b]!, vision),
      );
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
    // The same positive control `region-palette.test.ts` carries, and it is not redundant here:
    // it is what distinguishes a working `simulate` from an identity one for THIS file's runs.
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
 * Regions and continents wear the same seven colours, on purpose, and that is asserted rather
 * than left as a coincidence two future edits could quietly break in either direction.
 *
 * `app/globals.css` records the ruling: the two are the same categorical problem, PR0 measured
 * the answer once, and the two encodings never share a screen. If someone later decides they
 * MUST differ, this test is what says so — and the brief for that change is then to prove the
 * new set clears the same floor, which the assertions above already demand of whatever
 * `--continent-*` becomes.
 */
describe("the continent set is the region set, re-assigned", () => {
  it("is the same seven values, so the four worst figures cannot drift apart", () => {
    expect([...Object.values(CONTINENT_TINTS)].sort()).toEqual(
      [...Object.values(REGION_TINTS)].sort(),
    );
  });

  it("assigns them differently — this is a permutation, not a copy of the mapping", () => {
    // The slugs are disjoint, so a shared VALUE is the only thing the two sets have in common.
    // Without this, `CONTINENT_TINTS = REGION_TINTS` would satisfy the assertion above.
    const regionSlugs = new Set(Object.keys(REGION_TINTS));
    for (const slug of Object.keys(CONTINENT_TINTS)) {
      expect(regionSlugs.has(slug), `${slug} names both a region and a continent`).toBe(false);
    }
  });
});
