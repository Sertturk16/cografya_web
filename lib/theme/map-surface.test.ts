import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveVars, tokensIn } from "@/lib/test-support/css-tokens";
import { GRAPHICAL_MIN, ratio, TEXT_MIN } from "./contrast";

/**
 * Every painted map surface, per theme, exactly as `app/globals.css` declares it.
 *
 * Committed here rather than only parsed, for the reason `region-palette.test.ts` gives: this
 * is the set the floors below are ABOUT, so a stylesheet edit should make this file disagree
 * loudly rather than quietly re-measure whatever the stylesheet now says. The
 * `matches app/globals.css` test compares the two in both directions.
 *
 * WHAT IS NOT HERE. There is no `--map-land-line` and no second, deeper sea. Six of the eight
 * surfaces that draw Türkiye already carry their coastline on `--province-stroke`, which the
 * light palette's luminance budget was built around (`globals.css:161`) and which measures
 * 4.38:1 on the dark land and 4.21:1 on the dark sea without being redefined. The two that
 * did not — the play board and the workbench canvas — were also the only two that missed a
 * floor in EITHER theme. They adopt these tokens; their private tones are deleted, not ported.
 *
 * ELEVEN tokens per theme, not ten: `--map-tectonic` is new. It covers the tectonic-plate
 * context fill `v2-earthquake-explorer.tsx:524` paints today for the surrounding-sea basin
 * labels (`fill-[#537b93] dark:fill-[#5a86a0]`) — a real third surface, neither land nor
 * water, that had never had a token or a floor of its own. It is not folded into
 * `--map-context-land` (a different hue family entirely — warm neighbour-land tan, not a
 * cool plate-line blue) or into `--map-label` (a different job: label ink sits on land/sea/
 * neighbour-land, this sits on the sea itself, on top of `--map-sea`). Measured with
 * `lib/theme/contrast.ts`'s `ratio` against `--map-sea`: 3.59:1 light, 4.14:1 dark. Both
 * already clear `GRAPHICAL_MIN` (3:1) with the component's shipped values unchanged, which is
 * why this is a promotion to a token, not a repaint.
 */
export const MAP_SURFACES = {
  light: {
    "--map-plate": "#dbe7e8",
    "--map-sea": "#dbe7e8",
    "--map-land": "#ffffff",
    "--map-context-land": "#f1ece3",
    "--map-context-line": "#8a8078",
    "--map-water-line": "#002337",
    "--map-label": "#635a4e",
    "--map-ocean": "#0d1b2a",
    "--map-graticule": "#4d7ea8",
    "--map-unknown-land": "#64748b",
    "--map-tectonic": "#537b93",
  },
  dark: {
    "--map-plate": "#152228",
    "--map-sea": "#152228",
    "--map-land": "#201c18",
    "--map-context-land": "#2d2822",
    "--map-context-line": "#7d7468",
    "--map-water-line": "#5d8fb8",
    "--map-label": "#a89e92",
    "--map-ocean": "#070e17",
    "--map-graticule": "#4d7ea8",
    "--map-unknown-land": "#64748b",
    "--map-tectonic": "#5a86a0",
  },
} as const;

/** `--province-stroke`, which `.dark` deliberately does not redefine. See the docblock above. */
const PROVINCE_STROKE = "#8a8078";

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const THEMES = [
  ["light", ":root", MAP_SURFACES.light],
  // Not plain ".dark": `@custom-variant dark (&:is(.dark *));` near the top of the file
  // contains that literal substring, uncommented, well before the real `.dark {` ruleset —
  // `blockOf`'s `indexOf` finds THAT occurrence first and then the next "{" after it, which
  // is `:root`'s own opening brace, not `.dark`'s. The result is not a throw (so Step 2's
  // "confirm it fails on the token set, not on a parse" check saw green) but silent wrong
  // data: every `.dark` lookup above quietly read `:root` instead, which is exactly the
  // "throws vs. finds the wrong block" case the brief warns about, just without the throw.
  // `bridge-tokens.test.ts` already carries this fix (`section(".dark {")`); this file
  // matches it rather than reintroducing the collision.
  ["dark", ".dark {", MAP_SURFACES.dark],
] as const;

describe.each(THEMES)("the %s map surfaces", (theme, selector, table) => {
  it("matches app/globals.css exactly, both directions", () => {
    // `tokensIn` returns the literal string `"var(--name)"` for an alias — this stylesheet's
    // single-source idiom for a surface that is deliberately the same colour as another one.
    // `--map-water: var(--map-sea)` ships today; Task 3 adds `--map-plate: var(--map-sea)`
    // (both themes) and, in `:root` only, `--map-context-line: var(--province-stroke)`.
    // Comparing that literal string against a committed hex would fail for a reason that has
    // nothing to do with the palette being wrong, so the shipped block is resolved before the
    // `toEqual` below.
    //
    // Resolved TWICE, not once and not with a recursive helper. Once is not enough: in
    // `:root`, `--map-context-line` resolves to `var(--color-taupe)` — `--province-stroke`
    // is *itself* an alias (`--province-stroke: var(--color-taupe)`), so a single hop lands
    // on another bare `var()`, not a hex. A second call resolves that to the literal
    // `#8a8078`, and a third call is a no-op on this block, which is how the depth is known
    // to be exactly 2 rather than assumed. Not recursive: `resolveVars`'s own docblock stops
    // at one hop on purpose, so that a two-level chain surfaces as a loud, specific failure
    // (an unresolved `var(--x)` string in a `toEqual`) rather than being silently flattened.
    // That reasoning is about protecting against an UNKNOWN chain length; the chain this test
    // walks is a known, fixed 2, so it says that literally — two explicit calls — instead of
    // reaching for a general fixed-point resolver that would swallow the same signal
    // `resolveVars` was written to preserve.
    const shipped = resolveVars(resolveVars(tokensIn(CSS, selector)));
    const mapOnly = Object.fromEntries(Object.entries(shipped).filter(([name]) => name in table));
    expect(mapOnly, `${selector} declares none of the --map-* tokens`).not.toEqual({});
    expect(mapOnly).toEqual(table);
  });

  it("carries the coastline on --province-stroke at 3:1 against land, sea and neighbour land", () => {
    for (const surface of ["--map-land", "--map-sea", "--map-context-land"] as const) {
      expect(
        ratio(PROVINCE_STROKE, table[surface]),
        `--province-stroke on ${surface} in ${theme}`,
      ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    }
  });

  it("outlines neighbour land at 3:1 against both the land and the sea it borders", () => {
    for (const surface of ["--map-context-land", "--map-sea"] as const) {
      expect(
        ratio(table["--map-context-line"], table[surface]),
        `--map-context-line on ${surface} in ${theme}`,
      ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    }
  });

  it("outlines inland water at 3:1 against both the water and the land it sits in", () => {
    for (const surface of ["--map-sea", "--map-land"] as const) {
      expect(
        ratio(table["--map-water-line"], table[surface]),
        `--map-water-line on ${surface} in ${theme}`,
      ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    }
  });

  it("prints map labels at 4.5:1 on every surface one can land on", () => {
    for (const surface of ["--map-sea", "--map-land", "--map-context-land"] as const) {
      expect(
        ratio(table["--map-label"], table[surface]),
        `--map-label on ${surface} in ${theme}`,
      ).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  it("keeps --map-tectonic legible against the sea it is painted on", () => {
    // Measured 2026-09-19: 3.59:1 light, 4.14:1 dark — see the `--map-tectonic` paragraph in
    // the MAP_SURFACES docblock above for what surface this is and why it gets its own floor
    // rather than reusing --map-context-land or --map-label.
    expect(
      ratio(table["--map-tectonic"], table["--map-sea"]),
      `--map-tectonic on --map-sea in ${theme}`,
    ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });
});

/**
 * The doctrine `globals.css:161` states, asserted rather than restated: land and sea are told
 * apart by HUE, warm against cool, because the stroke floor leaves the palette about 1.29:1 of
 * luminance to spend. Light mode's own figure is 1.26:1, so a ratio assertion here would be
 * wrong in both directions. What must hold is that the two are not the same temperature — the
 * defect `v2-game-screen` shipped, where a cool land sat on a cool sea at 1.01:1.
 *
 * The two cases below do NOT assert `warmth(--map-land) > 0`, which is what an earlier draft
 * of this test did and which is false on a correct implementation: light `--map-land` is
 * `--province-fill` white (#ffffff), so r - b = 0 — achromatic BY DESIGN, not an oversight.
 * Light mode's warm/cool split is carried entirely by the sea being cool against an achromatic
 * land, not by the land itself having a hue; "warm land" only becomes literally true once dark
 * mode gives land an actual chroma. What holds in BOTH themes, and is what these assertions
 * check instead, is the relationship: land reads warmer than its own sea (never the weaker,
 * wrong claim that land itself must be on the warm side of neutral), and sea is unambiguously
 * on the cool side of neutral in both themes, on its own.
 *
 * Measured: light land 0, light sea -13 (1.26:1 apart, matching the ratio note above); dark
 * land +8, dark sea -19.
 */
describe("land is warm and sea is cool, in both themes", () => {
  const warmth = (hex: string): number => {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return r - b;
  };

  it.each(THEMES)("%s land reads warmer than its own sea", (_theme, _selector, table) => {
    expect(warmth(table["--map-land"])).toBeGreaterThan(warmth(table["--map-sea"]));
  });

  it.each(THEMES)("%s sea is bluer than it is redder", (_theme, _selector, table) => {
    expect(warmth(table["--map-sea"])).toBeLessThan(0);
  });
});

/**
 * Owner direction, 2026-09-17: "koyu masa üzerinde ışıklı harita masası" — the map panel is
 * LIGHTER than the page it sits on, in dark mode. Stated as an ordering rather than a ratio
 * because it is a relationship, not a floor: a figure here would have to be re-picked every
 * time `--background` moves.
 */
describe("the dark map panel is lighter than the page under it", () => {
  it("--map-plate is lighter than --background and than --card", () => {
    const dark = tokensIn(CSS, ".dark {");
    expect(ratio(MAP_SURFACES.dark["--map-plate"], dark["--background"]!)).toBeGreaterThan(1);
    expect(ratio(MAP_SURFACES.dark["--map-plate"], dark["--card"]!)).toBeGreaterThan(1);
  });
});

/**
 * The world map is dark in BOTH themes and its ocean was a three-stop gradient, which
 * `globals.css:113` forbids by name: a gradient makes every continent's contrast
 * latitude-dependent. Measured on the gradient it replaces, Avrupa ran 2.33 / 1.44 / 2.77 top
 * to bottom. Flat, at the full-strength fill Task 9 switches the continents to, the worst case
 * is Avrupa at 3.35:1 and it holds at every point on the map.
 */
describe("the world map's flat ocean", () => {
  const CONTINENTS = {
    avrupa: "#0072b2",
    asya: "#e69f00",
    afrika: "#009e73",
    "kuzey-amerika": "#56b4e9",
    "guney-amerika": "#d55e00",
    okyanusya: "#cc79a7",
    antarktika: "#f0e442",
  } as const;

  it.each(THEMES)("clears 3:1 against every continent fill in %s", (theme, _s, table) => {
    for (const [name, fill] of Object.entries(CONTINENTS)) {
      expect(
        ratio(fill, table["--map-ocean"]),
        `${name} on the ${theme} ocean`,
      ).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    }
  });

  it.each(THEMES)(
    "clears 3:1 for the graticule and for land with no continent in %s",
    (_t, _s, table) => {
      expect(ratio(table["--map-graticule"], table["--map-ocean"])).toBeGreaterThanOrEqual(
        GRAPHICAL_MIN,
      );
      expect(ratio(table["--map-unknown-land"], table["--map-ocean"])).toBeGreaterThanOrEqual(
        GRAPHICAL_MIN,
      );
    },
  );
});
