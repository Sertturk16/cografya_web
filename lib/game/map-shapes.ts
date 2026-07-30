import type { ProvinceMapSummary } from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";
import type { ProvinceShape } from "@/lib/map/tr-provinces.generated";

/**
 * The pure join between the build-time SVG artifact and the api's province records,
 * shared by the game map (`components/game/game-map.tsx`).
 *
 * It lives here rather than inside the component for one reason: it is the part of the
 * map that has a CONTRACT (one entry per shape, in artifact order; an unseeded plate can
 * never carry a target; the slug is the locale's own slug), and a contract is worth
 * testing without rendering React or reaching the api. The component keeps the markup.
 *
 * No geography facts are encoded here (CONVENTIONS §4): the shapes come from the
 * generated artifact, and the name/region/slug come from the api. This module only
 * decides how the two are paired.
 */

/**
 * The answer-relevant data for one shape, or `null` when the province is not seeded.
 *
 * These are exactly the two `data-*` values SPEC §4.2 pins as the game map's join
 * surface (alongside the plaka kodu): the region GROUPS shapes for the region modes, and
 * the slug is what the end-of-round "provinces you missed" list links to. Both are
 * server-rendered onto the shape so the future island reads them from the DOM instead of
 * shipping a second copy of the province table as JavaScript (SPEC §3.3).
 */
export interface GameShapeTarget {
  /** Coğrafi bölge ENUM KEY (e.g. "EGE"), never a translated label. */
  readonly region: ProvinceMapSummary["region"];
  /** The locale's own slug, so a link built from it resolves in that locale. */
  readonly slug: string;
}

/** One rendered `<path>` of the game map. */
export interface GameShapeEntry {
  /** Plaka kodu (zero-padded 2-digit) — the stable join key. */
  readonly plateCode: string;
  /** SVG path `d` from the generated artifact. */
  readonly d: string;
  /**
   * `null` for a plate the api does not (yet) publish: the shape still renders, as
   * geographic backdrop, but it can never become a question or an answer. This mirrors
   * the `/turkiye` map's "no link for an unpublished il" rule, one layer down.
   */
  readonly target: GameShapeTarget | null;
}

/**
 * Pairs every generated province shape with its api record.
 *
 * Order and cardinality follow the ARTIFACT, not the api: exactly one entry per shape,
 * in plaka-kodu order. That keeps the DOM order deterministic (and therefore the future
 * tab order deterministic too, SPEC §8.1) even if the api's payload is reordered or
 * arrives short.
 */
export function buildGameShapes(
  shapes: readonly ProvinceShape[],
  summaries: readonly ProvinceMapSummary[],
  locale: Locale,
): GameShapeEntry[] {
  const byPlate = new Map(summaries.map((summary) => [summary.plateCode, summary]));

  return shapes.map((shape) => {
    const province = byPlate.get(shape.plateCode);
    return {
      plateCode: shape.plateCode,
      d: shape.d,
      target: province
        ? {
            region: province.region,
            slug: locale === "en" ? province.slugEn : province.slugTr,
          }
        : null,
    };
  });
}
