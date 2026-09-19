import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments, stripCssComments } from "@/lib/test-support/strip-comments";
import { magnitudeBucket, type MagnitudeBucket } from "@/lib/earthquake/magnitude";
import { ratio } from "./contrast";
import {
  bucketFor,
  MAGNITUDE_BUCKETS,
  MAGNITUDE_IDENTITY,
  magnitudeIdentityOf,
} from "./magnitude-identity";

const CLASS_MEMBERS = ["mark", "ripple", "badge", "swatch"] as const;

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
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const declared = new Set([...css.matchAll(/(--eq-mag-[1-5])\s*:/g)].map((m) => m[1]!));
    expect(declared.size).toBe(5);
    for (const bucket of MAGNITUDE_BUCKETS) {
      expect(declared.has(`--eq-mag-${bucket}`)).toBe(true);
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
    // Confirmed here rather than taken on trust, and confirmed as a FAILURE: on the dark
    // `--card` (#121e21) the five steps measure 3.63 / 2.65 / 1.89 / 1.29 / 1.01 against a 3:1
    // graphical floor. Four of five are under it. Binding to the ramp is still correct — the
    // alternative is a second ramp — but this file must not be where somebody quietly fixes it,
    // because a change to those five values is a change to a public-safety scale and belongs in
    // one reviewed place. If these figures move, T-031d has landed and this test is its record.
    const DARK_CARD = "#121e21";
    const STEPS = ["#aa4cbd", "#9236a1", "#772281", "#521457", "#2e0e2f"] as const;
    expect(STEPS.map((hex) => ratio(hex, DARK_CARD))).toEqual([3.63, 2.65, 1.89, 1.29, 1.01]);
    // The same five on the LIGHT card, which is where the ramp works and why it shipped.
    expect(STEPS.map((hex) => ratio(hex, "#ffffff"))).toEqual([4.69, 6.43, 9.01, 13.15, 17.21]);
  });
});
