import { magnitudeBucket } from "@/lib/earthquake/magnitude";
import styles from "./earthquake.module.css";

interface MagnitudeBadgeProps {
  magnitude: number;
  /** BCP-47 tag, e.g. `"tr"`/`"en"` — for locale-correct decimal formatting only. */
  locale: string;
}

const BUCKET_CLASS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: styles.bucket1!,
  2: styles.bucket2!,
  3: styles.bucket3!,
  4: styles.bucket4!,
  5: styles.bucket5!,
};

/**
 * A small colour+text badge for one event's magnitude (§5.6, `deprem-sayfalari` plan).
 *
 * Colour is NEVER the only signal (`DESIGN.md` §6.1 rule 3): the number itself is always
 * printed, and the marker on `EarthquakeMap` additionally varies in SIZE by the same bucket
 * (`MAGNITUDE_MARKER_RADIUS`) — so the encoding survives with colour removed entirely.
 *
 * A plain, hook-free presentational component on purpose: it renders identically from the
 * server-rendered default view (`app/[locale]/deprem/page.tsx`) and the client filter
 * island's re-render (`components/earthquake/earthquake-filters.tsx`, `"use client"`),
 * neither of which it needs to know about.
 */
export function MagnitudeBadge({ magnitude, locale }: MagnitudeBadgeProps) {
  const bucket = magnitudeBucket(magnitude);
  const label = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(magnitude);

  return (
    <span
      className={`${styles.badge} ${BUCKET_CLASS[bucket]}`}
      // The accessible name states the unit in words — a bare number is ambiguous to a
      // screen-reader user who has not seen the page's own "magnitude" heading.
      aria-label={`M ${label}`}
      title={`M ${label}`}
    >
      M {label}
    </span>
  );
}
