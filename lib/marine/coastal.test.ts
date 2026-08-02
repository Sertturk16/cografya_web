import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  MarineConditions,
  MarinePointListItem,
  MarineProvinceConditions,
} from "@/lib/api/types";
import singlePointFixture from "@/test/fixtures/marine/province-conditions-single-point.json";
import twoPointFixture from "@/test/fixtures/marine/province-conditions-two-point.json";
import {
  coastalPlateCodes,
  isCoastalPlate,
  provinceMarineBlocks,
  provinceShowsMarine,
} from "./coastal";

/**
 * The coastal gate and the province publish signal — structural only
 * (`CONVENTIONS.md` §2). Nothing here asserts WHICH provinces have a coast: that is a
 * geographic fact, it lives in the api, and a test that pinned the twenty-seven codes would
 * be the second source this module exists to avoid.
 */

/** A point carrying only the fields the gate reads; the rest is contract padding. */
function point(overrides: Pick<MarinePointListItem, "slugTr" | "plateCode">): MarinePointListItem {
  return {
    slugEn: overrides.slugTr,
    nameTr: "Fixture",
    nameEn: "Fixture",
    coastLabelTr: "Fixture açıkları",
    coastLabelEn: "Fixture offshore",
    latitude: 41,
    longitude: 29,
    seaBasin: "black_sea",
    displayOrder: 1,
    ...overrides,
  };
}

describe("coastalPlateCodes — the coastal set is derived, never listed", () => {
  it("returns one entry per distinct plaka", () => {
    const codes = coastalPlateCodes([
      point({ slugTr: "a", plateCode: "57" }),
      point({ slugTr: "b", plateCode: "35" }),
    ]);

    expect(codes).toEqual(new Set(["57", "35"]));
  });

  it("counts a two-point province ONCE", () => {
    // İstanbul, Çanakkale and Balıkesir each publish two points. The question this set
    // answers is "has a coast", not "how many points" — 30 points, 27 plakas.
    const codes = coastalPlateCodes([
      point({ slugTr: "istanbul-karadeniz-aciklari", plateCode: "34" }),
      point({ slugTr: "istanbul-marmara-aciklari", plateCode: "34" }),
    ]);

    expect(codes.size).toBe(1);
    expect(codes.has("34")).toBe(true);
  });

  it("is empty for an empty point list", () => {
    expect(coastalPlateCodes([])).toEqual(new Set());
  });
});

describe("isCoastalPlate — the gate that decides whether a /conditions call happens", () => {
  const points = [point({ slugTr: "sinop-aciklari", plateCode: "57" })];

  it.each([
    ["a plaka in the point set", "57", true],
    ["a plaka that is not", "42", false],
  ] as const)("%s → %s", (_label, plateCode, expected) => {
    expect(isCoastalPlate(points, plateCode)).toBe(expected);
  });

  it("gates EVERY province off when the point list could not be read", () => {
    // The fail-soft points read answers `[]` on an outage. "We cannot tell which provinces
    // have a coast" must mean no section — never a section assembled from a guess.
    expect(isCoastalPlate([], "57")).toBe(false);
  });

  it("matches on the plaka string exactly, with no numeric coercion", () => {
    // Plakas are zero-padded strings in the contract ("08"), and "8" is a different province
    // page's parameter, not the same one written differently.
    expect(isCoastalPlate([point({ slugTr: "a", plateCode: "08" })], "8")).toBe(false);
  });
});

describe("provinceMarineBlocks / provinceShowsMarine — ONE publish signal", () => {
  const twoPoint = twoPointFixture as MarineProvinceConditions;
  const singlePoint = singlePointFixture as MarineProvinceConditions;

  /** A payload shaped like the contract's, with the block list swapped out. */
  function conditions(marinePoints: MarineConditions[]): MarineProvinceConditions {
    return { plateCode: "57", marinePoints, attributions: [] };
  }

  it("treats the fail-soft null as no blocks, not as no sea", () => {
    expect(provinceMarineBlocks(null)).toEqual([]);
    expect(provinceShowsMarine(null)).toBe(false);
  });

  it("treats an empty block list as nothing to publish", () => {
    expect(provinceShowsMarine(conditions([]))).toBe(false);
  });

  it("publishes a one-block and a two-block province alike", () => {
    expect(provinceShowsMarine(singlePoint)).toBe(true);
    expect(provinceShowsMarine(twoPoint)).toBe(true);
    expect(provinceMarineBlocks(twoPoint)).toHaveLength(2);
  });

  it("passes the api's blocks through in order, adding and removing nothing", () => {
    // The section renders `displayOrder` as the api sent it; a helper that sorted, filtered
    // or deduplicated here would be a second opinion about the coastal traverse.
    expect(provinceMarineBlocks(twoPoint)).toEqual(twoPoint.marinePoints);
  });

  it("keeps the boolean and the list in agreement by construction", () => {
    // The O1 lesson: the section and the licence block read ONE answer. Asserted as an
    // invariant over every shape this module can be handed.
    for (const input of [null, conditions([]), singlePoint, twoPoint]) {
      expect(provinceShowsMarine(input)).toBe(provinceMarineBlocks(input).length > 0);
    }
  });
});

/**
 * THE LOCKED TWO-POINT POLICY, AS MARKUP (the PR #37 review, I2).
 *
 * `provinceMarineBlocks` passes the api's blocks through untouched — asserted above — and
 * `fixtures.test.ts` proves the two blocks of a two-point province legitimately DISAGREE
 * (İstanbul's Black Sea point carries a wave height; its Marmara point cannot, permanently).
 * Neither of those proves the COMPONENT keeps them apart. A refactor that averaged the two
 * temperatures, or filled the Marmara's missing wave from the Black Sea's, would leave every
 * assertion in this repo green while publishing a number no instrument ever measured.
 *
 * This repo's vitest environment is `node` and the section is an async server component, so
 * it cannot be rendered here (same limitation as the anchor and attribution guards, and the
 * same answer): the honest guard at this level is the source symbol. It catches the class of
 * change that would break the policy — an index into the block list, a merge, an arithmetic
 * combination — and it does not pretend to be a render test.
 */
describe("the two-point policy survives into the markup", () => {
  const section = readFileSync(
    new URL("../../components/marine/province-marine-section.tsx", import.meta.url),
    "utf8",
  );

  it("renders one block per api entry, mapped over the list it was handed", () => {
    expect(section).toMatch(/blocks\.map\(\(block\) =>/);
  });

  it("reads every value from the block being rendered, never from a sibling", () => {
    // The sharp end of the policy. Each `<ValueCell>` in the section must take its magnitude
    // from `block.…`; a cell fed from anywhere else is a cross-block read by definition.
    const cells = section.match(/<ValueCell\b/g) ?? [];
    const blockScopedMagnitudes = section.match(/magnitude=\{block\./g) ?? [];

    expect(cells.length).toBeGreaterThan(0);
    expect(blockScopedMagnitudes).toHaveLength(cells.length);
  });

  it("never indexes the block list, and never combines two blocks into one number", () => {
    // `blocks[0]` / `blocks[1]` is how "fill the other one from this one" is spelled, and
    // `reduce` / `Math.` is how an average is. Neither belongs in a per-point render.
    expect(section).not.toMatch(/blocks\[/);
    expect(section).not.toMatch(/blocks\.(reduce|sort|filter|slice|find)\(/);
    expect(section).not.toMatch(/Math\./);
  });

  it("gives each block its own künye and its own hub link", () => {
    // Both are derived from the block/point in scope: a section-wide künye would speak for a
    // point that has nothing to say, and a section-wide link would send both blocks to the
    // same row of the hub table.
    expect(section).toMatch(/marineBlockValues\(block\)/);
    expect(section).toMatch(/hash: marinePointAnchorId\(point\)/);
  });

  it("never suppresses the province because one of its blocks is short of data", () => {
    // The other half of the policy: the gate is the LIST, in `./coastal`, and it asks only
    // whether there is a block — never whether a block's values are complete. A status test
    // inside the section would be that suppression creeping back in.
    expect(section).not.toMatch(/status ===/);
  });
});
