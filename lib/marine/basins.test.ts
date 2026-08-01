import { describe, expect, it } from "vitest";
import type { MarinePointListItem } from "@/lib/api/types";
import { basinLabel, groupPointsByBasin, type SeaBasin } from "./basins";

/**
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2). Nothing here asserts a geographic fact: not which
 * sea a real province faces, not how many points a basin has, not the coastal order of the
 * Black Sea. The contract under test is "every point lands in exactly one group, and both
 * the groups and their members follow the api's `displayOrder`", which must hold for ANY
 * payload — so the fixtures are synthetic.
 */

let counter = 0;

function point(overrides: {
  seaBasin: SeaBasin;
  displayOrder: number;
  coastLabelTr?: string;
  coastLabelEn?: string;
}): MarinePointListItem {
  counter += 1;
  return {
    slugTr: `fixture-point-${counter}`,
    slugEn: `fixture-point-en-${counter}`,
    nameTr: `Fixture ${counter}`,
    nameEn: `Fixture ${counter} EN`,
    coastLabelTr: overrides.coastLabelTr ?? "Fixture kıyısı",
    coastLabelEn: overrides.coastLabelEn ?? "Fixture coast",
    plateCode: "01",
    latitude: 0,
    longitude: 0,
    seaBasin: overrides.seaBasin,
    displayOrder: overrides.displayOrder,
  };
}

describe("groupPointsByBasin", () => {
  it("puts every point in exactly one group and loses none", () => {
    const points = [
      point({ seaBasin: "marmara", displayOrder: 4 }),
      point({ seaBasin: "black_sea", displayOrder: 1 }),
      point({ seaBasin: "marmara", displayOrder: 5 }),
      point({ seaBasin: "aegean", displayOrder: 9 }),
      point({ seaBasin: "black_sea", displayOrder: 2 }),
    ];

    const groups = groupPointsByBasin(points);
    const regrouped = groups.flatMap((group) => group.points);

    expect(regrouped).toHaveLength(points.length);
    expect(new Set(regrouped.map((p) => p.slugTr)).size).toBe(points.length);
    expect(new Set(regrouped)).toEqual(new Set(points));
  });

  it("never emits an empty group", () => {
    const groups = groupPointsByBasin([
      point({ seaBasin: "black_sea", displayOrder: 1 }),
      point({ seaBasin: "mediterranean", displayOrder: 2 }),
    ]);

    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.points.length).toBeGreaterThan(0);
    }
  });

  it("orders groups by their smallest displayOrder (the api's coastal traverse)", () => {
    const groups = groupPointsByBasin([
      point({ seaBasin: "mediterranean", displayOrder: 30 }),
      point({ seaBasin: "aegean", displayOrder: 22 }),
      point({ seaBasin: "black_sea", displayOrder: 3 }),
      point({ seaBasin: "black_sea", displayOrder: 1 }),
      point({ seaBasin: "marmara", displayOrder: 16 }),
    ]);

    expect(groups.map((group) => group.basin)).toEqual([
      "black_sea",
      "marmara",
      "aegean",
      "mediterranean",
    ]);
  });

  it("orders members inside a group by ascending displayOrder", () => {
    const groups = groupPointsByBasin([
      point({ seaBasin: "black_sea", displayOrder: 7 }),
      point({ seaBasin: "black_sea", displayOrder: 2 }),
      point({ seaBasin: "black_sea", displayOrder: 5 }),
    ]);

    expect(groups[0]?.points.map((p) => p.displayOrder)).toEqual([2, 5, 7]);
  });

  it("does not mutate the input array", () => {
    const points = [
      point({ seaBasin: "black_sea", displayOrder: 9 }),
      point({ seaBasin: "black_sea", displayOrder: 1 }),
    ];
    const before = points.map((p) => p.displayOrder);

    groupPointsByBasin(points);

    expect(points.map((p) => p.displayOrder)).toEqual(before);
  });

  it("still groups a basin value the web has never seen instead of dropping it", () => {
    // The enum is closed at compile time; this is the RUNTIME case of the api adding a
    // fifth basin. Silently dropping those points would hide a real contract change.
    const exotic = { ...point({ seaBasin: "black_sea", displayOrder: 40 }), seaBasin: "gulf" };
    const points = [
      point({ seaBasin: "black_sea", displayOrder: 1 }),
      exotic as MarinePointListItem,
    ];

    const groups = groupPointsByBasin(points);

    expect(groups.flatMap((group) => group.points)).toHaveLength(2);
    expect(groups.map((group) => group.basin)).toContain("gulf");
  });
});

describe("basinLabel", () => {
  it("reads the heading off the group's own data, per locale", () => {
    const groups = groupPointsByBasin([
      point({
        seaBasin: "black_sea",
        displayOrder: 1,
        coastLabelTr: "Fixture açıkları",
        coastLabelEn: "Fixture offshore",
      }),
    ]);
    const group = groups[0];
    if (group === undefined) throw new Error("fixture produced no group");

    expect(basinLabel(group, "tr")).toBe("Fixture açıkları");
    expect(basinLabel(group, "en")).toBe("Fixture offshore");
  });

  it("returns null for a group with no points (never a heading with nothing under it)", () => {
    expect(basinLabel({ basin: "black_sea", points: [] }, "tr")).toBeNull();
  });
});
