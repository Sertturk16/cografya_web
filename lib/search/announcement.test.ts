import { describe, expect, it } from "vitest";
import { searchAnnouncement } from "./announcement";

/**
 * T-168: what both search boxes' live regions say. Silence while closed, empty or loading (the
 * index may well match), the failure when the list is unavailable, otherwise the count.
 */
describe("searchAnnouncement", () => {
  const base = { open: true, hasQuery: true, hitCount: 3 } as const;

  it("says the result count", () => {
    expect(searchAnnouncement({ ...base, panelState: "results" })).toEqual({
      key: "resultCount",
      count: 3,
    });
  });

  it("says there are no results only when the full index answered so", () => {
    expect(searchAnnouncement({ ...base, hitCount: 0, panelState: "noResults" })).toEqual({
      key: "noResults",
    });
  });

  it("says the list is unavailable rather than 'no results'", () => {
    expect(searchAnnouncement({ ...base, hitCount: 0, panelState: "unavailable" })).toEqual({
      key: "loadFailed",
    });
  });

  it("stays silent while closed, without a query, or while the index loads", () => {
    expect(searchAnnouncement({ ...base, open: false, panelState: "results" })).toBeNull();
    expect(searchAnnouncement({ ...base, hasQuery: false, panelState: "idle" })).toBeNull();
    expect(searchAnnouncement({ ...base, hitCount: 0, panelState: "loading" })).toBeNull();
  });
});
