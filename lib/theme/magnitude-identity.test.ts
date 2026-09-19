import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments, stripCssComments } from "@/lib/test-support/strip-comments";
import { magnitudeBucket, type MagnitudeBucket } from "@/lib/earthquake/magnitude";
import { GRAPHICAL_MIN, ratio } from "./contrast";
import {
  bucketFor,
  MAGNITUDE_BUCKETS,
  MAGNITUDE_IDENTITY,
  magnitudeIdentityOf,
} from "./magnitude-identity";

const CLASS_MEMBERS = ["mark", "ripple", "badge", "swatch"] as const;

/** The two card surfaces every figure below is a ratio TO. Neither is "the background". */
const LIGHT_CARD = "#ffffff";
const DARK_CARD = "#121e21";

/**
 * The five ramp steps as `app/globals.css` declares them, PARSED rather than transcribed.
 *
 * This matters more here than in the palette tests, because this file pins a FAILURE. A
 * transcribed copy would keep asserting 3.63 / 2.65 / … about five literals while the stylesheet
 * said something else entirely, and the test that exists to say "T-031d has not happened yet"
 * would be green after T-031d happened. Comments are stripped first: the token block's own
 * docblock quotes contrast figures and bucket ranges in prose.
 */
const SHIPPED: Readonly<Record<number, string>> = (() => {
  const css = stripCssComments(
    readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
  );
  const out: Record<number, string> = {};
  for (const m of css.matchAll(/--eq-mag-([1-5]):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[Number(m[1])] = m[2]!.toLowerCase();
  }
  return out;
})();

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
    // White on `--eq-mag-1` — the lightest of the five and so the binding case — measures 4.69
    // against that step's own fill as the backdrop. The old four-step scale needed a second
    // foreground because its amber step was too light for white; the token ramp does not.
    for (const bucket of MAGNITUDE_BUCKETS) {
      expect(MAGNITUDE_IDENTITY[bucket].badge).toContain("text-white");
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

  it("does NOT re-light the ramp — the dark-mode failure stays T-031d's", () => {
    // A pin that RECORDS A FAILURE, so it has to be measured on the values that ship rather than
    // on transcribed literals. The first version of this read five hexes written out here, which
    // would have stayed green through any edit to `--eq-mag-3`; `SHIPPED` is parsed out of
    // `app/globals.css`, the way `fault-palette.test.ts` parses its own set.
    const steps = MAGNITUDE_BUCKETS.map((b) => SHIPPED[b]!);
    expect(steps.map((hex) => ratio(hex, DARK_CARD))).toEqual([3.63, 2.65, 1.89, 1.29, 1.01]);
    // The same five on the LIGHT card, which is where the ramp works and why it shipped.
    expect(steps.map((hex) => ratio(hex, LIGHT_CARD))).toEqual([4.69, 6.43, 9.01, 13.15, 17.21]);

    // …and the FAILURE itself is asserted, against the floor the repo exports, not described in
    // prose beside a number. Four of five steps are under `GRAPHICAL_MIN` on the dark card. If a
    // future change fixes that, this reds and T-031d has landed; if a future change makes it
    // worse, this reds too.
    const failing = steps.filter((hex) => ratio(hex, DARK_CARD) < GRAPHICAL_MIN);
    expect(
      failing,
      `on the dark --card the ramp is supposed to be FAILING; this pin exists to record that`,
    ).toHaveLength(4);
    expect(steps.filter((hex) => ratio(hex, LIGHT_CARD) < GRAPHICAL_MIN)).toHaveLength(0);
  });
});
