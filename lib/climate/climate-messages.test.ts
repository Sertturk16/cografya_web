import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the province page's CLIMATE block (the
 * `lib/home/messages.test.ts` pattern; the sibling `similar-climate.test.ts` guards the
 * cross-link sub-block's own keys).
 *
 * next-intl logs a missing key and renders its dotted path rather than failing the build, so
 * a typo here puts "ProvinceDetail.climatePlainNote" in front of a reader on an indexable page
 * with CI green. The climate block is on all 81 province pages, which makes it the widest
 * single copy surface in the repo.
 *
 * Both locales even though the block is TR-gated today: the gate is one boolean
 * (`EN_CONTENT_READY`, `lib/seo/indexing.ts`), and a key that resolves only in Turkish would
 * turn flipping it into a visible regression rather than a content release.
 *
 * Structural only (`CONVENTIONS.md` §2): never asserts what the copy says.
 */

const CLIMATE_KEYS = [
  "climateHeading",
  "climateValue",
  "climateClassOnly",
  // The always-visible plain sentence (→ DEC 2026-08-04i §3). It exists because the MGM
  // caveat below it arrives COLLAPSED, so this is the only explanation a reader who never
  // opens the disclosure sees — a missing key here would be a silent return to that state.
  "climatePlainNote",
  "climateNoteLabel",
  // Cited in the Kaynaklar line only when the Köppen class line actually renders (UX tour B5).
  "sourcesClimateClass",
] as const;

/** Placeholders each templated key must carry, so a message can never drop an interpolation. */
const REQUIRED_PLACEHOLDERS: Record<string, readonly string[]> = {
  climateHeading: ["name"],
  climateValue: ["className", "koppen"],
  climateClassOnly: ["className"],
};

const catalogues = { tr: trMessages.ProvinceDetail, en: enMessages.ProvinceDetail } as const;

describe("climate block message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(CLIMATE_KEYS)("resolves ProvinceDetail.%s to a non-empty string", (key) => {
        const value = (catalogue as Record<string, unknown>)[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });

      it("carries every required placeholder", () => {
        for (const [key, placeholders] of Object.entries(REQUIRED_PLACEHOLDERS)) {
          const value = String((catalogue as Record<string, unknown>)[key]);
          for (const placeholder of placeholders) {
            expect(value).toContain(`{${placeholder}`);
          }
        }
      });
    });
  }

  it("keeps the climate classification OUT of the base sources sentence", () => {
    // The base line is printed on every province page in both locales; the classification
    // clause is appended conditionally instead (UX tour B5 — EN pages cited a climate section
    // that the `isTr` gate never renders). If someone folds it back into the base string, the
    // EN page starts lying again and nothing else would catch it.
    expect(trMessages.ProvinceDetail.sources).not.toContain("iklim sınıflandırması");
    expect(enMessages.ProvinceDetail.sources).not.toContain("climate classification");
  });
});
