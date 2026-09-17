import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * THE EXPORTED PNG CARRIES THE CREDIT FOR THE GEOMETRY IT RASTERISES.
 *
 * ## Why the export is the case that matters most
 *
 * `V2ToolWorkbench` lets a reader download the measurement as an image. That file leaves the
 * site: it goes into a homework folder, a slide, a forum post. Every other map credit in this
 * repo is rendered next to a map that stays on a page the reader is looking at; this one is the
 * only credit that has to travel WITH the material, in the plain sense ODbL means it.
 *
 * It did not. The watermark read
 *
 *     "Coğrafya Gurmesi · WGS84 / MEB & MTA Tabanlı Ölçüm"
 *
 * and both halves of that were wrong in opposite directions. **MEB and MTA supply nothing here** —
 * the measurement is WGS84 haversine / L'Huilier arithmetic in `lib/map/`, and a search for either
 * name across `lib/map` and `lib/tools` returns nothing. Meanwhile the canvas rasterises
 * `PROVINCE_SHAPES` (OpenStreetMap, ODbL) and `INLAND_WATER_SHAPES` (OSM plus JRC Global Surface
 * Water), and named neither. So the one artefact that leaves the site credited two institutions
 * that contributed no data and omitted the two whose licences ask to be credited.
 *
 * The on-screen credit was correct the whole time (`V2MapAttribution`, twice in this file), which
 * is why nothing caught it: every guard in this repo asks what the PAGE renders.
 *
 * ## What this asserts
 *
 * That the watermark is built from the same `Map` namespace the on-screen credit reads, so the
 * two cannot drift; and that it names no institution the measurement does not use. It cannot
 * prove the rendered pixels say it — that needs a canvas, and vitest here is node with no jsdom.
 */

const workbench = stripComments(
  readFileSync(fileURLToPath(new URL("./v2-tool-workbench.tsx", import.meta.url)), "utf8"),
);

/** The single `fillText` call that stamps the download. */
const watermark = /ctx\.fillText\(\s*([\s\S]*?)\n\s*\d+,/.exec(workbench)?.[1] ?? "";

describe("the measurement image's credit", () => {
  it("finds the watermark call at all", () => {
    // Anti-vacuity: every assertion below is about the contents of `watermark`, so an empty match
    // would pass the negative ones for free — which is the failure this whole file is about.
    expect(workbench, "the export still rasterises to a canvas").toContain("ctx.fillText(");
    expect(watermark.length, "watermark expression").toBeGreaterThan(20);
  });

  it("credits the geometry the canvas actually draws", () => {
    // Read through the catalogue rather than written out, so the exported image and
    // `V2MapAttribution` cannot say different things about the same shapes.
    expect(watermark).toContain('tMap("attribution")');
    expect(watermark).toContain('tMap("attributionProvinceLabel")');
    expect(watermark).toContain('tMap("attributionJrcEnglish")');
  });

  it("names no institution the measurement does not use", () => {
    // Not a general "no institution names" rule — `Coğrafya Gurmesi` is ours and belongs there.
    // These two are pinned by name because they were there, and because a plausible-sounding
    // official acronym is the hardest kind of false credit to notice.
    expect(watermark).not.toMatch(/\bMEB\b/);
    expect(watermark).not.toMatch(/\bMTA\b/);
  });

  it("still draws the layers this credit is for", () => {
    // If the workbench stopped drawing OSM geometry, the credit would become the opposite defect
    // — crediting a source the file does not use. Pinned so the two move together.
    expect(workbench).toContain("PROVINCE_SHAPES");
    expect(workbench).toContain("INLAND_WATER_SHAPES");
  });
});
