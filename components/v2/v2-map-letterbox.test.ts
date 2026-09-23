import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_SHAPES } from "@/lib/map/tr-context.generated";
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
    for (const name of [
      "Ukrayna",
      "Romanya",
      "Moldova",
      "Mısır",
      "Libya",
      "Ürdün",
      "Suudi Arabistan",
    ]) {
      expect(turkey, name).toContain(`"${name}"`);
    }
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
