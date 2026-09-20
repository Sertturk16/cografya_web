import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  jsxElementsOf,
  label,
  readSource,
  type ScannedElement,
} from "@/lib/test-support/composition-scan";

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
 * surfaces draw their own inline SVG and render the shared `MapAttribution` after it, so the
 * plate rule has no stylesheet to police and the `[data-map-root]` hook no longer exists.
 *
 * What survives is the part that was never about V1: a credit nested INSIDE the map box is a
 * credit drawn over the map. Asserted across every surface that renders the component, derived
 * rather than listed — the same reason `lib/map/tr-inland-water-jrc.test.ts` derives its list.
 *
 * ## Why source order was not the rule
 *
 * The first version of this file asked only that `<MapAttribution` appear AFTER a `</svg>` in the
 * file's text, with no `<svg` opening in between. Every surface satisfied that while six of them
 * rendered the credit as a CHILD of the map box, because closing a tag and leaving an element are
 * different things: `</svg>` closes the map, the plate `</div>` that follows it does not.
 *
 * What that cost, measured on production rather than argued: on the two plates that are
 * `flex items-center justify-center` — `v2-game-screen.tsx` (three game modes) and
 * `v2-tool-workbench.tsx` (three GIS tools) — the credit `<p>` became a FLEX ITEM beside the
 * `<svg>` and took 517px of a 1166px plate. The map drew at 647px, a little over half the box it
 * was given. On the four plates that are plain blocks with `overflow-hidden`, the credit flowed
 * below a `h-full` map and was clipped away entirely: on `/deprem` it sat at y=532 in a 533px
 * box, so the ODbL and JRC credits this component exists to publish were on no screen at all.
 * One misplacement, two opposite symptoms, neither visible to a source-order check.
 *
 * So the rule is now read off the JSX TREE, through the one scanner (`composition-scan.ts`, per
 * T-045's single-reader rule): the element that holds the `<svg>` may not also hold the credit.
 * The source-order check stays below it — it is cheap, and it still catches the different mistake
 * of crediting a map that has not been drawn yet.
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

// COMMENT-STRIPPED, through the same reader the scanner uses. The first version of this file read
// the raw bytes, so a docblock saying "a flex sibling of the `<svg>`" was markup as far as the
// source-order check was concerned — and the rule's own explanation could fail the rule. That is
// the third time in this repo a comment has been read as JSX; `composition-scan.ts` exists partly
// because of the other two.
const surfaces = roots
  .flatMap(walk)
  .map((file) => ({
    name: file.slice(file.lastIndexOf("/") + 1),
    file,
    source: readSource(file),
  }))
  .filter(
    ({ source, name }) => source.includes("<MapAttribution") && name !== "map-attribution.tsx",
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
    expect(surfaces.length, "surfaces rendering MapAttribution").toBeGreaterThan(4);
  });

  /** The chain of enclosing elements, innermost first. Indices into `elements`. */
  const ancestorsOf = (elements: readonly ScannedElement[], index: number): number[] => {
    const chain: number[] = [];
    for (let at = elements[index]?.parent ?? null; at !== null; at = elements[at]?.parent ?? null) {
      chain.push(at);
    }
    return chain;
  };

  it.each(surfaces)("$name renders the credit outside the map box", ({ file }) => {
    const elements = jsxElementsOf(file);
    const credits = elements.flatMap((el, i) => (el.tag === "MapAttribution" ? [i] : []));
    const maps = elements.flatMap((el, i) => (el.tag === "svg" ? [i] : []));

    // Anti-vacuity per file: the walk above selected this file BECAUSE it writes both tags, so a
    // scan that finds neither means the scanner and the filter disagree — a broken test reading
    // as a pass, which is the failure mode this suite is least able to notice.
    expect(credits.length, `${label(file)}: scanner found no <MapAttribution>`).toBeGreaterThan(0);
    expect(maps.length, `${label(file)}: scanner found no <svg>`).toBeGreaterThan(0);

    for (const credit of credits) {
      const enclosing = ancestorsOf(elements, credit);
      for (const map of maps) {
        // The map box is whatever element holds the `<svg>`. A credit anywhere below that element
        // is drawn ON the map: squeezing it when the box lays its children out in a row, clipped
        // by the box when it does not.
        const box = elements[map]?.parent;
        if (box === null || box === undefined) continue;
        expect(
          enclosing,
          `${label(file)}: the credit is inside <${elements[box]?.tag}>, which holds the map`,
        ).not.toContain(box);
      }
    }
  });

  it.each(surfaces)("$name emits the credit after the map closes", ({ source }) => {
    const credit = source.indexOf("<MapAttribution");
    const lastSvgClose = source.lastIndexOf("</svg>", credit);
    expect(lastSvgClose, "no </svg> before the credit").toBeGreaterThan(-1);

    // Between the map closing and the credit there may be wrapper divs closing, but no <svg>
    // may OPEN — that would mean the credit sits inside a later map rather than after this one.
    const between = source.slice(lastSvgClose, credit);
    expect(between, "credit is nested inside a map").not.toMatch(/<svg[\s>]/);
  });
});
