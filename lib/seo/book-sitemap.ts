import type { MetadataRoute } from "next";
import type { BookListItem } from "@/lib/api/types";
import type { ContentSurface } from "./indexing";
import { sitemapEntriesFor } from "./sitemap-entries";

/**
 * The book tier's `<url>` set: the `/kitaplar` hub plus one entry per book, `"trOnly"` (both
 * English twins are permanently `noindex`, so each logical page owes exactly one URL).
 *
 * ## Why it lives here and not in `app/sitemap.ts`
 *
 * The rule below is an SEO rule, not data orchestration: an empty catalogue must produce no
 * hub `<url>`, because the hub is `noindex` on an empty list ({@link bookHubSurface}) and a
 * `noindex` URL in the sitemap is a blocker. `vitest.config.ts` collects `lib/**` and
 * `components/**` only, so the same predicate written inside `app/` is a rule CI cannot see —
 * and the empty branch is the exact path every api-less CI build takes. `app/sitemap.ts`'s own docblock
 * already said entry-building rules belong in `lib/seo/`; this is that split, applied to the
 * one builder that had grown a conditional.
 *
 * The predicate is stated twice on purpose, side by side in this file: `bookSitemapEntries`
 * decides the hub row's presence and {@link bookHubSurface} the hub page's own robots tag. Both
 * read the same catalogue, so the row exists exactly while the page is indexable.
 *
 * ## Two things that differ from the province and country builders
 *
 * **The hub travels with its books instead of sitting in `staticEntries()`** — the conditional
 * above is only expressible where the list is in hand, so an api outage at build drops the hub
 * and its books together, which is exactly right: it drops precisely the URLs that are
 * `noindex` or 404 on that build.
 *
 * **No detail fetch.** The sibling builders resolve every entity to its detail record for one
 * field — `updatedAt` — because their list DTOs do not carry it. `BookListItemDto` does
 * (added for this reason), so a real `lastmod` (never the build clock) costs no extra request and an unbounded catalogue
 * never becomes an N+1. That is also why this function is pure: it needs nothing but the list.
 */
export function bookSitemapEntries(books: BookListItem[]): MetadataRoute.Sitemap {
  if (books.length === 0) return [];

  // The hub's own `lastmod` is the most recent change across the books it lists — the only
  // honest answer for a page whose whole content is that list, and still a real `updated_at`
  // rather than the build clock.
  const hubLastModified = new Date(
    Math.max(...books.map((book) => new Date(book.updatedAt).getTime())),
  );

  return [
    ...sitemapEntriesFor(() => "/kitaplar", hubLastModified, 0.7, "trOnly"),
    ...books.flatMap((book) =>
      sitemapEntriesFor(
        (locale) => ({
          pathname: "/kitaplar/[slug]",
          params: { slug: locale === "en" ? book.slugEn : book.slugTr },
        }),
        new Date(book.updatedAt),
        0.7,
        "trOnly",
      ),
    ),
  ];
}

/**
 * The `/kitaplar` hub's surface: `trOnly` while the catalogue lists a book (the surface its
 * sitemap row above is built with) and `noindex` while it is empty, when the page only says
 * that no book is published yet. The page passes it to `buildMetadata` and to its breadcrumb
 * trail, so the robots tag and the BreadcrumbList JSON-LD cannot disagree.
 */
export function bookHubSurface(hasBooks: boolean): ContentSurface {
  return hasBooks ? "trOnly" : "noindex";
}
