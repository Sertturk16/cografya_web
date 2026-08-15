import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOK_DETAIL,
  BOOK_LIST_PAGE_1,
  BOOK_LIST_PAGE_2,
} from "@/test/fixtures/books/book-fixtures";
import { getBookBySlug, getBooks, getBooksResilient } from "./books";
import { isProductionBuild } from "./provinces";

// Both hoisted above the imports by vitest, for the same reasons `lib/api/marine.test.ts`
// records them:
//
// `./provinces` — `isProductionBuild` is the only thing `lib/api/books` takes from it, and
// the phase flag has to be flippable for the `…Resilient` contrast test below.
//
// `@/lib/env.server` — the REAL client is deliberately kept (see the block comment), and it
// reads the validated server env at module load. Stubbing the origin keeps this file off the
// ambient environment: what these tests assert must not depend on which `.env` file happens
// to exist on the machine running them.
vi.mock("./provinces", () => ({ isProductionBuild: vi.fn(() => false) }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/**
 * THE READ CONTRACT OF A MODULE WRITTEN BEFORE ITS ENDPOINTS EXIST.
 *
 * `/api/books` and `/api/books/{slug}` are not served yet — the api's B3 opens them — so
 * there is nothing live to call. Two halves are still pinnable today, and together they are
 * what W1 will be standing on when it makes the first real request:
 *
 *   · the SHAPES, pinned by the committed contract: the fixtures are annotated with the
 *     generated aliases, so `tsc` fails if either drifts (see the fixture's own docblock);
 *   · the BEHAVIOUR, pinned here: paging until `hasMore` clears, refusing to truncate,
 *     404 → `null` while every other failure re-throws, and the build-vs-runtime split.
 *
 * `fetch` IS STUBBED, NOT `apiGet` — the same choice `marine.test.ts` argues for. A 404
 * only becomes the `ApiError` these wrappers branch on by passing through the real client;
 * stubbing `apiGet` would test the `catch` against an error the code never actually meets.
 *
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2): every payload is synthetic. Nothing here asserts a
 * book title, an ISBN, a deneme count or how many videos exist.
 */

function ok(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function notOk(status: number): Response {
  return new Response("upstream failure", { status });
}

/** Answers each successive call with the next queued response. */
function apiAnswersInOrder(...responses: Response[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const stub = vi.fn(() => {
    const response = responses[call];
    call += 1;
    if (response === undefined) throw new Error("fetch called more times than the test queued");
    return Promise.resolve(response);
  });
  vi.stubGlobal("fetch", stub);
  return stub;
}

/** The URL string of the nth `fetch` call (1-based), for asserting the query contract. */
function requestedUrl(stub: ReturnType<typeof vi.fn>, nth: number): string {
  return String(stub.mock.calls[nth - 1]?.[0]);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(isProductionBuild).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getBooks — paging", () => {
  it("follows hasMore across pages and concatenates in the api's order", async () => {
    apiAnswersInOrder(ok(BOOK_LIST_PAGE_1), ok(BOOK_LIST_PAGE_2));

    const books = await getBooks();

    // Every item from both pages, in the order the api returned them — the list is ordered
    // by `displayOrder` server-side and the web never re-sorts it.
    expect(books.map((book) => book.slugTr)).toEqual([
      ...BOOK_LIST_PAGE_1.items.map((book) => book.slugTr),
      ...BOOK_LIST_PAGE_2.items.map((book) => book.slugTr),
    ]);
  });

  it("stops as soon as a page reports hasMore: false", async () => {
    const stub = apiAnswersInOrder(ok(BOOK_LIST_PAGE_2));

    await getBooks();

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("asks for page 1 first and increments, at the endpoint's documented ceiling", async () => {
    const stub = apiAnswersInOrder(ok(BOOK_LIST_PAGE_1), ok(BOOK_LIST_PAGE_2));

    await getBooks();

    // The query contract is ruled (→ DEC 2026-08-15h md.3) but is not in the committed
    // OpenAPI document yet, because the path itself is not. Pinning it here means the day
    // B3 lands, a mismatch shows up as a failing test rather than as an empty hub.
    expect(requestedUrl(stub, 1)).toBe("http://api.test/api/books?page=1&pageSize=100");
    expect(requestedUrl(stub, 2)).toBe("http://api.test/api/books?page=2&pageSize=100");
  });

  it("throws rather than silently truncating when hasMore never clears", async () => {
    // A broken contract, not a slow one. Truncating here would drop books out of
    // `generateStaticParams` and the sitemap with nothing failing anywhere — the silent
    // correctness loss the ceiling exists to convert into a loud one.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(ok({ ...BOOK_LIST_PAGE_1, hasMore: true }))),
    );

    await expect(getBooks()).rejects.toThrow(/hasMore/);
  });

  it("re-throws an api failure instead of returning a partial catalogue", async () => {
    apiAnswersInOrder(ok(BOOK_LIST_PAGE_1), notOk(502));

    await expect(getBooks()).rejects.toThrow();
  });
});

describe("getBooksResilient — the build-vs-runtime split", () => {
  it("degrades to an empty list during a production build", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(notOk(404))),
    );

    // CI has no api service, so a build must survive the outage; the hub then answers 404
    // on an empty list rather than rendering a heading with nothing under it.
    await expect(getBooksResilient()).resolves.toEqual([]);
  });

  it("re-throws at runtime, so ISR keeps the last good render", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(notOk(502))),
    );

    await expect(getBooksResilient()).rejects.toThrow();
  });
});

describe("getBookBySlug", () => {
  it("returns the payload on a 200", async () => {
    apiAnswersInOrder(ok(BOOK_DETAIL));

    await expect(getBookBySlug("fixture-book-one")).resolves.toEqual(BOOK_DETAIL);
  });

  it("returns null on a genuine 404 so the page can call notFound()", async () => {
    apiAnswersInOrder(notOk(404));

    // `null` is what keeps an unknown slug a REAL 404 instead of a soft-200
    // (`ENGINEERING.md` §4 #6). Any other value here would be that regression.
    await expect(getBookBySlug("no-such-book")).resolves.toBeNull();
  });

  it.each([
    ["a 5xx from the api", () => Promise.resolve(notOk(500))],
    ["a transport failure, where fetch itself rejects", () => Promise.reject(new TypeError("x"))],
  ])("re-throws on %s, so ISR never caches a broken page", async (_label, outcome) => {
    vi.stubGlobal("fetch", vi.fn(outcome));

    await expect(getBookBySlug("fixture-book-one")).rejects.toThrow();
  });

  it("path-encodes the slug it was handed", async () => {
    const stub = apiAnswersInOrder(ok(BOOK_DETAIL));

    // The value reaches here from a route parameter, so it is encoded regardless of how
    // well-behaved today's slugs are (`GLOSSARY.md` §5 keeps them ASCII by rule).
    await getBookBySlug("a b/../c");

    expect(requestedUrl(stub, 1)).toBe("http://api.test/api/books/a%20b%2F..%2Fc");
  });
});
