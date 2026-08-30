import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEarthquakeListResilient,
  getEarthquakeMetaResilient,
  getProvinceEarthquakesSafe,
} from "./earthquakes";
import { isProductionBuild } from "./provinces";

// Both hoisted above the imports by vitest — the identical setup `lib/api/marine.test.ts` uses
// for the same reason (see that file's own block comment).
vi.mock("./provinces", () => ({ isProductionBuild: vi.fn(() => false) }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/**
 * THE `…Resilient` PROPERTY, AS A TEST (review TEST104-I1).
 *
 * `lib/api/marine.ts`'s `getMarinePointsResilient` has a 214-line dedicated test file
 * (`lib/api/marine.test.ts`) precisely because a refactor that dropped its `try/catch` would
 * pass CI and then 500 the page at the next provider outage. `deprem-sayfalari` plan §5.3
 * claims `lib/api/earthquakes.ts` "follows `lib/api/marine.ts`'s established, documented split
 * precisely" — but only the CODE was ported, not the test that pins the behaviour. This file is
 * that test, for `getEarthquakeListResilient` and `getEarthquakeMetaResilient` (PR-A's own
 * two `…Resilient` wrappers) and, since PR-B, `getProvinceEarthquakesSafe` — the FAIL-SOFT
 * shape `lib/api/marine.test.ts` pins for `getMarineProvinceConditionsSafe`, at the identical
 * production risk: a refactor that dropped its `try/catch` would 500 every one of the 81
 * province pages at the next AFAD outage, a page whose subject is the province, not
 * earthquakes.
 *
 * `fetch` is stubbed, not `apiGet`, for the same reason `marine.test.ts` states: the three
 * failure shapes a real outage produces (a 404, a 5xx, a transport rejection) reach the wrapper
 * through three genuinely different paths, and only the real client turns the first two into
 * the `ApiError` the wrappers catch.
 *
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2): every payload below is a synthetic shape. Nothing
 * asserts a real magnitude, place name or province.
 */

type Outcome = () => Promise<Response>;

const FAILURES: [string, Outcome][] = [
  ["a 404 from a route the api does not serve yet", () => Promise.resolve(notOk(404))],
  ["a 5xx from the provider chain", () => Promise.resolve(notOk(502))],
  [
    "a transport failure, where fetch itself rejects",
    () => Promise.reject(new TypeError("fetch failed")),
  ],
];

function notOk(status: number): Response {
  return new Response("upstream failure", { status });
}

function ok(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Answers every request with the same outcome — one outage, however many reads. */
function apiAnswers(outcome: Outcome): void {
  vi.stubGlobal("fetch", vi.fn(outcome));
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(isProductionBuild).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getEarthquakeListResilient — build-safe, runtime-re-throwing", () => {
  // Fixed instants, not `Date.now()`-derived ones: `buildColdEarthquakeList`'s fallback shape
  // otherwise carries a `fromUtc`/`toUtc` this test cannot assert against deterministically.
  const filter = { fromUtc: "2026-08-01T00:00:00.000Z", toUtc: "2026-08-08T00:00:00.000Z" };

  it.each(FAILURES)("re-throws at RUNTIME on %s", async (_label, outcome) => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    apiAnswers(outcome);

    await expect(getEarthquakeListResilient(filter)).rejects.toThrow();
  });

  it.each(FAILURES)(
    "degrades to the honest cold shape during a BUILD on %s",
    async (_label, outcome) => {
      vi.mocked(isProductionBuild).mockReturnValue(true);
      apiAnswers(outcome);

      const result = await getEarthquakeListResilient(filter);
      // The real cold-path shape (§5.11): an empty `items` array with `dataStatus:
      // "unavailable"`, never a thrown error — web CI has no api service at build time.
      expect(result).toEqual({
        page: 1,
        pageSize: 50,
        total: 0,
        hasMore: false,
        items: [],
        meta: {
          filter: {
            minMagnitude: 2.5,
            plateCode: null,
            fromUtc: filter.fromUtc,
            toUtc: filter.toUtc,
          },
          dataUpdatedAtUtc: null,
          latestEventAtUtc: null,
          dataStatus: "unavailable",
          attributions: [],
        },
      });
    },
  );

  it("passes a successful read through untouched, in both phases", async () => {
    const payload = {
      page: 1,
      pageSize: 50,
      total: 1,
      hasMore: false,
      items: [{ id: "fixture-event", magnitude: 3.1 }],
      meta: {
        filter: {
          minMagnitude: 2.5,
          plateCode: null,
          fromUtc: filter.fromUtc,
          toUtc: filter.toUtc,
        },
        dataUpdatedAtUtc: "2026-08-08T00:00:00.000Z",
        latestEventAtUtc: "2026-08-07T23:00:00.000Z",
        dataStatus: "ok",
        attributions: [],
      },
    };
    apiAnswers(() => Promise.resolve(ok(payload)));

    const result = await getEarthquakeListResilient(filter);
    expect(result).toEqual(payload);
  });
});

describe("getEarthquakeMetaResilient — build-safe, runtime-re-throwing", () => {
  const COLD_META = {
    minMagnitudeDefault: 2.5,
    scopeBufferKm: 200,
    defaultWindowDays: 7,
    maxWindowDays: 366,
    dataUpdatedAtUtc: null,
    latestEventAtUtc: null,
    dataStatus: "unavailable",
    disclaimerTr:
      "Bu sayfa, AFAD'ın yayımladığı gerçekleşmiş deprem kayıtlarını gösterir. Erken uyarı sistemi değildir; gelecek depremler hakkında bilgi vermez.",
    attributions: [],
  };

  it.each(FAILURES)("re-throws at RUNTIME on %s", async (_label, outcome) => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    apiAnswers(outcome);

    await expect(getEarthquakeMetaResilient()).rejects.toThrow();
  });

  it.each(FAILURES)(
    "degrades to the honest cold meta during a BUILD on %s",
    async (_label, outcome) => {
      vi.mocked(isProductionBuild).mockReturnValue(true);
      apiAnswers(outcome);

      // No fabricated attribution row on the build-time fallback (the module's own docblock):
      // web CI has nothing real to publish, so it prints none rather than inventing one.
      await expect(getEarthquakeMetaResilient()).resolves.toEqual(COLD_META);
    },
  );

  it("passes a successful read through untouched, in both phases", async () => {
    const payload = {
      minMagnitudeDefault: 2.5,
      scopeBufferKm: 200,
      defaultWindowDays: 7,
      maxWindowDays: 366,
      dataUpdatedAtUtc: "2026-08-08T00:00:00.000Z",
      latestEventAtUtc: "2026-08-07T23:00:00.000Z",
      dataStatus: "ok",
      disclaimerTr: "fixture disclaimer",
      attributions: [{ providerId: "afad", providerName: "AFAD" }],
    };
    apiAnswers(() => Promise.resolve(ok(payload)));

    const result = await getEarthquakeMetaResilient();
    expect(result).toEqual(payload);
    // Not vacuous: the fallback and the payload are different values.
    expect(result).not.toEqual(COLD_META);
  });
});

describe("the build-vs-runtime split is genuinely wired, not flattened", () => {
  /**
   * Same route, same failure, two outcomes depending on the phase flag alone — a refactor that
   * collapsed the `isProductionBuild()` branch would leave every test above still green if it
   * always took ONE side; this pins that both sides are actually reachable from one call site.
   */
  it("getEarthquakeListResilient: build swallows, runtime re-throws, same failure", async () => {
    apiAnswers(() => Promise.resolve(notOk(500)));

    vi.mocked(isProductionBuild).mockReturnValue(false);
    await expect(getEarthquakeListResilient()).rejects.toThrow();

    vi.mocked(isProductionBuild).mockReturnValue(true);
    await expect(getEarthquakeListResilient()).resolves.toMatchObject({ items: [] });
  });

  it("getEarthquakeMetaResilient: build swallows, runtime re-throws, same failure", async () => {
    apiAnswers(() => Promise.resolve(notOk(500)));

    vi.mocked(isProductionBuild).mockReturnValue(false);
    await expect(getEarthquakeMetaResilient()).rejects.toThrow();

    vi.mocked(isProductionBuild).mockReturnValue(true);
    await expect(getEarthquakeMetaResilient()).resolves.toMatchObject({
      dataStatus: "unavailable",
    });
  });
});

describe("getProvinceEarthquakesSafe — fail-soft in every phase (PR-B)", () => {
  const PAYLOAD = {
    page: 1,
    pageSize: 50,
    total: 1,
    hasMore: false,
    items: [{ id: "fixture-province-event", magnitude: 3.4, bindingPlateCode: "34" }],
    meta: {
      filter: {
        minMagnitude: 2.5,
        plateCode: "34",
        fromUtc: "2026-08-01T00:00:00.000Z",
        toUtc: "2026-08-08T00:00:00.000Z",
      },
      dataUpdatedAtUtc: "2026-08-08T00:00:00.000Z",
      latestEventAtUtc: "2026-08-07T23:00:00.000Z",
      dataStatus: "ok",
      attributions: [{ providerId: "afad", providerName: "AFAD" }],
    },
  };

  it.each(FAILURES)("degrades to null on %s", async (_label, outcome) => {
    apiAnswers(outcome);

    // `resolves` is the whole assertion: a rejection here IS the regression — the same class
    // of failure `getMarineProvinceConditionsSafe`'s own test pins (marine.test.ts:135-150),
    // for the identical reason: a province page's earthquake section may never turn an AFAD
    // outage into a 500 on a page about the province. `beforeEach` sets the phase to runtime.
    await expect(getProvinceEarthquakesSafe("34")).resolves.toBeNull();
  });

  it("degrades at BUILD time too, not only at runtime", async () => {
    // The difference from `getEarthquakeListResilient`/`getEarthquakeMetaResilient`: those
    // swallow at build and re-throw at runtime; this one swallows in BOTH phases, because at
    // runtime the alternative is a 500 on a page about a province.
    vi.mocked(isProductionBuild).mockReturnValue(true);
    apiAnswers(() => Promise.resolve(notOk(503)));

    await expect(getProvinceEarthquakesSafe("34")).resolves.toBeNull();
  });

  it("passes a successful read through untouched", async () => {
    apiAnswers(() => Promise.resolve(ok(PAYLOAD)));

    const result = await getProvinceEarthquakesSafe("34");
    expect(result).toEqual(PAYLOAD);
    // Not vacuous: `null` and the payload are different values.
    expect(result).not.toBeNull();
  });

  it("URL-encodes the plaka path segment", async () => {
    // Typed via `ReturnType<typeof vi.fn>` (the `lib/reference/reference.server.test.ts`
    // `stubFetch` pattern), not inferred from the zero-arg lambda: an inferred `Mock<[], …>`
    // has a `calls` tuple of length 0, so `calls[0]?.[0]` fails `noUncheckedIndexedAccess`.
    const fetchMock: ReturnType<typeof vi.fn> = vi.fn(() => Promise.resolve(ok(PAYLOAD)));
    vi.stubGlobal("fetch", fetchMock);

    await getProvinceEarthquakesSafe("34");

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/api/earthquakes/provinces/34");
  });
});

describe("the outage warning survives the limiter (PR-B, the M9 pattern reused)", () => {
  /**
   * The same two wiring properties `lib/api/marine.test.ts` pins for
   * `getMarineProvinceConditionsSafe` (marine.test.ts:189-214), reused via the SAME
   * `createWarnLimiter` rather than a second implementation (plan §5.3): the first failure is
   * still reported in full, and a successful read resets the tally so the next outage is
   * reported as a new event rather than inheriting an earlier counter.
   */
  it("reports a fresh outage as occurrence one, with the plaka in the line", async () => {
    const warn = vi.mocked(console.warn);

    // A success first: whatever earlier tests left in the module-scoped tally, this clears it.
    apiAnswers(() =>
      Promise.resolve(
        ok({
          page: 1,
          pageSize: 50,
          total: 0,
          hasMore: false,
          items: [],
          meta: {
            filter: { minMagnitude: 2.5, plateCode: "34", fromUtc: "x", toUtc: "y" },
            dataUpdatedAtUtc: null,
            latestEventAtUtc: null,
            dataStatus: "ok",
            attributions: [],
          },
        }),
      ),
    );
    await getProvinceEarthquakesSafe("34");
    warn.mockClear();

    apiAnswers(() => Promise.resolve(notOk(503)));
    await getProvinceEarthquakesSafe("34");

    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("plaka 34");
    // No "(occurrence N)" suffix: the reset made this a first occurrence again.
    expect(line).not.toContain("occurrence");
  });
});
