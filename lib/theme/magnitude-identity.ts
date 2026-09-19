import { magnitudeBucket, type MagnitudeBucket } from "@/lib/earthquake/magnitude";

/**
 * The magnitude ramp, as classes a Tailwind surface can wear.
 *
 * `app/globals.css` decides what `--eq-mag-1`…`--eq-mag-5` ARE, `lib/earthquake/magnitude.ts`
 * decides which bucket a magnitude falls into, and this module is the only file that turns a
 * bucket into a class. It deliberately adds no third opinion: `bucketFor` below is
 * `magnitudeBucket` re-exported, not a second classifier.
 *
 * ## What this replaced, and why the ramp needed a module at all
 *
 * `components/v2/v2-earthquake-explorer.tsx` shipped its own ramp, three times over, none of
 * them the token set:
 *
 *   1. `getMagnitudeStyle` returned raw background classes in the red, orange, amber and
 *      emerald families — a traffic-light HUE scale for a quantity that belongs on a lightness
 *      ramp, and only FOUR steps where the tokens and the product's own classifier have five.
 *   2. the marker ripple carried raw hexes in an SVG `stroke` prop — `#dc2626` / `#ea580c` /
 *      `#059669`, the Tailwind **v3** values of those families, which this repo stopped
 *      shipping at the v4 upgrade. A bare hex in a prop is a class to no scanner, so neither
 *      arm of the palette count could see it.
 *   3. the legend spelled the four swatches out again, independently of the badges it claims
 *      to explain.
 *
 * `components/earthquake/magnitude-badge.tsx` bound to `--eq-mag-*` correctly the whole time,
 * through `earthquake.module.css`. So the product had two magnitude ramps in different hue
 * families, and which one a reader saw depended on which page they were on.
 *
 * ## The defect the colours were hiding
 *
 * `getMagnitudeStyle().bg` was applied to an SVG `<circle>`. `bg-*` sets `background-color`,
 * which an SVG shape never paints, so every epicentre on the live map rendered at SVG's default
 * fill: **black**. The legend has been describing colours the map never painted. Hence `mark`
 * below is a `fill-*` class rather than a `bg-*` one, and
 * `components/v2/magnitude-identity.test.ts` asserts no `bg-` class reaches an SVG shape in
 * that file.
 *
 * ## Five steps, not four
 *
 * The thresholds are `lib/earthquake/magnitude.ts`'s and were already the product's: <3, 3-3.9,
 * 4-4.9, 5-5.9, 6+. The explorer's own `getIntensityLabel` already split at 6.0 while its
 * colour branch lumped everything from 5.0 upward, so the fifth step is the component's own
 * missing case being restored, not a hue anybody invented.
 *
 * ## Why literal strings and not a template
 *
 * Tailwind v4 scans source text; a class assembled from the bucket number produces no CSS.
 * Every class is written out per bucket, and the five entries are checked against each other by
 * `components/v2/magnitude-identity.test.ts`.
 *
 * ## Contrast
 *
 * `--eq-mag-*` is a public-safety scale and is NOT retuned here. Its badge foreground is white
 * on every step (4.69 on `--eq-mag-1`, the lightest, rising to 17.21 on `--eq-mag-5` — the
 * backdrop of each figure is that step's own fill), so one foreground covers the ramp and the
 * near-black amber text the old amber step needed is gone with the amber.
 *
 * **The ramp itself fails in dark mode and that is T-031d's, not this module's.** Measured
 * against the dark `--card` the five steps are 3.63 / 2.65 / 1.89 / 1.29 / 1.01, four of five
 * under the 3:1 graphical floor. Binding to the ramp is still right — the alternative is a
 * second ramp, which is the defect this module removes — but nothing here re-lights it.
 */

export interface MagnitudeIdentity {
  /** The bucket, i.e. the `--eq-mag-*` token's own number. */
  readonly bucket: MagnitudeBucket;
  /**
   * The epicentre mark, as an SVG `fill`.
   *
   * A `fill-*` class, not `bg-*`: the mark is an SVG `<circle>`, and `background-color` on an
   * SVG shape paints nothing at all. That is not a hypothetical — it is what shipped.
   */
  readonly mark: string;
  /** The ripple ring around an unselected mark, as an SVG `stroke`. */
  readonly ripple: string;
  /** A filled magnitude badge: the step's fill, with the one foreground the ramp shares. */
  readonly badge: string;
  /** The legend swatch. The same token as `badge`, or the legend lies. */
  readonly swatch: string;
  /**
   * What the legend prints for this step.
   *
   * Here rather than in the JSX because the printed range and the classifier must agree, and
   * `components/v2/magnitude-identity.test.ts` proves they do by probing `bucketFor` either
   * side of every boundary rather than by comparing two copies of the same number.
   */
  readonly legend: string;
}

export const MAGNITUDE_IDENTITY: Readonly<Record<MagnitudeBucket, MagnitudeIdentity>> = {
  1: {
    bucket: 1,
    mark: "fill-[var(--eq-mag-1)]",
    ripple: "stroke-[var(--eq-mag-1)]",
    badge: "bg-[var(--eq-mag-1)] text-white",
    swatch: "bg-[var(--eq-mag-1)]",
    legend: "M < 3.0",
  },
  2: {
    bucket: 2,
    mark: "fill-[var(--eq-mag-2)]",
    ripple: "stroke-[var(--eq-mag-2)]",
    badge: "bg-[var(--eq-mag-2)] text-white",
    swatch: "bg-[var(--eq-mag-2)]",
    legend: "M 3.0–3.9",
  },
  3: {
    bucket: 3,
    mark: "fill-[var(--eq-mag-3)]",
    ripple: "stroke-[var(--eq-mag-3)]",
    badge: "bg-[var(--eq-mag-3)] text-white",
    swatch: "bg-[var(--eq-mag-3)]",
    legend: "M 4.0–4.9",
  },
  4: {
    bucket: 4,
    mark: "fill-[var(--eq-mag-4)]",
    ripple: "stroke-[var(--eq-mag-4)]",
    badge: "bg-[var(--eq-mag-4)] text-white",
    swatch: "bg-[var(--eq-mag-4)]",
    legend: "M 5.0–5.9",
  },
  5: {
    bucket: 5,
    mark: "fill-[var(--eq-mag-5)]",
    ripple: "stroke-[var(--eq-mag-5)]",
    badge: "bg-[var(--eq-mag-5)] text-white",
    swatch: "bg-[var(--eq-mag-5)]",
    legend: "M ≥ 6.0",
  },
};

/** The five buckets low to high — the order a legend reads in, stated once. */
export const MAGNITUDE_BUCKETS: readonly MagnitudeBucket[] = [1, 2, 3, 4, 5];

/**
 * Which bucket a magnitude falls into.
 *
 * Re-exported from `lib/earthquake/magnitude.ts` rather than reimplemented, so this module adds
 * a spelling and never a second classifier. That is the whole point of it existing: the ramp
 * had three spellings and two classifiers before T-031c.
 */
export const bucketFor = magnitudeBucket;

/** The identity of the step a magnitude falls into. */
export function magnitudeIdentityOf(magnitude: number): MagnitudeIdentity {
  return MAGNITUDE_IDENTITY[magnitudeBucket(magnitude)];
}
