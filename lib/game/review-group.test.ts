import { describe, expect, it } from "vitest";
import { REVIEW_OPEN_MAX, shouldOpenReviewGroup } from "./review-group";

describe("the end screen's review group", () => {
  it("opens itself for the short lists the region modes produce", () => {
    // The whole bölge pool is 7, so that mode can never fold.
    expect(shouldOpenReviewGroup(1)).toBe(true);
    expect(shouldOpenReviewGroup(7)).toBe(true);
  });

  it("folds once the list would bury the score", () => {
    // The boundary itself, from both sides — the one assertion a source scan cannot make.
    expect(shouldOpenReviewGroup(REVIEW_OPEN_MAX)).toBe(true);
    expect(shouldOpenReviewGroup(REVIEW_OPEN_MAX + 1)).toBe(false);
    // What an 81-question round with a bad run actually produces.
    expect(shouldOpenReviewGroup(80)).toBe(false);
  });

  it("stays shut on an empty group", () => {
    expect(shouldOpenReviewGroup(0)).toBe(false);
    expect(shouldOpenReviewGroup(-1)).toBe(false);
  });
});
