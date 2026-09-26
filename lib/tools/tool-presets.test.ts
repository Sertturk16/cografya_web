import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { readRingArea } from "@/lib/map/measure";
import { TOOL_MODES, TOOL_PRESETS } from "./tool-presets";

/** Türkiye's mainland and islands with a margin; a typo in a coordinate lands outside it. */
const TR_BOX = { minLat: 35.8, maxLat: 42.2, minLon: 25.6, maxLon: 44.9 };

const catalogues = { tr: trMessages.ToolWorkbench, en: enMessages.ToolWorkbench } as const;

describe("TOOL_PRESETS (T-125)", () => {
  it("gives every tool a few examples of its own", () => {
    for (const mode of TOOL_MODES) {
      expect(TOOL_PRESETS[mode].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("has the point count each tool measures", () => {
    for (const preset of TOOL_PRESETS.distance)
      expect(preset.points.length).toBeGreaterThanOrEqual(2);
    for (const preset of TOOL_PRESETS.area) expect(preset.points.length).toBeGreaterThanOrEqual(3);
    for (const preset of TOOL_PRESETS.coordinates) expect(preset.points).toHaveLength(1);
  });

  it("draws every area example as a simple polygon, so the tool can measure it", () => {
    for (const preset of TOOL_PRESETS.area) {
      expect(readRingArea(preset.points), preset.id).toMatchObject({ kind: "area" });
    }
  });

  it("keeps every point inside Türkiye", () => {
    for (const mode of TOOL_MODES) {
      for (const preset of TOOL_PRESETS[mode]) {
        for (const p of preset.points) {
          expect(p.lat, preset.id).toBeGreaterThan(TR_BOX.minLat);
          expect(p.lat, preset.id).toBeLessThan(TR_BOX.maxLat);
          expect(p.lon, preset.id).toBeGreaterThan(TR_BOX.minLon);
          expect(p.lon, preset.id).toBeLessThan(TR_BOX.maxLon);
        }
      }
    }
  });

  it("uses unique ids", () => {
    const ids = TOOL_MODES.flatMap((mode) => TOOL_PRESETS[mode].map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every label key in both locales", () => {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const mode of TOOL_MODES) {
        for (const preset of TOOL_PRESETS[mode]) {
          const keys = [preset.labelKey, ...preset.points.flatMap((p) => p.labelKey ?? [])];
          for (const key of keys) {
            expect(typeof (catalogue as Record<string, unknown>)[key], `${locale}.${key}`).toBe(
              "string",
            );
          }
        }
      }
    }
  });

  it("names every point except area corners, which the tool numbers", () => {
    for (const mode of ["distance", "coordinates"] as const) {
      for (const preset of TOOL_PRESETS[mode]) {
        for (const p of preset.points) expect(p.labelKey, preset.id).toBeDefined();
      }
    }
  });
});
