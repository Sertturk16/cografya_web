import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * Country borders on the two world-map surfaces are drawn in CSS pixels, not viewBox units.
 *
 * `WORLD_MAP_VIEWBOX` is 1000 units wide. A unitless `stroke-[0.4]` without
 * `vector-effect: non-scaling-stroke` rendered 0.108px on a 360px phone (a 269px-wide map), under
 * one device pixel, so every continent drew as one blob (T-092). The rule: every country `<path>`
 * carries `non-scaling-stroke`, and no stroke width on it is a bare viewBox number.
 */
const read = (file: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8"));

const SURFACES = ["./v2-world-map-explorer.tsx", "./v2-continent-locator-map.tsx"] as const;

/** A Tailwind stroke width in viewBox units: `stroke-[0.4]`, `focus-visible:stroke-[2]`. */
const UNITLESS_STROKE_WIDTH = /\bstroke-\[\d*\.?\d+\]/g;

describe.each(SURFACES)("%s", (file) => {
  const source = read(file);

  it("draws every country path with a non-scaling stroke", () => {
    const paths = source.match(/<path\b[\s\S]*?\/>/g) ?? [];
    expect(paths.length, "no <path> found; re-anchor this test").toBeGreaterThan(0);
    for (const path of paths) {
      expect(
        /\[vector-effect:non-scaling-stroke\]|vectorEffect="non-scaling-stroke"/.test(path),
        `a country <path> without non-scaling-stroke:\n${path.slice(0, 200)}`,
      ).toBe(true);
    }
  });

  it("spells no stroke width in viewBox units", () => {
    // The graticule lines are map furniture, not borders, and deliberately scale with the map.
    const allowed = file === "./v2-world-map-explorer.tsx" ? ["stroke-[0.5]", "stroke-[0.8]"] : [];
    const found = [...new Set(source.match(UNITLESS_STROKE_WIDTH) ?? [])].sort();
    expect(found).toEqual(allowed);
  });
});

/**
 * The explorer zooms with a CSS `scale()` on an HTML wrapper, which `non-scaling-stroke` does not
 * undo (measured: a 0.75px border drew 2.85px at 3.8x). Its border width is divided by the zoom.
 */
it("the world explorer divides its border width by the zoom", () => {
  const source = read("./v2-world-map-explorer.tsx");
  expect(source).toContain("[stroke-width:calc(var(--country-stroke)/var(--map-zoom))]");
  expect(source).toMatch(/"--map-zoom": zoom/);
});
