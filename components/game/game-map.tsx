import { getTranslations } from "next-intl/server";
import { MapZoomPan } from "@/components/map/map-zoom-pan";
import { getMapSummaryResilient } from "@/lib/api/provinces";
import type { Locale } from "@/i18n/routing";
import { buildGameShapes, toTargetEntries } from "@/lib/game/map-shapes";
import type { RegionLabels } from "@/lib/game/target";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/map/tr-provinces.generated";
import { GameIslandLoader } from "./game-island-loader";
import styles from "./game-map.module.css";

interface GameMapProps {
  locale: Locale;
  /**
   * The locale's province-detail path with the slug placeholder in it, resolved by the
   * PAGE through `getPathname`. It is threaded through rather than built here on purpose:
   * route construction belongs to the route layer, and keeping it out of this file is also
   * what lets the "the game map never navigates" CI guard hold this component to
   * containing no URL of any kind (`game-map.nav-guard.test.ts`).
   */
  provinceUrlTemplate: string;
}

/**
 * The game's Türkiye map (server component — SPEC §4.2).
 *
 * A SEPARATE surface from `components/map/turkey-map-section.tsx`, which is deliberately
 * never opened by this work. There, a shape is wrapped in an anchor and a click NAVIGATES;
 * here a click ANSWERS a question. Merging the two behind a `mode` prop would leak game
 * state into the most SEO-critical component on the site (81 crawlable internal links), so
 * the two share their DATA sources and nothing else: the same generated artifact
 * (`lib/map/tr-provinces.generated.ts` — raw GeoJSON never ships) and the same
 * `/api/provinces/map-summary` payload.
 *
 * WHAT IS SERVER-RENDERED HERE: all 81 `<path>` elements, in the first response. With
 * JavaScript switched off the page still shows a real Türkiye map, and a crawler sees the
 * same HTML it did before the game existed. The island only enhances it.
 *
 * WHAT THE CLIENT GETS: `toTargetEntries` strips the path geometry before the shape data
 * crosses the boundary, so the 56 KB of `d` is paid once, as HTML, and never a second time
 * as JavaScript (SPEC §3.3).
 *
 * While no round is running the SVG is exposed to assistive tech as ONE labelled image
 * rather than 81 anonymous children (WCAG 1.1.1). The island swaps that for per-shape
 * `role="button"` names the moment there is something to answer, and swaps it back when
 * the round ends.
 */
export async function GameMap({ locale, provinceUrlTemplate }: GameMapProps) {
  const t = await getTranslations("Game");
  const tMap = await getTranslations("Map");
  const tRegions = await getTranslations("Regions");

  // Build-tolerant, runtime-strict (`getMapSummaryResilient`): at `next build` an api
  // outage degrades the map to an unjoined outline instead of failing the build, but at
  // RUNTIME the failure propagates so ISR keeps serving the last good page. The map join
  // is this page's only api read, so swallowing it at runtime would let a regeneration
  // "succeed" with zero targets and cache an inert map for a whole revalidate window.
  const summaries = await getMapSummaryResilient();

  const shapes = buildGameShapes(PROVINCE_SHAPES, summaries, locale);
  const titleId = "game-map-title";
  const instructionsId = "game-map-instructions";

  // Region names come from the shared `Regions` namespace, so the game and the rest of the
  // site can never disagree about what a bölge is called.
  const regionLabels: RegionLabels = {
    MARMARA: tRegions("MARMARA"),
    EGE: tRegions("EGE"),
    AKDENIZ: tRegions("AKDENIZ"),
    IC_ANADOLU: tRegions("IC_ANADOLU"),
    KARADENIZ: tRegions("KARADENIZ"),
    DOGU_ANADOLU: tRegions("DOGU_ANADOLU"),
    GUNEYDOGU_ANADOLU: tRegions("GUNEYDOGU_ANADOLU"),
  };

  return (
    <div className={styles.frame}>
      {/* Pre-sized HUD slot. The island mounts INTO it, so the play controls appear without
          moving the map; until then — and permanently, with JavaScript off — it holds the
          same instruction line the island would show. */}
      <div className={styles.hudSlot} data-game-hud>
        <p className={styles.hudFallback}>{t("hudIdle")}</p>
        <GameIslandLoader
          shapes={toTargetEntries(shapes)}
          regionLabels={regionLabels}
          provinceUrlTemplate={provinceUrlTemplate}
        />
      </div>

      {/* Fixed-size stage (aspect-ratio from MAP_VIEWBOX): the box reserves its height
          before any script runs, so the overlays mount on top of it without moving a
          single pixel of the page (CLS budget, CONVENTIONS §6 #9). */}
      <div className={styles.stage} data-game-map>
        {/* Rendered BEFORE the <svg> so the zoom controls come first in tab order — a
            keyboard player reaches +/−/reset without tabbing through 81 provinces (the
            solution already proven on /dunya). Visual position is unaffected: the layer is
            absolutely positioned, and the island finds the <svg> by query. */}
        <MapZoomPan
          viewBox={MAP_VIEWBOX}
          instructionsId={instructionsId}
          labels={{
            zoomIn: t("zoomIn"),
            zoomOut: t("zoomOut"),
            reset: t("zoomReset"),
            instructions: t("zoomInstructions"),
            controls: t("zoomControls"),
            hint: t("zoomHint"),
            dismissHint: t("zoomDismissHint"),
          }}
        />

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

      {/* Keyboard-controls description the zoomable SVG points at via aria-describedby
          (wired client-side by the zoom island). Visually hidden — the always-visible
          +/− buttons carry the sighted affordance. */}
      <p id={instructionsId} className={styles.srOnly}>
        {t("zoomInstructions")}
      </p>

      {/* ODbL obligation: the attribution stays visible wherever these shapes are drawn
          (SPEC §1). Shared string with the /turkiye map — one source, never re-typed. */}
      <p className={styles.attribution}>{tMap("attribution")}</p>
    </div>
  );
}
