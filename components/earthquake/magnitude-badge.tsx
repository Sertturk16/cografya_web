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
 * The pill itself. `text-white`, and it is the third DELIBERATE bare achromatic on this
 * surface after `pm25-chart.tsx` and `climate-chart.tsx`, for the same class of reason: the
 * label is measured against the FILL under it, which is a data colour that does not follow the
 * theme, not against the page. Measured (`lib/theme/contrast.ts`) — #fff on `--eq-mag-1`…`-5`:
 * **4.69 / 6.43 / 9.01 / 13.15 / 17.21:1**. A bridge token here would track a surface the label
 * never sits on and would go UNREADABLE on the dark end of the ramp: `--foreground` in dark
 * (#e8f0f1) is the same reading, but in LIGHT it is #2b2622, which measures 1.12:1 on
 * `--eq-mag-5`. The label is white in both themes because the ground under it is.
 *
 * `rounded-full` where the stylesheet wrote `border-radius: 999px`. The computed value changes
 * (999px to Tailwind v4's `calc(infinity * 1px)`) and the rendering does not: both fully round
 * a 24px-tall pill, and 999px was already ten times the half-height it needed.
 */
const BADGE =
  "inline-block rounded-full px-2 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap text-white";

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
 * badge (`/deprem` renders `V2EarthquakeExplorer` instead) — the five fills measure
 * **3.63 / 2.65 / 1.89 / 1.29 / 1.01:1**. Four of the five are under WCAG 1.4.11's 3:1 floor
 * for a graphical object and the strongest bucket is invisible. On light `--card` (#ffffff) the
 * same five read 4.69 / 6.43 / 9.01 / 13.15 / 17.21:1, so this is a dark-mode-only defect:
 * the ramp was drawn to darken toward the top of the scale, which inverts against a dark page.
 *
 * **That fix is T-031d's, not this task's.** T-031d owns the dark data surfaces and its own
 * first job is re-measuring exactly this kind of table (see `components/ui/token-binding.test.ts`,
 * MAP_SURFACE_FILES). A ramp is a scale, not five independent colours: it cannot be repaired one
 * bucket at a time without destroying the ordering the badge encodes, and re-deriving it belongs
 * with the branch that re-derives the map tints. Nothing here is silently left as if it passed.
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
