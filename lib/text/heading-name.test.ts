import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import {
  COUNTRY_HEADING_CASE,
  COUNTRY_HEADING_KEY,
  headingName,
  PROVINCE_HEADING_CASE,
  type CountryHeadingSlot,
  type ProvinceHeadingSlot,
} from "./heading-name";

/**
 * Guards the two things the page-level heading logic used to do inline and untested: the
 * TR/EN locale gate (the PR #16 EN-slip regression class) and the per-section case
 * assignment. Structure/invariant tests — the suffix forms themselves are proven in
 * turkish-suffix.test.ts.
 */
describe("headingName — locale gate", () => {
  it("applies the Turkish suffix for TR", () => {
    expect(headingName("tr", "Antalya", "genitive")).toBe("Antalya'nın");
    expect(headingName("tr", "Antalya", "locative")).toBe("Antalya'da");
    expect(headingName("tr", "Kocaeli", "locative")).toBe("Kocaeli'nde");
  });

  it("returns the BARE name for EN — no Turkish suffix ever (PR #16 regression class)", () => {
    expect(headingName("en", "Antalya", "genitive")).toBe("Antalya");
    expect(headingName("en", "Antalya", "locative")).toBe("Antalya");
    expect(headingName("en", "Kocaeli", "locative")).toBe("Kocaeli");
  });
});

describe("PROVINCE_HEADING_CASE — per-section mapping", () => {
  it("assigns the intended genitive/locative split (3 + 3)", () => {
    expect(PROVINCE_HEADING_CASE.landform).toBe("genitive");
    expect(PROVINCE_HEADING_CASE.hydrography).toBe("genitive");
    expect(PROVINCE_HEADING_CASE.neighbors).toBe("genitive");
    expect(PROVINCE_HEADING_CASE.climate).toBe("locative");
    expect(PROVINCE_HEADING_CASE.settlement).toBe("locative");
    expect(PROVINCE_HEADING_CASE.economy).toBe("locative");
  });

  it("covers exactly the six §19 slots and only genitive/locative values", () => {
    const slots = Object.keys(PROVINCE_HEADING_CASE) as ProvinceHeadingSlot[];
    expect(slots).toHaveLength(6);
    for (const slot of slots) {
      expect(["genitive", "locative"]).toContain(PROVINCE_HEADING_CASE[slot]);
    }
  });
});

describe("COUNTRY_HEADING_CASE — per-section mapping", () => {
  it("keeps the province assignment on every shared slot", () => {
    // One platform-wide slot→case convention: "X'in Hidrografyası" must not mean one thing
    // on /turkiye and another on /dunya. A drift here is what this assertion catches.
    for (const slot of ["landform", "hydrography", "neighbors", "climate"] as const) {
      expect(COUNTRY_HEADING_CASE[slot]).toBe(PROVINCE_HEADING_CASE[slot]);
    }
  });

  it("assigns the country-only `independence` slot the genitive", () => {
    // "Şili'nin Bağımsızlığı" — the locative would describe independence happening INSIDE
    // the country rather than the country's own independence.
    expect(COUNTRY_HEADING_CASE.independence).toBe("genitive");
  });

  it("covers exactly the five country slots and only genitive/locative values", () => {
    const slots = Object.keys(COUNTRY_HEADING_CASE) as CountryHeadingSlot[];
    expect(slots).toHaveLength(5);
    for (const slot of slots) {
      expect(["genitive", "locative"]).toContain(COUNTRY_HEADING_CASE[slot]);
    }
  });

  it("maps every slot to a named AND a plain message key", () => {
    const slots = Object.keys(COUNTRY_HEADING_KEY) as CountryHeadingSlot[];
    expect(slots.sort()).toEqual((Object.keys(COUNTRY_HEADING_CASE) as string[]).sort());
    // The two forms must never collapse onto the same key — that would silently make the
    // special-status rows render the entity-named heading again.
    for (const slot of slots) {
      expect(COUNTRY_HEADING_KEY[slot].named).not.toBe(COUNTRY_HEADING_KEY[slot].plain);
    }
  });

  it("produces the intended TR headings and bare EN names for a country name", () => {
    // End-to-end through the same helper the page uses, incl. a possessive-compound name.
    expect(headingName("tr", "Şili", COUNTRY_HEADING_CASE.landform)).toBe("Şili'nin");
    expect(headingName("tr", "Şili", COUNTRY_HEADING_CASE.climate)).toBe("Şili'de");
    expect(headingName("tr", "Kongo Cumhuriyeti", COUNTRY_HEADING_CASE.climate)).toBe(
      "Kongo Cumhuriyeti'nde",
    );
    expect(headingName("en", "Kongo Cumhuriyeti", COUNTRY_HEADING_CASE.climate)).toBe(
      "Kongo Cumhuriyeti",
    );
  });
});

describe("country heading keys exist in both locale catalogues (I7 guard, PR #22 filter)", () => {
  // Same failure mode the meta-description keys are guarded against: next-intl logs
  // console.error on a missing/typo'd key but does NOT fail the build, so a lost key would
  // ship the literal "CountryDetail.hydrographyHeading" inside a live <h2> with CI green.
  // The placeholder assertions are the SEO half: silently losing "{name}" from a named key
  // strips the entity name from every /dunya heading — the exact §B3.4 defect class this
  // template was built to close — while a stray "{name}" in a PLAIN key would render an
  // unresolved placeholder on the special-status rows, which pass no params.
  const catalogues = { tr: trMessages, en: enMessages } as const;
  const slots = Object.keys(COUNTRY_HEADING_KEY) as CountryHeadingSlot[];

  for (const [locale, messages] of Object.entries(catalogues)) {
    const countryDetail = messages.CountryDetail as Record<string, unknown>;
    for (const slot of slots) {
      const { named, plain } = COUNTRY_HEADING_KEY[slot];

      it(`${locale}.json CountryDetail.${named} is a non-empty string carrying {name}`, () => {
        expect(typeof countryDetail[named]).toBe("string");
        expect(countryDetail[named] as string).toContain("{name}");
      });

      it(`${locale}.json CountryDetail.${plain} is a non-empty string with NO placeholder`, () => {
        expect(typeof countryDetail[plain]).toBe("string");
        expect((countryDetail[plain] as string).length).toBeGreaterThan(0);
        expect(countryDetail[plain] as string).not.toContain("{");
      });
    }
  }
});
