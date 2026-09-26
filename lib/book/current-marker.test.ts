import { describe, expect, it } from "vitest";
import { currentMarkerIndex } from "./current-marker";

describe("currentMarkerIndex", () => {
  const seconds = [0, 86, 141, 229];
  it("is -1 before the first marker", () => {
    expect(currentMarkerIndex([10, 20], 5)).toBe(-1);
  });
  it("is the marker whose segment contains the time", () => {
    expect(currentMarkerIndex(seconds, 100)).toBe(1);
  });
  it("switches exactly on a boundary", () => {
    expect(currentMarkerIndex(seconds, 141)).toBe(2);
  });
  it("stays on the last marker past its start", () => {
    expect(currentMarkerIndex(seconds, 9999)).toBe(3);
  });
  it("is -1 for a video with no markers", () => {
    expect(currentMarkerIndex([], 50)).toBe(-1);
  });
});
