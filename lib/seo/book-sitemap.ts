import type { MetadataRoute } from "next";
import type { BookListItem } from "@/lib/api/types";
import { sitemapEntriesFor } from "./sitemap-entries";

/**
 * The book tier's `<url>` set: the `/kitaplar` hub plus one entry per book, `"trOnly"` (both
 * English twins are permanently `noindex`, so each logical page owes exactly one URL).
 *
 * ## Why it lives here and not in `app/sitemap.ts` (→ PR #62 review `TEST62-I1`)
 *
 * The rule below is SEO POLICY, not data orchestration: an empty catalogue must produce no
 * hub `<url>`, because the hub answers `notFound()` on an empty list and §B6 6.8 rates a 404
 * URL in the sitemap a BLOCKER. `vitest.config.ts` collects `lib/**` and `components/**`
 * only, so the same predicate written inside `app/` is a rule CI cannot see — and the empty
 * branch is the exact path every api-less CI build takes. `app/sitemap.ts`'s own docblock
 * already said entry-building rules belong in `lib/seo/`; this is that split, applied to the
 * one builder that had grown a conditional.
 *
 * The predicate is now stated ONCE for the sitemap. `app/[locale]/kitaplar/page.tsx` states
 * the same `books.length === 0` condition for the page's own 404, which is deliberate rather
 * than duplicated: one decides a page's status code and the other decides a URL's presence,
 * and they are joined by reading the SAME list, not by sharing a helper.
 *
 * ## Two things that differ from the province and country builders
 *
 * **The hub travels with its books instead of sitting in `staticEntries()`** — the conditional
 * above is only expressible where the list is in hand, so an api outage at build drops the hub
 * and its books together, which is exactly right: it drops precisely the URLs that will 404.
 *
 * **No detail fetch.** The sibling builders resolve every entity to its detail record for one
 * field — `updatedAt` — because their list DTOs do not carry it. `BookListItemDto` does
 * (→ DEC 2026-08-15i md.4, added for this reason), so a real `lastmod` (`ENGINEERING.md`
 * §4 #7, §B6 6.9 — never the build clock) costs no extra request and an unbounded catalogue
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
