import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";
import { resolveVars, tokensIn } from "@/lib/test-support/css-tokens";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";
import { GRAPHICAL_MIN, blendOver, ratio } from "./contrast";
// From test/fixtures, not `./map-surface.test` and not a plain lib/theme module either — see
// test/fixtures/theme/map-surfaces.ts's docblock for both incidents this avoids (a test-file
// import re-registers its suites; a lib/ module gets read as a painted colour by the palette
// scanner).
import { MAP_SURFACES } from "@/test/fixtures/theme/map-surfaces";

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

/**
 * WHY THIS MEASURES THE LINE AND NOT THE FILLS.
 *
 * The obvious assertion — every region tint clears 3:1 against the map surface — is false in
 * light mode today and always has been: İç Anadolu is 1.05:1 on the light sea, five of seven
 * are under 3:1. It is also the wrong question. 1.4.11 asks whether the line that IDENTIFIES a
 * shape is perceivable against the colours adjacent to it; the seven are told apart from each
 * other by hue and chroma, which the ΔE00 cases above already prove at ≥ 10 across all 21
 * pairs under four visions. Asserting a luminance floor between categorical fills is the same
 * class of error as applying a graphical floor to text — the wrong criterion for what the
 * value is doing.
 *
 * WHAT DID CHANGE is the ground under the line. `--game-hover-edge`'s own docblock in
 * app/globals.css ends "⚠ RE-MEASURE WHEN THE LAND TONE CHANGES … Marmara's 3.25:1 is the
 * margin that will bite first", and T-031d changed the land tone in dark. It bit exactly
 * there: over the dark --map-land the edge measures 3.25:1 against Marmara at full strength,
 * 2.68:1 at the opacity-85 the province map rendered it at, and 2.52:1 at fillSoft's /80. (At
 * full strength `blendOver` returns the tint unaltered regardless of the ground it is asked to
 * blend over — mix = 1·fill + 0·ground — so the four full-strength cases below collapse to the
 * same number whether the ground named is land or sea, light or dark; that is not a bug in the
 * fixture, it is what "full strength" means.) A lighter edge does not fix it — #e8f0f1,
 * #ffffff, #d7e3e5 and #c3d3d6 all fail against İç Anadolu's yellow at 1.14–1.97 over the dark
 * land — so the softening goes instead, and the region fills render at full strength in both
 * themes (Tasks 6 and 9).
 */
const HOVER_EDGE = "#211c19"; // --game-hover-edge = --color-ink-dark, not redefined in .dark

/**
 * The same guard `map-surface.test.ts` puts on `--province-stroke`, for this file's own free
 * literal. `HOVER_EDGE` is a transcription, and every figure in the suite below measures the
 * transcription rather than the stylesheet: a `.dark` override of `--game-hover-edge` — or of
 * the `--color-ink-dark` it aliases, which reaches it just as surely — would draw a different
 * identifying line in dark mode with every assertion below still green. So the absence is
 * asserted, and the literal is tied to the `:root` value it copies.
 */
describe("the identifying line is one tone, and this file transcribes it correctly", () => {
  /**
   * ONE `it`, deliberately, where `map-surface.test.ts`'s twin block uses four.
   *
   * This file is imported by seven other test files for `REGION_TINTS`, and an import EXECUTES
   * a test module, so every case declared here is registered eight times over — counted with
   * `vitest run -t`, not from the import list, because the closure is transitive. That is the
   * multiplier `test/fixtures/theme/map-surfaces.ts`'s docblock records an incident about. The
   * assertions below are one indivisible claim — "the hover edge is the `:root` value, in both
   * themes" — so folding them into a single case costs no signal (each `expect` carries its own
   * message) and costs the suite 8 registrations instead of 32.
   */
  it("--game-hover-edge is #211c19 in :root and .dark overrides neither it nor --color-ink-dark", () => {
    const CSS = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    const root = resolveVars(tokensIn(CSS, ":root"));
    const dark = tokensIn(CSS, ".dark {");
    // Positive control: both blocks really parsed, so the absences below are facts about the
    // stylesheet rather than about an empty object.
    expect(root["--color-ink-dark"], ":root declares --color-ink-dark").toBeDefined();
    expect(dark["--background"], ".dark declares --background").toBeDefined();

    expect(root["--color-ink-dark"], "HOVER_EDGE transcribes --color-ink-dark").toBe(HOVER_EDGE);
    // One `resolveVars` hop: `--game-hover-edge: var(--color-ink-dark)`.
    expect(root["--game-hover-edge"], "HOVER_EDGE transcribes --game-hover-edge").toBe(HOVER_EDGE);

    for (const token of ["--game-hover-edge", "--color-ink-dark"] as const) {
      expect(
        Object.keys(dark),
        `${token} must not be redefined in .dark; read this block's docblock before changing it`,
      ).not.toContain(token);
    }
  });
});

describe("the line that identifies a region clears 1.4.11 on every ground", () => {
  it.each(["light", "dark"] as const)(
    "--game-hover-edge clears 3:1 against all seven region fills in %s, at full strength",
    (theme) => {
      for (const [region, tint] of Object.entries(REGION_TINTS)) {
        for (const surface of ["--map-land", "--map-sea"] as const) {
          const rendered = blendOver(tint, 1, MAP_SURFACES[theme][surface]);
          expect(
            ratio(HOVER_EDGE, rendered),
            `--game-hover-edge on ${region} over ${surface} in ${theme}`,
          ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
        }
      }
    },
  );

  /**
   * The regression this task exists to catch, pinned as a NEGATIVE control so it cannot come
   * back silently: at the opacity the province map used to render region fills at, the same
   * edge misses the floor on Marmara over the dark land. If a future change makes this pass,
   * the softening has been reintroduced somewhere or the palette moved — either way, read the
   * docblock above before deleting this. THIS TEST IS SUPPOSED TO FAIL if the softening comes
   * back: a green here is the regression, not a red. Do not "fix" a red here by widening
   * GRAPHICAL_MIN or by changing the 0.8 to something that passes; that is rebuilding the
   * exact error this task exists to correct. The only legitimate reason for this test to
   * change is a palette move recorded in a new commit, with the new figure re-measured and
   * written down here, the same way 2.52 was.
   */
  it("would MISS the floor if the fills were softened again in dark", () => {
    const softened = blendOver(REGION_TINTS.marmara!, 0.8, MAP_SURFACES.dark["--map-land"]);
    expect(ratio(HOVER_EDGE, softened)).toBeLessThan(GRAPHICAL_MIN);
  });
});
