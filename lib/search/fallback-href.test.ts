import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { PROVINCE_INDEX_SECTION_ID } from "@/lib/geo/hub-index";
import { searchFallbackHref } from "./fallback-href";

/**
 * The no-JS fallback target. Exercised against the REAL routing table (the same choice
 * `lib/seo/routes.fixture.ts` makes for the metadata tests) — asserting a hand-written
 * string here would prove only that two literals match.
 */
describe("searchFallbackHref", () => {
  it("points at the province index section in each locale", () => {
    expect(searchFallbackHref("tr")).toBe("/turkiye#iller");
    expect(searchFallbackHref("en")).toBe("/en/turkiye#iller");
  });

  it("derives the path from the routing table rather than concatenating one", () => {
    // The guard that matters: if the hub's localized path ever changes, this href must move
    // with it. Comparing against `getPathname` proves the coupling is real, not incidental.
    for (const locale of ["tr", "en"] as const) {
      expect(searchFallbackHref(locale)).toBe(
        `${getPathname({ locale, href: "/turkiye" })}#${PROVINCE_INDEX_SECTION_ID}`,
      );
    }
  });

  it("emits exactly one fragment separator and no double slash", () => {
    for (const locale of ["tr", "en"] as const) {
      const href = searchFallbackHref(locale);
      expect(href.split("#")).toHaveLength(2);
      expect(href).not.toMatch(/\/\//);
      expect(href.startsWith("/")).toBe(true);
    }
  });
});
