/**
 * The sea-surface-temperature ramp, in one place, spelled once.
 *
 * `app/globals.css` decides WHAT colour each band is; this module is the only file that turns
 * `--sst-band-*` into something a component can wear, and the only file that says where the
 * band boundaries are.
 *
 * ## Why this is a module and not two ternaries
 *
 * Before T-031c `components/v2/v2-marine-map-explorer.tsx` carried the ramp TWICE, about two
 * hundred lines apart, and the two spellings disagreed:
 *
 *   - the map station pins, as raw SVG `fill` attributes: `#2563eb` / `#0d9488` / `#ea580c`
 *   - the `Su Sıcaklığı` table chips, as utility classes: `blue-500/15` + `blue-700`,
 *     `teal-500/15` + `teal-700`, `orange-500/15` + `orange-700`
 *
 * Same three families, same thresholds, two different shades — and the pin hexes were Tailwind
 * v3 values the repo stopped shipping at the v4 upgrade. Both call sites now read `bandOfSst`,
 * so a pin and the chip beside it cannot say different things about one reading again.
 *
 * ## This is a binding, not a design
 *
 * SST is a geophysical scale, so it stays standard and is never restyled to Terra — the rule
 * that also keeps the earthquake magnitude ramp and the AQI bands standard. The tokens are the
 * Tailwind v4 `-600` of the three families the ramp already shipped in, which is the shade the
 * pins already used. `lib/theme/sst-band-palette.test.ts` pins how far each moved (2.7 / 0.8 /
 * 3.2) so a future edit cannot quietly turn a re-spelling into a re-colouring.
 *
 * ## Contrast
 *
 * `-text` is solved against a station row that is SELECTED and HOVERED, not a resting one, and
 * the figures for all four row states live in `app/globals.css` beside the declarations.
 */

/** The three ordered bands, coolest first. */
export type SstBand = "cool" | "warm" | "hot";

export interface SstBandStyle {
  /** The band's own name, i.e. the `--sst-band-*` token's name. */
  readonly band: SstBand;
  /**
   * The fill as a raw CSS VALUE, for an SVG `fill` attribute rather than a class — Tailwind
   * never sees it. Carries the hue a second time as a literal fallback, the one place in this
   * module where a colour is spelled twice; the fallback is checked against
   * `lib/theme/sst-band-palette.test.ts`'s table (and so against `app/globals.css`) by
   * `components/v2/sst-band.test.ts`, because a stale fallback would paint a station the wrong
   * temperature on exactly the browsers that needed the fallback.
   */
  readonly fillValue: string;
  /** `surface` + `label` + `edge`: the temperature chip, in a station table row. */
  readonly chip: string;
}

export const SST_BAND_STYLE: Readonly<Record<SstBand, SstBandStyle>> = {
  cool: {
    band: "cool",
    fillValue: "var(--sst-band-cool, #155dfc)",
    chip: "bg-[var(--sst-band-cool-tint)] text-[var(--sst-band-cool-text)] border-[var(--sst-band-cool)]/30",
  },
  warm: {
    band: "warm",
    fillValue: "var(--sst-band-warm, #009689)",
    chip: "bg-[var(--sst-band-warm-tint)] text-[var(--sst-band-warm-text)] border-[var(--sst-band-warm)]/30",
  },
  hot: {
    band: "hot",
    fillValue: "var(--sst-band-hot, #f54900)",
    chip: "bg-[var(--sst-band-hot-tint)] text-[var(--sst-band-hot-text)] border-[var(--sst-band-hot)]/30",
  },
};

/**
 * Where the bands divide, in °C. Exported so the legend and the tests read the same numbers the
 * classifier does rather than restating them.
 */
export const SST_BAND_MIN_C: Readonly<Record<Exclude<SstBand, "cool">, number>> = {
  warm: 25,
  hot: 28,
};

/**
 * The band a reading falls in. `null` and `undefined` fall in `cool`, which is what both call
 * sites already did — a station with no model value renders the coolest chip rather than no
 * chip, so the column never gains a hole.
 */
export function bandOfSst(sst: number | null | undefined): SstBand {
  if (typeof sst !== "number") return "cool";
  if (sst >= SST_BAND_MIN_C.hot) return "hot";
  if (sst >= SST_BAND_MIN_C.warm) return "warm";
  return "cool";
}

/** The style for a reading, in one step. */
export function sstBandStyleOf(sst: number | null | undefined): SstBandStyle {
  return SST_BAND_STYLE[bandOfSst(sst)];
}
