import { describe, expect, it } from "vitest";
import {
  armedSecondFor,
  BENCH_HISTORY_MARK,
  historyWriteFor,
  isBenchEntry,
  stepForHash,
} from "./bench-history";

const nos = [1, 2, 20];

describe("stepForHash", () => {
  it("opens the watch step on a video fragment", () => {
    expect(stepForHash("#video-20", nos)).toEqual({ step: "watch", orderNo: 20 });
  });
  it("opens the watch step on a marker fragment of that video", () => {
    expect(stepForHash("#video-20-etiket-3", nos)).toEqual({ step: "watch", orderNo: 20 });
    expect(stepForHash("#video-2-tahillar", nos)).toEqual({ step: "watch", orderNo: 2 });
  });
  it("stays on the list for no hash, an unknown video, or a foreign fragment", () => {
    expect(stepForHash("", nos)).toEqual({ step: "pick", orderNo: null });
    expect(stepForHash("#video-99", nos)).toEqual({ step: "pick", orderNo: null });
    expect(stepForHash("#kitap-bilgisi", nos)).toEqual({ step: "pick", orderNo: null });
  });
  it("does not read video-2 out of video-20", () => {
    expect(stepForHash("#video-20", [2])).toEqual({ step: "pick", orderNo: null });
  });
});

describe("isBenchEntry", () => {
  it("recognises only entries the bench pushed", () => {
    expect(isBenchEntry({ [BENCH_HISTORY_MARK]: true })).toBe(true);
    expect(isBenchEntry(null)).toBe(false);
    expect(isBenchEntry({ other: true })).toBe(false);
  });
});

describe("historyWriteFor", () => {
  it("pushes the first video entry above the list", () => {
    expect(historyWriteFor(null)).toBe("push");
    expect(historyWriteFor({ __NA: true })).toBe("push");
  });
  it("replaces once a bench entry is on top, so one back always reaches the list", () => {
    expect(historyWriteFor({ [BENCH_HISTORY_MARK]: true })).toBe("replace");
  });
});

describe("armedSecondFor", () => {
  it("starts from the armed marker's second for the video it was armed on", () => {
    expect(armedSecondFor({ orderNo: 3, second: 229 }, 3)).toBe(229);
  });
  it("never carries a marker's second over to another video", () => {
    expect(armedSecondFor({ orderNo: 3, second: 229 }, 4)).toBe(0);
  });
  it("starts from 0 when nothing is armed", () => {
    expect(armedSecondFor(null, 4)).toBe(0);
  });
});
