import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tokensIn } from "@/lib/test-support/css-tokens";
import { stripComments } from "@/lib/test-support/strip-comments";
import { MAP_SURFACES } from "@/test/fixtures/theme/map-surfaces";
import { GRAPHICAL_MIN, ratio, relativeLuminance, TEXT_MIN } from "./contrast";
import { MAGNITUDE_LABEL, MAGNITUDE_RING } from "./magnitude-identity";

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
 * THE THREE LABEL CONSUMERS BIND TO `--eq-mag-fg`, NOT A BARE ACHROMATIC.
 *
 * Neither arm of the palette count can see any of these swaps: `text-white`/`fill="#ffffff"`
 * are not raw palette classes (`raw-palette-count.test.ts` only scans the Tailwind colour
 * families and bracketed arbitrary values, never a bare SVG presentation attribute), and
 * `text-[var(--eq-mag-fg)]`/`fill-[var(--eq-mag-fg)]` are token references, not values, so
 * nothing that greps for a hex or a named hue trips on either direction of any of these
 * changes. This file is where the ramp and its one shared foreground are asserted correct — it
 * is also the right place to assert that the three places painting a label ON that ramp (two
 * Tailwind classes, one SVG `fill` attribute) actually reach for the foreground this file
 * measures, rather than a hard-coded white that silently stopped being safe when Task 12 turned
 * the ramp around under `.dark`.
 *
 * The third — the on-disc magnitude number, `v2-earthquake-explorer.tsx`'s SVG `<text
 * fill="#ffffff">` shown for `eq.magnitude >= 3.5` — is the same defect as the badge, one
 * element over: white measured 3.51 / 2.76 / 2.19 / 1.71 / 1.34 against the dark ramp's five
 * steps, under `TEXT_MIN` on every step and worst at magnitude 6+, the exact case the ramp
 * inversion exists to make prominent. `fill="#ffffff"` is an SVG *presentation attribute*, not
 * a class — a class cannot override it, so the attribute itself had to be deleted, not shadowed
 * (the same reason Task 10 deleted `fill="url(#ocean-gradient)")` rather than layer a class over
 * it) — which is why the assertion below checks for the attribute's absence, not merely the
 * class's presence.
 */
describe("the ramp's three label consumers read --eq-mag-fg, not a bare white", () => {
  const read = (rel: string): string =>
    stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

  it("magnitude-identity.ts's five badge entries all carry the token", () => {
    const source = read("./magnitude-identity.ts");
    expect(source.match(/text-\[var\(--eq-mag-fg\)\]/g)).toHaveLength(5);
    expect(source).not.toMatch(/text-white\b/);
  });

  it("magnitude-badge.tsx's BADGE constant carries the token", () => {
    const source = read("../../components/earthquake/magnitude-badge.tsx");
    expect(source).toContain("text-[var(--eq-mag-fg)]");
    expect(source).not.toMatch(/text-white\b/);
  });

  it("MAGNITUDE_LABEL is --eq-mag-fg, as a fill class — the same token as MAGNITUDE_RING, a different property", () => {
    expect(MAGNITUDE_LABEL).toBe("fill-[var(--eq-mag-fg)]");
  });

  it("the explorer's on-disc magnitude number carries MAGNITUDE_LABEL, with no bare fill attribute left", () => {
    const source = stripComments(
      readFileSync(
        fileURLToPath(new URL("../../components/v2/v2-earthquake-explorer.tsx", import.meta.url)),
        "utf8",
      ),
    );
    expect(source).toContain("MAGNITUDE_LABEL");
    // The presentation attribute, not just the achromatic: `fill="#ffffff"` (or any bare hex
    // fill) must be gone, since a class cannot shadow it.
    expect(source).not.toMatch(/fill="#[0-9a-fA-F]{3,6}"/);
    expect(source).not.toContain("--eq-mag-");
  });
});

/**
 * THE DISC'S IDENTIFYING RING — RECONSIDERED, AND BOUND TO `--eq-mag-fg`.
 *
 * Task 12 measured `v2-earthquake-explorer.tsx`'s `stroke-white dark:stroke-black` (a plain
 * opaque stroke, no alpha suffix — `ratio` alone measures the rendered pixel) against three
 * grounds at once — `--map-plate`, the dark ramp's darkest step and its lightest step — and
 * proved arithmetically that no single value clears all three: the span from `--map-plate`
 * (lum ~0.0146) to the ramp's lightest step (~0.7358) is wide enough that any colour clearing
 * 3:1 against both ends necessarily fails 3:1 against the darkest step (~0.2495) sitting
 * between them. Those three facts are re-asserted below, unchanged — `blackVsPlateFails`,
 * `blackClearsBothRampEnds`, `whiteClearsPlateAndDarkestStep`, `whiteMissesLightestStep`.
 *
 * TASK 13's QUESTION, tested rather than assumed: does the ring actually need to clear
 * `--map-plate` at all? A disc's boundary has two neighbours — its own fill inside, the plate
 * (or another disc) outside — and the FILL already carries the plate boundary on its own: the
 * ramp clears `GRAPHICAL_MIN` against `--map-plate` in both themes with room to spare (3.71
 * worst in light, 4.64 worst in dark — see the "clears 3:1" test above). That is the same shape
 * Ruling 16 (Task 5/6, this branch) found for inland water: in dark the FILL carries the water
 * body against the region tints it sits on (worst 3.14, 0/7 under), which freed the OUTLINE to
 * suit a different constraint entirely. Here the constraint the ring is actually needed for,
 * once the fill already carries the plate boundary, is separating two OVERLAPPING discs — a
 * ring-against-fill question, not a ring-against-plate one.
 *
 * `--eq-mag-fg` is measured against every one of the five fills in both themes already (the
 * "carries ONE label" test above: 4.69 worst in light, 4.81 worst in dark, both comfortably
 * past `GRAPHICAL_MIN` and even `TEXT_MIN`). A disc's fill is always one of those five, in
 * either theme, regardless of which bucket the disc UNDER it belongs to — so a ring in
 * `--eq-mag-fg` reads against any other disc's fill it might overlap, in both themes, without a
 * new figure. Checked and confirmed here rather than assumed: `--eq-mag-fg` itself fails badly
 * against `--map-plate` and `--card` (`fgFailsAgainstPlate`, `fgFailsAgainstCard`) — it is not
 * a general-purpose achromatic, it is a fill-relative one, which is exactly the role the ring
 * needs and the plate boundary does not.
 *
 * `stroke-[var(--eq-mag-fg)]` replaces `stroke-white dark:stroke-black` in
 * `v2-earthquake-explorer.tsx` — a single binding for a `dark:` pair, using a token that
 * already exists and is already measured for this exact relationship.
 */
describe("the disc's ring: the plate boundary is the fill's job, not the ring's", () => {
  const PLATE_DARK = MAP_SURFACES.dark["--map-plate"];
  const PLATE_LIGHT = MAP_SURFACES.light["--map-plate"];
  const DARKEST_STEP = RAMP.dark[1]; // magnitude < 3 — the darkest fill in the dark ramp
  const LIGHTEST_STEP = RAMP.dark[5]; // magnitude 6+ — the lightest fill, the step that matters

  it("the shipped dark:stroke-black already misses the floor against --map-plate", () => {
    expect(ratio("#000000", PLATE_DARK)).toBeLessThan(GRAPHICAL_MIN);
  });

  it("black clears the floor against both ends of the dark ramp", () => {
    expect(ratio("#000000", DARKEST_STEP)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    expect(ratio("#000000", LIGHTEST_STEP)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it("white clears the floor against --map-plate and the ramp's darkest step", () => {
    expect(ratio("#ffffff", PLATE_DARK)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    expect(ratio("#ffffff", DARKEST_STEP)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
  });

  it("but white misses the floor against the dark ramp's own lightest step", () => {
    expect(ratio("#ffffff", LIGHTEST_STEP)).toBeLessThan(GRAPHICAL_MIN);
  });

  it("the fill already clears the plate boundary on its own, in both themes", () => {
    for (const n of STEPS) {
      expect(ratio(RAMP.light[n], PLATE_LIGHT)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
      expect(ratio(RAMP.dark[n], PLATE_DARK)).toBeGreaterThanOrEqual(GRAPHICAL_MIN);
    }
  });

  it("--eq-mag-fg is fill-relative, not plate-relative — it fails against the plate and the card", () => {
    expect(ratio(RAMP.light.fg, PLATE_LIGHT)).toBeLessThan(GRAPHICAL_MIN);
    expect(ratio(RAMP.dark.fg, PLATE_DARK)).toBeLessThan(GRAPHICAL_MIN);
    expect(ratio(RAMP.light.fg, "#ffffff")).toBeLessThan(GRAPHICAL_MIN);
    expect(ratio(RAMP.dark.fg, "#121e21")).toBeLessThan(GRAPHICAL_MIN);
  });

  it("MAGNITUDE_RING is --eq-mag-fg, as a stroke class", () => {
    expect(MAGNITUDE_RING).toBe("stroke-[var(--eq-mag-fg)]");
  });

  it("the explorer strokes the disc's core circle with MAGNITUDE_RING, not the old dark: pair", () => {
    // `MAGNITUDE_RING`, not the raw token: `components/v2/magnitude-identity.test.ts` asserts
    // the ramp's token names appear in this file nowhere but through `lib/theme/
    // magnitude-identity.ts`, the same rule `mark`/`ripple`/`badge`/`swatch` already follow.
    const source = stripComments(
      readFileSync(
        fileURLToPath(new URL("../../components/v2/v2-earthquake-explorer.tsx", import.meta.url)),
        "utf8",
      ),
    );
    expect(source).toContain("MAGNITUDE_RING");
    expect(source).not.toContain("--eq-mag-");
    expect(source).not.toMatch(/stroke-white\s+dark:stroke-black/);
  });
});
