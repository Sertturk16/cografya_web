import { describe, expect, it } from "vitest";
import { rowStatuses } from "./book-status";

describe("rowStatuses", () => {
  const durations = new Map<string, number | null>([
    ["a", 400],
    ["b", 400],
    ["c", null],
  ]);
  it("marks a watched video done whatever its position", () => {
    const s = rowStatuses([{ bookVideoId: "a", lastPositionSeconds: 0, watched: true }], durations);
    expect(s.get("a")).toEqual({ kind: "done" });
  });
  it("fills the ring by position over duration", () => {
    const s = rowStatuses(
      [{ bookVideoId: "b", lastPositionSeconds: 100, watched: false }],
      durations,
    );
    expect(s.get("b")).toEqual({ kind: "part", fraction: 0.25 });
  });
  it("uses half a ring when the duration is unknown", () => {
    const s = rowStatuses(
      [{ bookVideoId: "c", lastPositionSeconds: 90, watched: false }],
      durations,
    );
    expect(s.get("c")).toEqual({ kind: "part", fraction: 0.5 });
  });
  it("keeps a started ring visible and never full", () => {
    const s = rowStatuses(
      [
        { bookVideoId: "a", lastPositionSeconds: 1, watched: false },
        { bookVideoId: "b", lastPositionSeconds: 399, watched: false },
      ],
      durations,
    );
    expect(s.get("a")).toEqual({ kind: "part", fraction: 0.05 });
    expect(s.get("b")).toEqual({ kind: "part", fraction: 0.95 });
  });
  it("answers nothing for a signed-out reader (no rows)", () => {
    expect(rowStatuses([], durations).size).toBe(0);
  });
});
