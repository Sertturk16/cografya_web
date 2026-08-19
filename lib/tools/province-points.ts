import type { ProvinceListItem } from "@/lib/api/types";
import type { GeoPoint } from "@/lib/map/measure";

/**
 * The 81-province picker's option list — the CBS tools' keyboard input path.
 *
 * SPEC §6.1 gives every measurement tool three ways in, and this is the one that makes the
 * others optional: picking two provinces from a list works with no pointer, no zoom and no
 * map at all, which is what SPEC §10.1 and WCAG 2.1.1 require of the PRIMARY path. Clicking
 * the map is the enhancement on top.
 *
 * ## Where the coordinate comes from, and why it changed
 *
 * From the api's `ProvinceListItem.latitude` / `.longitude` — the il-merkezi point the api
 * publishes (MGM's provincial-centre station).
 *
 * **This is a deliberate deviation from SPEC §6.1 and `plan-web.md` §5.6, ruled by Atlas as
 * AK-27 md.2 (2026-08-19).** Both of those predate the api field: the SPEC said "the centres
 * in `tr-provinces.generated.ts`" and the plan proposed deriving a point from the province
 * polygon with `largestSubpathInteriorPoint()`. Either would have produced a point that is
 * NOT the one the province page publishes, so the tool and the corpus would have disagreed
 * about where a province is — and `GLOSSARY.md` §1 names conflating an area's centroid with
 * the il merkezi as its own error. A measuring instrument that contradicts the page it links
 * to is worse than one that lacks a picker.
 *
 * ## A province with no point is OMITTED, never approximated
 *
 * The api declares both fields `nullable` while listing them as required, so the key is
 * always present and the value may be `null`. A province in that state is left OUT of the
 * options rather than falling back to the polygon centroid: the fallback is exactly the
 * conflation above, and it would be invisible — a plausible distance computed from the wrong
 * point. The picker is allowed to be short; it is not allowed to be wrong.
 */
export interface ProvincePoint {
  /** The api's two-digit plaka kodu — stable option value, never the display name. */
  readonly plateCode: string;
  /** Turkish name, which is what the api publishes in both locales. */
  readonly nameTr: string;
  readonly point: GeoPoint;
}

/**
 * Builds the picker options from the api list, dropping any province whose point the api
 * does not publish, and ordering them with the collator the province index already uses.
 *
 * `collationLocale` is fixed at `"tr"` rather than taken from the page, and that is the same
 * rule `lib/geo/alphabet.ts` states at length: province labels are Turkish in BOTH locales
 * because `ProvinceListItem` carries no `nameEn`, so collating them by the page locale would
 * sort Turkish names with English rules on `/en`. Measured there against the real 81: 67 of
 * them land in a different position under a naive sort.
 */
export function buildProvincePoints(provinces: readonly ProvinceListItem[]): ProvincePoint[] {
  const collator = new Intl.Collator("tr");
  return provinces
    .flatMap((province) => {
      const { latitude, longitude } = province;
      if (latitude === null || longitude === null) return [];
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [
        {
          plateCode: province.plateCode,
          nameTr: province.nameTr,
          point: { lon: longitude, lat: latitude },
        },
      ];
    })
    .sort((a, b) => collator.compare(a.nameTr, b.nameTr));
}

/** Finds a picked option by its plaka kodu; `null` when the code is not in the list. */
export function findProvincePoint(
  options: readonly ProvincePoint[],
  plateCode: string,
): ProvincePoint | null {
  return options.find((option) => option.plateCode === plateCode) ?? null;
}
