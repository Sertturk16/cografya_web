import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_SHAPES } from "@/lib/map/tr-context.generated";
import { MAP_COUNTRY_NAMES_TR } from "@/lib/map/map-country-names";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * T-079. On a phone both explorers' boxes were forced taller than their maps (`min-h-[300px]`,
 * `min-h-[320px]`) and the gap painted as sea; zoom bounds are the box, so a zoomed map could be
 * panned into that gap; and the selection card covered the map and part of its own text. These
 * pin the source shape of the fix. What they cannot see — the measured empty area, card overlap
 * and label positions at 320–1440 — is recorded in the T-079 PR from the browser.
 */
const read = (file: string) => stripComments(readFileSync(join(__dirname, file), "utf8"));
const turkey = read("v2-turkey-map-explorer.tsx");
const labels = read("map-context-labels.tsx");

describe("/turkiye fills a squarer box with real geography (T-079)", () => {
  it("draws the tall context artifact with `slice`, not the wide one", () => {
    expect(turkey).toContain('from "@/lib/map/tr-context-tall.generated"');
    expect(turkey).not.toContain('from "@/lib/map/tr-context.generated"');
    expect(turkey).toMatch(/viewBox=\{TR_CONTEXT_TALL_VIEWBOX\}/);
    expect(turkey).toMatch(/preserveAspectRatio="xMidYMid slice"/);
  });

  it("is square on a phone, the tall frame's own shape, so `slice` crops nothing", () => {
    // At 320px a 231×300 box was taller than wide; `slice` then cut the frame's sides and with
    // them Türkiye's eastern edge. Square matches TR_CONTEXT_TALL_FRAME exactly.
    expect(turkey).toMatch(/\baspect-square sm:aspect-\[1270\/580\] sm:min-h-\[420px\]/);
    expect(turkey).not.toMatch(/(?<!sm:)min-h-\[300px\]/);
  });

  it("labels a country new to the tall frame only when it can hold a label", () => {
    expect(turkey).toMatch(/NEW_CONTEXT_LABEL_MIN_RADIUS = 30\b/);
    expect(turkey).toMatch(/c\.iso in MAP_COUNTRY_NAMES_TR/);
    for (const iso of ["UA", "RO", "MD", "EG", "LY", "JO", "SA"]) {
      expect(MAP_COUNTRY_NAMES_TR[iso], iso).toBeTruthy();
    }
  });

  it("sizes and filters the neighbour labels by the measured render scale (T-082)", () => {
    // A fixed `text-[12px]` in viewBox units measured 2.2-2.8px on a phone. The layout comes
    // from `lib/map/context-label-fit.ts` through the shared `MapContextLabels`, fed by a
    // ResizeObserver on the box and the zoom level; the metrics start `null` so the server
    // render is today's desktop labels.
    expect(turkey).toMatch(/useMapBoxMetrics\(mapContainerRef, toolbarRef\)/);
    expect(turkey).toMatch(/scale=\{boxScale === null \? null : boxScale \* zoomLevel\}/);
    expect(labels).toMatch(/new ResizeObserver\(/);
    expect(labels).toMatch(/useState<MapBoxMetrics \| null>\(null\)/);
    expect(labels).toMatch(/contextLabelLayout\(scale\)/);
    expect(labels).toMatch(/fontSize=\{neighbours\.fontSize\}/);
    expect(labels).toMatch(/layout\.fits\(name, target\)/);
    expect(turkey).not.toMatch(/fill-\[var\(--map-label\)\]/);
  });

  it("keeps WIDE_FRAME_ISOS equal to the wide artifact's countries", () => {
    // Hand-listed so the explorer does not ship the wide artifact's geometry just to read its
    // keys; this is what stops the list drifting when the wide frame is regenerated.
    const literal = /WIDE_FRAME_ISOS = new Set\(\[([^\]]*)\]\)/.exec(turkey)?.[1] ?? "";
    const listed = [...literal.matchAll(/"([A-Z]{2})"/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(CONTEXT_SHAPES.map((s) => s.iso).sort());
  });

  it("renders its selection card through MapSelectionCard, under the map on a phone", () => {
    expect(turkey).toContain("<MapSelectionCard");
    expect(turkey).toMatch(
      /<MapSelectionCard[\s\S]*?className="[^"]*mt-2[^"]*sm:absolute[^"]*sm:bottom-3[^"]*sm:left-3/,
    );
    expect(turkey).not.toMatch(/<Link[^>]*>\s*<Button/);
  });
});

const world = read("v2-world-map-explorer.tsx");

describe("/dunya's box follows the map's own ratio (T-079)", () => {
  it("sets no minimum height that would letterbox the map", () => {
    expect(world).toMatch(/aspect-\[1008\/520\]/);
    expect(world).not.toMatch(/min-h-\[(320|460)px\]/);
  });

  it("keeps toolbar and card off the map below sm, and over it from sm", () => {
    expect(world).toMatch(
      /data-map-toolbar[\s\S]{0,200}?className="[^"]*sm:absolute[^"]*sm:top-3[^"]*sm:right-3/,
    );
    expect(world).toMatch(
      /<MapSelectionCard[\s\S]*?className="[^"]*mt-2[^"]*sm:absolute[^"]*sm:bottom-3[^"]*sm:left-3/,
    );
  });
});

describe("/deniz and /deprem draw their names through the same layout (T-085)", () => {
  // Both drew fixed-size SVG text over the wide artifact: at 360px the neighbour names measured
  // 3-4px and the sea names 3-6px. They now measure their box and render `MapContextLabels`.
  for (const file of ["v2-marine-map-explorer.tsx", "v2-earthquake-explorer.tsx"]) {
    const source = read(file);
    it(`${file} measures its box and hands the scale to MapContextLabels`, () => {
      expect(source).toMatch(/useMapBoxMetrics\(mapBoxRef/);
      expect(source).toMatch(
        /<MapContextLabels[\s\S]*?scale=\{mapScale\}[\s\S]*?frame=\{WIDE_FRAME\}/,
      );
    });
    it(`${file} keeps no fixed-size label layer of its own`, () => {
      expect(source).not.toMatch(/SEA_LABELS/);
      expect(source).not.toMatch(/fill-\[var\(--map-label\)\]/);
      expect(source).not.toMatch(/const COUNTRY_NAMES_TR/);
    });
  }

  it("/deniz keeps its names clear of the basin chip floating over the map", () => {
    const marine = read("v2-marine-map-explorer.tsx");
    expect(marine).toMatch(/useMapBoxMetrics\(mapBoxRef, modeChipRef\)/);
    expect(marine).toMatch(/blocked=\{mapBlocked\}/);
  });
});
