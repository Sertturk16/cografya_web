import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import type { BookListItem } from "@/lib/api/types";
import { bookSitemapEntries } from "./book-sitemap";
import { absoluteUrl } from "./site";

/**
 * INVARIANT GUARDS for the book tier's sitemap composition (→ PR #62 review `TEST62-I1`).
 *
 * The rule these protect is the conditional one: `/kitaplar` answers `notFound()` on an empty
 * catalogue, so its `<url>` may not appear in the sitemap in that state (§B6 6.8 — a 404 URL
 * in a sitemap is a BLOCKER). Until this file existed the predicate lived in `app/`, outside
 * vitest's collection, and the failure it guards against is silent: a later "consistency"
 * refactor that moves `/kitaplar` into `staticEntries()` makes `/sitemap.xml` advertise a 404
 * with all three CI jobs green.
 *
 * The empty branch is not an edge case here — it is the path EVERY api-less CI build takes.
 *
 * Expectations are DERIVED through `getPathname`/`absoluteUrl` rather than written as literal
 * URLs, because the literals are already pinned once, on purpose, in `book-routes.test.ts`
 * (review `CODE61-M5`). Repeating them here would test the routing config a second time and
 * say nothing about the composition rule, which is the only thing this file is for. The
 * fixtures are synthetic: no real book, publisher or ISBN is named (`CONVENTIONS.md` §2).
 */

/** A synthetic book. Only the four fields this builder reads carry meaning. */
function book(overrides: Partial<BookListItem> = {}): BookListItem {
  return {
    slugTr: "synthetic-book-one",
    slugEn: "synthetic-book-one",
    titleTr: "Synthetic Book One",
    publisherName: "Synthetic Publisher",
    examTrack: "AYT",
    coverImagePath: null,
    videoCount: 3,
    questionCount: 18,
    displayOrder: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const hubUrl = absoluteUrl(getPathname({ locale: "tr", href: "/kitaplar" }));

const detailUrl = (slug: string) =>
  absoluteUrl(
    getPathname({ locale: "tr", href: { pathname: "/kitaplar/[slug]", params: { slug } } }),
  );

describe("bookSitemapEntries", () => {
  it("emits no hub <url> for an empty catalogue, and does emit one when a book exists", () => {
    // BOTH DIRECTIONS IN ONE TEST, deliberately. "The hub URL is absent" is also what a
    // builder that emits nothing at all, or one whose URL form has drifted, would produce —
    // so the absence is only evidence once the same assertion has been watched to fire
    // positively against a list that must contain it.
    expect(bookSitemapEntries([]).map((entry) => entry.url)).not.toContain(hubUrl);
    expect(bookSitemapEntries([])).toEqual([]);
    expect(bookSitemapEntries([book()]).map((entry) => entry.url)).toContain(hubUrl);
  });

  it("emits the hub exactly once plus one <url> per book", () => {
    // `"trOnly"`: one entry per logical page, never a second for the noindex EN twin. A hub
    // repeated per book, or a book's URL missing, both show up here.
    const entries = bookSitemapEntries([
      book({ slugTr: "synthetic-book-one", slugEn: "synthetic-book-one-en" }),
      book({ slugTr: "synthetic-book-two", slugEn: "synthetic-book-two-en" }),
    ]);

    expect(entries.map((entry) => entry.url)).toEqual([
      hubUrl,
      detailUrl("synthetic-book-one"),
      detailUrl("synthetic-book-two"),
    ]);
  });

  it("stamps the hub with the most recent book's updatedAt, not the build clock", () => {
    // §B6 6.9 / `ENGINEERING.md` §4 #7: `lastmod` is a real `updated_at`. The newest book is
    // deliberately NOT the last one in the list, so a builder reading `at(-1)` — or `new
    // Date()` — fails instead of coincidentally agreeing.
    const entries = bookSitemapEntries([
      book({ slugTr: "synthetic-book-one", updatedAt: "2026-03-04T05:06:07.000Z" }),
      book({ slugTr: "synthetic-book-two", updatedAt: "2026-02-01T00:00:00.000Z" }),
    ]);

    expect(entries[0]?.url).toBe(hubUrl);
    expect(entries[0]?.lastModified).toEqual(new Date("2026-03-04T05:06:07.000Z"));
  });
});
