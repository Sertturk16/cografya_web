import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The credit sits UNDER the map box, never on it.
 *
 * ## What the rule is, and what it was
 *
 * Two owner rulings removed a plated credit chip that floated over `/turkiye`'s map. V1 enforced
 * that structurally — the credit `<p>` had to be a SIBLING of `[data-map-root]`, emitted after
 * the panel's own `</div>` closed — plus a stylesheet rule that the retired `.attribution` plate
 * class was deleted rather than left warm for another surface to pick up.
 *
 * T-032 PR4 deleted `turkey-map-section.tsx` and `map.module.css` with the rest of V1. The V2
 * surfaces draw their own inline SVG and render the shared `V2MapAttribution` after it, so the
 * plate rule has no stylesheet to police and the `[data-map-root]` hook no longer exists.
 *
 * What survives is the part that was never about V1: a credit nested INSIDE the map box is a
 * credit drawn over the map. Asserted across every surface that renders the component, derived
 * rather than listed — the same reason `lib/map/tr-inland-water-jrc.test.ts` derives its list.
 */

const roots = [
  fileURLToPath(new URL("../../components/", import.meta.url)),
  fileURLToPath(new URL("../../app/", import.meta.url)),
];
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });

const surfaces = roots
  .flatMap(walk)
  .map((file) => ({
    name: file.slice(file.lastIndexOf("/") + 1),
    source: readFileSync(file, "utf8"),
  }))
  .filter(
    ({ source, name }) => source.includes("<V2MapAttribution") && name !== "v2-map-attribution.tsx",
  )
  // A surface that draws NO inline `<svg>` has no map box for the credit to be nested inside,
  // so this rule is vacuous there and asserting it would be a false failure.
  // `/oyun/bolge-bolge-il` is the first such surface: it composes `V2RegionThumb`, whose seven
  // OSM-derived thumbnails draw their SVG in their own file, and carries ONE credit under the
  // grid for all of them. What that page owes is a credit at all — which is the subject of
  // `lib/map/tr-inland-water-jrc.test.ts`'s derived list, not of this file.
  .filter(({ source }) => /<svg[\s>]/.test(source));

describe("the map credit sits under the map box, never on it", () => {
  it("finds the surfaces to check", () => {
    // Anti-vacuity: an empty list would pass every assertion below for free, and the whole point
    // of deriving the list is that a new map surface joins it without anyone remembering.
    expect(surfaces.length, "surfaces rendering V2MapAttribution").toBeGreaterThan(4);
  });

  it.each(surfaces)("$name emits the credit after the map closes", ({ source }) => {
    const credit = source.indexOf("<V2MapAttribution");
    const lastSvgClose = source.lastIndexOf("</svg>", credit);
    expect(lastSvgClose, "no </svg> before the credit").toBeGreaterThan(-1);

    // Between the map closing and the credit there may be wrapper divs closing, but no <svg>
    // may OPEN — that would mean the credit sits inside a later map rather than after this one.
    const between = source.slice(lastSvgClose, credit);
    expect(between, "credit is nested inside a map").not.toMatch(/<svg[\s>]/);
  });
});
