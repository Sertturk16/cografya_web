import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * STRUCTURAL GUARD for the country page's Kaynaklar line (→ PR #47 review TA47-M3; the
 * province sibling lives in `lib/climate/climate-messages.test.ts`).
 *
 * `CountryDetail.sources` is a single fixed sentence printed UNCONDITIONALLY on all ~199
 * country pages, in both locales. That is what made the Geostat defect so wide: the string
 * carried "(Gürcistan için Geostat 2024 sayımı)" — a footnote true of exactly one country —
 * and so Çad, Brezilya and Japonya each cited Georgia's census as a source for their own
 * population (UX tour B13, ruling AP-2).
 *
 * The lesson generalises past that one parenthetical: a per-entity qualifier does not belong
 * in a corpus-wide sentence. Per-country source surfaces are a real thing to want, and they
 * are the `/veri-kaynaklari` work — not a parenthesis in a shared string.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts the SHAPE of the sentence — non-empty,
 * no country-specific qualifier — never the wording of the source list.
 */

const catalogues = { tr: trMessages.CountryDetail, en: enMessages.CountryDetail } as const;

/**
 * Country-specific tokens that must never appear in a string every country page prints.
 * `Geostat` is the one that shipped; the country names are the trailing edge of the same
 * mistake (a qualifier naming ONE country inside the shared sentence).
 */
const COUNTRY_SPECIFIC_TOKENS = ["Geostat", "Gürcistan", "Georgia"] as const;

describe("CountryDetail.sources", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it("resolves to a non-empty string", () => {
        expect(typeof catalogue.sources).toBe("string");
        expect(catalogue.sources.trim().length).toBeGreaterThan(0);
      });

      it.each(COUNTRY_SPECIFIC_TOKENS)("carries no country-specific qualifier (%s)", (token) => {
        expect(catalogue.sources).not.toContain(token);
      });

      it("carries no ICU placeholder", () => {
        // The sentence is deliberately static. A placeholder here would mean per-country data
        // is being interpolated into a line that is otherwise identical corpus-wide, which is
        // the shape the Geostat defect wore.
        expect(catalogue.sources).not.toMatch(/\{[a-zA-Z]/);
      });
    });
  }
});
