import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TURKEY_REGIONS } from "./v2-turkey-regions";

/**
 * Regression guard for the `b75cc52` correction round (`Owner's Inbox/bolge-b75cc52-duzeltme/plan.md`
 * §2.7). Every defect this round fixed was a hand-typed value that had already drifted once —
 * this file locks the corrected literals so a future hand edit cannot silently drift them
 * again.
 *
 * PLACEMENT NOTE (`VALB75R2-NEW-C1`): this file previously lived at
 * `app/[locale]/v2/turkiye/bolge/region-figures.test.ts`, a path `vitest.config.ts`'s
 * `include` globs (`lib/**\/*.test.ts`, `components/**\/*.test.{ts,tsx}`, `tools/**\/*.test.ts`)
 * do not collect — the guard could never have gone red. It lives here instead, matching
 * every other structural page-file assertion in this repo.
 *
 * The two page files (`app/[locale]/v2/turkiye/bolge/page.tsx` and its `[slug]/page.tsx`
 * sibling) import server-only modules (`next-intl/server`, `next/navigation`) and cannot be
 * imported directly into a Vitest run, so they are read as text — the same `readFileSync`
 * form `./v2-map-pan-bounds.test.ts` already uses for this repo's other page-adjacent
 * structural tests.
 */

const hubPage = readFileSync(
  resolve(__dirname, "../../app/[locale]/v2/turkiye/bolge/page.tsx"),
  "utf-8",
);
const detailPage = readFileSync(
  resolve(__dirname, "../../app/[locale]/v2/turkiye/bolge/[slug]/page.tsx"),
  "utf-8",
);
const deckFile = readFileSync(resolve(__dirname, "./v2-turkey-regions.tsx"), "utf-8");

describe("REGIONS_STATIC_FALLBACK numeric fields (plan §2.4)", () => {
  // Marmara's five fields were already correct and are untouched by this round — only the
  // other six regions' values changed, which is why this is 30 assertions (6 regions x 5
  // fields), not 35.
  it("ege: population/populationSharePercent/areaKm2/areaSharePercent/populationDensity match the approved research", () => {
    expect(hubPage).toContain("population: 11011261,");
    expect(hubPage).toContain("populationSharePercent: 12.79,");
    expect(hubPage).toContain("areaKm2: 89339,");
    expect(hubPage).toContain("areaSharePercent: 11.45,");
    expect(hubPage).toContain("populationDensity: 123,");
  });

  it("akdeniz: population/populationSharePercent/areaKm2/areaSharePercent/populationDensity match the approved research", () => {
    expect(hubPage).toContain("population: 11028175,");
    expect(hubPage).toContain("populationSharePercent: 12.81,");
    expect(hubPage).toContain("areaKm2: 89516,");
    expect(hubPage).toContain("areaSharePercent: 11.48,");
    expect(hubPage).toContain("populationDensity: 123,");
  });

  it("ic-anadolu: population/populationSharePercent/areaKm2/areaSharePercent/populationDensity match the approved research", () => {
    expect(hubPage).toContain("population: 13809574,");
    expect(hubPage).toContain("populationSharePercent: 16.04,");
    expect(hubPage).toContain("areaKm2: 187227,");
    expect(hubPage).toContain("areaSharePercent: 24.0,");
    expect(hubPage).toContain("populationDensity: 74,");
  });

  it("karadeniz: population/populationSharePercent/areaKm2/areaSharePercent/populationDensity match the approved research", () => {
    expect(hubPage).toContain("population: 8041038,");
    expect(hubPage).toContain("populationSharePercent: 9.34,");
    expect(hubPage).toContain("areaKm2: 116379,");
    expect(hubPage).toContain("areaSharePercent: 14.92,");
    expect(hubPage).toContain("populationDensity: 69,");
  });

  it("dogu-anadolu: population/populationSharePercent/areaKm2/areaSharePercent/populationDensity match the approved research", () => {
    expect(hubPage).toContain("population: 5902603,");
    expect(hubPage).toContain("populationSharePercent: 6.86,");
    expect(hubPage).toContain("areaKm2: 148966,");
    expect(hubPage).toContain("areaSharePercent: 19.1,");
    expect(hubPage).toContain("populationDensity: 40,");
  });

  it("guneydogu-anadolu: population/populationSharePercent/areaKm2/areaSharePercent/populationDensity match the approved research", () => {
    expect(hubPage).toContain("population: 9587992,");
    expect(hubPage).toContain("populationSharePercent: 11.14,");
    expect(hubPage).toContain("areaKm2: 75947,");
    expect(hubPage).toContain("areaSharePercent: 9.74,");
    expect(hubPage).toContain("populationDensity: 126,");
  });
});

describe("REGIONS_STATIC_FALLBACK peak name/elevation pairs (plan §2.4) — the §2.7.1 mutation target", () => {
  // This is the NAMED assertion the plan's §2.7.1 mutation demonstration breaks first: change
  // guneydogu-anadolu's `highestPeakElevationM` from 2838 back to 1957 (Karacadağ's own summit,
  // not the region's) and this assertion — and only this one, among the seven — must go red.
  it("guneydogu-anadolu's highest peak is Yazlıca (Herekul) Dağı at 2838 m, not Karacadağ at 1957 m", () => {
    expect(hubPage).toContain('highestPeakNameTr: "Yazlıca (Herekul) Dağı",');
    expect(hubPage).toContain("highestPeakElevationM: 2838,");
    expect(hubPage).not.toContain("highestPeakElevationM: 1957,");
  });

  it("the other six regions' peak name/elevation pairs match the approved research", () => {
    expect(hubPage).toContain('highestPeakNameTr: "Uludağ",');
    expect(hubPage).toContain("highestPeakElevationM: 2543,");
    expect(hubPage).toContain('highestPeakNameTr: "Honaz Dağı",');
    expect(hubPage).toContain("highestPeakElevationM: 2571,");
    // Name-form alignment only (not a factual correction) — the elevation was already right.
    expect(hubPage).toContain('highestPeakNameTr: "Medetsiz Tepesi",');
    expect(hubPage).toContain("highestPeakElevationM: 3524,");
    expect(hubPage).toContain('highestPeakNameTr: "Erciyes Dağı",');
    expect(hubPage).toContain("highestPeakElevationM: 3917,");
    expect(hubPage).toContain('highestPeakNameTr: "Kaçkar Dağı",');
    expect(hubPage).toContain("highestPeakElevationM: 3937,");
    expect(hubPage).toContain('highestPeakNameTr: "Ağrı Dağı (Büyük Ağrı)",');
    expect(hubPage).toContain("highestPeakElevationM: 5137,");
  });
});

describe("REGIONS_STATIC_FALLBACK totals (plan §2.4/§2.5) — the footnote's own base", () => {
  it("the seven areaKm2 values sum to 780040 km², the same base page.tsx:620-623's footnote prints", () => {
    const areas = [...hubPage.matchAll(/areaKm2:\s*(\d+),/g)].map((m) => Number(m[1]));
    expect(areas).toHaveLength(7);
    expect(areas.reduce((a, b) => a + b, 0)).toBe(780040);
  });

  it("the seven population values sum to 86092168, the same base page.tsx:620-623's footnote prints", () => {
    const populations = [...hubPage.matchAll(/population:\s*(\d+),/g)].map((m) => Number(m[1]));
    expect(populations).toHaveLength(7);
    expect(populations.reduce((a, b) => a + b, 0)).toBe(86092168);
  });
});

describe(
  "SUBREGION_DETAILS keys match the 21 api strings — guards WEB-SIDE edits only; an " +
    "api-side rename is NOT covered (no enum in the OpenAPI contract, lib/api/schema.ts:1951)",
  () => {
    // Mirrors `cografya_api/src/database/seeds/region.seed-data.ts`'s `SEED_REGIONS[*].subregions`
    // strings verbatim (plan §2.3). A fixture list, not an import: `ENGINEERING.md` §1 forbids
    // reaching into the api repo, and the committed web-side contract (`lib/api/schema.ts:1951`)
    // types `subregions` as `string[]` with no enum to assert against instead.
    const API_SUBREGION_NAMES = [
      "Yıldız Dağları Bölümü",
      "Ergene Bölümü",
      "Çatalca-Kocaeli Bölümü",
      "Güney Marmara Bölümü",
      "Ege Bölümü (Asıl Ege)",
      "İç Batı Anadolu Bölümü",
      "Adana Bölümü",
      "Antalya Bölümü",
      "Konya Bölümü",
      "Yukarı Sakarya Bölümü",
      "Orta Kızılırmak Bölümü",
      "Yukarı Kızılırmak Bölümü",
      "Batı Karadeniz Bölümü",
      "Orta Karadeniz Bölümü",
      "Doğu Karadeniz Bölümü",
      "Erzurum-Kars Bölümü",
      "Yukarı Fırat Bölümü",
      "Yukarı Murat-Van Bölümü",
      "Hakkari Bölümü",
      "Dicle Bölümü",
      "Orta Fırat Bölümü",
    ] as const;

    it(`carries all 21 api subregion strings as SUBREGION_DETAILS keys, verbatim`, () => {
      expect(API_SUBREGION_NAMES).toHaveLength(21);
      for (const name of API_SUBREGION_NAMES) {
        expect(detailPage).toContain(`"${name}": {`);
      }
    });

    it("no longer carries the 5 pre-round key spellings that did not match the api", () => {
      expect(detailPage).not.toContain('"Çatalca - Kocaeli Bölümü": {');
      expect(detailPage).not.toContain('"Asıl Ege Bölümü": {');
      expect(detailPage).not.toContain('"Erzurum - Kars Bölümü": {');
      expect(detailPage).not.toContain('"Yukarı Murat - Van Bölümü": {');
      expect(detailPage).not.toContain('"Hakkâri Bölümü": {');
    });
  },
);

describe("V2TurkeyRegions deck no longer carries a second hand-typed figure copy (plan §2.6)", () => {
  it("RegionInfo/TURKEY_REGIONS drop the areaKm2/populationShare/highestPeak string fields", () => {
    // The narrowed pattern from `RegionDeckFigures`'s own export: `RegionDeckFigures.areaKm2`
    // is `number`, so a bare `areaKm2:` match would false-positive against a CORRECT
    // implementation (`VALB75R2-NEW-I1`). This pattern only matches the STRING-typed/valued
    // forms the deleted fields used.
    const staleFieldPattern = /(areaKm2|populationShare|highestPeak): (string;|")/g;
    expect([...deckFile.matchAll(staleFieldPattern)]).toHaveLength(0);
  });

  it("exports RegionDeckFigures and TURKEY_REGIONS entries carry no figure fields at runtime", () => {
    expect(TURKEY_REGIONS).toHaveLength(7);
    for (const region of TURKEY_REGIONS) {
      expect(region).not.toHaveProperty("areaKm2");
      expect(region).not.toHaveProperty("populationShare");
      expect(region).not.toHaveProperty("highestPeak");
    }
  });
});

describe("Retired AFAD seismic-degree classification stays gone (plan §2.1) — the §2.7.1 mutation target", () => {
  // The extended CLASS regex from plan §11 V1 (`VALB75R2-NEW-M2`): every retired ordinal-degree
  // seismic-hazard spelling, every case (deliberately NOT spelled out literally in this
  // comment — V1 itself scans this very directory, and a literal example here would be its
  // own false positive). This is the SECOND assertion §2.7.1's mutation demonstration breaks:
  // reinsert the retired wording (§2.1's original KARADENIZ `primaryRisks[2]` string) into a
  // `primaryRisks` entry and this assertion must go red.
  const D = "[Dd][Ee][Rr][Ee][Cc][Ee]";
  // Extended for CODE135-I1: (1) ASCII "I" beside dotted "İ/i" in the ordinal words, for text
  // typed on a non-Turkish keyboard or pasted from an ALL-CAPS source; (2) apostrophe-suffixed
  // ordinal digits ("1'inci Derece", straight or curly apostrophe); (3) the reversed/possessive
  // form ("Derece(si): 1"). No "g" flag, matching the pattern this replaces — kept for
  // consistency and because RegExp.prototype.test() (unlike the .match()-based toMatch() this
  // file's own assertions use below) DOES carry lastIndex state across separate calls on a
  // global-flagged instance; see tur2-plan.md §2.3 for where that bit this plan's own
  // verification script, and why it is not a real exposure for the three assertions below.
  // Extended again for CODE135R2-NEW-I1: branches (2) and (3) above were shipped lowercase-only
  // — "1'İNCİ DERECE" / "1'INCI DERECE" / "DERECESİ 1" / "DERECESI 1" all passed uncaught, the
  // exact ALL-CAPS threat this comment already named as the reason for the extension. Every
  // letter in the ordinal-suffix alternation and the possessive "si" marker now carries its own
  // case-tolerant bracket class, the same way branches (1) and the base ordinal words already do.
  const I = "[İIi]";
  const U = "[ÜüU]";
  const IDOTLESS = "[Iı]";
  const degreeClassPattern = new RegExp(
    `[0-9] ?\\. ?${D}|[Bb]${I}[Rr]${I}[Nn][Cc]${I} ${D}|${I}[Kk]${I}[Nn][Cc]${I} ${D}|` +
      `[ÜüU][ÇçC][ÜüU][Nn][Cc][ÜüU] ${D}|[Dd][ÖöO][Rr][Dd][ÜüU][Nn][Cc][ÜüU] ${D}|` +
      `${D} [Dd][Ee][Pp][Rr][Ee][Mm]|[Dd][Ee][Pp][Rr][Ee][Mm] [Bb][öÖ][Ll][Gg][Ee]|` +
      `[0-9]['’]? ?(?:${I}[Nn][Cc]${I}|[Nn][Cc]${I}|${U}[Nn][Cc]${U}|[Nn][Cc]${IDOTLESS}|` +
      `${IDOTLESS}[Nn][Cc]${IDOTLESS}|[Uu][Nn][Cc][Uu]) ?${D}|${D}(?:[Ss]${I})? ?[:.]? ?[1-4]`,
  );

  it("[slug]/page.tsx (REGION_DISASTER_PROFILES) carries no retired degree-classification wording", () => {
    expect(detailPage).not.toMatch(degreeClassPattern);
  });

  it("the hub page.tsx and the deck component carry no retired degree-classification wording either", () => {
    expect(hubPage).not.toMatch(degreeClassPattern);
    expect(deckFile).not.toMatch(degreeClassPattern);
  });

  it("no longer attributes the (deleted) classification to AFAD TDTH", () => {
    expect(detailPage).not.toContain("Resmî Kaynak: AFAD TDTH");
    expect(detailPage).not.toContain("riskLevel");
  });
});
