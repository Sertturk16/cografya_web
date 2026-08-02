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
 * three slightly different lakes. It is a server component with no props: it has no state,
 * no client JS and nothing to configure — the region maps clip it with their own viewBox.
 */
export function InlandWaterLayer() {
  return (
    <g className={styles.layer} aria-hidden="true" data-inland-water>
      {INLAND_WATER_SHAPES.map((shape) => (
        <path key={shape.id} className={styles.water} d={shape.d} />
      ))}
    </g>
  );
}
