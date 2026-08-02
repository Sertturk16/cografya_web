import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MarineOverview, MarineProvinceConditions } from "@/lib/api/types";
import overviewFixture from "@/test/fixtures/marine/overview.json";
import twoPointFixture from "@/test/fixtures/marine/province-conditions-two-point.json";
import { MARINE_POINTS_SECTION_ID, marineBasinAnchorId, marinePointAnchorId } from "./anchors";

/**
 * The `/deniz` row anchors — a contract between two routes, and the reason it needs a test at
 * all is that BREAKING IT IS SILENT. A province page whose fragment no longer matches any id
 * on the hub simply lands the reader at the top of the page; no error, no 404, no CI signal.
 *
 * Two things are pinned: the id function is deterministic and collision-free over the real
 * point set, and BOTH sides go through this module instead of assembling the string
 * themselves (the source-symbol guard, same shape as the A1 catalogue guard in
 * `messages.test.ts` — this repo's vitest environment is `node`, so an async server component
 * cannot be rendered here).
 */

const overview = overviewFixture as MarineOverview;
const twoPoint = twoPointFixture as MarineProvinceConditions;

describe("anchor ids are deterministic and unique", () => {
  it("nests the point id under its basin id, and that under the section id", () => {
    const id = marinePointAnchorId({ seaBasin: "black_sea", slugTr: "sinop-aciklari" });

    expect(marineBasinAnchorId("black_sea")).toBe(`${MARINE_POINTS_SECTION_ID}-black_sea`);
    expect(id).toBe(`${MARINE_POINTS_SECTION_ID}-black_sea-sinop-aciklari`);
  });

  it("gives all thirty published points distinct ids", () => {
    const ids = overview.points.map((block) => marinePointAnchorId(block.point));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives a two-point province two different ids", () => {
    // The case the anchors exist for: İstanbul's province page carries two links, and they
    // must land on two different rows of the hub.
    const [first, second] = twoPoint.marinePoints;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;

    expect(marinePointAnchorId(first.point)).not.toBe(marinePointAnchorId(second.point));
  });

  it("emits ids that are valid HTML fragments as-is", () => {
    // The slugs are api-issued ASCII routing keys, so nothing is escaped on either side. If
    // that ever stops being true, this fails here rather than in a browser address bar.
    for (const block of overview.points) {
      expect(marinePointAnchorId(block.point)).toMatch(/^[a-z0-9_-]+$/);
    }
  });
});

describe("both sides of the anchor contract call this module", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  const emitter = read("../../components/marine/basin-values-table.tsx");
  const fallbackEmitter = read("../../components/marine/reference-points.tsx");
  const linker = read("../../components/marine/province-marine-section.tsx");

  it("the hub row EMITS its id through marinePointAnchorId", () => {
    expect(emitter).toMatch(/id=\{marinePointAnchorId\(point\)\}/);
  });

  it("the province section LINKS through the same function", () => {
    expect(linker).toMatch(/hash: marinePointAnchorId\(point\)/);
  });

  it("neither side rebuilds the id from the section constant by hand", () => {
    // A template literal on either side is what drift looks like before it happens.
    for (const source of [emitter, linker, fallbackEmitter]) {
      expect(source).not.toContain("deniz-reference-points");
    }
  });

  /**
   * THE BRANCH THE FORMAT CONTRACT ALONE DOES NOT COVER (the PR #37 review, FENER-I3 +
   * code-reviewer M2).
   *
   * `/deniz` has two render shapes: the value table, and the value-less point list it falls
   * back to when the overview payload is not publishable. The province sections link to
   * `#…-{slug}` UNCONDITIONALLY — they read `/api/marine/provinces/{plaka}/conditions`, a
   * different endpoint with an independent cache entry from the hub's `/api/marine/overview`,
   * so "province has values, hub does not" is genuinely reachable rather than theoretical.
   *
   * With the id emitted in one branch only, those 27 pages' links landed at the top of
   * `/deniz` — no error, no 404, no CI signal, which is precisely the silent-failure class
   * this module was written to prevent. Both branches list every point, so both name it, and
   * this is the assertion that keeps it that way.
   */
  it("emits the per-point id in the value-less fallback branch too", () => {
    expect(fallbackEmitter).toMatch(
      /<li key=\{point\.slugTr\} id=\{marinePointAnchorId\(point\)\}/,
    );
  });

  it("makes both fragment targets programmatically focusable", () => {
    // A fragment target that is not focusable is followed VISUALLY but not by Safari/VoiceOver
    // (ENGINEERING.md §5, the climate-chart precedent). Both branches, one rule.
    expect(emitter).toMatch(/id=\{marinePointAnchorId\(point\)\} tabIndex=\{-1\}/);
    expect(fallbackEmitter).toMatch(/id=\{marinePointAnchorId\(point\)\} tabIndex=\{-1\}/);
  });
});
