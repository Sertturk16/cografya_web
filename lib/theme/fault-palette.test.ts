import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";
import { blendOver, ratio, TEXT_MIN } from "./contrast";
import { CATEGORICAL_MIN, deltaE00 } from "./delta-e";
import { simulate, VISIONS, type Vision } from "./cvd";
import { REGION_TINTS } from "./region-palette.test";
import { CONTINENT_TINTS } from "./continent-palette.test";
import { SST_BANDS } from "./sst-band-palette.test";

/**
 * The three `--fault-*` fills exactly as `app/globals.css` defines them.
 *
 * Duplicated here rather than parsed out of the stylesheet, for the same reason the region,
 * continent and basin palette tests duplicate theirs: this is the set the assertions below are
 * ABOUT, so a change to `app/globals.css` should make this file disagree loudly rather than
 * quietly re-measure whatever it now says. The loud disagreement is the
 * `matches --fault-* in app/globals.css` test below, which parses the stylesheet independently
 * and compares it against this table in both directions.
 *
 * Unlike the basin set, NONE of these moved: the hues four files already agreed on pass on
 * measurement, so the shipped identity is the shipped identity. `the shipped set needed no
 * member to move` below is what keeps that a figure rather than a claim.
 */
export const FAULT_TINTS: Readonly<Record<string, string>> = {
  kaf: "#e7000b",
  daf: "#155dfc",
  bafs: "#009966",
};

const PAIRS: readonly (readonly [string, string])[] = Object.keys(FAULT_TINTS).flatMap(
  (a, i, all) => all.slice(i + 1).map((b) => [a, b] as const),
);

/** Worst pair per vision, measured 2026-09-19 on the set authored above. */
const WORST: Readonly<Record<Vision, number>> = {
  normal: 48.5,
  protanopia: 23.1,
  deuteranopia: 17.2,
  tritanopia: 16.5,
};

/**
 * The pair that binds each `WORST` figure, in `PAIRS` order (the order `Object.keys` yields on
 * `FAULT_TINTS`, so the first name in each pair is always the one that appears first there).
 */
const WORST_PAIR: Readonly<Record<Vision, readonly [string, string]>> = {
  normal: ["kaf", "daf"],
  protanopia: ["kaf", "bafs"],
  deuteranopia: ["kaf", "bafs"],
  tritanopia: ["daf", "bafs"],
};

/**
 * What the three fault zones wore before T-031c, taken from the `-600` shade of the families
 * `lib/earthquake/fault-lines-data.ts` and both `/deprem` routes spelled.
 *
 * Identical to `FAULT_TINTS`, and that identity is the POINT: it is asserted below rather than
 * left implicit, so "the binding restyled the fault zones" is answerable with a comparison.
 */
const SHIPPED_BEFORE: Readonly<Record<string, string>> = {
  kaf: "#e7000b", // red-600
  daf: "#155dfc", // blue-600
  bafs: "#009966", // emerald-600
};

describe("the three fault fills are a usable categorical set", () => {
  it("has 3 pairs — the whole set is compared, not a sample", () => {
    expect(PAIRS).toHaveLength(3);
  });

  it("matches --fault-* in app/globals.css exactly, both directions", () => {
    // Comments stripped before parsing, and that is load-bearing rather than defensive: the
    // block above these declarations discusses the shipped hues in prose, and an un-stripped
    // parse could be satisfied by a sentence instead of a declaration.
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const shipped: Record<string, string> = {};
    for (const match of css.matchAll(/--fault-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      shipped[match[1]!] = match[2]!.toLowerCase();
    }
    // A CSS change that renamed or dropped every fault would make this an empty-vs-empty pass
    // below, so it is checked separately first.
    expect(shipped, "app/globals.css declares no --fault-* custom properties").not.toEqual({});
    // The `-tint` and `-text` members are NOT hex, so the regex above cannot pick them up and
    // this stays an exact both-ways comparison of the three base fills: an added, removed or
    // renamed fault changes the key set, a changed value changes a value.
    expect(shipped).toEqual(FAULT_TINTS);
  });

  it.each(VISIONS)("holds the categorical floor under %s", (vision) => {
    for (const [a, b] of PAIRS) {
      const seen = deltaE00(simulate(FAULT_TINTS[a]!, vision), simulate(FAULT_TINTS[b]!, vision));
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
      const seen = deltaE00(simulate(FAULT_TINTS[a]!, vision), simulate(FAULT_TINTS[b]!, vision));
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
    // The same positive control the other three palette tests carry, and it matters MORE here,
    // not less: three members give only three pairs, so this is the easiest of the four sets to
    // pass by accident. The first half says the pair is a fair test rather than two colours that
    // were never distinguishable; the second is what a no-op `simulate` would break.
    expect(
      deltaE00(simulate("#008000", "normal"), simulate("#a52a2a", "normal")),
    ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
    expect(
      deltaE00(simulate("#008000", "deuteranopia"), simulate("#a52a2a", "deuteranopia")),
    ).toBeLessThan(CATEGORICAL_MIN);
  });
});

/**
 * The basin set had to move two members. This one moved none, and that is a measurement.
 *
 * The distinction is worth a test of its own because the two tasks look identical from the
 * outside — four files agreeing on a hue set, consolidated into tokens — and reached opposite
 * conclusions. If a later reader assumes "T-031c retunes the palette it touches" and nudges one
 * of these three, this is what says the shipped values were checked and kept.
 */
describe("the shipped set needed no member to move", () => {
  it.each(Object.keys(FAULT_TINTS))("%s is the value that shipped", (slug) => {
    expect(
      FAULT_TINTS[slug],
      `--fault-${slug} is no longer the hue this product shipped; a geophysical classification ` +
        `is bound, not restyled`,
    ).toBe(SHIPPED_BEFORE[slug]);
  });

  it.each(VISIONS)("the shipped set already cleared the floor under %s", (vision) => {
    // The other half of the claim. "Nothing moved" is only defensible if the thing that did not
    // move passes — otherwise it is an omission wearing a measurement's clothes.
    for (const [a, b] of PAIRS) {
      const seen = deltaE00(
        simulate(SHIPPED_BEFORE[a]!, vision),
        simulate(SHIPPED_BEFORE[b]!, vision),
      );
      expect(
        seen,
        `the shipped ${a} / ${b} measured ${seen} under ${vision}, floor is ${CATEGORICAL_MIN}`,
      ).toBeGreaterThanOrEqual(CATEGORICAL_MIN);
    }
  });
});

/**
 * Two cross-set neighbours, measured and deliberately left alone.
 *
 * `--fault-daf` IS `--sst-band-cool` — the same value, not merely a close one — and
 * `--fault-bafs` sits 2.9 from `--region-dogu-anadolu`. Both would be disqualifying if the sets
 * could share a screen. Neither can: the fault set paints only `/deprem` and
 * `/deprem/fay-hatlari`, the SST bands paint only `/deniz`, and `/deprem`'s map fills provinces
 * `fill-card/90` rather than from any region or continent token.
 *
 * Pinned rather than fixed, and pinned in BOTH directions — the value equality and the ΔE00 —
 * so a page that later renders two of these sets together has to walk past a failing test with
 * `app/globals.css`'s reasoning in front of it, instead of rediscovering the collision on a
 * screenshot.
 */
describe("the fault set's cross-set neighbours are recorded, not discovered later", () => {
  it("shares exactly one value with --sst-band-*, and it is daf/cool", () => {
    const bandValues = new Map(Object.entries(SST_BANDS).map(([k, v]) => [v, k]));
    const shared = Object.entries(FAULT_TINTS)
      .filter(([, value]) => bandValues.has(value))
      .map(([slug, value]) => `${slug}=${bandValues.get(value)}`);
    expect(
      shared,
      `the recorded collision is daf/cool alone. A NEW one means a second fault hue now equals ` +
        `an SST band, which needs the same screen-sharing argument app/globals.css makes`,
    ).toEqual(["daf=cool"]);
    expect(deltaE00(FAULT_TINTS.daf!, SST_BANDS.cool!), "daf and cool are one value").toBe(0);
  });

  it("shares no VALUE with --region-* or --continent-*, though it sits close to one", () => {
    // Weaker than the basin claim, because these sets genuinely never meet — but `--continent-*`
    // IS `--region-*` re-assigned, so both halves are asserted or a shared value could hide in
    // whichever half went unchecked.
    const okabeIto = new Set([...Object.values(REGION_TINTS), ...Object.values(CONTINENT_TINTS)]);
    for (const [slug, value] of Object.entries(FAULT_TINTS)) {
      expect(
        okabeIto.has(value),
        `--fault-${slug} is ${value}, which is also a --region-* / --continent-* value`,
      ).toBe(false);
    }
  });

  it("records how close bafs sits to the bluish-green those two sets share", () => {
    // 2.9 to normal vision. Not fixed: `--fault-bafs` clears its own categorical floor, cross-set
    // ΔE00 is not the bar, and moving a member of a standard classification to tidy a collision
    // that cannot be painted is restyling. If this figure MOVES — better or worse — the reasoning
    // in app/globals.css gets re-read rather than assumed.
    expect(deltaE00(FAULT_TINTS.bafs!, REGION_TINTS["dogu-anadolu"]!)).toBe(2.9);
  });
});

/**
 * The `-text` figures in `app/globals.css`, re-derived rather than trusted.
 *
 * The other three data sets leave their tables to painted pixels, because a hero blur sits over
 * two of them and a Gaussian blur is not a blend any analytic model expresses. Nothing blurs a
 * fault label: every backdrop below is a plain alpha composite of tokens this file can read, so
 * the table IS checkable and is checked. Painted-pixel verification still ran (the task report
 * carries it); this is the half that runs in CI.
 *
 * EVERY RATIO NAMES ITS BACKDROP. Three failures on this programme came from a figure measured
 * against a surface the page never paints, and "the card" is the surface a careless table
 * reaches for — here it is `TILE`, the most flattering of the five and the one that binds
 * nothing.
 */
describe("every --fault-*-text figure app/globals.css records is the figure", () => {
  /** The opaque surfaces the two routes actually paint, per theme. */
  const SURFACE = {
    light: { card: "#ffffff", background: "#fbf8f3", muted: "#f1e9de" },
    dark: { card: "#121e21", background: "#0b1416", muted: "#1b2b2f" },
  } as const;

  const TEXT = {
    light: {
      kaf: "oklch(0.5 0.11 27.325)",
      daf: "oklch(0.5 0.11 262.881)",
      bafs: "oklch(0.49 0.11 163.225)",
    },
    dark: {
      kaf: "oklch(0.65 0.13 27.325)",
      daf: "oklch(0.65 0.13 262.881)",
      bafs: "oklch(0.65 0.13 163.225)",
    },
  } as const;

  /**
   * The five named backdrops, built the way the markup stacks them.
   *
   * `DECK` and `CHIP` are measured at BOTH ends of the `/deprem` section gradient
   * (`from-card via-card to-muted/20`) because a gradient has no single backdrop and the three
   * fault cards sit at its lower end — which is where the light-theme worst case lives.
   */
  function backdrops(theme: "light" | "dark", fill: string): Record<string, string> {
    const t = SURFACE[theme];
    const gradientTop = t.card;
    const gradientBottom = blendOver(t.muted, 0.2, t.background);
    return {
      TILE: t.card,
      BADGE: blendOver(fill, 0.15, t.card),
      PANEL: blendOver(t.muted, 0.2, t.card),
      DECK_TOP: blendOver(fill, 0.05, gradientTop),
      DECK_BOTTOM: blendOver(fill, 0.05, gradientBottom),
      CHIP_TOP: blendOver(fill, 0.1, blendOver(fill, 0.05, gradientTop)),
      CHIP_BOTTOM: blendOver(fill, 0.1, blendOver(fill, 0.05, gradientBottom)),
    };
  }

  /** `app/globals.css`'s own tables, transcribed. `ratio()` already returns 2dp. */
  const RECORDED = {
    light: {
      kaf: {
        TILE: 6.35,
        BADGE: 4.85,
        PANEL: 6.13,
        DECK_TOP: 5.81,
        DECK_BOTTOM: 5.37,
        CHIP_TOP: 4.9,
        CHIP_BOTTOM: 4.54,
      },
      daf: {
        TILE: 6.08,
        BADGE: 4.89,
        PANEL: 5.87,
        DECK_TOP: 5.66,
        DECK_BOTTOM: 5.21,
        CHIP_TOP: 4.94,
        CHIP_BOTTOM: 4.56,
      },
      bafs: {
        TILE: 5.9,
        BADGE: 4.93,
        PANEL: 5.7,
        DECK_TOP: 5.56,
        DECK_BOTTOM: 5.12,
        CHIP_TOP: 4.95,
        CHIP_BOTTOM: 4.57,
      },
    },
    dark: {
      kaf: {
        TILE: 4.97,
        BADGE: 4.71,
        PANEL: 4.82,
        DECK_TOP: 4.91,
        DECK_BOTTOM: 5.17,
        CHIP_TOP: 4.73,
        CHIP_BOTTOM: 4.93,
      },
      daf: {
        TILE: 5.19,
        BADGE: 4.59,
        PANEL: 5.03,
        DECK_TOP: 5.01,
        DECK_BOTTOM: 5.28,
        CHIP_TOP: 4.6,
        CHIP_BOTTOM: 4.84,
      },
      bafs: {
        TILE: 5.58,
        BADGE: 4.65,
        PANEL: 5.4,
        DECK_TOP: 5.28,
        DECK_BOTTOM: 5.58,
        CHIP_TOP: 4.65,
        CHIP_BOTTOM: 4.95,
      },
    },
  } as const;

  const THEMES = ["light", "dark"] as const;

  it.each(THEMES)(
    "%s: every fault clears 4.5 on every backdrop, at the recorded figure",
    (theme) => {
      for (const slug of Object.keys(FAULT_TINTS)) {
        const bds = backdrops(theme, FAULT_TINTS[slug]!);
        // Anti-vacuity: a typo in a backdrop name would otherwise compare an empty set.
        expect(Object.keys(bds)).toHaveLength(7);
        for (const [name, backdrop] of Object.entries(bds)) {
          const seen = ratio(TEXT[theme][slug as "kaf"], backdrop);
          expect(
            seen,
            `--fault-${slug}-text on ${name} (${backdrop}) in ${theme} measured ${seen}, ` +
              `app/globals.css records ${RECORDED[theme][slug as "kaf"][name as "TILE"]}`,
          ).toBe(RECORDED[theme][slug as "kaf"][name as "TILE"]);
          expect(seen, `--fault-${slug}-text on ${name} in ${theme}`).toBeGreaterThanOrEqual(
            TEXT_MIN,
          );
        }
      }
    },
  );

  it("names the backdrop that BINDS in each theme, and they are different ones", () => {
    // Worth an assertion of its own: the light worst is the `/deprem` mechanism chip at the
    // gradient's lower end, the dark worst is the `fay-hatlari` article badge. Neither theme's
    // binding case could have been inferred from the other's, and neither is `--card`.
    const worstOf = (theme: "light" | "dark") => {
      let best = { value: Number.POSITIVE_INFINITY, name: "" };
      for (const slug of Object.keys(FAULT_TINTS)) {
        for (const [name, backdrop] of Object.entries(backdrops(theme, FAULT_TINTS[slug]!))) {
          const seen = ratio(TEXT[theme][slug as "kaf"], backdrop);
          if (seen < best.value) best = { value: seen, name: `${slug}/${name}` };
        }
      }
      return best;
    };
    expect(worstOf("light")).toEqual({ value: 4.54, name: "kaf/CHIP_BOTTOM" });
    expect(worstOf("dark")).toEqual({ value: 4.59, name: "daf/BADGE" });
  });

  it.each(Object.keys(FAULT_TINTS))(
    "%s declares both derived members in app/globals.css",
    (slug) => {
      const css = stripCssComments(
        readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
      );
      expect(css).toContain(`--fault-${slug}-tint:`);
      expect(
        css.match(new RegExp(`--fault-${slug}-text:`, "g")) ?? [],
        `--fault-${slug}-text must be declared twice: once in :root and once in .dark`,
      ).toHaveLength(2);
      // The tint is translucent and composites over whichever surface it lands on, so it must NOT
      // be re-declared for dark — a second declaration would double-apply the theme.
      expect(
        css.match(new RegExp(`--fault-${slug}-tint:`, "g")) ?? [],
        `--fault-${slug}-tint is translucent; a .dark re-declaration would be a second opinion`,
      ).toHaveLength(1);
    },
  );
});
