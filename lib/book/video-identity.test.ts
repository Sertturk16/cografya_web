import { describe, expect, it } from "vitest";
import { denemeFragment, questionFragment, videoTitle } from "./video-identity";

/**
 * THE FRAGMENT SCHEME IS BINDING IA, AND THE REFACTOR THAT COLLECTED IT HERE IS EXACTLY WHAT
 * MADE IT CHEAP TO BREAK.
 *
 * `SEO-POLICY.md` §B4's book row names `#deneme-12` and `#deneme-12-soru-3` in as many words, so
 * these two strings are a ruling rather than an implementation detail. Before this module the
 * scheme was written out at four call sites and a typo broke one link; now one edit rewrites all
 * of them at once — the page stays perfectly self-consistent (every `href` still finds its `id`,
 * so `bench.structure.test.ts` and the anchor counters all pass), while every shared deep link
 * anyone has ever sent stops resolving. Zero red, total breakage: the shape that earns a unit
 * test rather than a structural one (→ PR #70 review `TA70-M3`).
 *
 * Structural, not factual (`CONVENTIONS.md` §2): the cases assert the SCHEME these functions
 * emit, never that any particular book has a deneme 12.
 */

describe("the book surface's fragment scheme", () => {
  it("addresses a video block as `deneme-N`", () => {
    expect(denemeFragment(12)).toBe("deneme-12");
    expect(denemeFragment(1)).toBe("deneme-1");
    expect(denemeFragment(40)).toBe("deneme-40");
  });

  it("addresses a question row as `deneme-N-soru-M`", () => {
    expect(questionFragment(12, 3)).toBe("deneme-12-soru-3");
    expect(questionFragment(33, 6)).toBe("deneme-33-soru-6");
  });

  it("builds the question fragment ON the block fragment rather than beside it", () => {
    // The two are used together — the jump strip links the block, the row links the question, and
    // a reader lands on one from the other. Composing the second from the first is what keeps a
    // change to the block scheme from leaving 180 orphans behind.
    for (const denemeNo of [1, 15, 40]) {
      expect(questionFragment(denemeNo, 4).startsWith(`${denemeFragment(denemeNo)}-`)).toBe(true);
    }
  });

  it("emits no character a fragment identifier cannot carry", () => {
    // Turkish is the authoring language of this surface and `soru` is deliberately ASCII: a `ş`
    // or an `ı` here would be percent-encoded by half the tooling that touches a URL and left
    // alone by the other half, so one link would exist in two spellings.
    expect(questionFragment(7, 2)).toMatch(/^[a-z0-9-]+$/);
  });

  it("asks the caller's translator for the ONE key the whole surface prints", () => {
    // `videoTitle` is the seam `FU-BOOK-GENERIC-CONTRACT` lands on, and its contract with three
    // consumers (index row, stage caption, `VideoObject.name`) is that they all get the same
    // string. What that costs is that the key and the value shape are load-bearing.
    const t = (key: "denemeHeading", values: { no: number }) => `${key}/${values.no}`;
    expect(videoTitle(t, { denemeNo: 24 })).toBe("denemeHeading/24");
  });
});
