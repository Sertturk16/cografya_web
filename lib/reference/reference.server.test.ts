import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isProductionBuild } from "@/lib/api/provinces";
import {
  getDepartmentsResilient,
  getDistricts,
  getUniversitiesResilient,
  isValidPlateCode,
} from "./reference.server";

/**
 * G7 (plan §9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`): `"34"`
 * passes; `"6"`, `"034"`, `""`, `"3a"`, `" 34"`, `"34\n"` and a 40-character string are all
 * refused BEFORE any api call (the fetch stub records zero calls); a valid-but-unknown code
 * returns `[]` with no throw. Plus the build-vs-runtime split the two flat reference reads
 * carry, on the `lib/api/books.test.ts` pattern: `fetch` is stubbed, not `apiGet` — stubbing
 * `apiGet` would test a `catch` against an error the code never actually meets.
 */

vi.mock("@/lib/api/provinces", () => ({ isProductionBuild: vi.fn(() => false) }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { API_BASE_URL: "http://api.test", INTERNAL_REQUEST_TOKEN: undefined },
}));

const MALFORMED_CODES = ["6", "034", "", "3a", " 34", "34\n", "1".repeat(40)];

function ok(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response): ReturnType<typeof vi.fn> {
  const stub = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", stub);
  return stub;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(isProductionBuild).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isValidPlateCode", () => {
  it("accepts a real two-digit code — positive control", () => {
    expect(isValidPlateCode("34")).toBe(true);
  });

  it.each(MALFORMED_CODES)("refuses %j", (value) => {
    expect(isValidPlateCode(value)).toBe(false);
  });
});

describe("getDistricts", () => {
  it("calls the api for a well-formed code and returns its array unchanged", async () => {
    const stub = stubFetch(ok([{ id: "x", nameTr: "Kadıköy" }]));
    await expect(getDistricts("34")).resolves.toEqual([{ id: "x", nameTr: "Kadıköy" }]);
    expect(stub).toHaveBeenCalledTimes(1);
    expect(String(stub.mock.calls[0]?.[0])).toContain("plateCode=34");
  });

  it("a well-formed but unmatched code returns [] with no throw — the api's own contract", async () => {
    stubFetch(ok([]));
    await expect(getDistricts("99")).resolves.toEqual([]);
  });

  it.each(MALFORMED_CODES)("refuses %j BEFORE any api call (zero fetch calls)", async (value) => {
    const stub = stubFetch(ok([]));
    await expect(getDistricts(value)).rejects.toThrow();
    expect(stub).not.toHaveBeenCalled();
  });
});

describe("getUniversitiesResilient / getDepartmentsResilient — build-vs-runtime split", () => {
  it("re-throws at RUNTIME on an api failure (universities)", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    stubFetch(new Response("upstream failure", { status: 502 }));
    await expect(getUniversitiesResilient()).rejects.toMatchObject({ name: "ApiError" });
  });

  it("degrades to [] during a no-api BUILD (universities)", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(true);
    stubFetch(new Response("upstream failure", { status: 502 }));
    await expect(getUniversitiesResilient()).resolves.toEqual([]);
  });

  it("re-throws at RUNTIME on an api failure (departments)", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(false);
    stubFetch(new Response("upstream failure", { status: 502 }));
    await expect(getDepartmentsResilient()).rejects.toMatchObject({ name: "ApiError" });
  });

  it("degrades to [] during a no-api BUILD (departments)", async () => {
    vi.mocked(isProductionBuild).mockReturnValue(true);
    stubFetch(new Response("upstream failure", { status: 502 }));
    await expect(getDepartmentsResilient()).resolves.toEqual([]);
  });

  it("returns the real payload when the api answers — positive control", async () => {
    stubFetch(ok([{ nameTr: "Boğaziçi Üniversitesi", type: "DEVLET" }]));
    await expect(getUniversitiesResilient()).resolves.toEqual([
      { nameTr: "Boğaziçi Üniversitesi", type: "DEVLET" },
    ]);
  });

  it("returns the real department payload when the api answers — positive control", async () => {
    stubFetch(ok([{ nameTr: "Coğrafya Öğretmenliği" }]));
    await expect(getDepartmentsResilient()).resolves.toEqual([{ nameTr: "Coğrafya Öğretmenliği" }]);
  });
});
