import { getTranslations } from "next-intl/server";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import type { Locale } from "@/i18n/routing";
import { buildGameShapes } from "@/lib/game/map-shapes";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import styles from "./game-map.module.css";

interface GameMapProps {
  locale: Locale;
}

/**
 * The game's Türkiye map (server component — SPEC §4.2).
 *
 * A SEPARATE surface from `components/map/turkey-map-section.tsx`, which is deliberately
 * never opened by this work. There, a shape is wrapped in `<a href="/turkiye/{slug}">`
 * and a click NAVIGATES; here a click will ANSWER a question (PR-2). Merging the two
 * behind a `mode` prop would leak game state into the most SEO-critical component on the
 * site (81 crawlable internal links), so the two share their DATA sources and nothing
 * else: the same generated artifact (`lib/map/tr-provinces.generated.ts` — raw GeoJSON
 * never ships) and the same `/api/provinces/map-summary` payload.
 *
 * PR-1 renders it INERT: 81 `<path>` elements in the first-response HTML and no
 * interaction at all, so the page is a real map picture with JavaScript switched off.
 * The island that adds the question/answer layer lands in PR-2 and finds the shapes
 * through the `data-*` join surface pinned in SPEC §4.2 — it never ships a second copy
 * of the province table as JavaScript.
 *
 * Because the shapes are not actionable yet, the whole SVG is exposed to assistive tech
 * as ONE labelled image rather than 81 anonymous children (WCAG 1.1.1); per-shape
 * accessible names + keyboard targets arrive with the interaction they describe.
 */
export async function GameMap({ locale }: GameMapProps) {
  const t = await getTranslations("Game");
  const tMap = await getTranslations("Map");

  // Build-tolerant, runtime-strict (`getMapSummaryResilient`): at `next build` an api
  // outage degrades the map to an unjoined outline instead of failing the build, but at
  // RUNTIME the failure propagates so ISR keeps serving the last good page. The map join
  // is this page's only api read, so swallowing it at runtime would let a regeneration
  // "succeed" with zero targets and cache an inert map for a whole revalidate window.
  const summaries = await getMapSummaryResilient();

  const shapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const titleId = "game-map-title";

  return (
    <div className={styles.frame}>
      {/* Fixed-size stage (aspect-ratio from MAP_VIEWBOX): the box reserves its height
          before any script runs, so the PR-2 island can mount a HUD on top of it without
          moving a single pixel of the page (CLS budget, CONVENTIONS §6 #9). */}
      <div className={styles.stage} data-game-map>
        <svg
          className={styles.svg}
          viewBox={MAP_VIEWBOX}
          role="img"
          aria-labelledby={titleId}
          focusable="false"
        >
          <title id={titleId}>{t("mapTitle")}</title>
          {shapes.map((shape) => (
            <path
              key={shape.plateCode}
              className={shape.target ? styles.province : styles.provinceInert}
              d={shape.d}
              data-plate={shape.plateCode}
              data-region={shape.target?.region}
              data-slug={shape.target?.slug}
            />
          ))}
        </svg>
      </div>

      {/* ODbL obligation: the attribution stays visible wherever these shapes are drawn
          (SPEC §1). Shared string with the /turkiye map — one source, never re-typed. */}
      <p className={styles.attribution}>{tMap("attribution")}</p>
    </div>
  );
}
