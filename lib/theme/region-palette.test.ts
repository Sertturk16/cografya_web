import { describe, expect, it } from "vitest";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";

/**
 * The seven `--region-*` tints exactly as `app/globals.css` defines them.
 *
 * Duplicated here rather than parsed out of the stylesheet on purpose: this is the set the
 * assertion below is ABOUT, so a change to globals.css should make this file disagree loudly
 * rather than quietly re-measure whatever it now says.
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

describe("the seven region tints are a usable categorical set", () => {
  it("has 21 pairs — the whole set is compared, not a sample", () => {
    expect(PAIRS).toHaveLength(21);
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
    const worst = Math.min(
      ...PAIRS.map(([a, b]) =>
        deltaE00(simulate(REGION_TINTS[a]!, vision), simulate(REGION_TINTS[b]!, vision)),
      ),
    );
    // Pinned, not floored: a change that IMPROVES the set should also have to be noticed and
    // re-recorded, because these four numbers are the target T-031d's dark set has to match.
    expect(worst).toBe(WORST[vision]);
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
