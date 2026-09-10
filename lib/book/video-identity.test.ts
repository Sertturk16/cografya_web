import { describe, expect, it } from "vitest";
import type { Locale } from "@/i18n/routing";
import { tagFragment, videoFragment, videoTitle } from "./video-identity";

/**
 * THE FRAGMENT SCHEME IS BINDING IA, AND THE REFACTOR THAT COLLECTED IT HERE IS EXACTLY WHAT
 * MADE IT CHEAP TO BREAK.
 *
 * `SEO-POLICY.md` §B4's book row names `#video-{n}` / `#video-{n}-{name}` /
 * `#video-{n}-etiket-{m}` in as many words (P0 generic-catalogue cut-over, `DEC 2026-09-10b`
 * md.5), so these strings are a ruling rather than an implementation detail. Before this module
 * the scheme was written out at four call sites and a typo broke one link; now one edit rewrites
 * all of them at once.
 *
 * Structural, not factual (`CONVENTIONS.md` §2): the cases assert the SCHEME these functions
 * emit, never that any particular book has a video 12.
 */

describe("the book surface's fragment scheme", () => {
  it("addresses a video block as `video-N`", () => {
    expect(videoFragment(12)).toBe("video-12");
    expect(videoFragment(1)).toBe("video-1");
    expect(videoFragment(40)).toBe("video-40");
  });

  it("addresses an unnamed etiket as `video-N-etiket-M`", () => {
    expect(tagFragment(12, { orderNo: 3, nameTr: null })).toBe("video-12-etiket-3");
    expect(tagFragment(33, { orderNo: 6, nameTr: null })).toBe("video-33-etiket-6");
  });

  it("addresses a named etiket as `video-N-{folded name}`, not by its order number", () => {
    expect(tagFragment(12, { orderNo: 3, nameTr: "İklim" })).toBe("video-12-iklim");
    expect(tagFragment(1, { orderNo: 1, nameTr: "Nüfus ve Yerleşme" })).toBe(
      "video-1-nufus-ve-yerlesme",
    );
  });

  it("folds every Turkish character GLOSSARY.md §5 names, and collapses non-alnum runs", () => {
    expect(tagFragment(1, { orderNo: 1, nameTr: "Çöğüşı  --  Test" })).toBe("video-1-cogusi-test");
  });

  it("builds the etiket fragment ON the block fragment rather than beside it", () => {
    // The two are used together — the jump strip links the block, the row links the etiket, and
    // a reader lands on one from the other. Composing the second from the first is what keeps a
    // change to the block scheme from leaving 180 orphans behind.
    for (const videoOrderNo of [1, 15, 40]) {
      expect(
        tagFragment(videoOrderNo, { orderNo: 4, nameTr: null }).startsWith(
          `${videoFragment(videoOrderNo)}-`,
        ),
      ).toBe(true);
    }
  });

  it("emits no character a fragment identifier cannot carry", () => {
    // Turkish is the authoring language of this surface and the fallback token `etiket` is
    // deliberately ASCII: a `ş` or an `ı` here would be percent-encoded by half the tooling that
    // touches a URL and left alone by the other half, so one link would exist in two spellings.
    expect(tagFragment(7, { orderNo: 2, nameTr: null })).toMatch(/^[a-z0-9-]+$/);
    expect(tagFragment(7, { orderNo: 2, nameTr: "Şehirleşme" })).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("videoTitle — prefers the nullable authored title over the fallback key", () => {
  const t = (key: "videoFallbackHeading", values: { no: number }) => `${key}/${values.no}`;

  it("TR locale, titleTr present: returns the authored TR title", () => {
    expect(
      videoTitle(t, "tr" as Locale, { orderNo: 24, titleTr: "İklim Konusu", titleEn: null }),
    ).toBe("İklim Konusu");
  });

  it("TR locale, titleTr null: falls back to the translator key", () => {
    expect(videoTitle(t, "tr" as Locale, { orderNo: 24, titleTr: null, titleEn: null })).toBe(
      "videoFallbackHeading/24",
    );
  });

  it("EN locale, titleEn present: returns the authored EN title", () => {
    expect(
      videoTitle(t, "en" as Locale, { orderNo: 24, titleTr: null, titleEn: "Climate Topic" }),
    ).toBe("Climate Topic");
  });

  it("EN locale, titleEn null: falls back to the translator key even when titleTr exists", () => {
    // §B14 14.2 — a field with no EN counterpart is omitted, never machine-filled from the TR
    // value. The fallback branch must not silently borrow the other locale's authored string.
    expect(
      videoTitle(t, "en" as Locale, { orderNo: 24, titleTr: "İklim Konusu", titleEn: null }),
    ).toBe("videoFallbackHeading/24");
  });
});
