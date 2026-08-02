import { describe, expect, it } from "vitest";
import type { MarineOverview } from "@/lib/api/types";
import coldFixture from "@/test/fixtures/marine/overview-not-publishable.json";
import overviewFixture from "@/test/fixtures/marine/overview.json";
import { marinePublishableBlocks, marineShowsValues } from "./overview";

/**
 * THE PUBLISH GATE, pinned.
 *
 * `dataAvailable` is a contract signal, not a hint: a render that ignored it would bake the
 * api's own "this is not publishable" answer into a static page for a whole ISR window. The
 * gate is two lines of code and therefore easy to reintroduce a bug into, and both the lede
 * and the value section's heading now hang off it, so it is asserted directly.
 *
 * Structural only (`CONVENTIONS.md` §2): nothing here asserts a wave height or a temperature.
 */

const overview = overviewFixture as MarineOverview;
const notPublishable = coldFixture as MarineOverview;

describe("marinePublishableBlocks", () => {
  it("returns the payload's blocks when the api says the render is publishable", () => {
    expect(marinePublishableBlocks(overview)).toHaveLength(overview.points.length);
  });

  it("returns nothing for a `dataAvailable: false` payload", () => {
    expect(marinePublishableBlocks(notPublishable)).toEqual([]);
  });

  it("returns nothing for the fail-soft `null` an outage produces", () => {
    expect(marinePublishableBlocks(null)).toEqual([]);
  });

  it("honours the flag even when blocks are present", () => {
    // The flag wins over the payload's own content: an api that sends blocks alongside
    // `dataAvailable: false` is telling us not to publish them, and "but there are blocks"
    // is not a reading of that signal.
    const withheld = { ...overview, dataAvailable: false } satisfies MarineOverview;
    expect(marinePublishableBlocks(withheld)).toEqual([]);
  });
});

describe("marineShowsValues", () => {
  it("is true only when the page will actually print numbers", () => {
    expect(marineShowsValues(overview)).toBe(true);
    expect(marineShowsValues(notPublishable)).toBe(false);
    expect(marineShowsValues(null)).toBe(false);
  });

  it("is false for a publishable payload that carries no blocks", () => {
    // The empty-section case: the flag says publish, the payload has nothing to show. A lede
    // announcing values over an empty section is the same broken promise by another route.
    const empty = { ...overview, points: [] } satisfies MarineOverview;
    expect(marineShowsValues(empty)).toBe(false);
  });
});
