import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";

/**
 * The seven `--region-*` tints exactly as `app/globals.css` defines them.
 *
 * Duplicated here rather than parsed out of the stylesheet on purpose: this is the set the
 * assertion below is ABOUT, so a change to globals.css should make this file disagree loudly
 * rather than quietly re-measure whatever it now says. The "loud disagreement" is the
 * `matches --region-* in app/globals.css` test below, which parses the stylesheet
 * independently (the same `stripCssComments` precaution as `bridge-tokens.test.ts`) and
 * compares it against this table in both directions.
 */
export const REGION_TINTS: Readonly<Record<string, string>> = {
  marmara: "#0072b2",
  ege: "#e69f00",
  akdeniz: "#56b4e9",
  "ic-anadolu": "#f0e442",
  karadeniz: "#cc79a7",
  "dogu-anadolu": "#009e73",
  "guneydogu-anadolu": "#d55e00",
};

const PAIRS: readonly (readonly [string, string])[] = Object.keys(REGION_TINTS).flatMap(
  (a, i, all) => all.slice(i + 1).map((b) => [a, b] as const),
);

/** Worst pair per vision, measured 2026-09-19 on the shipped set. */
const WORST: Readonly<Record<Vision, number>> = {
  normal: 21.7,
  protanopia: 12.3,
  deuteranopia: 11.5,
  tritanopia: 11.1,
};

/**
 * The pair that binds each `WORST` figure, in `PAIRS` order (the order `Object.keys` yields on
 * `REGION_TINTS`, so the first name in each pair is always the one that appears first there).
 */
const WORST_PAIR: Readonly<Record<Vision, readonly [string, string]>> = {
  normal: ["ege", "ic-anadolu"],
  protanopia: ["marmara", "karadeniz"],
  deuteranopia: ["ege", "ic-anadolu"],
  tritanopia: ["ege", "karadeniz"],
};

describe("the seven region tints are a usable categorical set", () => {
  it("has 21 pairs — the whole set is compared, not a sample", () => {
    expect(PAIRS).toHaveLength(21);
  });

  it("matches --region-* in app/globals.css exactly, both directions", () => {
    // Same precaution as `bridge-tokens.test.ts`: comments stripped before parsing, so a prose
    // mention of `--region-` inside a comment can't be mistaken for a declaration.
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const shipped: Record<string, string> = {};
    for (const match of css.matchAll(/--region-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      shipped[match[1]!] = match[2]!.toLowerCase();
    }
    // A CSS change that renamed or dropped every region would make this an empty-vs-empty
    // pass below, so it is checked separately first.
    expect(shipped, "app/globals.css declares no --region-* custom properties").not.toEqual({});
    // toEqual is exact both ways: an added, removed or renamed region changes the key set, and
    // a changed value changes a value — either fails this, in either direction.
    expect(shipped).toEqual(REGION_TINTS);
  });

  it.each(VISIONS)("holds the categorical floor under %s", (vision) => {
    for (const [a, b] of PAIRS) {
      const seen = deltaE00(simulate(REGION_TINTS[a]!, vision), simulate(REGION_TINTS[b]!, vision));
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
      const seen = deltaE00(simulate(REGION_TINTS[a]!, vision), simulate(REGION_TINTS[b]!, vision));
      if (seen < worstValue) {
        worstValue = seen;
        worstPair = pair;
      }
    }
    // Pinned, not floored: a change that IMPROVES the set should also have to be noticed and
    // re-recorded, because these four numbers are the target T-031d's dark set has to match.
    // Both the pair AND the value are asserted — a palette change that moves the binding pair
    // while landing on the same number must still fail this.
    expect(worstPair, `worst pair under ${vision}`).toEqual(WORST_PAIR[vision]);
    expect(
      worstValue,
      `${worstPair[0]} / ${worstPair[1]} under ${vision} measured ${worstValue}, recorded worst is ${WORST[vision]}`,
    ).toBe(WORST[vision]);
  });

  it("discriminates: a pair that is clear to normal vision and collapses under deuteranopia", () => {
    // #008000 / #a52a2a measure 65.6 apart normally and 4.6 under deuteranopia.
    // Both halves matter. The first says the pair is a fair test rather than two colours
    // that were never distinguishable. The second is what a no-op `simulate` would break:
    // it would report 65.6 here and this assertion would fail. The previous pair (two
    // blues, 6.2 apart in raw space) collapsed with or without simulation, so it could not
    // tell a working `simulate` from an identity one.
    expect(
      deltaE00(simulate("#008000", "normal"), simulate("#a52a2a", "normal")),
    ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
    expect(
      deltaE00(simulate("#008000", "deuteranopia"), simulate("#a52a2a", "deuteranopia")),
    ).toBeLessThan(CATEGORICAL_MIN);
  });
});
