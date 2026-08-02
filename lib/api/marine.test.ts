import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMarineLayersSafe,
  getMarineOverviewSafe,
  getMarinePointsResilient,
  getMarinePointsSafe,
  getMarineProvinceConditionsSafe,
} from "./marine";
import { isProductionBuild } from "./provinces";

// Both hoisted above the imports by vitest.
//
// `./provinces` — `isProductionBuild` is the only thing `lib/api/marine` takes from it, and
// the phase flag has to be flippable for the `…Resilient` contrast test below.
//
// `@/lib/env.server` — the real client is deliberately kept (see the block comment), and it
// reads the validated server env at module load. Stubbing the origin keeps this test off the
// ambient environment entirely: it asserts what the wrappers do with a FAILING api, and that
// answer must not depend on which `.env` file happens to exist on the machine running it.
vi.mock("./provinces", () => ({ isProductionBuild: vi.fn(() => false) }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

/**
 * THE FAIL-SOFT PROPERTY, AS A TEST (the PR #37 review, I1).
 *
 * Four `…Safe` wrappers exist for one reason: a chain of external providers we do not operate
 * — ECMWF, Copernicus Marine, the api in front of them — may remove a marine SECTION, and may
 * never remove the page it hangs off, its 200, its facts or its links. Three of the four are
 * read by 27 province pages whose subject is not the sea at all.
 *
 * That premise was verified once, by hand, against a live api serving 404s. This file is what
 * makes it verifiable on every commit. Without it, a refactor that dropped a `try/catch` would
 * pass CI and then 500 every coastal province page at the next provider outage — the failure
 * mode the wrappers were written to make impossible.
 *
 * HOW IT IS EXERCISED, AND WHY AT THIS LEVEL. `fetch` is stubbed, not `apiGet`: the three
 * failure shapes a real outage produces (a 404 from a route the api does not serve yet, a 5xx
 * from the provider chain, and `fetch` itself rejecting on a transport failure) reach the
 * wrapper through three genuinely different paths, and only the real client turns the first
 * two into the `ApiError` the wrappers catch. Stubbing `apiGet` would have tested the
 * try/catch against an error the code never actually meets.
 *
 * `./provinces` is the one module mocked, for `isProductionBuild` alone: it is the phase flag
 * the `…Resilient` contrast below has to flip, and mocking it keeps the test off `NEXT_PHASE`
 * and off Next's own module graph. Its implementation is a single `process.env` comparison and
 * is not what is under test here.
 *
 * STRUCTURAL ONLY (`CONVENTIONS.md` §2): every payload below is a synthetic shape. Nothing
 * asserts a wave height, a plaka's coastline or which provinces have a sea.
 */

/** One api outcome, produced lazily so each case gets a fresh `Response`/rejection. */
type Outcome = () => Promise<Response>;

const FAILURES: [string, Outcome][] = [
  // The state this branch actually shipped into: `/api/marine/overview` and the province
  // conditions route answered 404 until the api's M4.
  ["a 404 from a route the api does not serve yet", () => Promise.resolve(notOk(404))],
  // The provider chain behind the api having a bad afternoon.
  ["a 5xx from the provider chain", () => Promise.resolve(notOk(502))],
  // No response at all: DNS, TLS, a closed socket. `apiGet` never sees a status.
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

interface SafeRead {
  readonly name: string;
  readonly read: () => Promise<unknown>;
  /** What the caller gets when the read fails: "no material this render", never an error. */
  readonly fallback: unknown;
  /** A synthetic 200 body, deliberately distinguishable from the fallback. */
  readonly payload: unknown;
}

const SAFE_READS: SafeRead[] = [
  {
    name: "getMarinePointsSafe",
    read: getMarinePointsSafe,
    fallback: [],
    payload: [{ slugTr: "fixture-aciklari", plateCode: "00" }],
  },
  {
    name: "getMarineLayersSafe",
    read: getMarineLayersSafe,
    fallback: [],
    payload: [{ id: "fixture_layer" }],
  },
  {
    name: "getMarineOverviewSafe",
    read: getMarineOverviewSafe,
    fallback: null,
    payload: { dataAvailable: true, points: [] },
  },
  {
    name: "getMarineProvinceConditionsSafe",
    read: () => getMarineProvinceConditionsSafe("00"),
    fallback: null,
    payload: { plateCode: "00", marinePoints: [], attributions: [] },
  },
];

beforeEach(() => {
  // The wrappers warn by design; the assertions below are about what they RETURN, so the
  // lines are captured rather than printed into the CI log.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(isProductionBuild).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(SAFE_READS)("$name — fail-soft in every phase", ({ read, fallback, payload }) => {
  it.each(FAILURES)("degrades to its fallback on %s", async (_label, outcome) => {
    apiAnswers(outcome);

    // `resolves` is the whole assertion: a rejection here IS the regression.
    await expect(read()).resolves.toEqual(fallback);
  });

  it("degrades at RUNTIME too, not only during a build", async () => {
    // The difference from the `…Resilient` pair: those swallow at build and re-throw at
    // runtime. These four swallow in both phases, because at runtime the alternative is a
    // 500 on a page about a province.
    vi.mocked(isProductionBuild).mockReturnValue(false);
    apiAnswers(() => Promise.resolve(notOk(503)));

    await expect(read()).resolves.toEqual(fallback);
  });

  it("passes a successful read through untouched", async () => {
    apiAnswers(() => Promise.resolve(ok(payload)));

    const result = await read();
    expect(result).toEqual(payload);
    // Not vacuous: the fallback and the payload are different values, so a wrapper that
    // always returned its fallback would fail this.
    expect(result).not.toEqual(fallback);
  });
});

describe("the two resilience shapes are genuinely different", () => {
  /**
   * The split this PR's design rests on, pinned so it cannot be flattened by accident.
   *
   * Same route, same failure, two contracts: on `/deniz` the points ARE the page, so a
   * runtime blip must re-throw and leave the last good static render in place; on a province
   * page the same list is only a gate, so it must degrade to "no section" instead. A refactor
   * that made both wrappers behave alike would silently pick one surface's failure mode for
   * the other, and neither wrapper's own test would notice.
   */
  it("Resilient re-throws at runtime where Safe returns an empty list", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    apiAnswers(() => Promise.resolve(notOk(500)));

    await expect(getMarinePointsResilient()).rejects.toThrow();
    await expect(getMarinePointsSafe()).resolves.toEqual([]);
  });

  it("Resilient degrades during a build, so web CI can build with no api", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(true);
    apiAnswers(() => Promise.resolve(notOk(500)));

    await expect(getMarinePointsResilient()).resolves.toEqual([]);
  });
});

describe("the outage warning survives the limiter", () => {
  /**
   * The M9 limiter emits occurrences 1, 2, 4, 8 … and folds the rest into a count, so a
   * 27-province outage prints six lines instead of fifty-four. Two properties of the WIRING
   * are asserted here (the emission schedule itself is `warn-limiter.test.ts`'s job): the
   * first failure is still reported in full, and a successful read resets the tally so the
   * next outage is reported as a new event rather than inheriting last week's counter.
   */
  it("reports a fresh outage as occurrence one, with the plaka in the line", async () => {
    const warn = vi.mocked(console.warn);

    // A success first: whatever earlier tests left in the module-scoped tally, this clears it.
    apiAnswers(() => Promise.resolve(ok({ plateCode: "00", marinePoints: [], attributions: [] })));
    await getMarineProvinceConditionsSafe("00");
    warn.mockClear();

    apiAnswers(() => Promise.resolve(notOk(503)));
    await getMarineProvinceConditionsSafe("00");

    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("plaka 00");
    // No "(occurrence N)" suffix: the reset made this a first occurrence again.
    expect(line).not.toContain("occurrence");
  });
});
