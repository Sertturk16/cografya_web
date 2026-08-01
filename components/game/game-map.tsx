import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { MapZoomPan } from "@/components/map/map-zoom-pan";
import { aspectOfViewBox } from "@/lib/game/map-bbox";
import type { GameShapeEntry } from "@/lib/game/map-shapes";
import styles from "./game-map.module.css";

/**
 * `React.CSSProperties` has no index signature for custom properties, and the usual
 * workaround is to assert the whole object. Naming the one property instead keeps the rest
 * of the object type-checked, so a typo in a real CSS property is still a compile error.
 */
type StageStyle = CSSProperties & Record<"--game-stage-aspect", string>;

interface GameMapProps {
  /** The shapes to DRAW — already narrowed to the round's map (§ region mode). */
  shapes: readonly GameShapeEntry[];
  /** The frame these shapes are drawn in: the full map's, or the region subset's. */
  viewBox: string;
  /** `<title>` of the SVG — what assistive tech calls this picture. */
  title: string;
}

/**
 * The game's map surface (server component — SPEC §4.2).
 *
 * A SEPARATE surface from `components/map/turkey-map-section.tsx`, which is deliberately
 * never opened by this work. There, a shape is wrapped in an anchor and a click NAVIGATES;
 * here a click ANSWERS a question. Merging the two behind a `mode` prop would leak game
 * state into the most SEO-critical component on the site (81 crawlable internal links), so
 * the two share their DATA sources and nothing else: the same generated artifact
 * (`lib/map/tr-provinces.generated.ts` — raw GeoJSON never ships) and the same
 * `/api/provinces/map-summary` payload.
 *
 * This file contains NO link of any kind, and a CI guard keeps it that way
 * (`game-map.nav-guard.test.ts`): on a play surface a click must answer a question, never
 * navigate. The back link and the end-of-round province links live in their own files.
 *
 * WHAT IS SERVER-RENDERED HERE: every `<path>` of the round's map, in the first response.
 * With JavaScript switched off the page still shows a real map. The island only enhances
 * it.
 *
 * SUBSET RENDERING (→ DEC 2026-07-30p). In the region mode the caller hands over only that
 * region's provinces and a viewBox fitted to them, so the other regions are not dimmed,
 * they are absent — and the region fills the same stage the whole country used to, which
 * is what makes its smallest provinces comfortably tappable.
 *
 * While no round is running the SVG is exposed to assistive tech as ONE labelled image
 * rather than N anonymous children (WCAG 1.1.1). The island swaps that for per-shape
 * `role="button"` names the moment there is something to answer, and swaps it back when
 * the round ends.
 */
export async function GameMap({ shapes, viewBox, title }: GameMapProps) {
  const t = await getTranslations("Game");
  const tMap = await getTranslations("Map");
  const titleId = "game-map-title";
  const instructionsId = "game-map-instructions";
  // The stage takes its shape FROM the frame it is drawing, so the map fills the box
  // exactly instead of letterboxing inside a fixed one — which is what lets a region's
  // provinces use the full width they are entitled to (`lib/game/map-bbox.ts`).
  //
  // Handed to CSS as a CUSTOM PROPERTY rather than as `aspect-ratio` directly, because the
  // stylesheet needs the ratio as a NUMBER in arithmetic too: the viewport cap it applies is
  // a height, and turning a height cap into the width that produces it is a multiplication
  // by this ratio (`game-map.module.css` `.stage`). One value, read twice, so the shape and
  // the cap can never disagree.
  //
  // The guard is `> 0`, not just "not null": the ratio is now an operand in the stylesheet's
  // width arithmetic, so a zero would compute `width: 0` and erase the map, where the old
  // `aspect-ratio`-only usage merely fell back to the CSS default. `aspectOfViewBox` already
  // rejects non-finite and non-positive boxes, so this is unreachable — it is here so the
  // unreachable branch fails toward the fallback ratio rather than toward a blank stage.
  const aspect = aspectOfViewBox(viewBox);
  const stageStyle: StageStyle | undefined =
    aspect !== null && aspect > 0 ? { "--game-stage-aspect": String(aspect) } : undefined;

  return (
    <div className={styles.frame}>
      {/* FIXED-SIZE STAGE. Fixed does not mean constant: the ratio is server-rendered from
          the viewBox, so it is settled before any script runs and the overlays mount on top
          of it without moving a single pixel of the page (CLS budget, CONVENTIONS §6 #9).
          The CSS default is the full map's ratio, for the case the string is unreadable. */}
      <div className={styles.stage} style={stageStyle} data-game-map>
        {/* Rendered BEFORE the <svg> so the zoom controls come first in tab order — a
            keyboard player reaches +/−/reset without tabbing through every province (the
            solution already proven on /dunya). Visual position is unaffected: the layer is
            absolutely positioned, and the island finds the <svg> by query. */}
        <MapZoomPan
          viewBox={viewBox}
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
          viewBox={viewBox}
          role="img"
          aria-labelledby={titleId}
          focusable="false"
        >
          <title id={titleId}>{title}</title>
          {shapes.map((shape) => (
            <path
              key={shape.plateCode}
              className={shape.target ? styles.province : styles.provinceInert}
              d={shape.d}
              data-plate={shape.plateCode}
              data-region={shape.target?.region}
            />
          ))}
        </svg>

        {/* ODbL obligation: the attribution stays visible wherever these shapes are drawn
            (SPEC §1). Shared string with the /turkiye map — one source, never re-typed. */}
        <p className={styles.attribution}>{tMap("attribution")}</p>
      </div>

      {/* Keyboard-controls description the zoomable SVG points at via aria-describedby
          (wired client-side by the zoom island). Visually hidden — the always-visible
          +/− buttons carry the sighted affordance. */}
      <p id={instructionsId} className={styles.srOnly}>
        {t("zoomInstructions")}
      </p>
    </div>
  );
}
