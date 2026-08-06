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
  // Value line (WEB-KOPPEN, DEC 2026-08-05c): "<curriculum name> · Köppen: <code>". The name
  // segment is `climateCurriculumNameTr`, NOT the MGM class name.
  "climateValue",
  // Contract-legal fallback when `climateCurriculumNameTr` is null (plan §3 V-1) — code alone,
  // never a bare name-less/code-less line.
  "climateValueKoppenOnly",
  // Defense-in-depth ONLY (§6 "no bare Csa"): renders when the mandatory MGM caveat itself is
  // absent, a contract violation the api already guards against. Shows the MGM class name
  // (`climateClassTr`), never the curriculum name — a different field from the two above.
  "climateClassOnly",
  // The always-visible plain sentence (→ DEC 2026-08-04i §3; re-worded for WEB-KOPPEN's V-5,
  // adopting NOVA's cumle-taslaklari.md §3.1 text). The MGM caveat below it now renders OPEN
  // by default (DEC 2026-08-05c), but this sentence stays: it is the only one that names which
  // of the two heading names is which BEFORE a reader reads the caveat's own full text.
  "climatePlainNote",
  "climateNoteLabel",
  // Cited in the Kaynaklar line only when the Köppen class line actually renders (UX tour B5).
  "sourcesClimateClass",
  // MEB curriculum-name attribution (WEB-KOPPEN plan §5) — its own entry, a distinct source
  // family from MGM's classification, cited only when the curriculum name segment renders.
  "sourcesClimateCurriculum",
] as const;

/** Placeholders each templated key must carry, so a message can never drop an interpolation. */
const REQUIRED_PLACEHOLDERS: Record<string, readonly string[]> = {
  climateHeading: ["name"],
  climateValue: ["name", "koppen"],
  climateValueKoppenOnly: ["koppen"],
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
