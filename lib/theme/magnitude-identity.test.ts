import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tokensIn } from "@/lib/test-support/css-tokens";
import { stripComments } from "@/lib/test-support/strip-comments";
import { magnitudeBucket, type MagnitudeBucket } from "@/lib/earthquake/magnitude";
import { ratio } from "./contrast";
import {
  bucketFor,
  MAGNITUDE_BUCKETS,
  MAGNITUDE_IDENTITY,
  magnitudeIdentityOf,
} from "./magnitude-identity";

const CLASS_MEMBERS = ["mark", "ripple", "badge", "swatch"] as const;

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

/** The five `--eq-mag-*` entries a block's own token map declares, keyed by bucket number. */
function eqMagOf(tokens: Readonly<Record<string, string>>): Readonly<Record<number, string>> {
  const out: Record<number, string> = {};
  for (const bucket of [1, 2, 3, 4, 5] as const) {
    const value = tokens[`--eq-mag-${bucket}`];
    if (value !== undefined) out[bucket] = value.toLowerCase();
  }
  return out;
}

/**
 * The five ramp steps as `app/globals.css`'s `:root` declares them, PARSED rather than
 * transcribed, and BLOCK-SCOPED to `:root` rather than read file-wide.
 *
 * The block scoping is the fix, not a stylistic change: this used to run
 * `css.matchAll(/--eq-mag-([1-5]):.../g)` over the WHOLE file, which was safe only as long as
 * `--eq-mag-1`…`-5` were declared exactly once. T-031d Task 12 gave `.dark` its own five, and a
 * file-wide match lets the LATER declaration win for every bucket — `SHIPPED` would silently
 * hold the DARK hexes even where a test means to measure the light theme. That is precisely
 * the failure `lib/test-support/css-tokens.ts`'s `tokensIn`/`blockOf` exist to prevent, and it
 * had shipped here since PR1 without being wired to them.
 */
const SHIPPED: Readonly<Record<number, string>> = eqMagOf(tokensIn(CSS, ":root"));

describe("the magnitude identity table", () => {
  it("covers exactly the five buckets the token set declares", () => {
    expect(MAGNITUDE_BUCKETS).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(MAGNITUDE_IDENTITY).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(MAGNITUDE_BUCKETS)("bucket %i names its own token in every member", (bucket) => {
    for (const member of CLASS_MEMBERS) {
      const value = MAGNITUDE_IDENTITY[bucket][member];
      expect(value, `${bucket}.${member} names no --eq-mag-${bucket}`).toContain(
        `--eq-mag-${bucket}`,
      );
      for (const other of MAGNITUDE_BUCKETS) {
        if (other === bucket) continue;
        expect(
          value.includes(`--eq-mag-${other}`),
          `${bucket}.${member} names --eq-mag-${other} — a step is wearing another step's hue`,
        ).toBe(false);
      }
    }
    expect(MAGNITUDE_IDENTITY[bucket].bucket).toBe(bucket);
  });

  it("paints the epicentre with a fill, never a background — the shipped defect", () => {
    // `bg-*` sets `background-color`, which an SVG `<circle>` does not paint. That is what
    // shipped: every marker on `/deprem` rendered at SVG's default fill, black, while the
    // legend described four colours the map never drew. `mark` must be a `fill-*` class.
    for (const bucket of MAGNITUDE_BUCKETS) {
      expect(MAGNITUDE_IDENTITY[bucket].mark).toMatch(/^fill-\[var\(--eq-mag-[1-5]\)\]$/);
      expect(MAGNITUDE_IDENTITY[bucket].mark.startsWith("bg-")).toBe(false);
      expect(MAGNITUDE_IDENTITY[bucket].ripple).toMatch(/^stroke-\[var\(--eq-mag-[1-5]\)\]$/);
    }
  });

  it("gives the legend swatch the SAME token as the badge, or the legend lies", () => {
    for (const bucket of MAGNITUDE_BUCKETS) {
      const { badge, swatch } = MAGNITUDE_IDENTITY[bucket];
      expect(badge).toContain(swatch);
    }
  });

  it("shares ONE foreground across the ramp, and it clears 4.5 on the lightest step", () => {
    // `--eq-mag-fg` (T-031d Task 13), not a bare `text-white`: the ramp inverts under `.dark`
    // (`lib/theme/magnitude-ramp.test.ts`), and a hard-coded white measures only 1.34:1 against
    // the new dark lightest step. White on `--eq-mag-1` — the lightest of the LIGHT five and so
    // the binding case for the light theme's own token value — measures 4.69 against that
    // step's own fill as the backdrop.
    for (const bucket of MAGNITUDE_BUCKETS) {
      expect(MAGNITUDE_IDENTITY[bucket].badge).toContain("text-[var(--eq-mag-fg)]");
    }
    expect(ratio("#ffffff", "#aa4cbd")).toBe(4.69);
  });

  it("adds a spelling, never a second classifier", () => {
    // `bucketFor` must BE `magnitudeBucket`, not agree with it. A copy would pass a sampled
    // comparison and then drift, which is exactly how the explorer ended up with a four-step
    // colour branch beside a five-step label branch.
    expect(bucketFor).toBe(magnitudeBucket);
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./magnitude-identity.ts", import.meta.url)), "utf8"),
    );
    // No threshold comparison of its own may survive here.
    expect(source).not.toMatch(/magnitude\s*[<>]=?/);
    expect(source).toMatch(/magnitudeBucket/);
  });

  it("prints a legend range that the classifier actually agrees with", () => {
    // Probing the classifier either side of every boundary, rather than comparing two copies of
    // the same number — a legend and a threshold table can be transcribed from each other and
    // both be wrong.
    const boundaries: readonly [number, MagnitudeBucket][] = [
      [2.99, 1],
      [3, 2],
      [3.99, 2],
      [4, 3],
      [4.99, 3],
      [5, 4],
      [5.99, 4],
      [6, 5],
      [9.9, 5],
    ];
    for (const [magnitude, bucket] of boundaries) {
      expect(magnitudeIdentityOf(magnitude).bucket, `M ${magnitude}`).toBe(bucket);
    }
    // …and the printed text names those same numbers, in order, low to high.
    expect(MAGNITUDE_BUCKETS.map((b) => MAGNITUDE_IDENTITY[b].legend)).toEqual([
      "M < 3.0",
      "M 3.0–3.9",
      "M 4.0–4.9",
      "M 5.0–5.9",
      "M ≥ 6.0",
    ]);
  });

  it("names only tokens app/globals.css actually declares", () => {
    expect(Object.keys(SHIPPED)).toHaveLength(5);
    for (const bucket of MAGNITUDE_BUCKETS) {
      expect(SHIPPED[bucket], `--eq-mag-${bucket} is not declared in app/globals.css`).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }
  });

  it("spells no raw palette class and inlines no colour value", () => {
    // Comments stripped, and that is load-bearing: the docblock quotes `bg-red-600`,
    // `#dc2626` and the rest of what this module replaced, so an un-stripped read would be
    // satisfied by the explanation instead of the code.
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./magnitude-identity.ts", import.meta.url)), "utf8"),
    );
    expect(source).toMatch(/MAGNITUDE_IDENTITY/);
    expect(source).not.toMatch(
      /\b(?:text|bg|border|ring|fill|stroke)-(?:red|orange|amber|emerald|yellow|green)-\d{2,3}\b/,
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  /**
   * DELETED HERE: `it("does NOT re-light the ramp — the dark-mode failure stays T-031d's")`.
   *
   * It was a pin that RECORDED A FAILURE — the light ramp's five hexes, measured against the
   * dark `--card`, were supposed to be four-of-five under `GRAPHICAL_MIN` until T-031d Task 12
   * turned the dark ramp around. Its own comment said as much: "if a future change fixes that,
   * this reds and T-031d has landed." Task 12 is that future change. It fired, exactly as
   * designed — the same shape as the `fillSoft` negative control this suite's sibling
   * `continent-palette.test.ts` deleted when Task 10 removed what it was recording the absence
   * of. Editing its five expected numbers would have kept a test with the same NAME asserting
   * the opposite claim; deleting it, the way that sibling did, is the honest move.
   *
   * Not replaced with a same-shape positive version here, because `lib/theme/magnitude-ramp.test.ts`
   * (Task 12) already says everything this pin's premise-flip would say, and says it better: it
   * compares `:root` and `.dark` against the SAME committed table (this file's old pin only ever
   * read `:root`, even nominally "for" the dark case), it checks the WCAG floor against
   * `--card`, `--map-plate`, `--map-sea` AND `--map-land` rather than `--card` alone, it checks
   * the shared `--eq-mag-fg` label at 4.5:1, and it asserts monotonic lightness in both
   * directions explicitly. A rewritten pin here would be a strictly weaker duplicate kept for
   * sentiment, which is exactly what not to do.
   */
});
