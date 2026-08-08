import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { BASE_MAP_TOKEN_PINS, buildTrBaseMapSvg, buildWorldBaseMapSvg } from "./base-map-svg";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "./tr-provinces.generated";
import { COUNTRY_SHAPES, WORLD_MAP_VIEWBOX } from "./world-countries.generated";

/**
 * Three obligations are pinned here, and each one is a rule that would otherwise go missing
 * SILENTLY — no visual change, no type error, no failing page.
 *
 * 1. **The drawn ODbL credit** must stay a real `<text>` node inside an `<a>`, with exactly the
 *    catalogue's string. A refactor that "tidied" it into `<desc>` or `<title>` would look
 *    identical in a diff review and would break the OSMF Attribution Guideline's rule that
 *    seeing the credit must not require interaction (→ DEC 2026-08-08c md.1).
 * 2. **The pinned hexes** must equal `app/globals.css`. An SVG served through `<img>` cannot
 *    read CSS variables, so these values are transcribed by hand — the one place
 *    `ENGINEERING.md` §10's "no brand hex outside the token layer" rule is suspended. This
 *    test is the price of that suspension.
 * 3. **The drift gate**: every artifact shape must be present in the produced file, so the
 *    shared silhouette and the interactive hub map can never diverge (the DEC 2026-08-05b
 *    failure mode, where a separate mini artifact grew cracks the main one did not have).
 *
 * No test here asserts a fact about a place.
 */

const globalsCss = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("base-map token pins", () => {
  it("matches app/globals.css byte for byte", () => {
    for (const [token, hex] of Object.entries(BASE_MAP_TOKEN_PINS)) {
      // Matches both a literal declaration (`--color-border: #ddd5cc;`) and nothing else —
      // an alias token would fail loudly here rather than silently pinning the wrong colour.
      const declaration = new RegExp(`${token}:\\s*(#[0-9a-f]{3,8})\\s*;`, "i");
      const match = globalsCss.match(declaration);
      expect(
        match,
        `${token} must be declared with a literal hex in app/globals.css`,
      ).not.toBeNull();
      expect(match?.[1]?.toLowerCase(), token).toBe(hex.toLowerCase());
    }
  });
});

describe("buildTrBaseMapSvg", () => {
  it("keeps the ODbL credit as a DRAWN <text> node inside a link", () => {
    const svg = buildTrBaseMapSvg("tr");
    const drawn = svg.match(/<a [^>]*>\s*<text[^>]*>([^<]*)<\/text>\s*<\/a>/);
    expect(drawn, "the credit must be a <text> node wrapped in an <a>").not.toBeNull();
    expect(drawn?.[1]).toBe(trMessages.Map.attribution);
    expect(svg).toContain("https://www.openstreetmap.org/copyright");
  });

  it("draws the EN credit on the EN file — the reason four routes exist", () => {
    const drawn = buildTrBaseMapSvg("en").match(/<text[^>]*>([^<]*)<\/text>/);
    expect(drawn?.[1]).toBe(enMessages.Map.attribution);
    expect(enMessages.Map.attribution).not.toBe(trMessages.Map.attribution);
  });

  it("does not satisfy the obligation with metadata alone", () => {
    // `<desc>` may ALSO carry it; what must never happen is `<desc>` INSTEAD of `<text>`.
    const svg = buildTrBaseMapSvg("tr");
    const withoutDesc = svg.replace(/<desc>[\s\S]*?<\/desc>/, "");
    expect(withoutDesc).toContain("<text");
    expect(withoutDesc).toContain(trMessages.Map.attribution);
  });

  it("keeps the artifact's own viewBox, so the figure's aspect ratio is unchanged", () => {
    expect(buildTrBaseMapSvg("tr")).toContain(`viewBox="${MAP_VIEWBOX}"`);
  });

  it("carries every one of the artifact's province outlines", () => {
    const svg = buildTrBaseMapSvg("tr");
    for (const shape of PROVINCE_SHAPES) {
      expect(svg.includes(shape.d), shape.plateCode).toBe(true);
    }
  });

  it("emits exactly one path element (the outlines are merged, not repeated)", () => {
    expect(buildTrBaseMapSvg("tr").match(/<path\b/g)).toHaveLength(1);
  });
});

describe("buildWorldBaseMapSvg", () => {
  it("keeps every country in its OWN evenodd path, so enclave holes survive", () => {
    const svg = buildWorldBaseMapSvg("tr");
    expect(svg.match(/<path\b/g)).toHaveLength(COUNTRY_SHAPES.length);
    expect(svg.match(/fill-rule="evenodd"/g)).toHaveLength(COUNTRY_SHAPES.length);
  });

  it("carries every one of the artifact's country outlines", () => {
    const svg = buildWorldBaseMapSvg("tr");
    for (const shape of COUNTRY_SHAPES) {
      expect(svg.includes(shape.d), shape.iso).toBe(true);
    }
  });

  it("draws NO credit text — Natural Earth is public domain, so none is owed", () => {
    expect(buildWorldBaseMapSvg("tr")).not.toContain("<text");
  });

  it("still names its source in <desc>, per locale", () => {
    expect(buildWorldBaseMapSvg("tr")).toContain(`<desc>${trMessages.WorldMap.attribution}</desc>`);
    expect(buildWorldBaseMapSvg("en")).toContain(`<desc>${enMessages.WorldMap.attribution}</desc>`);
  });

  it("keeps the artifact's own viewBox", () => {
    expect(buildWorldBaseMapSvg("tr")).toContain(`viewBox="${WORLD_MAP_VIEWBOX}"`);
  });
});
