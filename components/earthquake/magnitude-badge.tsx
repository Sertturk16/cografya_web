import type { EarthquakeEvent } from "@/lib/api/types";
import { magnitudeBucket } from "@/lib/earthquake/magnitude";

interface MagnitudeBadgeProps {
  magnitude: number;
  /** Normalised magnitude-method token (`EarthquakeEventDto.magnitudeType`) — `GLOSSARY.md`
   *  §4's own bold rule: "aynı deprem farklı yöntemlerle farklı sayı verir, bu yüzden büyüklük
   *  türsüz yayımlanmaz" (review FENER104-I1). Carried in the accessible name/tooltip, never
   *  in the always-visible label — the badge's printed text stays short on every row. */
  magnitudeType: EarthquakeEvent["magnitudeType"];
  /** BCP-47 tag, e.g. `"tr"`/`"en"` — for locale-correct decimal formatting only. */
  locale: string;
}

/**
 * The pill itself. `text-[var(--eq-mag-fg)]`, T-031d Task 12's single per-theme foreground for
 * the whole ramp — white in light, `--color-ink-dark` in dark — in place of the bare
 * `text-white` this carried before: `.dark`'s ramp inverted (lightness now rises with
 * magnitude, matching a dark ground) and a hard-coded white measures only **1.34:1** on the new
 * lightest dark step (`--eq-mag-5`, magnitude 6+ — the step that matters most). `--eq-mag-fg` is
 * measured (`lib/theme/magnitude-ramp.test.ts`) against every one of the five fills in both
 * themes — **4.69:1 worst case in light, 4.81:1 worst case in dark** — so one token still covers
 * the whole ramp, the way one hard-coded colour used to, except it now survives the ramp
 * inverting.
 *
 * A bridge token would still be wrong here, for the reason it always was: the label is measured
 * against the FILL under it, which is a DATA colour that does not follow the theme, not against
 * the page. `--foreground` FAILS IN BOTH THEMES against the current ramp — 3.19 / 2.33 / 1.66 /
 * 1.14 / 1.15:1 in light, 3.03 / 2.38 / 1.89 / 1.48 / 1.16:1 in dark — every step under 4.5:1 and
 * all but step 1 under 3:1, in either theme. Step 1 is the LIGHTEST step in light, where the
 * ramp darkens with magnitude, but the DARKEST step in dark, where the ramp lightens with
 * magnitude — "all but the lightest" is only true in light and would misstate dark, where the
 * step that clears is the darkest one, not the lightest. A bridge token tracks the PAGE; this
 * label needs a token that tracks the RAMP, which is what `--eq-mag-fg` is for.
 *
 * `rounded-full` where the stylesheet wrote `border-radius: 999px`. The computed value changes
 * (999px to Tailwind v4's `calc(infinity * 1px)`) and the rendering does not: both fully round
 * a 24px-tall pill, and 999px was already ten times the half-height it needed.
 */
const BADGE =
  "inline-block rounded-full px-2 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap text-[var(--eq-mag-fg)]";

/**
 * THE MAGNITUDE RAMP IS A DATA TOKEN SET AND DOES NOT MOVE TO A BRIDGE TOKEN.
 *
 * `--eq-mag-1`…`--eq-mag-5` (`app/globals.css`) encode a PUBLIC-SAFETY SCALE. They are
 * deliberately absent from T-033's frozen-token mapping table for the same reason
 * `--chart-pm25-line` and `--chart-temp-line` are: `docs/design.md` rule 1 is that brand chrome
 * never encodes data, and rebinding a magnitude step to `bg-warning` would put the Terra
 * palette on a seismic scale. T-033 task 6 converted every other rule in this component's
 * stylesheet and left these five exactly where they were.
 *
 * WHAT THE CONVERSION DID DO IS MEASURE THEM, because nobody had. Against the section's real
 * backdrop — `--card` (#121e21 in dark), the fill of the `<Card variant="panel">` that wraps
 * `ProvinceEarthquakeSection` on `/turkiye/[slug]`, which is the only route that renders this
 * badge (`/deprem` renders `V2EarthquakeExplorer` instead) — the five fills measured
 * **3.63 / 2.65 / 1.89 / 1.29 / 1.01:1** AS SHIPPED AT THE TIME (T-033). Four of the five were
 * under WCAG 1.4.11's 3:1 floor for a graphical object and the strongest bucket was invisible.
 * On light `--card` (#ffffff) the same five read 4.69 / 6.43 / 9.01 / 13.15 / 17.21:1, so it was
 * a dark-mode-only defect: the ramp darkened toward the top of the scale, which inverts against
 * a dark page.
 *
 * **T-031d Task 12 fixed it — the current dark fills are 4.86 / 6.18 / 7.79 / 9.98 / 12.74:1
 * against `--card` and 4.64 / 5.90 / 7.44 / 9.53 / 12.17:1 against `--map-plate`**, both
 * clearing `GRAPHICAL_MIN` on every step with the strongest bucket now the most prominent, not
 * the most invisible. A ramp is a scale, not five independent colours, so this was re-derived as
 * one table on the branch that re-derives the map tints rather than patched bucket by bucket —
 * `lib/theme/magnitude-ramp.test.ts` is where those five hexes and their measurements now live.
 *
 * Colour is never the only signal either way (`DESIGN.md` §6.1 rule 3) — the number is always
 * printed — so an invisible fill degrades the badge, it does not hide the magnitude.
 */
const BUCKET_CLASS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-[var(--eq-mag-1)]",
  2: "bg-[var(--eq-mag-2)]",
  3: "bg-[var(--eq-mag-3)]",
  4: "bg-[var(--eq-mag-4)]",
  5: "bg-[var(--eq-mag-5)]",
};

/**
 * A small colour+text badge for one event's magnitude (§5.6, `deprem-sayfalari` plan).
 *
 * Colour is NEVER the only signal (`DESIGN.md` §6.1 rule 3): the number itself is always
 * printed, and the marker on `EarthquakeMap` additionally varies in SIZE by the same bucket
 * (`MAGNITUDE_MARKER_RADIUS`) — so the encoding survives with colour removed entirely.
 *
 * A plain, hook-free presentational component on purpose: it renders identically from the
 * server-rendered default view (`app/[locale]/(site)/deprem/page.tsx`) and the client filter
 * island's re-render (`components/earthquake/earthquake-filters.tsx`, `"use client"`),
 * neither of which it needs to know about.
 */
export function MagnitudeBadge({ magnitude, magnitudeType, locale }: MagnitudeBadgeProps) {
  const bucket = magnitudeBucket(magnitude);
  const label = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(magnitude);
  // The visible text stays "M {label}" everywhere — the method token rides only the
  // accessible name/tooltip (GLOSSARY.md §4, review FENER104-I1).
  const accessibleLabel = `M ${label} (${magnitudeType})`;

  return (
    <span
      className={`${BADGE} ${BUCKET_CLASS[bucket]}`}
      // The accessible name states the unit in words — a bare number is ambiguous to a
      // screen-reader user who has not seen the page's own "magnitude" heading.
      aria-label={accessibleLabel}
    >
      M {label}
    </span>
  );
}
