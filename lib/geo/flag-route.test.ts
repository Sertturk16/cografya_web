import { describe, expect, it, vi } from "vitest";
import { flagParamsForCountries, loadFlagSvgForRequest, servedFlagIsoCodes } from "./flag-route";

const available = new Set(["AA", "BB", "EU"]);

describe("served flag corpus", () => {
  it("is the intersection of API rows and resolved assets", () => {
    expect([...servedFlagIsoCodes([{ isoCode: " aa " }, { isoCode: "CC" }], available)]).toEqual([
      "AA",
    ]);
  });

  it("emits no static params for an API-offline build fallback", () => {
    expect(flagParamsForCountries([], available)).toEqual([]);
  });
});

describe("on-demand flag requests", () => {
  it("serves a country learned after an empty build without opening package-only codes", async () => {
    const readSvg = vi.fn((iso: string) => `<svg data-iso="${iso}"/>`);
    const dependencies = {
      availableIsoCodes: () => available,
      getCountryIsoCodes: async () => ["AA"],
      readSvg,
    };

    expect(flagParamsForCountries([], available)).toEqual([]);
    await expect(loadFlagSvgForRequest("AA.svg", dependencies)).resolves.toContain("AA");
    await expect(loadFlagSvgForRequest("EU.svg", dependencies)).resolves.toBeNull();
    expect(readSvg).toHaveBeenCalledTimes(1);
  });

  it("rejects traversal before the API or filesystem reader runs", async () => {
    const getCountryIsoCodes = vi.fn(async () => ["AA"]);
    const readSvg = vi.fn(() => "<svg/>");

    await expect(
      loadFlagSvgForRequest("../AA.svg", {
        availableIsoCodes: () => available,
        getCountryIsoCodes,
        readSvg,
      }),
    ).resolves.toBeNull();

    expect(getCountryIsoCodes).not.toHaveBeenCalled();
    expect(readSvg).not.toHaveBeenCalled();
  });

  it("propagates an API outage instead of caching a false empty corpus", async () => {
    const outage = new Error("api offline");
    const readSvg = vi.fn(() => "<svg/>");

    await expect(
      loadFlagSvgForRequest("AA.svg", {
        availableIsoCodes: () => available,
        getCountryIsoCodes: async () => {
          throw outage;
        },
        readSvg,
      }),
    ).rejects.toBe(outage);

    expect(readSvg).not.toHaveBeenCalled();
  });

  it("warns and rejects when an admitted reader returns null", async () => {
    const warn = vi.fn();
    await expect(
      loadFlagSvgForRequest("AA.svg", {
        availableIsoCodes: () => available,
        getCountryIsoCodes: async () => ["AA"],
        readSvg: () => null,
        warn,
      }),
    ).rejects.toThrow(/admitted flag reader returned null/);
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each(["package", "local"] as const)(
    "warns and rethrows an admitted %s-layer read fault",
    async (layer) => {
      const failure = new Error(`${layer} EACCES`);
      const warn = vi.fn();
      await expect(
        loadFlagSvgForRequest("AA.svg", {
          availableIsoCodes: () => available,
          getCountryIsoCodes: async () => ["AA"],
          readSvg: () => {
            throw failure;
          },
          warn,
        }),
      ).rejects.toBe(failure);
      expect(warn).toHaveBeenCalledOnce();
    },
  );
});
