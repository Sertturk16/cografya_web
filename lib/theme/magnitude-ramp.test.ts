import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tokensIn } from "@/lib/test-support/css-tokens";
import { MAP_SURFACES } from "@/test/fixtures/theme/map-surfaces";
import { GRAPHICAL_MIN, ratio, relativeLuminance, TEXT_MIN } from "./contrast";

/**
 * The five magnitude steps per theme, and the one label colour that sits on all five.
 *
 * ORDERED, NOT CATEGORICAL, so it is measured with WCAG ratios and a monotonic-lightness
 * assertion rather than with the ΔE00 >= 10 floor `region-palette.test.ts` uses — that floor is
 * for unordered categorical sets, and the spec says so in as many words.
 *
 * THE DARK RAMP RUNS THE OTHER WAY, and that is the whole change. Light mode reads a bigger
 * earthquake as a DARKER mark on a pale map; on the night map the same rule makes the biggest
 * quake the faintest thing on screen — measured on the shipped ramp against the dark --card,
 * 3.63 / 2.65 / 1.89 / 1.29 / 1.01, four of five under 3:1, worst at the step that matters
 * most. Prominence on a dark ground is lightness, so lightness rises with magnitude.
 *
 * The dark window is not free: every step must clear 3:1 on --card, --map-plate, --map-sea and
 * --map-land, and carry a single label at 4.5:1. Below oklch L 0.65 the label fails on step 1;
 * the five sit at L 0.65 -> 0.91.
 */
const RAMP = {
  light: { 1: "#aa4cbd", 2: "#9236a1", 3: "#772281", 4: "#521457", 5: "#2e0e2f", fg: "#ffffff" },
  dark: { 1: "#ba69cd", 2: "#ca80db", 3: "#d998e8", 4: "#e9b4f5", 5: "#f7d3ff", fg: "#211c19" },
} as const;

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const ROOT_TOKENS = tokensIn(CSS, ":root");
const THEMES = [
  ["light", ":root", "#ffffff"],
  // Not plain ".dark": `@custom-variant dark (&:is(.dark *));` near the top of the file
  // contains that literal substring before the real `.dark {` ruleset — `blockOf`'s `indexOf`
  // would find the decoy first. `map-surface.test.ts` already carries this fix; matched here.
  ["dark", ".dark {", "#121e21"],
] as const;
const STEPS = [1, 2, 3, 4, 5] as const;

describe.each(THEMES)("the %s magnitude ramp", (theme, selector, card) => {
  const table = RAMP[theme];

  it("matches app/globals.css exactly, both directions", () => {
    const shipped = tokensIn(CSS, selector);
    const mine = Object.fromEntries([
      ...STEPS.map((n) => [`--eq-mag-${n}`, table[n]] as const),
      ["--eq-mag-fg", table.fg] as const,
    ]);
    const found = Object.fromEntries(Object.entries(shipped).filter(([n]) => n in mine));
    // `.dark` carries `--eq-mag-fg` as a bare `var(--color-ink-dark)` alias, this stylesheet's
    // single-source idiom for reusing a `:root` neutral rather than repeating its hex
    // (`--map-water: var(--map-sea)` is the same shape). `resolveVars` only resolves an alias
    // whose target lives in the SAME block's own token map, and `--color-ink-dark` is a
    // `:root`-only token, so the one-level lookup is done by hand here for this single caller.
    if (found["--eq-mag-fg"] === "var(--color-ink-dark)") {
      found["--eq-mag-fg"] = ROOT_TOKENS["--color-ink-dark"]!;
    }
    expect(found, `${selector} declares no --eq-mag-* tokens`).not.toEqual({});
    expect(found).toEqual(mine);
  });

  it("clears 3:1 on the card the legend sits in and on every map surface a disc can land on", () => {
    for (const n of STEPS) {
      for (const [what, ground] of [
        ["--card", card],
        // Offshore quakes, and lake-centred ones since PR2 paints lakes above provinces, sit
        // on --map-plate, not --card — and there the shipped ramp measures worse (3.47 / 2.53 /
        // 1.80 / 1.24 / 1.06), so it is asserted here rather than assumed to follow from --card.
        ["--map-plate", MAP_SURFACES[theme]["--map-plate"]],
        ["--map-sea", MAP_SURFACES[theme]["--map-sea"]],
        ["--map-land", MAP_SURFACES[theme]["--map-land"]],
      ] as const) {
        expect(
          ratio(table[n], ground),
          `--eq-mag-${n} on ${what} in ${theme}`,
        ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
      }
    }
  });

  it("carries ONE label at 4.5:1 across all five steps", () => {
    for (const n of STEPS) {
      expect(
        ratio(table.fg, table[n]),
        `--eq-mag-fg on --eq-mag-${n} in ${theme}`,
      ).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });
});

describe("the ramp is ordered, and its direction follows the ground", () => {
  it("darkens with magnitude in light", () => {
    const lums = STEPS.map((n) => relativeLuminance(RAMP.light[n]));
    expect(lums).toEqual([...lums].sort((a, b) => b - a));
  });

  it("lightens with magnitude in dark", () => {
    const lums = STEPS.map((n) => relativeLuminance(RAMP.dark[n]));
    expect(lums).toEqual([...lums].sort((a, b) => a - b));
  });
});

/**
 * THE DISC'S IDENTIFYING RING, MEASURED BUT NOT BOUND HERE.
 *
 * `v2-earthquake-explorer.tsx` strokes the epicentre circle `stroke-white dark:stroke-black`
 * (a plain opaque stroke, no alpha suffix — `ratio` alone measures the rendered pixel). That
 * ring is the only thing that separates two overlapping discs, and separates a disc from
 * `--map-plate`/`--map-sea` under it, once the fill itself stops being a reliable edge.
 *
 * Re-lighting the fills without touching the ring is not neutral: `dark:stroke-black` was
 * already below floor against `--map-plate` (1.29:1, unchanged by this task — the ring never
 * sat on a magnitude fill). What this task's own ramp change newly exposes is that the OTHER
 * candidate, white, fails against the ramp's own new lightest step: a disc at magnitude 6+
 * (step 5, the step that matters most) is `#f7d3ff`, and white on it measures only 1.34:1.
 *
 * No single value clears all three grounds at once, and the reason is arithmetic, not a
 * missed shade: --map-plate sits at luminance ~0.0146 and the ramp's own lightest step at
 * ~0.7358, a span wide enough that no colour of any hue can hold 3:1 against both while also
 * holding 3:1 against the ramp's darkest step (~0.2495) in between. A ring lighter than
 * everything would need a luminance past 1 to clear the darkest step from the plate side; a
 * ring darker than everything has no room left below the already-near-black plate; and a ring
 * sitting between any two of the three fails the third by construction. This is reported
 * rather than "fixed" with an invented token — the brief for this task asks for exactly that
 * when nothing single-valued clears, and nothing does.
 */
describe("the disc's ring is not bound to a single value, and is not invented here", () => {
  const PLATE_DARK = MAP_SURFACES.dark["--map-plate"];
  const DARKEST_STEP = RAMP.dark[1]; // magnitude < 3 — the darkest fill in the dark ramp
  const LIGHTEST_STEP = RAMP.dark[5]; // magnitude 6+ — the lightest fill, the step that matters

  it("the shipped dark:stroke-black already misses the floor against --map-plate", () => {
    expect(ratio("#000000", PLATE_DARK)).toBeLessThan(GRAPHICAL_MIN);
  });

  it("black clears the floor against both ends of the new ramp", () => {
    expect(ratio("#000000", DARKEST_STEP)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    expect(ratio("#000000", LIGHTEST_STEP)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it("white clears the floor against --map-plate and the ramp's darkest step", () => {
    expect(ratio("#ffffff", PLATE_DARK)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    expect(ratio("#ffffff", DARKEST_STEP)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it("but white newly misses the floor against the ramp's own lightest step", () => {
    expect(ratio("#ffffff", LIGHTEST_STEP)).toBeLessThan(GRAPHICAL_MIN);
  });
});
