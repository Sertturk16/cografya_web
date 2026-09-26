import { describe, expect, it } from "vitest";
import {
  groupVideos,
  hasGroupHeadings,
  isNamed,
  markerLayout,
  neighbours,
  nextPlayable,
} from "./workbench-model";

const q = (n: number) => Array.from({ length: n }, () => ({ nameTr: null }));

describe("markerLayout", () => {
  it("uses cards up to twelve unnamed markers", () => {
    expect(markerLayout(q(6))).toBe("cards");
    expect(markerLayout(q(12))).toBe("cards");
  });
  it("switches to the dense grid at thirteen", () => {
    expect(markerLayout(q(13))).toBe("grid");
    expect(markerLayout(q(64))).toBe("grid");
  });
  it("lists named markers whatever their count", () => {
    expect(markerLayout([{ nameTr: "Giriş" }, { nameTr: null }])).toBe("list");
    expect(isNamed([{ nameTr: "Tahıllar" }])).toBe(true);
    expect(isNamed(q(3))).toBe(false);
  });
});

describe("groupVideos", () => {
  const v = (orderNo: number, groupTitleTr: string | null) => ({ orderNo, groupTitleTr });
  it("keeps a deneme book as one untitled group", () => {
    const groups = groupVideos([v(1, null), v(2, null), v(3, null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBeNull();
    expect(hasGroupHeadings(groups)).toBe(false);
  });
  it("splits consecutive runs of the same title", () => {
    const groups = groupVideos([v(1, "1. GÜN"), v(2, "2. GÜN"), v(3, "2. GÜN")]);
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ["1. GÜN", 1],
      ["2. GÜN", 2],
    ]);
    expect(hasGroupHeadings(groups)).toBe(true);
  });
  it("does not merge a title that reappears after another group", () => {
    expect(groupVideos([v(1, "A"), v(2, "B"), v(3, "A")]).map((g) => g.title)).toEqual([
      "A",
      "B",
      "A",
    ]);
  });
  it("returns no groups for no videos", () => {
    expect(groupVideos([])).toEqual([]);
  });
});

describe("neighbours", () => {
  const nos = [1, 2, 3, 15, 16];
  it("walks the book order, not the numbers", () => {
    expect(neighbours(nos, 3)).toEqual({ prev: 2, next: 15 });
  });
  it("stops at both ends", () => {
    expect(neighbours(nos, 1)).toEqual({ prev: null, next: 2 });
    expect(neighbours(nos, 16)).toEqual({ prev: 15, next: null });
  });
  it("answers nothing for an unknown current", () => {
    expect(neighbours(nos, 99)).toEqual({ prev: null, next: null });
  });
});

describe("nextPlayable", () => {
  const vids = [
    { orderNo: 1, playable: true },
    { orderNo: 2, playable: false },
    { orderNo: 3, playable: true },
  ];
  it("returns the next video when it can play in the page", () => {
    expect(nextPlayable(vids, 2)?.orderNo).toBe(3);
  });
  it("returns null when the next video cannot play in the page", () => {
    expect(nextPlayable(vids, 1)).toBeNull();
  });
  it("returns null at the last video", () => {
    expect(nextPlayable(vids, 3)).toBeNull();
  });
});
