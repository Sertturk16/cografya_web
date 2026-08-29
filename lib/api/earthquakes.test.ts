import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEarthquakeListResilient, getEarthquakeMetaResilient } from "./earthquakes";
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
 * that test, for the two wrappers this module actually exports: `getEarthquakeListResilient`
 * and `getEarthquakeMetaResilient`. There is no `…Safe` shape here (unlike marine) — the plan's
 * own §5.4 reserves that split for PR-B's province section — so only the build-vs-runtime
 * contrast is under test.
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
