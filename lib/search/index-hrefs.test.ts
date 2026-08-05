import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { COUNTRY_INDEX_SECTION_ID, PROVINCE_INDEX_SECTION_ID } from "@/lib/geo/hub-index";
import { countryIndexHref, provinceIndexHref } from "./index-hrefs";

/**
 * The two hub-index targets (and, for the province one, the no-JS fallback). Exercised
 * against the REAL routing table (the same choice `lib/seo/routes.fixture.ts` makes for the
 * metadata tests) — asserting a hand-written string here would prove only that two literals
 * match.
 */

const LOCALES = ["tr", "en"] as const;

describe("provinceIndexHref", () => {
  it("points at the province index section in each locale", () => {
    expect(provinceIndexHref("tr")).toBe("/turkiye#iller");
    expect(provinceIndexHref("en")).toBe("/en/turkiye#iller");
  });

  it("derives the path from the routing table rather than concatenating one", () => {
    // The guard that matters: if the hub's localized path ever changes, this href must move
    // with it. Comparing against `getPathname` proves the coupling is real, not incidental.
    for (const locale of LOCALES) {
      expect(provinceIndexHref(locale)).toBe(
        `${getPathname({ locale, href: "/turkiye" })}#${PROVINCE_INDEX_SECTION_ID}`,
      );
    }
  });
});

describe("countryIndexHref", () => {
  it("points at the country index section in each locale", () => {
    expect(countryIndexHref("tr")).toBe("/dunya#ulkeler");
    expect(countryIndexHref("en")).toBe("/en/dunya#ulkeler");
  });

  it("derives the path from the routing table rather than concatenating one", () => {
    for (const locale of LOCALES) {
      expect(countryIndexHref(locale)).toBe(
        `${getPathname({ locale, href: "/dunya" })}#${COUNTRY_INDEX_SECTION_ID}`,
      );
    }
  });
});

describe("both index hrefs", () => {
  it("emit exactly one fragment separator and no double slash", () => {
    for (const locale of LOCALES) {
      for (const href of [provinceIndexHref(locale), countryIndexHref(locale)]) {
        expect(href.split("#")).toHaveLength(2);
        expect(href).not.toMatch(/\/\//);
        expect(href.startsWith("/")).toBe(true);
      }
    }
  });

  it("never resolve to the same destination", () => {
    // The whole point of the change: one row, two DIFFERENT corpora. If a routing edit ever
    // collapsed the two hubs onto one path, the panel would quietly be misleading again.
    for (const locale of LOCALES) {
      expect(provinceIndexHref(locale)).not.toBe(countryIndexHref(locale));
    }
  });
});
