import { frameForMarkers } from "@/lib/earthquake/map-geometry";
import { MAGNITUDE_MARKER_RADIUS, magnitudeBucket } from "@/lib/earthquake/magnitude";
import { formatEarthquakeOccurredAt } from "@/lib/earthquake/time";
import type { EarthquakeEvent } from "@/lib/api/types";
import { formatViewBox, parseViewBox, projectToMapPoint } from "@/lib/map/projection";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import styles from "./earthquake.module.css";

const TITLE_ID_PREFIX = "deprem-map-title";
const DESC_ID_PREFIX = "deprem-map-desc";

const MARKER_BUCKET_CLASS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: styles.markerBucket1!,
  2: styles.markerBucket2!,
  3: styles.markerBucket3!,
  4: styles.markerBucket4!,
  5: styles.markerBucket5!,
};

/** The extra breathing room around the frame, matching `frameForLabelledPoints`'s own margin. */
const FRAME_MARGIN = 6;

interface EarthquakeMapProps {
  locale: string;
  events: readonly EarthquakeEvent[];
  title: string;
  /** ICU-resolved, e.g. "{count} olay bu haritada işaretli." with `count` already applied. */
  description: string;
  /** Unique per render — the hub renders this map once, but the client filter island can
   *  re-render it after a fetch, and two `<svg>`s with the same ids would be an a11y defect. */
  idSuffix: string;
}

/**
 * The default-view earthquake map (§5.13, `deprem-sayfalari` plan): server-rendered inline SVG,
 * modeled on `components/marine/marine-map.tsx`, with two deliberate differences because the
 * underlying data differs.
 *
 * NO PER-MARKER TEXT LABEL. Marine's 30 points are a small, fixed catalogue where a
 * province-name label is legible; an earthquake list can hold up to 200 events on one page,
 * and labelling each would recreate the exact "word cloud" `MarineMap`'s own docblock names
 * and rejects. Each marker instead carries only an accessible `<title>` (place name +
 * magnitude + Türkiye time, one string) — no `placePointLabels`/`frameForLabelledPoints`
 * label-layout machinery is needed, only the simpler `frameForMarkers` (`lib/earthquake/
 * map-geometry.ts`).
 *
 * MARKER RADIUS/COLOUR IS MAGNITUDE-DRIVEN (§5.6), unlike marine's "every marker is identical"
 * state, because this leg's magnitude field is available from day one.
 *
 * A plain, hook-free presentational component — no `getTranslations`/`useTranslations` call
 * inside it — so it renders identically whether the caller resolved its strings on the server
 * (`app/[locale]/deprem/page.tsx`) or on the client (`earthquake-filters.tsx`, `"use client"`,
 * after a re-fetch). This is a deliberate deviation from most of this repo's server components,
 * which resolve their own translations — the reason is this exact dual-context requirement,
 * which no earlier surface in this repo has had.
 */
export function EarthquakeMap({
  locale,
  events,
  title,
  description,
  idSuffix,
}: EarthquakeMapProps) {
  const base = parseViewBox(MAP_VIEWBOX);
  if (base === null) return null;

  const markers = events.map((event) => {
    const { x, y } = projectToMapPoint(event.longitude, event.latitude);
    const bucket = magnitudeBucket(event.magnitude);
    const magnitudeLabel = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(event.magnitude);
    const timeLabel = formatEarthquakeOccurredAt(event.occurredAtUtc, locale);
    return {
      key: event.id,
      x,
      y,
      radius: MAGNITUDE_MARKER_RADIUS[bucket],
      bucketClass: MARKER_BUCKET_CLASS[bucket],
      // One em dash, matching `MarineMap`'s own accessible-name shape
      // (`CONTENT-STYLE.md` §17's density limit, applied even to a data label). The magnitude
      // method rides in parentheses (GLOSSARY.md §4, review FENER104-I1) — magnitude is never
      // published without its type, because two methods give the same event two numbers.
      accessibleName: `${event.placeNameTr} — M ${magnitudeLabel} (${event.magnitudeType}), ${timeLabel}`,
    };
  });

  // A single non-finite coordinate would poison the whole union frame (`Math.min`/`Math.max`
  // propagate NaN), the same defence `MarineMap` documents for its own frame computation.
  const maxRadius = Math.max(0, ...Object.values(MAGNITUDE_MARKER_RADIUS));
  const computedFrame = frameForMarkers(
    base,
    markers.map((m) => ({ x: m.x, y: m.y })),
    maxRadius,
    FRAME_MARGIN,
  );
  const computed = formatViewBox(computedFrame);
  const frame = parseViewBox(computed) === null ? MAP_VIEWBOX : computed;

  const titleId = `${TITLE_ID_PREFIX}-${idSuffix}`;
  const descId = `${DESC_ID_PREFIX}-${idSuffix}`;

  return (
    <figure className={styles.mapFigure}>
      <div className={styles.mapRoot}>
        <svg
          className={styles.mapSvg}
          viewBox={frame}
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <title id={titleId}>{title}</title>
          <desc id={descId}>{description}</desc>

          {/* Geographic backdrop only — the province outlines carry no link on this map, the
              same posture `MarineMap` takes: the map's subject is the events. */}
          <g aria-hidden="true">
            {PROVINCE_SHAPES.map((shape) => (
              <path key={shape.plateCode} className={styles.mapLand} d={shape.d} />
            ))}
          </g>

          {markers.map((marker) => (
            // `role="img"` + a `<title>` child gives the marker ONE accessible name — the
            // same "one accessible name, no drift" pattern `MarineMap`'s own markers use.
            //
            // `lang="tr"` on the WHOLE title (review VAL104-M1, WCAG 3.1.2): SVG `<title>`'s
            // content model is text-only, so — unlike `earthquake-list.tsx`'s `<span>`, which
            // can wrap `placeNameTr` alone — there is no valid way to mark only the Turkish
            // place-name portion of this one string. `placeNameTr` is the substantial, often
            // multi-word part of the name; the trailing "M {value} ({type}), {time}" fragment
            // is mostly numeric and unaffected either way. Marking the dominant language of a
            // mixed-language node this technology cannot split is the accepted WCAG 3.1.2
            // fallback (Understanding 3.1.2).
            <g key={marker.key} role="img">
              <title lang="tr">{marker.accessibleName}</title>
              <circle
                className={`${styles.mapMarker} ${marker.bucketClass}`}
                cx={marker.x}
                cy={marker.y}
                r={marker.radius}
              />
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
