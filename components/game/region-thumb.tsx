import type { CSSProperties } from "react";
import type { GeographicRegion } from "@/lib/api/types";
import { aspectOfViewBox } from "@/lib/game/map-bbox";
import type { GameShapeEntry } from "@/lib/game/map-shapes";
import { MAP_VIEWBOX } from "@/lib/map/tr-provinces.generated";
import styles from "@/app/[locale]/oyun/game.module.css";

/**
 * The Bölge Seç cards' mini map (→ DEC 2026-08-05g md. 3, shape ruled by Atlas AO-5).
 *
 * WHAT THE UX TOUR FOUND (B32): the region picker was seven cards carrying a title and a
 * button and nothing else. A player who does not already know where Doğu Anadolu is — which
 * is the entire population this mode exists for — had to pick one blind and find out
 * afterwards. The card asked the question the round is supposed to answer.
 *
 * THE SHAPE OF THE FIX IS THE OWNER'S (AO-5): the region is highlighted INSIDE the country's
 * silhouette, not drawn alone. A bare regional outline is a shape with no anchor — it tells
 * you what the region looks like, not where it is — and "where is it" is the question. The
 * measured cost of the country context is ~one extra `<use>` per card: the path data for all
 * eighty-one provinces has to be on the page either way, because every province belongs to
 * some region and all seven cards are on this screen.
 *
 * NO COUNTS ON THE CARDS (→ DEC 2026-07-30q + DEC 2026-08-05g md. 3). "11 il" is the same
 * badge the owner removed from the mode cards one level up.
 *
 * NO GEOGRAPHY IS ENCODED HERE. Which provinces make up a region arrives from the api through
 * `shape.target.region`, exactly as on the game map (CONVENTIONS §4); this file only groups
 * and draws what it is handed.
 *
 * DECORATIVE, and marked so. The card's own `<h2>` names the region, so the picture adds no
 * information an assistive-tech user would otherwise miss — a second announcement of the same
 * name would be noise (WCAG 1.1.1, decorative-image case).
 */

/** `id` prefix of the shared geometry — per SURFACE, since a `<use href>` is document-global. */
const THUMB_ID_PREFIX = "region-thumb-";

/** `id` of the whole-country backdrop group every card re-uses. */
const COUNTRY_ID = `${THUMB_ID_PREFIX}country`;

type ThumbStyle = CSSProperties & Record<"--region-thumb-aspect", string>;

/**
 * The geometry, ONCE per page — eighty-one classless `<path id>` plus one group that re-uses
 * all of them as the faint backdrop.
 *
 * Rendering the paths per card instead would put the artifact on the page seven times: 57.6 KB
 * raw becomes 403 KB. This element is the reason the feature costs ~21 KB gzip in total rather
 * than seven times that, and the cost is accepted as-is (→ Atlas AO-6): the page is `noindex`,
 * and the alternative — generating a second, decimated small-map artifact — is a build-script
 * investment nobody has asked for yet.
 *
 * `<svg>` with no size and `aria-hidden`: it paints nothing itself, it only defines.
 */
export function RegionThumbDefs({ shapes }: { shapes: readonly GameShapeEntry[] }) {
  return (
    <svg className={styles.thumbDefs} aria-hidden="true" focusable="false">
      <defs>
        {shapes.map((shape) => (
          <path key={shape.plateCode} id={`${THUMB_ID_PREFIX}${shape.plateCode}`} d={shape.d} />
        ))}
        <g id={COUNTRY_ID}>
          {shapes.map((shape) => (
            <use key={shape.plateCode} href={`#${THUMB_ID_PREFIX}${shape.plateCode}`} />
          ))}
        </g>
      </defs>
    </svg>
  );
}

interface RegionThumbProps {
  region: GeographicRegion;
  /** The plaka kodu of every province in THIS region, from the api's own grouping. */
  members: readonly string[];
}

/**
 * One card's picture: the whole country receding, this region standing out of it.
 *
 * FIXED-RATIO BOX, derived from the same viewBox it draws, so the card's height is settled by
 * the first layout pass and nothing moves as the page finishes loading (CLS budget,
 * ENGINEERING.md §4 #9).
 *
 * The highlight is ONE colour on all seven cards, deliberately. It marks "this card's area",
 * which is an affordance, not a value — the region's identity is carried by its SHAPE and by
 * the heading above it. Giving each card its own hue would be a categorical data encoding
 * (DESIGN.md §6.1) built out of chrome tokens, and it would teach a colour language this mode
 * never uses: the bölge-bölge-il rounds ask for provinces and draw no region tints at all.
 */
export function RegionThumb({ region, members }: RegionThumbProps) {
  const aspect = aspectOfViewBox(MAP_VIEWBOX);
  const style: ThumbStyle | undefined =
    aspect !== null && aspect > 0 ? { "--region-thumb-aspect": String(aspect) } : undefined;

  return (
    <svg
      className={styles.thumb}
      style={style}
      viewBox={MAP_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      data-region={region}
    >
      <use href={`#${COUNTRY_ID}`} className={styles.thumbBase} />
      {members.map((plateCode) => (
        <use
          key={plateCode}
          href={`#${THUMB_ID_PREFIX}${plateCode}`}
          className={styles.thumbActive}
        />
      ))}
    </svg>
  );
}
