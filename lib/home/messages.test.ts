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
  // The Kadastro hero treatment's decorative coordinate label (fix round 2026-08-29,
  // `.heroCoord`) — aria-hidden chrome, not a data claim, so it carries no unit/citation
  // obligation; the pair itself is Turkey's commonly-cited approximate geographic centre.
  "heroCoordLabel",
  // The hero stat-card strip (→ `Owner's Inbox/anasayfa-yenileme/plan.md` §5.11): label-only
  // keys, the count rendered separately via `format.number()`. Supersedes the former
  // `chipProvinces`/`chipCountries`/`chipMarine` combined-sentence keys. `statSeasLabel` /
  // `statPointsLabel` (the "4 Deniz" / "30 Referans Noktası" cards) are REMOVED (owner ruling,
  // fix round 2026-08-29) — three cards now, not five; no replacement stat was added.
  "statProvincesLabel",
  "statCountriesLabel",
  "statGameModesLabel",
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
  // The eyebrow labels above each section (plan §5.13) — chrome copy, not entity names, so
  // they carry no `GLOSSARY.md` obligation beyond what §9 of that plan already confirms.
  "eyebrowMaps",
  "eyebrowProvinces",
  "eyebrowCountries",
  "eyebrowGame",
  "eyebrowTools",
  "gameHeading",
  "gameBody",
  "gameCta",
  // The CBS tool band (→ DEC 2026-08-19a md.3/md.4): the tool hub's static internal link from
  // the homepage, alongside the header nav entry. `toolsBody` is gone (plan §5.5) — the band is
  // three real cards (`components/home/tool-cards.tsx`). `toolsCta` (the trailing "Araçları aç"
  // link under the cards) is REMOVED (owner ruling, fix round 2026-08-29) — redundant with the
  // three cards themselves; `/araclar` stays reachable via the header nav.
  "toolsHeading",
] as const;

/**
 * Placeholders each templated key must carry, so a message can never drop an interpolation.
 *
 * The three remaining `stat*Label` keys are DELIBERATELY absent here (plan §5.11; two of the
 * original five, `statSeasLabel`/`statPointsLabel`, are gone entirely — fix round 2026-08-29):
 * their TR values are plain fixed words with no `{count}` token at all — Turkish needs none —
 * so asserting a required `{count` placeholder against the TR catalogue would fail on correct
 * code. EN's own ICU plural form satisfies pluralization without this assertion's help.
 */
const REQUIRED_PLACEHOLDERS: Record<string, readonly string[]> = {
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
