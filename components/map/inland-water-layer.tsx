import { INLAND_WATER_SHAPES } from "@/lib/map/tr-inland-water.generated";
import styles from "./inland-water.module.css";

/**
 * Türkiye's lakes and reservoirs, drawn on top of the province outlines.
 *
 * ## Where it goes, and why the position is the feature
 *
 * Render it as the LAST child of the `<svg>`, after the province shapes. That single fact
 * does two jobs at once:
 *
 *   1. it hides the administrative boundary segments that run across a lake — every
 *      published Türkiye political map, including HGM's official 1:2 000 000 sheet, cuts the
 *      province line at the shore and draws the lake as one undivided body (→ DEC
 *      2026-08-01r-3). No geometric intersection is computed and no province geometry is
 *      read: paint order is the whole mechanism;
 *   2. it puts the water above the links in hit-testing order, which is what implements the
 *      owner's ruling that a click on water does nothing (see `inland-water.module.css`).
 *
 * ## Why it is inert to assistive tech
 *
 * `aria-hidden` on a decorative `<g>` is not the anti-pattern it would be on a control:
 * these paths are not focusable, carry no role and no `tabindex`, and add no anchor, so the
 * tab order and the `<a>` count of every surface are unchanged. A lake is a picture element
 * here — it has no page, no label and no action — so announcing 39 unnamed shapes would be
 * pure noise. When labels or lake pages exist, they will arrive as real content, not as an
 * `aria-label` bolted onto a path.
 *
 * ## Why one component for four surfaces
 *
 * `/turkiye`, the game's full map, the game's region maps and `/deniz` all draw the same
 * pinned frame. Rendering the layer from one file is what guarantees they cannot drift into
 * three slightly different lakes. It is a server component with no state and no client JS.
 */

/**
 * The LAND this surface draws, as a clip region.
 *
 * `paths` and `id` are ONE object rather than two optional props on purpose. As two props,
 * passing `clipToPaths` and forgetting `clipId` type-checked and rendered the layer
 * completely UNCLIPPED — the exact defect the clip exists to prevent, restored silently, with
 * the call site still reading as though it clips. Bundling them makes "half a clip"
 * unrepresentable.
 */
interface InlandWaterClip {
  /**
   * Province path `d` strings that define the LAND on this surface — pass a clip only when
   * the surface draws a SUBSET of the country.
   *
   * The game's region rounds are the case this exists for, and rendered samples are what
   * found it. A region map narrows the viewBox to the region's bounding box, which was
   * assumed to clip the rest away. It does not: Keban, Karakaya and Atatürk all fall inside
   * Doğu Anadolu's bounding box while lying in provinces the round does not draw, so they
   * rendered as blue filaments floating on the empty parchment beyond the region's edge.
   *
   * An EMPTY array is honoured as "this surface draws no land", so no water is drawn. That is
   * deliberate: the alternative — falling back to unclipped — would put every body in the
   * artifact on an empty parchment, which is the loudest possible version of the same defect.
   */
  readonly paths: readonly string[];
  /** Unique id for the clip path — one per surface, since ids are document-global. */
  readonly id: string;
}

interface InlandWaterLayerProps {
  /**
   * Pass a clip only on a surface that draws part of the country. The full-country surfaces
   * pass nothing: every body in the artifact is Turkish and the whole country is on screen,
   * so a clip there would be ~57 kB of markup to change no pixel.
   */
  readonly clip?: InlandWaterClip;
}

export function InlandWaterLayer({ clip }: InlandWaterLayerProps) {
  return (
    <g className={styles.layer} aria-hidden="true" clipPath={clip ? `url(#${clip.id})` : undefined}>
      {clip && (
        <clipPath id={clip.id}>
          {clip.paths.map((d, index) => (
            // The land shapes again, as a clip region. Index keys are correct here: this is
            // a static, order-stable projection of the caller's own array, and the elements
            // carry no state.
            <path key={index} d={d} />
          ))}
        </clipPath>
      )}
      {INLAND_WATER_SHAPES.map((shape) => (
        <path key={shape.id} className={styles.water} d={shape.d} />
      ))}
    </g>
  );
}
