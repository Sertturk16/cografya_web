import { describe, expect, it } from "vitest";
import type { ProvinceMapSummary } from "@/lib/api/types";
import type { ProvinceShape } from "@/lib/map/tr-provinces.generated";
import { buildGameShapes } from "./map-shapes";

/**
 * Structural guards for the game map's shape↔api join.
 *
 * Every fixture below is SYNTHETIC (fictional plates, names, slugs and path data): the
 * contract under test is structural — "one entry per shape, in artifact order; an
 * unseeded plate carries no target; the slug follows the locale" — and it must hold for
 * any input. Asserting a real province's region or slug here would turn a structure test
 * into a fact test, which `CONVENTIONS.md` §2 bars (fact verification is its own
 * process).
 */

function shape(plateCode: string): ProvinceShape {
  return { plateCode, geoName: `Fixture ${plateCode}`, d: `M0 0L1 ${plateCode}Z` };
}

function summary(plateCode: string, region: ProvinceMapSummary["region"]): ProvinceMapSummary {
  return {
    plateCode,
    nameTr: `Fixture ${plateCode}`,
    region,
    slugTr: `fixture-${plateCode}-tr`,
    slugEn: `fixture-${plateCode}-en`,
    population: null,
    populationYear: null,
    areaKm2: null,
    districtCount: null,
  };
}

const SHAPES: readonly ProvinceShape[] = [shape("01"), shape("02"), shape("03")];

describe("buildGameShapes", () => {
  it("emits exactly one entry per shape, in artifact order", () => {
    const entries = buildGameShapes(SHAPES, [summary("02", "EGE")], "tr");

    expect(entries).toHaveLength(SHAPES.length);
    expect(entries.map((entry) => entry.plateCode)).toEqual(["01", "02", "03"]);
  });

  it("carries each shape's path data through untouched", () => {
    const entries = buildGameShapes(SHAPES, [], "tr");

    expect(entries.map((entry) => entry.d)).toEqual(SHAPES.map((s) => s.d));
  });

  it("leaves an unseeded plate without a target (backdrop only, never an answer)", () => {
    const entries = buildGameShapes(SHAPES, [summary("02", "EGE")], "tr");

    expect(entries.find((entry) => entry.plateCode === "01")?.target).toBeNull();
    expect(entries.find((entry) => entry.plateCode === "03")?.target).toBeNull();
    expect(entries.find((entry) => entry.plateCode === "02")?.target).not.toBeNull();
  });

  it("passes the region enum key through, not a translated label", () => {
    const entries = buildGameShapes(SHAPES, [summary("01", "KARADENIZ")], "tr");

    expect(entries[0]?.target?.region).toBe("KARADENIZ");
  });

  it("resolves the slug of the requested locale", () => {
    const summaries = [summary("01", "MARMARA")];

    expect(buildGameShapes(SHAPES, summaries, "tr")[0]?.target?.slug).toBe("fixture-01-tr");
    expect(buildGameShapes(SHAPES, summaries, "en")[0]?.target?.slug).toBe("fixture-01-en");
  });

  it("ignores an api record whose plate has no shape (never invents a shape)", () => {
    const entries = buildGameShapes(SHAPES, [summary("99", "AKDENIZ")], "tr");

    expect(entries).toHaveLength(SHAPES.length);
    expect(entries.every((entry) => entry.target === null)).toBe(true);
  });

  it("keeps plate codes unique, so no shape can be rendered twice", () => {
    const entries = buildGameShapes(SHAPES, [], "tr");
    const plates = entries.map((entry) => entry.plateCode);

    expect(new Set(plates).size).toBe(plates.length);
  });
});
