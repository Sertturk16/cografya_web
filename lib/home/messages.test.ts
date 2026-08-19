import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the homepage (the `lib/marine/messages.test.ts` pattern).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path
 * in place of the copy. On the site's most-visited, fully-indexable page that means shipping
 * "Home.seaMedian" as visible text with CI green. This file is the net.
 *
 * The homepage is a `"localized"` surface: BOTH locales are indexable, so a key present in tr
 * and missing in en is a real defect, not a translation backlog. Every key is therefore
 * required in both catalogues.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that keys resolve to non-empty strings,
 * never what the copy says.
 */

const HOME_KEYS = [
  "metaTitle",
  "metaDescription",
  "heading",
  "lede",
  "ctaMap",
  "ctaAbout",
  "chipProvinces",
  "chipCountries",
  "chipMarine",
  "mapHeading",
  "mapBody",
  "mapLinkLabel",
  // The world block's own heading + body — the band split (→ DEC 2026-08-05e) gave the world
  // half its own section instead of hanging its link under "Türkiye'nin illeri".
  "worldHeading",
  "worldBody",
  "worldLinkLabel",
  "seaHeadingValues",
  "seaHeadingNoValues",
  "seaTemperature",
  "seaWave",
  "seaMedian",
  "seaScope",
  "seaScopeFallback",
  "seaLink",
  "discoverProvinces",
  "discoverCountries",
  "gameHeading",
  "gameBody",
  "gameCta",
  // The CBS tool band (→ DEC 2026-08-19a md.3/md.4): the tool hub's static internal link from
  // the homepage, alongside the header nav entry.
  "toolsHeading",
  "toolsBody",
  "toolsCta",
] as const;

/** Placeholders each templated key must carry, so a message can never drop an interpolation. */
const REQUIRED_PLACEHOLDERS: Record<string, readonly string[]> = {
  chipProvinces: ["count"],
  chipCountries: ["count"],
  chipMarine: ["basins", "points"],
  seaMedian: ["count"],
  seaScope: ["basins", "points", "provinces"],
};

const catalogues = { tr: trMessages.Home, en: enMessages.Home } as const;

describe("Home message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(HOME_KEYS)("resolves %s to a non-empty string", (key) => {
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

  it("carries the SAME key set in both locales (the homepage is indexable in both)", () => {
    expect(Object.keys(enMessages.Home).sort()).toEqual(Object.keys(trMessages.Home).sort());
  });
});
