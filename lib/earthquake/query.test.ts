import { describe, expect, it } from "vitest";
import { buildEarthquakeQuery, parseEarthquakeFilterParams } from "./query";

describe("buildEarthquakeQuery", () => {
  it("returns an empty string for an empty filter — no accidental empty params", () => {
    expect(buildEarthquakeQuery({})).toBe("");
  });

  it("sends only the fields present, never a blank value for an absent one", () => {
    // The CODE121-M1 defect class this module exists to prevent: `?minMagnitude=` (empty
    // string) is silently read as 0 upstream, not "unset". A correct builder never emits it.
    const qs = buildEarthquakeQuery({ minMagnitude: 2.5 });
    expect(qs).toBe("?minMagnitude=2.5");
    expect(qs).not.toContain("minMagnitude=&");
    expect(qs.endsWith("=")).toBe(false);
  });

  it("builds all five documented parameters together", () => {
    const qs = buildEarthquakeQuery({
      minMagnitude: 3,
      fromUtc: "2026-08-01T00:00:00.000Z",
      toUtc: "2026-08-29T00:00:00.000Z",
      page: 2,
      pageSize: 50,
    });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get("minMagnitude")).toBe("3");
    expect(params.get("fromUtc")).toBe("2026-08-01T00:00:00.000Z");
    expect(params.get("toUtc")).toBe("2026-08-29T00:00:00.000Z");
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
  });
});

describe("parseEarthquakeFilterParams", () => {
  it("omits a blank value rather than forwarding it (the CODE121-M1 shape, reversed)", () => {
    const params = new URLSearchParams("minMagnitude=&page=");
    expect(parseEarthquakeFilterParams(params)).toEqual({
      minMagnitude: undefined,
      fromUtc: undefined,
      toUtc: undefined,
      page: undefined,
      pageSize: undefined,
    });
  });

  it("omits a non-numeric value for a numeric field rather than forwarding NaN", () => {
    const params = new URLSearchParams("minMagnitude=abc");
    expect(parseEarthquakeFilterParams(params).minMagnitude).toBeUndefined();
  });

  it("parses every well-formed field", () => {
    const params = new URLSearchParams(
      "minMagnitude=4.5&fromUtc=2026-08-01T00:00:00.000Z&toUtc=2026-08-29T00:00:00.000Z&page=2&pageSize=100",
    );
    expect(parseEarthquakeFilterParams(params)).toEqual({
      minMagnitude: 4.5,
      fromUtc: "2026-08-01T00:00:00.000Z",
      toUtc: "2026-08-29T00:00:00.000Z",
      page: 2,
      pageSize: 100,
    });
  });

  it("round-trips through buildEarthquakeQuery", () => {
    const filter = { minMagnitude: 2.5, page: 1, pageSize: 50 };
    const qs = buildEarthquakeQuery(filter);
    const parsed = parseEarthquakeFilterParams(new URLSearchParams(qs.slice(1)));
    expect(parsed).toEqual({
      minMagnitude: 2.5,
      fromUtc: undefined,
      toUtc: undefined,
      page: 1,
      pageSize: 50,
    });
  });
});
