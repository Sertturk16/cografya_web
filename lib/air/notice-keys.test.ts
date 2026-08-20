import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { PM25_NOTICE_SLOTS, pm25NoticeFlags } from "./notice-keys";

/**
 * The whitelist's two jobs: recognise every key the api ships today, and refuse to render a
 * key it does not know. Structure only — nothing here asserts what a notice SAYS.
 *
 * ## Why the contract's keys are EXTRACTED and not written down here
 *
 * This file used to declare `CONTRACT_KEYS` as four hand-typed strings — the same four
 * `PM25_NOTICE_SLOTS` already declares. Both sides moved together, neither derived from
 * anything the api owns, so the check could not fail for the reason it was written, and
 * `notice-keys.ts` credited it with a guarantee it never provided (→ PR #76 review CODE76-I1
 * + TEST76-I2). The keys below are now read out of the committed `openapi/openapi.json`, the
 * one artifact in this repo the api actually owns.
 *
 * ## What that does and does not close — said plainly, because overclaiming is the defect
 *
 * It closes RENAME and REMOVE **as far as the spec carries the key**: a key that changes in
 * the spec goes red on the next mirror refresh. It does NOT close ADD. `noticeKeys` is typed
 * `string[]` with no `enum`, and the spec's `example` lists only some of the keys the api
 * emits, so an added key need not change any artifact in this repo. Closing that direction
 * needs the api to publish an `enum` (`FU-API-NOTICEKEYS-ENUM`, Deniz); until then the only
 * thing holding it is the api's Atlas-notification rule, and `notice-keys.ts` says so.
 */

/** The shape a contract notice key has. Escaped dots: `.` would match the whole namespace. */
const CONTRACT_KEY_PATTERN = /airPollution\.notice\.[A-Za-z0-9_]+/g;

/**
 * The vendored api contract, read as TEXT rather than imported as a module. The spec is ~180
 * kB and only its key strings matter here, so parsing it (and typing it) buys nothing — the
 * same reason `version-drift.test.ts` scans sources as text.
 */
const vendoredSpec = readFileSync(new URL("../../openapi/openapi.json", import.meta.url), "utf8");

/** Every `airPollution.notice.*` key the committed contract carries, deduplicated. */
const SPEC_NOTICE_KEYS = [...new Set(vendoredSpec.match(CONTRACT_KEY_PATTERN) ?? [])];

describe("the contract's own keys resolve, and they are read from the contract", () => {
  it("resolves every notice key the committed spec publishes", () => {
    // The length assertion is not decoration: an extraction that finds nothing would make the
    // loop below pass by iterating zero times, i.e. report clean because it looked nowhere.
    expect(SPEC_NOTICE_KEYS.length).toBeGreaterThan(0);
    for (const key of SPEC_NOTICE_KEYS) {
      const resolved = Object.values(pm25NoticeFlags([key])).some(Boolean);
      expect({ key, resolved }).toEqual({ key, resolved: true });
    }
  });

  it("POSITIVE CONTROL — the extraction sees an added key and the whitelist rejects it", () => {
    // Proves both halves fire: the pattern picks up a key that was not there before, and an
    // unrecognised key resolves to nothing. The control token lives in this test and in an
    // IN-MEMORY copy of the spec — it is written into `openapi/openapi.json` nowhere, so no
    // run can pass because the control put it there.
    const unknownKey = "airPollution.notice.aDutyThisRepoDoesNotKnowYet";
    const anchor = SPEC_NOTICE_KEYS[0];
    if (anchor === undefined) throw new Error("no contract notice key found in the spec");

    const poisoned = vendoredSpec.replace(`"${anchor}"`, `"${anchor}","${unknownKey}"`);
    expect([...new Set(poisoned.match(CONTRACT_KEY_PATTERN) ?? [])]).toContain(unknownKey);
    expect(Object.values(pm25NoticeFlags([unknownKey])).some(Boolean)).toBe(false);
  });
});

describe("pm25NoticeFlags", () => {
  it.each(PM25_NOTICE_SLOTS)("maps the contract's prefixed key to slot %s", (slot) => {
    // Derived from the exported whitelist, so it cannot drift from it: this is the prefix
    // strip, exercised on every slot the repo can render rather than on a copy of the list.
    expect(pm25NoticeFlags([`airPollution.notice.${slot}`])[slot]).toBe(true);
  });

  it("SKIPS an unknown key and does not throw", () => {
    // The residual risk this closes in one direction: next-intl renders a missing key's
    // dotted path rather than failing the build, so an unrecognised fifth key must never
    // reach `t()`. It stays open in the other direction by design — see notice-keys.ts.
    const flags = pm25NoticeFlags([
      ...SPEC_NOTICE_KEYS,
      "airPollution.notice.somethingNewInApiPr999",
      "someOther.namespace.annualMean",
      "annualMean",
    ]);
    expect(Object.keys(flags).sort()).toEqual([...PM25_NOTICE_SLOTS].sort());
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
