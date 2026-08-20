import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { PM25_NOTICE_SLOTS, pm25NoticeFlags } from "./notice-keys";

/**
 * The whitelist's two jobs: recognise every key the api ships today, and refuse to render a
 * key it does not know. Structure only — nothing here asserts what a notice SAYS.
 */

/**
 * The four keys the contract publishes, spelled exactly as the api emits them
 * (`cografya_api/src/province/acag-attribution.constant.ts`, `ACAG_NOTICE_KEYS`).
 *
 * This list is a copy of a CONTRACT, not of a fact: if the api renames or removes one, that
 * is a breaking change routed through Atlas, and this test is where the web side of it
 * surfaces instead of a dotted key path appearing on 81 indexable pages.
 */
const CONTRACT_KEYS = [
  "airPollution.notice.satelliteDerived",
  "airPollution.notice.gridResolution",
  "airPollution.notice.provinceCentrePoint",
  "airPollution.notice.annualMean",
] as const;

describe("pm25NoticeFlags", () => {
  it("recognises every key the contract ships", () => {
    const flags = pm25NoticeFlags(CONTRACT_KEYS);
    expect(Object.values(flags).every(Boolean)).toBe(true);
    expect(Object.keys(flags).sort()).toEqual([...PM25_NOTICE_SLOTS].sort());
  });

  it("SKIPS an unknown key and does not throw", () => {
    // The residual risk this closes in one direction: next-intl renders a missing key's
    // dotted path rather than failing the build, so an unrecognised fifth key must never
    // reach `t()`. It stays open in the other direction by design — see notice-keys.ts.
    const flags = pm25NoticeFlags([
      ...CONTRACT_KEYS,
      "airPollution.notice.somethingNewInApiPr999",
      "someOther.namespace.annualMean",
      "annualMean",
    ]);
    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it("does NOT set a flag the payload omitted — the positive control on the whole file", () => {
    // Without this, "every key recognised" would also pass for a function that returned all
    // true unconditionally.
    const flags = pm25NoticeFlags(["airPollution.notice.annualMean"]);
    expect(flags.annualMean).toBe(true);
    expect(flags.provinceCentrePoint).toBe(false);
    expect(flags.satelliteDerived).toBe(false);
    expect(flags.gridResolution).toBe(false);
  });

  it("yields all-false for an empty payload rather than failing", () => {
    const flags = pm25NoticeFlags([]);
    expect(Object.values(flags).some(Boolean)).toBe(false);
  });

  it("is idempotent under duplicate keys", () => {
    expect(pm25NoticeFlags(["airPollution.notice.annualMean"])).toEqual(
      pm25NoticeFlags(["airPollution.notice.annualMean", "airPollution.notice.annualMean"]),
    );
  });
});

describe("every recognised slot has a message in BOTH catalogues", () => {
  // A recognised slot with no message is the exact failure the whitelist exists to prevent,
  // just moved one step later. Both locales, because the section is not locale-gated.
  const catalogues = { tr: trMessages.AirPollution, en: enMessages.AirPollution } as const;
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    it.each(PM25_NOTICE_SLOTS)(
      `${locale}: AirPollution.notice.%s is a non-empty string`,
      (slot) => {
        const value = (catalogue.notice as Record<string, string | undefined>)[slot];
        expect(typeof value).toBe("string");
        expect(value?.length ?? 0).toBeGreaterThan(0);
      },
    );
  }
});
