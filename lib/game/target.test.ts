import { describe, expect, it } from "vitest";
import type { ProvinceMapSummary } from "@/lib/api/types";
import type { GameShapeTargetEntry } from "./map-shapes";
import {
  buildProvinceTargetSet,
  buildRegionTargetSet,
  isGameModeId,
  targetsById,
  type RegionLabels,
} from "./target";

/**
 * Structural guards for the target layer.
 *
 * The fixtures are synthetic plates and names. What is asserted is the CONTRACT — an
 * unseeded shape can never be asked or answered, every seeded plate resolves to exactly
 * one target, a region target is answered by any of its provinces — not which province
 * sits in which region (that is api data and a fact-check concern, `CONVENTIONS.md` §2).
 */

const LABELS: RegionLabels = {
  MARMARA: "Region A",
  EGE: "Region B",
  AKDENIZ: "Region C",
  IC_ANADOLU: "Region D",
  KARADENIZ: "Region E",
  DOGU_ANADOLU: "Region F",
  GUNEYDOGU_ANADOLU: "Region G",
};

function seeded(
  plateCode: string,
  region: ProvinceMapSummary["region"],
  name = `Fixture ${plateCode}`,
): GameShapeTargetEntry {
  return {
    plateCode,
    target: { name, region, slug: `fixture-${plateCode}` },
  };
}

function unseeded(plateCode: string): GameShapeTargetEntry {
  return { plateCode, target: null };
}

const SHAPES: readonly GameShapeTargetEntry[] = [
  seeded("01", "EGE", "Alpha"),
  unseeded("02"),
  seeded("03", "MARMARA", "Beta"),
  seeded("04", "EGE", "Gamma"),
];

describe("buildProvinceTargetSet", () => {
  it("creates one target per seeded shape, in artifact order", () => {
    const set = buildProvinceTargetSet(SHAPES);

    expect(set.modeId).toBe("provinces");
    expect(set.targets.map((target) => target.id)).toEqual(["01", "03", "04"]);
    expect(set.targets.map((target) => target.label)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("never turns an unseeded plate into a question or an answer", () => {
    const set = buildProvinceTargetSet(SHAPES);

    expect(set.targets.some((target) => target.id === "02")).toBe(false);
    expect(set.plateToTarget["02"]).toBeUndefined();
  });

  it("keeps the province slug on the target, for the end-of-round links", () => {
    const set = buildProvinceTargetSet(SHAPES);

    expect(set.targets[0]?.slug).toBe("fixture-01");
    expect(set.targets.every((target) => target.kind === "province")).toBe(true);
  });

  it("maps each seeded plate to its own target", () => {
    const set = buildProvinceTargetSet(SHAPES);

    expect(set.plateToTarget).toEqual({ "01": "01", "03": "03", "04": "04" });
  });
});

describe("buildRegionTargetSet", () => {
  it("creates one target per region that has at least one seeded province", () => {
    const set = buildRegionTargetSet(SHAPES, LABELS);

    expect(set.modeId).toBe("regions");
    expect(set.targets.map((target) => target.id)).toEqual(["EGE", "MARMARA"]);
  });

  it("lets ANY province of a region answer that region", () => {
    const set = buildRegionTargetSet(SHAPES, LABELS);

    expect(set.plateToTarget["01"]).toBe("EGE");
    expect(set.plateToTarget["04"]).toBe("EGE");
    expect(set.plateToTarget["03"]).toBe("MARMARA");
  });

  it("uses the translated region label, never the enum key, as the question text", () => {
    const set = buildRegionTargetSet(SHAPES, LABELS);

    expect(set.targets.map((target) => target.label)).toEqual(["Region B", "Region A"]);
  });

  it("gives a region target no slug (there is no region page to link to)", () => {
    const set = buildRegionTargetSet(SHAPES, LABELS);

    expect(set.targets.every((target) => target.slug === null)).toBe(true);
    expect(set.targets.every((target) => target.kind === "region")).toBe(true);
  });

  it("excludes an unseeded plate from the answer binding", () => {
    const set = buildRegionTargetSet(SHAPES, LABELS);

    expect(set.plateToTarget["02"]).toBeUndefined();
  });

  it("produces an empty pool rather than throwing when nothing is seeded", () => {
    const set = buildRegionTargetSet([unseeded("07")], LABELS);

    expect(set.targets).toEqual([]);
    expect(set.plateToTarget).toEqual({});
  });
});

describe("plate binding integrity", () => {
  it("points every bound plate at a target that exists in the same pool (both modes)", () => {
    for (const set of [buildProvinceTargetSet(SHAPES), buildRegionTargetSet(SHAPES, LABELS)]) {
      const ids = new Set(set.targets.map((target) => target.id));
      for (const targetId of Object.values(set.plateToTarget)) {
        expect(ids.has(targetId)).toBe(true);
      }
    }
  });

  it("binds every seeded plate in both modes, so no shape is a dead click", () => {
    const seededPlates = SHAPES.filter((shape) => shape.target).map((shape) => shape.plateCode);

    for (const set of [buildProvinceTargetSet(SHAPES), buildRegionTargetSet(SHAPES, LABELS)]) {
      expect(Object.keys(set.plateToTarget).sort()).toEqual([...seededPlates].sort());
    }
  });
});

describe("targetsById", () => {
  it("indexes targets for the label lookup the HUD needs", () => {
    const set = buildProvinceTargetSet(SHAPES);

    expect(targetsById(set.targets).get("03")?.label).toBe("Beta");
  });
});

describe("isGameModeId", () => {
  it("accepts the shipped modes and rejects anything else (storage is untrusted)", () => {
    expect(isGameModeId("regions")).toBe(true);
    expect(isGameModeId("provinces")).toBe(true);
    expect(isGameModeId("region-provinces")).toBe(false);
    expect(isGameModeId(null)).toBe(false);
    expect(isGameModeId(2)).toBe(false);
  });
});
