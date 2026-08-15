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
 * The slug alphabet and length the api's own route parameter accepts, mirrored — NOT
 * re-invented (`cografya_api/src/book/dto/book-slug.params.ts`: `/^[a-z0-9-]+$/`,
 * `@Length(1, 140)`, the ceiling being `books.slug_tr varchar(140)`).
 *
 * WHY A SHAPE CHECK ON OUR SIDE AT ALL (→ PR #61 review `SEC61-M2`). `getBookBySlug`
 * percent-encodes the value, and the docblock there used to present that as if it closed the
 * question — but encoding is NORMALISATION, not validation. `encodeURIComponent` leaves
 * `.`, `-`, `_`, `~`, `!`, `*`, `'`, `(` and `)` untouched, so a route parameter of `.` or
 * `..` survives it and reaches the api as a path segment. Under Express's non-strict
 * routing that is not necessarily the 400 the contract promises: `/api/books/.` normalises
 * to the COLLECTION endpoint, which answers 200 with a list envelope — a shape this function
 * would then hand to a page typed as a single book.
 *
 * The guard therefore refuses to make the request at all and answers `null`, which the page
 * turns into `notFound()` — the same answer as the api's 400 and 404, and the right one:
 * a string outside this alphabet is not a slug any book can hold.
 */
const BOOK_SLUG_PATTERN = /^[a-z0-9-]+$/;
const BOOK_SLUG_MAX_LENGTH = 140;

/**
 * Whether a route parameter is shaped like a book slug.
 *
 * Exported so it is unit-testable — and it lives in `lib/` rather than beside the page for
 * a mechanical reason: `vitest.config.ts` collects only `lib/**` and `components/**`, so a
 * guard placed under `app/` is a guard CI cannot see.
 *
 * DELIBERATELY THE API'S SUPERSET, NOT THE SEED'S GATE. The seed additionally refuses a
 * leading, trailing or doubled hyphen (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`), which is correct
 * where it decides what may be WRITTEN as a permanent address. This one decides only what
 * is worth a request, and `--foo-` is not dangerous — merely unmatchable. Tightening it
 * would turn a 404 into a different 404 for a value no book can hold either way, while
 * silently disagreeing with the contract it mirrors.
 */
export function isBookSlugShape(slug: string): boolean {
  return slug.length <= BOOK_SLUG_MAX_LENGTH && BOOK_SLUG_PATTERN.test(slug);
}

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
 *
 * SHORTNESS HAS TWO CAUSES AND BOTH ARE GUARDED. `hasMore` stuck TRUE is caught by the page
 * ceiling below. `hasMore` arriving prematurely FALSE — missing, null, or wrongly cleared —
 * ends the loop through the success path and would return a short list looking like a
 * complete one, which is the very failure the ceiling exists to prevent, entering by the
 * other door. The completeness check after the loop closes it using a number the contract
 * already publishes, so it costs no extra request.
 *
 * That check throws on a `total` mismatch rather than warning, and the cost is named
 * because it is real: a book written between two page reads would move `total` and fail a
 * build that had done nothing wrong. Accepted deliberately — books are seeded, not
 * user-generated, so a concurrent write during a build is not a state this system produces;
 * and if it ever did, the same loud failure is still the right answer, because a
 * half-enumerated catalogue is exactly what must not reach the sitemap quietly.
 */
export async function getBooks(): Promise<BookListItem[]> {
  const books: BookListItem[] = [];

  for (let page = 1; page <= MAX_BOOK_PAGES; page += 1) {
    const response = await apiGet<BookList>(`/api/books?page=${page}&pageSize=${BOOKS_PAGE_SIZE}`);
    books.push(...response.items);

    if (!response.hasMore) {
      if (books.length !== response.total) {
        throw new Error(
          `[books] /api/books reported hasMore: false after ${books.length} of ` +
            `${response.total} books; refusing to publish a partial catalogue.`,
        );
      }
      return books;
    }
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
 * At build, `[]` must not become a silent hole, and that is an obligation W1 INHERITS
 * rather than a behaviour that exists today: the hub it builds is required to answer
 * `notFound()` on an empty list instead of rendering a heading with nothing under it, so a
 * degraded build shows up as a 404 rather than as a thin page. No hub exists yet.
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
 * precedent). Returns `null` when the slug does not resolve to a book, so the page can
 * call `notFound()` (`ENGINEERING.md` §4 #6 — a real 404, never a soft-200); re-throws any
 * other failure so ISR keeps the last good render instead of caching a broken page.
 *
 * TWO STATUSES MEAN "NO SUCH BOOK", NOT ONE. The api's route contract splits the
 * not-a-book case in two, and its own DTO says so: *"a slug that violates the shape answers
 * 400; a well-formed unknown one answers 404"* (`cografya_api/src/book/dto/book-slug.params.ts`,
 * published on the route as `@ApiBadRequestResponse`). Both are the same answer to the only
 * question this function asks — the page maps both to `notFound()`.
 *
 * Mapping only 404 is what a reader would write from habit, and it fails on the ORDINARY
 * case rather than an exotic one: a crawler following a mangled link, or a typo, sends a
 * malformed slug, the api answers 400, and a page that re-threw would return a 500 where it
 * owes a 404. Every OTHER status still re-throws — a 500 from the api is not "no such book",
 * and turning it into one would cache a soft-404 over a real outage.
 *
 * The slug is SHAPE-CHECKED before anything else ({@link isBookSlugShape}) and only then
 * path-encoded — and the honest description of the pair is that the check now does the work
 * and the encoding is defence in depth. `encodeURIComponent` is a NO-OP on every value the
 * check admits (`[a-z0-9-]` are all unreserved), so it changes no request that is made
 * today; it stays because it is the line that keeps a future loosening of the alphabet from
 * silently becoming a path-injection, and removing it would make that loosening a one-line
 * change with no remaining guard. A value that fails the check never becomes a request.
 */
export async function getBookBySlug(slug: string): Promise<BookDetail | null> {
  if (!isBookSlugShape(slug)) return null;

  try {
    return await apiGet<BookDetail>(`/api/books/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}
