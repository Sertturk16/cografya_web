import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOK_DETAIL,
  BOOK_LIST_PAGE_1,
  BOOK_LIST_PAGE_2,
} from "@/test/fixtures/books/book-fixtures";
import { getBookBySlug, getBooks, getBooksResilient, isBookSlugShape } from "./books";
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

/**
 * A SELF-CONSISTENT one-page response: `hasMore: false` **and** a `total` equal to its own
 * item count.
 *
 * `BOOK_LIST_PAGE_2` is page 2 of a three-book set, so its `total: 3` is correct in that
 * role and wrong when the page is served alone — one item claiming a catalogue of three is
 * precisely the "short list arriving through the success path" that the completeness check
 * exists to reject. It rejected it: this constant exists because the guard failed the two
 * tests below on its first CI run, on a fixture misuse that had been invisible while the
 * guard did not exist.
 */
const SINGLE_COMPLETE_PAGE = { ...BOOK_LIST_PAGE_2, total: BOOK_LIST_PAGE_2.items.length };

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
    const stub = apiAnswersInOrder(ok(SINGLE_COMPLETE_PAGE));

    await getBooks();

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("asks for page 1 first and increments, at the endpoint's documented ceiling", async () => {
    const stub = apiAnswersInOrder(ok(BOOK_LIST_PAGE_1), ok(BOOK_LIST_PAGE_2));

    await getBooks();

    // WHAT THIS PINS, AND WHAT IT CANNOT. It pins the request THIS module builds, so a
    // silent edit to the parameter names or the page size fails here. It does NOT validate
    // that against the api: the expectation is a literal copy of the string the code
    // produces, so if the ruled contract (→ DEC 2026-08-15h md.3) and this module disagree,
    // both sides of this assertion move together and it stays green. The real check is a
    // live call, and it belongs to W1 — the path does not exist in the committed OpenAPI
    // document yet, which is exactly why it is not a check that can be written here.
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

    // The status is asserted, not just "something threw": a page-2 failure and a bug in
    // this test's own stub both satisfy a bare `toThrow()`.
    await expect(getBooks()).rejects.toMatchObject({ name: "ApiError", status: 502 });
  });

  // CODE61-M3: the ceiling catches `hasMore` stuck TRUE; this catches it arriving
  // prematurely FALSE, which ends the loop through the SUCCESS path and would otherwise
  // return a short catalogue that looks complete.
  it("throws when hasMore clears before the published total is reached", async () => {
    apiAnswersInOrder(ok({ ...BOOK_LIST_PAGE_1, hasMore: false }));

    await expect(getBooks()).rejects.toThrow(/partial catalogue/);
  });

  it("accepts a single complete page whose length matches the total", async () => {
    // The completeness check must not fire on the ordinary one-page case — a guard that
    // rejects the normal path is worse than no guard.
    apiAnswersInOrder(ok(SINGLE_COMPLETE_PAGE));

    await expect(getBooks()).resolves.toHaveLength(SINGLE_COMPLETE_PAGE.items.length);
  });
});

describe("getBooksResilient — the build-vs-runtime split", () => {
  it("degrades to an empty list during a production build", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(notOk(404))),
    );

    // CI has no api service, so a build must survive the outage; W1's hub then owes a 404
    // on an empty list rather than a heading with nothing under it.
    await expect(getBooksResilient()).resolves.toEqual([]);

    // The degrade is only safe because it is ANNOUNCED. A silent `[]` during a build is
    // indistinguishable from a genuinely empty catalogue, so the warning is part of the
    // contract rather than debug noise.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[books]"));
  });

  it("re-throws at runtime, so ISR keeps the last good render", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(notOk(502))),
    );

    await expect(getBooksResilient()).rejects.toMatchObject({ name: "ApiError", status: 502 });
  });
});

describe("getBookBySlug", () => {
  it("returns the payload on a 200", async () => {
    apiAnswersInOrder(ok(BOOK_DETAIL));

    await expect(getBookBySlug("fixture-book-one")).resolves.toEqual(BOOK_DETAIL);
  });

  // BOTH STATUSES THE API USES FOR "NO SUCH BOOK". The route contract splits the case in
  // two — a malformed slug answers 400, a well-formed unknown one answers 404
  // (`cografya_api/src/book/dto/book-slug.params.ts`, published as `@ApiBadRequestResponse`)
  // — and the page owes `notFound()` for both. The 400 row is the one that was missing: a
  // crawler following a mangled link is the ordinary case, not an exotic one, and a
  // re-thrown 400 turns a page that owes a 404 into a 500.
  it.each([
    ["404, a well-formed slug that matches no book", 404],
    ["400, a slug that violates the api's shape rule", 400],
  ])("returns null on %s so the page can call notFound()", async (_label, status) => {
    apiAnswersInOrder(notOk(status));

    // `null` is what keeps an unknown slug a REAL 404 instead of a soft-200
    // (`ENGINEERING.md` §4 #6). Any other outcome here is that regression.
    await expect(getBookBySlug("no-such-book")).resolves.toBeNull();
  });

  // The complement, and the reason the mapping is two statuses rather than "4xx": a 500 is
  // NOT "no such book", and mapping it to `null` would cache a soft-404 over a real outage.
  it.each([
    ["a 5xx from the api", 500],
    ["a 403 from the api", 403],
  ])("re-throws on %s, so ISR never caches a broken page", async (_label, status) => {
    apiAnswersInOrder(notOk(status));

    // Asserted on the ApiError's own status rather than with a bare `toThrow()`: the point
    // is WHICH rejection surfaced, and a bare matcher passes on any of them — including a
    // TypeError from a typo in the test itself.
    await expect(getBookBySlug("fixture-book-one")).rejects.toMatchObject({
      name: "ApiError",
      status,
    });
  });

  it("re-throws a transport failure, where fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed"))),
    );

    // No status exists here — `apiGet` never sees a response — so this rejection must reach
    // the caller as the TypeError it is, not as an ApiError.
    await expect(getBookBySlug("fixture-book-one")).rejects.toThrow(TypeError);
  });

  it("asks for the slug it was handed, as one path segment", async () => {
    const stub = apiAnswersInOrder(ok(BOOK_DETAIL));

    await getBookBySlug("fixture-book-one");

    expect(requestedUrl(stub, 1)).toBe("http://api.test/api/books/fixture-book-one");
  });
});

// THE SHAPE GUARD (→ PR #61 review `SEC61-M2`). It sits in `lib/` and not beside the page
// for a mechanical reason: `vitest.config.ts` collects only `lib/**` and `components/**`,
// so a guard under `app/` is one CI cannot see.
describe("isBookSlugShape", () => {
  it.each([
    ["today's real slug shape", "ayt-cografya-konu-ozetli-brans-denemeleri"],
    ["digits", "deneme-2026"],
    ["a single character", "a"],
    // The api's own pattern is a deliberate SUPERSET of the seed's write-time gate: it
    // permits a leading/trailing/doubled hyphen, which no book can hold but which is
    // unmatchable rather than dangerous. Mirroring the superset keeps the two sides in
    // agreement about which values are a 404 and which are a 400.
    ["a shape the seed gate would refuse but the api accepts", "--foo-"],
    ["the maximum column length", "a".repeat(140)],
  ])("accepts %s", (_case, slug) => {
    expect(isBookSlugShape(slug)).toBe(true);
  });

  it.each([
    // The case the finding was actually about: `encodeURIComponent` leaves `.` untouched,
    // so a bare dot survives normalisation and, under Express's non-strict routing,
    // `/api/books/.` resolves to the COLLECTION endpoint — a 200 carrying a list envelope
    // where a single book was expected.
    ["a bare dot", "."],
    ["a parent-directory segment", ".."],
    ["a path separator", "a/b"],
    ["an unencoded space", "a b"],
    ["uppercase", "Ayt-Cografya"],
    ["a Turkish character the slug rule folds away", "coğrafya"],
    ["an empty string", ""],
    ["one character past the column length", "a".repeat(141)],
  ])("refuses %s", (_case, slug) => {
    expect(isBookSlugShape(slug)).toBe(false);
  });

  it("refuses a malformed slug without issuing a request at all", async () => {
    const stub = vi.fn(() => Promise.resolve(ok(BOOK_DETAIL)));
    vi.stubGlobal("fetch", stub);

    // `null`, so the page answers `notFound()` — the same answer as the api's 400, reached
    // without asking. The request count is the assertion that matters: a guard that returns
    // the right value after making the call would not have closed the finding.
    await expect(getBookBySlug("..")).resolves.toBeNull();
    expect(stub).not.toHaveBeenCalled();
  });
});
