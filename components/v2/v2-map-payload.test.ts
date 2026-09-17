import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO MAP SURFACE SHIPS THE SAME GEOMETRY TWICE.
 *
 * ## What this replaces
 *
 * V1 painted its maps in two marked groups — `data-map-layer="base"` (decorative, `aria-hidden`)
 * and `data-map-layer="hit"` (interactive, crawlable) — over one `<defs>` block of `<use>`-able
 * paths. `components/map/map-layers.test.ts` pinned that architecture: base declared once, hit
 * once, base painted first (SVG has no z-index), the geometry emitted once and only inside
 * `<defs>`, kept classless and carrying `vector-effect`, and every `<a>` confined to the hit
 * layer so the internal link graph could not be crawled twice.
 *
 * T-032 PR4 deleted those components. V2 draws each map inline with no base/hit split and no
 * anchors inside the SVG at all, so the layer-order and link-duplication rules have no subject —
 * re-expressing them would invent requirements rather than preserve them.
 *
 * ## What survives, because it is about bytes rather than architecture
 *
 * `tr-provinces.generated.ts` is ~58 KB of path data. Iterating it a second time to emit `d=`
 * again — for a hover outline, a shadow pass, a "tidy-up" that mirrors one loop into another —
 * doubles the largest thing on the page while looking like a refactor and rendering identically.
 * That was the sharpest edge of the V1 rule and it applies to every V2 map unchanged.
 *
 * The surface list is DERIVED, for the reason `lib/map/tr-inland-water-jrc.test.ts` records: a
 * hand-kept list is exactly how eight V2 map surfaces went unnoticed for a whole rewrite.
 */

const GENERATED_ARRAYS = [
  "PROVINCE_SHAPES",
  "INLAND_WATER_SHAPES",
  "CONTEXT_SHAPES",
  "WORLD_SHAPES",
] as const;

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });

const surfaces = ["components", "app"]
  .flatMap((r) => walk(join(repoRoot, r)))
  .map((file) => ({ name: file.slice(repoRoot.length), source: readFileSync(file, "utf8") }))
  .filter(({ source }) => GENERATED_ARRAYS.some((a) => source.includes(`${a}.map(`)));

/** How many separate iterations of `array` in `source` emit a `d=` path attribute. */
function geometryEmittingLoops(source: string, array: string): number {
  let count = 0;
  const needle = `${array}.`;
  for (let i = source.indexOf(needle); i !== -1; i = source.indexOf(needle, i + 1)) {
    // A chain like `CONTEXT_SHAPES.filter(...).map(...)` is ONE iteration; only count the head.
    if (source.slice(Math.max(0, i - 40), i).includes(needle)) continue;
    // The JSX a single iteration can produce, generously bounded.
    if (/\bd=\{/.test(source.slice(i, i + 600))) count += 1;
  }
  return count;
}

describe("V2 map surfaces do not duplicate generated geometry", () => {
  it("finds the surfaces to check", () => {
    // Anti-vacuity: an empty list passes every assertion below for free, and deriving the list
    // is the whole reason this rule survived the rewrite.
    expect(surfaces.length, "components iterating a generated shape array").toBeGreaterThan(3);
  });

  it.each(surfaces)("$name emits each array's geometry from one loop", ({ source }) => {
    for (const array of GENERATED_ARRAYS) {
      if (!source.includes(`${array}.map(`)) continue;
      expect(
        geometryEmittingLoops(source, array),
        `${array} is iterated for geometry more than once — that ships the path data twice`,
      ).toBeLessThanOrEqual(1);
    }
  });
});
