import { describe, expect, it } from "vitest";
import { searchPanelState, type SearchPanelInput } from "./panel-state";

const base: SearchPanelInput = {
  entryCount: 300,
  loadFailed: false,
  incomplete: false,
  hasQuery: true,
  hitCount: 0,
};
const state = (patch: Partial<SearchPanelInput>) => searchPanelState({ ...base, ...patch });

describe("searchPanelState", () => {
  it("is idle with no query and a healthy or pending index", () => {
    expect(state({ hasQuery: false })).toBe("idle");
    expect(state({ hasQuery: false, entryCount: null })).toBe("idle");
  });

  it("is loading, never 'no results', while a typed query waits on the index", () => {
    expect(state({ entryCount: null })).toBe("loading");
  });

  it("shows hits whenever there are any, even from a partial index", () => {
    expect(state({ hitCount: 3 })).toBe("results");
    expect(state({ hitCount: 3, incomplete: true })).toBe("results");
    expect(state({ hitCount: 3, loadFailed: true })).toBe("results");
  });

  it("says 'no results' only for a complete, non-empty index", () => {
    expect(state({})).toBe("noResults");
  });

  it("calls a failed, empty or partial index unavailable instead of 'no results'", () => {
    // A province outage must not tell a reader who typed "konya" that Konya does not exist.
    expect(state({ entryCount: null, loadFailed: true })).toBe("unavailable");
    expect(state({ entryCount: 0 })).toBe("unavailable");
    expect(state({ incomplete: true })).toBe("unavailable");
  });

  it("reports a failed load before anything is typed, but not a partial one", () => {
    expect(state({ hasQuery: false, entryCount: null, loadFailed: true })).toBe("unavailable");
    expect(state({ hasQuery: false, incomplete: true })).toBe("idle");
  });
});
