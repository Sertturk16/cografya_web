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
 * ELEVEN, not ten, as of review round 1: `--map-water` joins the table. It shipped before
 * this file did (`--map-water: var(--map-sea)`, inland water on the Türkiye map) and was
 * always a real surface — the original oversight was leaving it out of `MAP_SURFACES` while
 * the `matches app/globals.css` test filtered `shipped` down to `name in table`, so a real
 * `--map-*` token nobody had written down here could never make that test fail either way.
 * See `NOT_A_SURFACE` and `mapSurfacesIn` below for the prefix-based filter that replaced it
 * and now needs `--map-water` accounted for on purpose. It resolves to the sea in both
 * themes, so its value here is the same as `--map-sea`'s, per theme.
 *
 * TWELVE, THEN BACK TO ELEVEN, as of review round 2: `--map-tectonic` lived here for one
 * round and was removed again. It was meant to cover the earthquake explorer's
 * `fill-[#537b93] dark:fill-[#5a86a0]` sea-basin fill as "a real third surface, neither land
 * nor water", measured with `ratio` against `--map-sea` at 3.59:1 light / 4.14:1 dark — both
 * clearing `GRAPHICAL_MIN`. The review that produced those figures never opened the
 * component: the element is `<text>` (sea-name labels), so its floor is `TEXT_MIN` (4.5:1),
 * not `GRAPHICAL_MIN`; and it carries `opacity-60`, so its RENDERED contrast — the fill
 * blended over `--map-sea` at 60%, not the undiluted fill this table measured — is 2.03:1
 * light / 2.35:1 dark, clearing neither floor. The token documented a surface the app does
 * not have, so it came back out; the actual defect (a label at 60% opacity with no floor of
 * its own) is fixed on the component, in Task 7, not carried by a token here.
 *
 * BINDING NOTE FOR TASK 3: `.dark` must declare `--map-water` explicitly (as
 * `var(--map-sea)`, the same alias `:root` already carries), not leave it to inherit from
 * `:root`. Same decision the plan already records for `--map-graticule` and
 * `--map-unknown-land` (both identical across themes, both still declared in `.dark`): a
 * token missing from a block reads as either "unchanged from light" or "forgotten", and
 * nothing here can tell those apart except declaring it.
 */
export const MAP_SURFACES = {
  light: {
    "--map-plate": "#dbe7e8",
    "--map-sea": "#dbe7e8",
    "--map-water": "#dbe7e8",
    "--map-land": "#ffffff",
    "--map-context-land": "#f1ece3",
    "--map-context-line": "#8a8078",
    "--map-water-line": "#002337",
    "--map-label": "#635a4e",
    "--map-ocean": "#0d1b2a",
    "--map-graticule": "#4d7ea8",
    "--map-unknown-land": "#64748b",
  },
  dark: {
    "--map-plate": "#152228",
    "--map-sea": "#152228",
    "--map-water": "#152228",
    "--map-land": "#201c18",
    "--map-context-land": "#2d2822",
    "--map-context-line": "#7d7468",
    "--map-water-line": "#5d8fb8",
    "--map-label": "#a89e92",
    "--map-ocean": "#070e17",
    "--map-graticule": "#4d7ea8",
    "--map-unknown-land": "#64748b",
  },
} as const;

/**
 * `--map-*` tokens that are declared in `app/globals.css` but are not painted surfaces, so
 * they have no floor in this file and must not be demanded of `MAP_SURFACES`.
 *
 * Named and exhaustive on purpose. Review round 1 found that the original "matches
 * app/globals.css exactly, both directions" test filtered `shipped` to `name in table` —
 * which drops any `--map-*` token this file never wrote down BEFORE the comparison runs, so
 * a stray or renamed token could never fail it in either direction despite the test's own
 * name. The fix is a prefix filter (every `--map-*` token) with this named exclusion list
 * subtracted, so an unlisted extra has nowhere to hide: it either belongs in `MAP_SURFACES`
 * or belongs here, explicitly, with a reason.
 *
 * - `--map-hover-width` is a stroke WIDTH (3.5px), not a colour — nothing to contrast-check.
 * - `--map-1` … `--map-6` are the ordered choropleth ramp, a DATA encoding (province density
 *   buckets), not a static surface. It has its own measurement elsewhere; folding it in here
 *   would test the same six colours against floors this file's surfaces don't share (a
 *   sequential ramp's job is to be perceptually ordered, not to clear a fixed contrast ratio
 *   against a single background).
 */
const NOT_A_SURFACE: ReadonlySet<string> = new Set([
  "--map-hover-width",
  "--map-1",
  "--map-2",
  "--map-3",
  "--map-4",
  "--map-5",
  "--map-6",
]);

/**
 * Every `--map-*` token in a block that IS a painted surface: the prefix, minus
 * `NOT_A_SURFACE`. Shared by the real `app/globals.css` comparison and by the "catches a
 * stray token" tests below, so both exercise the exact same filter rather than two
 * independently written copies that could drift apart from each other.
 */
function mapSurfacesIn(tokens: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokens).filter(
      ([name]) => name.startsWith("--map-") && !NOT_A_SURFACE.has(name),
    ),
  );
}

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
    const mapOnly = mapSurfacesIn(shipped);
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
});

/**
 * Proves the hole review round 1 found is actually closed: a `--map-*` token this file never
 * wrote down must fail the comparison, not be silently dropped before it runs. Constructed
 * with a mock token map — `app/globals.css` is not touched to prove this, since the whole
 * point is that the filter, not the stylesheet, was the bug.
 */
describe("the surface filter is genuinely bidirectional", () => {
  it("a stray, unexcluded --map-* token makes the filtered set disagree with the table", () => {
    const shipped = { ...MAP_SURFACES.light, "--map-stray": "#123456" };
    const mapOnly = mapSurfacesIn(shipped);
    // The old bug: filtering by `name in table` would have dropped --map-stray right here,
    // leaving mapOnly === MAP_SURFACES.light and the assertion below passing when it must not.
    expect(mapOnly).not.toEqual(MAP_SURFACES.light);
    expect(mapOnly).toHaveProperty("--map-stray", "#123456");
  });

  it("the excluded non-surface tokens never get mistaken for a missing or stray surface", () => {
    const shipped = {
      ...MAP_SURFACES.light,
      "--map-hover-width": "3.5px",
      "--map-1": "#e8efce",
      "--map-6": "#6e3a1c",
    };
    // Real, declared --map-* tokens that are excluded by name must vanish from the filtered
    // set, landing exactly back on the table — the positive control for NOT_A_SURFACE.
    expect(mapSurfacesIn(shipped)).toEqual(MAP_SURFACES.light);
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
