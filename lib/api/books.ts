import "server-only";
import { ApiError, apiGet } from "./client";
import { isProductionBuild } from "./provinces";
import type { BookDetail, BookList, BookListItem } from "./types";

/**
 * Book data access (the SSG/ISR source for the `/kitaplar` hub + book detail pages).
 *
 * Thin wrappers over the typed api client; the OpenAPI contract guarantees the shapes and
 * no book fact lives here. Same shape and the same reasoning as `lib/api/provinces.ts`,
 * with one structural difference: `/api/books` is PAGED.
 *
 * NO SEPARATE ISR WINDOW. Every read below inherits `CONTENT_REVALIDATE_SECONDS` (1 h)
 * from `apiGet`. Book data changes less often than province data, so a dedicated constant
 * would be a number invented for a freshness problem nobody has (`ENGINEERING.md` §10 —
 * no speculative generality). The marine module's own windows exist because the api
 * publishes matching `s-maxage` values there; this endpoint publishes the same
 * `max-age=300, stale-while-revalidate=86400` posture as the province endpoints.
 *
 * WRITTEN BEFORE THE ENDPOINTS EXIST. The contract's `Book*` schemas are merged
 * (`cografya_api` `origin/dev`), but `/api/books` and `/api/books/{slug}` are not served
 * yet — the api's B3 opens them. That is why this module's tests are fixture-backed rather
 * than live: the shapes are pinned by the generated types, and the request/response
 * BEHAVIOUR (paging, 404 handling, build-vs-runtime resilience) is exercised against a
 * stubbed `fetch`. The first real call happens in W1, after B3 lands.
 */

/**
 * Page size asked of `/api/books`.
 *
 * 100 is the endpoint's documented ceiling (→ DEC 2026-08-15h md.3: `pageSize` default 50,
 * max 100, `page` max 10 000), and asking for the ceiling is right here because every
 * consumer of this list wants ALL of it — `generateStaticParams`, the hub index and the
 * sitemap each need the complete set, so a smaller page would only add round trips.
 */
const BOOKS_PAGE_SIZE = 100;

/**
 * Hard ceiling on the paging loop — 20 pages × 100 = 2 000 books.
 *
 * Not a product limit: the book set is deliberately unbounded (→ DEC 2026-08-15e, "onlarca
 * kitap bile olabilir"), and 2 000 is far above any plausible catalogue. It exists so a
 * contract break — `hasMore` stuck at `true`, an off-by-one in the api's paging — cannot
 * hang `next build` in an infinite loop.
 */
const MAX_BOOK_PAGES = 20;

/**
 * Every book, in the api's own order (`displayOrder` ascending, tie-broken by `slugTr`).
 *
 * Reads pages until `hasMore === false`. Throws on failure, and — the deliberate part —
 * ALSO throws when the loop hits `MAX_BOOK_PAGES` instead of returning what it has so far.
 *
 * WHY IT THROWS RATHER THAN TRUNCATING. A short list here is not a degraded page; it is a
 * silent correctness loss that looks exactly like success. Every consumer of this function
 * is an enumeration: a truncated list means missing `generateStaticParams` entries (those
 * books fall back to on-demand ISR, or 404 if the detail route never resolves) and missing
 * `<url>` rows in the sitemap — with nothing failing, nothing logging, and CI green. The
 * loud failure is caught one level up by `getBooksResilient`, which already knows the
 * difference between build and runtime.
 */
export async function getBooks(): Promise<BookListItem[]> {
  const books: BookListItem[] = [];

  for (let page = 1; page <= MAX_BOOK_PAGES; page += 1) {
    const response = await apiGet<BookList>(`/api/books?page=${page}&pageSize=${BOOKS_PAGE_SIZE}`);
    books.push(...response.items);
    if (!response.hasMore) return books;
  }

  throw new Error(
    `[books] /api/books still reported hasMore after ${MAX_BOOK_PAGES} pages of ` +
      `${BOOKS_PAGE_SIZE}; refusing to truncate the catalogue silently.`,
  );
}

/**
 * Build-safe book list for the enumerating consumers that run during `next build`
 * (`generateStaticParams`, the `/kitaplar` hub index, the sitemap).
 *
 * The same build-vs-runtime split as `getProvincesResilient`, which documents the full
 * rationale: degrade to `[]` at BUILD so web CI (which has no api service) can still
 * build, and re-throw at RUNTIME so a transient api blip makes Next keep serving the last
 * good static artifact instead of caching an empty hub.
 *
 * At build, `[]` is not a silent hole either: the hub answers `notFound()` on an empty
 * list rather than rendering a heading with nothing under it, so the degraded state is
 * visible as a 404 rather than as a thin page.
 */
export async function getBooksResilient(): Promise<BookListItem[]> {
  try {
    return await getBooks();
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[books] list fetch failed during build; deferring to on-demand ISR. ${String(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/**
 * One book by its TR or EN slug (the api resolves both — the `ProvinceController`
 * precedent). Returns `null` on a genuine 404 so the page can call `notFound()`
 * (`ENGINEERING.md` §4 #6 — a real 404, never a soft-200); re-throws any other failure so
 * ISR keeps the last good render instead of caching a broken page.
 *
 * The slug is path-encoded even though today's book slugs are ASCII by rule
 * (`GLOSSARY.md` §5): the value arrives from a route parameter, and a route parameter is
 * never interpolated raw regardless of how well-behaved the current data is.
 */
export async function getBookBySlug(slug: string): Promise<BookDetail | null> {
  try {
    return await apiGet<BookDetail>(`/api/books/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
