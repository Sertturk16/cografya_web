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
 * `--eq-mag-*` is a public-safety scale and is NOT retuned here. The badge foreground is
 * `--eq-mag-fg` (T-031d Task 12), a single token per theme rather than a hard-coded
 * achromatic: white in light, `--color-ink-dark` in dark. It is measured against every one of
 * the five fills, in both themes, worst case first — 4.69:1 in light, 4.81:1 in dark
 * (`lib/theme/magnitude-ramp.test.ts`) — so one foreground still covers the whole ramp, the
 * same shape the old bare `text-white` had, except it now survives the ramp inverting under
 * `.dark`.
 *
 * A bridge token (`--foreground`) is still wrong here, unchanged from before: the label sits
 * on a DATA colour, one of the five ramp fills, not on a page surface, so a token tuned for
 * `--card`/`--background` has no reason to track it and does not. Measured against the current
 * ramp, `--foreground` reads 3.19 / 2.33 / 1.66 / 1.14 / 1.15:1 in light and 3.03 / 2.38 / 1.89
 * / 1.48 / 1.16:1 in dark — every step misses `TEXT_MIN` (4.5:1) in both themes, and all but
 * step 1 miss `GRAPHICAL_MIN` (3:1) too. Step 1 is the ramp's LIGHTEST step in light (where the
 * ramp darkens with magnitude) but its DARKEST step in dark (where the ramp lightens with
 * magnitude), so "all but the lightest" holds only in light — in dark the step that clears is
 * the darkest one. `--eq-mag-fg` exists precisely because it is measured against the ramp it
 * labels, not against a page surface the label never sits on.
 *
 * **The ramp's own fills were the dark-mode defect, and that was T-031d's, not this module's.**
 * Against the dark `--card`, the SHIPPED (pre-Task-12) fills measured 3.63 / 2.65 / 1.89 / 1.29
 * / 1.01, four of five under the 3:1 graphical floor. Task 12 turned the ramp around under
 * `.dark`; the current fills clear 4.86–12.74 on `--card` and 4.64–12.17 on `--map-plate`.
 * Binding to the ramp was still right even while it failed — the alternative is a second ramp,
 * which is the defect this module removes — and now the ramp it binds to no longer fails.
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
    badge: "bg-[var(--eq-mag-1)] text-[var(--eq-mag-fg)]",
    swatch: "bg-[var(--eq-mag-1)]",
    legend: "M < 3.0",
  },
  2: {
    bucket: 2,
    mark: "fill-[var(--eq-mag-2)]",
    ripple: "stroke-[var(--eq-mag-2)]",
    badge: "bg-[var(--eq-mag-2)] text-[var(--eq-mag-fg)]",
    swatch: "bg-[var(--eq-mag-2)]",
    legend: "M 3.0–3.9",
  },
  3: {
    bucket: 3,
    mark: "fill-[var(--eq-mag-3)]",
    ripple: "stroke-[var(--eq-mag-3)]",
    badge: "bg-[var(--eq-mag-3)] text-[var(--eq-mag-fg)]",
    swatch: "bg-[var(--eq-mag-3)]",
    legend: "M 4.0–4.9",
  },
  4: {
    bucket: 4,
    mark: "fill-[var(--eq-mag-4)]",
    ripple: "stroke-[var(--eq-mag-4)]",
    badge: "bg-[var(--eq-mag-4)] text-[var(--eq-mag-fg)]",
    swatch: "bg-[var(--eq-mag-4)]",
    legend: "M 5.0–5.9",
  },
  5: {
    bucket: 5,
    mark: "fill-[var(--eq-mag-5)]",
    ripple: "stroke-[var(--eq-mag-5)]",
    badge: "bg-[var(--eq-mag-5)] text-[var(--eq-mag-fg)]",
    swatch: "bg-[var(--eq-mag-5)]",
    legend: "M ≥ 6.0",
  },
};

/** The five buckets low to high — the order a legend reads in, stated once. */
export const MAGNITUDE_BUCKETS: readonly MagnitudeBucket[] = [1, 2, 3, 4, 5];

/**
 * The disc's identifying ring — ONE class for every bucket, unlike `mark`/`ripple`/`badge`/
 * `swatch`, because `--eq-mag-fg` is a single token per theme, not five.
 *
 * `v2-earthquake-explorer.tsx`'s epicentre circle used to stroke `stroke-white
 * dark:stroke-black`. T-031d Task 12 proved no single achromatic clears `--map-plate`, the dark
 * ramp's darkest step AND its lightest step at once — the luminance span between the plate and
 * the ramp's lightest step is wide enough that any value clearing both necessarily fails the
 * darkest step sitting between them, arithmetically, not from a missed shade.
 *
 * Task 13 tested rather than assumed whether the ring needs to clear the plate at all. It does
 * not: the FILL already clears `--map-plate` on its own in both themes (>=3.71 light, >=4.64
 * dark — `lib/theme/magnitude-ramp.test.ts`), the same shape Ruling 16 found for dark inland
 * water, where the fill carries the water body against the region tints and the outline is free
 * to suit a different constraint. What is actually left for the ring is separating two
 * OVERLAPPING discs — a ring-against-fill question — and `--eq-mag-fg` is already measured
 * against every one of the five fills in both themes (4.69 worst light, 4.81 worst dark), well
 * past `GRAPHICAL_MIN`.
 *
 * Exported as a constant, not spelled inline in the component, for the reason `mark`/`ripple`/
 * `badge`/`swatch` are: `components/v2/magnitude-identity.test.ts` asserts the ramp's token
 * names appear in `v2-earthquake-explorer.tsx` nowhere but through this module.
 */
export const MAGNITUDE_RING = "stroke-[var(--eq-mag-fg)]";

/**
 * The magnitude NUMBER printed directly on the disc (`v2-earthquake-explorer.tsx`'s SVG
 * `<text>`, shown for `eq.magnitude >= 3.5`) — the SAME token as `MAGNITUDE_RING`,
 * `--eq-mag-fg`, but as a `fill-*` utility rather than `stroke-*`: SVG `<text>` paints its
 * glyphs with `fill`, not `stroke`, the same split `mark` (fill) and `ripple`/`MAGNITUDE_RING`
 * (stroke) already have for the identical reason.
 *
 * This is the label-on-fill relationship, not the ring's disc-vs-disc one — the number sits
 * directly on its OWN disc's fill, the same shape `badge` already has — and `--eq-mag-fg` is
 * measured for exactly that (4.69 worst light, 4.81 worst dark, against every one of the five
 * fills). It replaces a hard-coded `fill="#ffffff"` SVG *presentation attribute*, not a class:
 * a class cannot shadow a presentation attribute (the same reason Task 10 deleted
 * `fill="url(#ocean-gradient)"` rather than layer a class over it), so the attribute itself has
 * to go, not just gain a sibling. White there measured 3.51 / 2.76 / 2.19 / 1.71 / 1.34 against
 * the dark ramp's five steps — under `TEXT_MIN` on ALL FIVE, worst at the step the ramp
 * inversion exists to make prominent (magnitude 6+). Light was never broken (4.69–17.21); only
 * dark needed the token.
 */
export const MAGNITUDE_LABEL = "fill-[var(--eq-mag-fg)]";

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
