import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveVars, tokensIn } from "@/lib/test-support/css-tokens";
import { blendOver, GRAPHICAL_MIN, ratio, relativeLuminance, TEXT_MIN } from "./contrast";
import { MAP_SURFACES } from "@/test/fixtures/theme/map-surfaces";

/**
 * `MAP_SURFACES` — the table these tests measure — lives in
 * `test/fixtures/theme/map-surfaces.ts`, not in this file. It was declared and exported from
 * THIS file until `region-palette.test.ts` and `continent-palette.test.ts` needed to import it
 * too: a `.test.ts` import executes the module, so importing this file for its export re-ran
 * its 21 cases inside every importer (and inside every file that transitively imports one of
 * THOSE for `REGION_TINTS`/`CONTINENT_TINTS`) — the suite went from 5804 to 6008 tests for a
 * five-case change. Moving it to a plain module under `lib/theme/` fixed that but tripped a
 * second guard, `components/ui/raw-palette-count.test.ts`, which reads any non-test `.ts` file
 * under `lib/` for literal colour values — so it now lives under `test/fixtures/`, outside
 * every root either guard walks. See `test/fixtures/theme/map-surfaces.ts`'s own docblock for
 * the full incident (both halves) and the rule it leaves for the next shared table. Every
 * assertion below is unchanged; only where the table is declared moved.
 */

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
 * - `--map-artifact-sea` is the FROZEN GROUND under the locator figure, not a themed surface.
 *   It transcribes ink `lib/map/base-map-svg.ts` bakes into an isolated `<img>` SVG that cannot
 *   read this stylesheet, so it is declared in `:root` and deliberately NOT in `.dark`. Demanding
 *   it in `MAP_SURFACES` would demand a dark value — the exact thing that must never exist, and
 *   whose accidental arrival on `--map-sea` is what broke the locator frame in the first place.
 *   `components/map/locator-map-floors.test.ts` owns the assertion that `.dark` stays silent
 *   about it; this entry only keeps the surface filter from asking for the opposite.
 */
const NOT_A_SURFACE: ReadonlySet<string> = new Set([
  "--map-artifact-sea",
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

/**
 * `--province-stroke`, which `.dark` deliberately does not redefine — ONE coastline tone for
 * both themes is this branch's headline decision, and every coastline figure below is measured
 * on this literal.
 *
 * It is a free literal here, which is exactly the exposure `the coastline tone is one tone` (the
 * block after the tables) closes: transcribed from `:root` and asserted against it, and `.dark`
 * asserted silent about both `--province-stroke` and the `--color-taupe` it aliases. Without
 * that, a `.dark` override would paint a different coastline with all four assertions above
 * still green, because they measure this string rather than the stylesheet.
 */
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
 * THE DECISION THE FOUR COASTLINE ASSERTIONS ABOVE REST ON, asserted instead of assumed.
 *
 * T-031d's headline ruling is that `--province-stroke` stays ONE tone across both themes: it
 * measures 4.38:1 on the dark `--map-land` and 4.21:1 on the dark `--map-sea`, so a dark half
 * would buy nothing and would split the coastline across two values that could drift. Nothing
 * held that ruling. `PROVINCE_STROKE` above is a free literal, so a `.dark { --province-stroke:
 * … }` — or a `.dark` override of the `--color-taupe` it aliases, which reaches it just as
 * surely — would repaint every coastline in dark mode with all four assertions above still
 * green, because they measure the string, not the stylesheet.
 *
 * Two halves, and both are needed. The ABSENCE assertion says the decision still holds. The
 * TRANSCRIPTION assertion says the literal is still the value the decision is about, so a retune
 * of `--color-taupe` in `:root` cannot leave this file quietly measuring a colour the site no
 * longer draws. `region-palette.test.ts` carries the same pair for its own free literal,
 * `--game-hover-edge`.
 */
describe("the coastline tone is one tone, and this file transcribes it correctly", () => {
  const root = resolveVars(tokensIn(CSS, ":root"));
  const dark = tokensIn(CSS, ".dark {");

  it("positive control — both blocks parsed", () => {
    expect(root["--map-sea"], ":root declares --map-sea").toBeDefined();
    expect(dark["--map-sea"], ".dark declares --map-sea").toBeDefined();
  });

  it("PROVINCE_STROKE is the :root value it transcribes, resolved through --color-taupe", () => {
    expect(root["--color-taupe"]).toBe(PROVINCE_STROKE);
    // One `resolveVars` hop: `--province-stroke: var(--color-taupe)`.
    expect(root["--province-stroke"]).toBe(PROVINCE_STROKE);
  });

  it.each(["--province-stroke", "--color-taupe"] as const)(
    ".dark declares no %s — the coastline is one tone in both themes",
    (token) => {
      expect(
        Object.keys(dark),
        `${token} must not be redefined in .dark; see this block's docblock before changing it`,
      ).not.toContain(token);
    },
  );
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
      "--map-artifact-sea": "#dbe7e8",
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
 *
 * MEASURED IN LUMINANCE, NOT IN `ratio`, and that is the correction this block needed. `ratio`
 * is symmetric and never below 1, so `ratio(plate, background) > 1` is true of EVERY plate
 * colour except one exactly equal to the background — a pure black plate satisfies it at 1.13,
 * which is the opposite of what the heading claims. `relativeLuminance` is signed by
 * construction, so comparing it is the only way this asserts the direction it names.
 *
 * Measured on the shipped values: L 0.014567 plate · 0.011670 card · 0.006294 background.
 */
describe("the dark map panel is lighter than the page under it", () => {
  it("--map-plate is lighter than --background and than --card", () => {
    const dark = tokensIn(CSS, ".dark {");
    const plate = relativeLuminance(MAP_SURFACES.dark["--map-plate"]);
    expect(plate).toBeGreaterThan(relativeLuminance(dark["--background"]!));
    expect(plate).toBeGreaterThan(relativeLuminance(dark["--card"]!));
  });

  /**
   * The negative control for the instrument, not for the palette: a black plate is what the old
   * `ratio`-based assertion accepted. Kept so the reason this block reads luminance survives the
   * next person who finds `ratio` more familiar.
   */
  it("POSITIVE CONTROL — a black plate would fail this, where the old ratio test passed it", () => {
    const dark = tokensIn(CSS, ".dark {");
    expect(relativeLuminance("#000000")).toBeLessThan(relativeLuminance(dark["--background"]!));
    expect(ratio("#000000", dark["--background"]!)).toBeGreaterThan(1);
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

  /**
   * The hover/selected highlight. `--map-graticule` (above) clears `GRAPHICAL_MIN` too but sits
   * INSIDE the continent fills' own contrast range against `--map-ocean`, near the BOTTOM of it
   * (4.03/4.49 against a 3.35-13.15 / 3.74-14.65 range) — only Avrupa is dimmer — which is why a
   * hovered country read as a de-emphasised member of the palette rather than one that outshouts
   * it (T-031d Task 10 fix round 1). `--map-hover` moves that to near the TOP of the range, but
   * not cleanly past every member of it, and this test says exactly where the honest line is
   * rather than a blanket "outshouts everything":
   *
   *   - at FULL strength (the value itself), it clears every continent but Antarktika's
   *     outlier: 8.38 light / 9.33 dark against a worst-ordinary-continent (Asya) of
   *     7.72 / 8.60.
   *   - at the `/90` alpha the fill actually renders at (`blendOver`, not a bare `ratio`), it
   *     drops to 7.00 light / 7.71 dark — ABOVE four of the six ORDINARY continents (Avrupa,
   *     Afrika, Güney Amerika, Okyanusya) but slightly BELOW Asya's and Kuzey Amerika's own
   *     full-strength values (7.72/7.54 light, 8.60/8.39 dark). That gap is real and this
   *     suite does not paper over it with a false
   *     assertion; the picked-out read a hovered country gets is carried partly by this margin
   *     and partly by hue (a warm salmon against every continent's Okabe-Ito hue), which no
   *     luminance ratio measures. Confirmed on screen at all three latitudes, both themes, in
   *     the Task 10 fix-round-2 report.
   *
   * ONE token, not a light/dark pair: /dunya is dark in both themes, so the highlight has only
   * ever one ground, and a theme-aware "state" token (`--primary-strong`, tried in fix round 1)
   * splits exactly because its light value is calibrated as text on a LIGHT surface, not for a
   * permanently dark one.
   */
  it.each(THEMES)(
    "the hover highlight clears 3:1, and full strength outshouts every ordinary continent, in %s",
    (theme, _s, table) => {
      const ocean = table["--map-ocean"];
      const full = ratio(table["--map-hover"], ocean);
      const rendered = ratio(blendOver(table["--map-hover"], 0.9, ocean), ocean);
      expect(full, `${theme} full-strength`).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
      expect(rendered, `${theme} at the shipped /90`).toBeGreaterThanOrEqual(GRAPHICAL_MIN);

      const ordinary = Object.entries(CONTINENTS).filter(([name]) => name !== "antarktika");
      const worstOrdinary = Math.max(...ordinary.map(([, fill]) => ratio(fill, ocean)));
      // TRUE at full strength...
      expect(full, `${theme} full vs the brightest ordinary continent`).toBeGreaterThan(
        worstOrdinary,
      );
      // ...but NOT at the rendered /90 — asserted explicitly rather than left unstated, so a
      // future change that quietly makes this pass does not read as a coincidence nobody checked.
      expect(rendered, `${theme} rendered /90 vs the brightest ordinary continent`).toBeLessThan(
        worstOrdinary,
      );
      // Still clears every ORDINARY continent except the top two (Asya, Kuzey Amerika) at the
      // rendered alpha — four of six, not zero of six.
      const clearedAtRendered = ordinary.filter(([, fill]) => rendered > ratio(fill, ocean));
      expect(clearedAtRendered.length, `${theme} continents cleared at /90`).toBe(4);
    },
  );
});
