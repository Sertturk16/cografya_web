import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Invariant tests for sovereignty rules and naming across V2 components
 * (`SOV125-C1`, `SOV122-C1`, `SOV125-I1`, `SOV124-I1`, `SOV122-I1`, `SOV124-P2`, `VAL124SEO-I2`).
 */

describe("V2 sovereignty and naming invariants", () => {
  it("uses canonical Güney Kıbrıs Rum Yönetimi for CY in neighbor map dictionaries (VAL124SEO-I2)", () => {
    const files = [
      "./v2-earthquake-explorer.tsx",
      "./v2-marine-map-explorer.tsx",
      "./v2-turkey-map-explorer.tsx",
      "./v2-interactive-map-preview.tsx",
    ];

    for (const relPath of files) {
      const url = new URL(relPath, import.meta.url);
      const content = readFileSync(url, "utf8");
      expect(content).not.toContain('CY: "Kıbrıs"');
      expect(content).toContain('CY: "Güney Kıbrıs Rum Yönetimi"');
    }
  });

  it("does not claim egemenlik statüleri or egemen ülke in v2-sources-section (SOV122-I1, SOV124-P2)", () => {
    const url = new URL("./v2-sources-section.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");
    expect(content).not.toContain("egemenlik statüleri");
    expect(content).not.toContain("199 egemen ülke");
    expect(content).toContain("199 ülke ve özerk bölge");
  });

  it("enforces locale-aware flag gating and synchronizes special status set in v2/dunya (SOV125-C1, SOV124-I1)", () => {
    const pageUrl = new URL("../../app/[locale]/v2/dunya/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");

    // Must suppress flags in EN for special-status rows per DEC 2026-08-08h and DEC 2026-09-03a md.2
    expect(pageContent).toContain(
      'const flagVisible = hasFlagAsset && (!isSpecialStatus || locale === "tr");',
    );

    // The declaration lives in ONE neutral module (PR #133 fix round, VAL133RX-I1) — reading
    // FROM lib/geo/special-status-isos.ts, not from lib/geo/sovereignty.ts, which explicitly
    // encodes no country list at all.
    const declUrl = new URL("../../lib/geo/special-status-isos.ts", import.meta.url);
    const declContent = readFileSync(declUrl, "utf8");
    const isoMatch = declContent.match(/SPECIAL_STATUS_ISO_CODES\s*=\s*new\s+Set\(\[([^\]]+)\]\)/);
    expect(isoMatch).not.toBeNull();
    const rawCodes = isoMatch && isoMatch[1] ? isoMatch[1] : "";
    const codes = rawCodes
      .split(",")
      .map((s) => s.trim().replace(/["']/g, ""))
      .sort();
    expect(codes).toEqual(["CY", "IL", "PS", "QN", "TW", "XK"].sort());

    // Neither consuming page may silently re-declare a private copy of the set (§5.1-C).
    const slugUrl = new URL("../../app/[locale]/v2/dunya/[slug]/page.tsx", import.meta.url);
    const slugContent = readFileSync(slugUrl, "utf8");
    for (const content of [pageContent, slugContent]) {
      expect(content).toContain('from "@/lib/geo/special-status-isos"');
      expect(content).not.toContain("SPECIAL_STATUS_ISO_CODES = new Set(");
    }
  });

  it("renders canonical full SpecialStatusBadge across all explorer views (SOV125-I1, FEN125-I3)", () => {
    const url = new URL("./v2-world-map-explorer.tsx", import.meta.url);
    const content = readFileSync(url, "utf8");

    // Canonical labels present in unified badge
    expect(content).toContain("Özel Statülü Varlık");
    expect(content).toContain("Special Status Entity");
    expect(content).toContain("SpecialStatusBadge");

    // No truncated variants in badge outputs
    expect(content).not.toMatch(/SpecialStatusBadge[^>]*>[^<]*"Özel"/);
    expect(content).not.toContain('isEn ? "Special" : "Özel"');
    expect(content).not.toContain('isEn ? "Special Status" : "Özel Statü"');

    // 5 render locations use SpecialStatusBadge
    const badgeUsages = content.match(/<SpecialStatusBadge/g);
    expect(badgeUsages?.length).toBe(5);
  });

  it("localizes the sovereign/special-status entity badge in v2/dunya/[slug] via next-intl, matching the canonical explorer strings", () => {
    const pageUrl = new URL("../../app/[locale]/v2/dunya/[slug]/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");

    // The badge text comes from CountryDetail messages, never a hardcoded literal.
    expect(pageContent).toContain('t("specialStatusBadge")');
    expect(pageContent).toContain('t("sovereignEntityBadge")');
    expect(pageContent).not.toMatch(/>\s*Özel Statülü Varlık\s*</);
    expect(pageContent).not.toMatch(/>\s*Egemen Devlet\s*</);

    const tr = JSON.parse(readFileSync(new URL("../../messages/tr.json", import.meta.url), "utf8"));
    const en = JSON.parse(readFileSync(new URL("../../messages/en.json", import.meta.url), "utf8"));

    // `specialStatusBadge` is the canonical pair the explorer's own SpecialStatusBadge renders
    // (SOV125-I1) — `sovereignEntityBadge` has no explorer-side counterpart (TEST133-M1: the
    // old comment here claimed BOTH matched the explorer, which was never true of the second).
    expect(tr.CountryDetail.specialStatusBadge).toBe("Özel Statülü Varlık");
    expect(en.CountryDetail.specialStatusBadge).toBe("Special Status Entity");
    expect(tr.CountryDetail.sovereignEntityBadge).toBe("Egemen Devlet");
    expect(en.CountryDetail.sovereignEntityBadge).toBe("Sovereign State");
  });

  it("keeps the entityType/status badge branch order stable — a swap must fail this suite (TEST133-I1)", () => {
    const pageUrl = new URL("../../app/[locale]/v2/dunya/[slug]/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");

    // The territory/special branch is keyed on entityType, not on a re-derived condition.
    expect(pageContent).toContain('country.entityType !== "country"');

    // Within the remaining ternary, the special-status branch must be checked BEFORE the
    // sovereign-entity default, so a branch swap (rendering "Sovereign State" for a
    // special-status row) fails this test instead of shipping.
    const ternaryStart = pageContent.indexOf('country.entityType !== "country"');
    const specialIdx = pageContent.indexOf('t("specialStatusBadge")', ternaryStart);
    const sovereignIdx = pageContent.indexOf('t("sovereignEntityBadge")', ternaryStart);
    expect(specialIdx).toBeGreaterThan(-1);
    expect(sovereignIdx).toBeGreaterThan(-1);
    expect(specialIdx).toBeLessThan(sovereignIdx);
  });

  it("resolves every PR #133 fix-round CountryDetail key to a non-empty string in both locales (TEST133-I2)", () => {
    const tr = JSON.parse(readFileSync(new URL("../../messages/tr.json", import.meta.url), "utf8"));
    const en = JSON.parse(readFileSync(new URL("../../messages/en.json", import.meta.url), "utf8"));
    const catalogues = { tr, en } as const;

    // The 60 keys of plan.md §2.5's derived inventory (58 addresses; the coordinate row
    // carries 4 keys and labelCapital serves 2 rows, so 58 rows -> 60 distinct keys).
    const inventoryKeys = [
      "islandChipLabel",
      "landNeighboursChip",
      "kpiSourceLabel",
      "kpiLandNeighboursLabel",
      "kpiIslandNeighbourValue",
      "kpiNeighbourCountriesValue",
      "kpiCoordinatesLabel",
      "coordinateNorth",
      "coordinateSouth",
      "coordinateEast",
      "coordinateWest",
      "kpiCurrencyLabel",
      "sectionNavAriaLabel",
      "sectionNavLabel",
      "sectionNavLocation",
      "sectionNavClimateHydrography",
      "sectionNavGovernance",
      "sectionNavBorders",
      "sectionNavSources",
      "physicalGeographyBadge",
      "quickFactContinentRegion",
      "quickFactCapitalCoordinates",
      "quickFactNotSpecified",
      "quickFactCurrency",
      "quickFactOfficialLanguages",
      "labelCapital",
      "spatialStatusLabel",
      "spatialIslandBoundaries",
      "spatialLandBorderCount",
      "unSubregionLabel",
      "climateHydrographyBadge",
      "climateBeltsBadge",
      "hydrographyResourcesBadge",
      "administrativeStructureBadge",
      "sovereigntyStatusBadge",
      "governanceStructureBadge",
      "governanceStructureHeading",
      "politicalLegalStatusBadge",
      "politicalLegalStatusHeading",
      "settlementBadge",
      "settlementHeading",
      "economyBadge",
      "economyHeading",
      "identityCardTitle",
      "identityRowNameTr",
      "identityRowNameEn",
      "identityRowPopulation",
      "identityRowArea",
      "identityRowGovernmentForm",
      "identityRowCurrency",
      "identityRowOfficialLanguages",
      "identityRowContinentSubregion",
      "identityRowIsoCodes",
      "identityRowNeighbourCount",
      "identityIslandNeighbourValue",
      "identityLandNeighbours",
      "bordersRegionalBadge",
      "neighboursHelperWithNeighbours",
      "neighboursHelperIsland",
      "neighbourFlagAlt",
    ];
    // §5.2.1's three intro-fallback keys, for the two non-country rows (GL, AQ).
    const introKeys = [
      "introFallbackNonCountryPopulation",
      "introFallbackNonCountryArea",
      "introFallbackNonCountryContinent",
    ];
    // §5.4's `A11Y133-M1` remedy — restores a literal the diff REMOVED, so it is deliberately
    // not part of the derived-inventory list above (that list is additions, not restorations).
    const restoredKeys = ["landformHeadingWithLocation"];
    // The 11 keys this diff already added (before this fix round) and kept.
    const keptKeys = [
      "sovereignEntityBadge",
      "specialStatusBadge",
      "climateHydrographyGroupHeading",
      "continentExploreLink",
      "administrativeGroupHeading",
      "governanceFallback",
      "officialStatusLabel",
      "officialLanguagesLabel",
      "islandCountryHeading",
      "islandCountryBody",
      "islandCountryCta",
    ];
    // The 4 hero-card title keys this round-2 fix adds (SOV133R2-NEW-M3 / FEN133R2-NEW-M1):
    // the card subtitle labels were already next-intl, the titles were not, so an EN reader
    // saw a Turkish title over an English subtitle. Moving the titles closes that mismatch.
    const round2Keys = [
      "kpiPopulationTitle",
      "kpiAreaTitle",
      "kpiCapitalTitle",
      "kpiGovernmentFormTitle",
    ];
    const allKeys = [...inventoryKeys, ...introKeys, ...restoredKeys, ...keptKeys, ...round2Keys];
    expect(allKeys.length).toBe(79);
    expect(new Set(allKeys).size).toBe(79);

    for (const [locale, messages] of Object.entries(catalogues)) {
      const countryDetail = messages.CountryDetail as Record<string, unknown>;
      for (const key of allKeys) {
        expect(typeof countryDetail[key], `${locale}.json CountryDetail.${key}`).toBe("string");
        expect(
          (countryDetail[key] as string).length,
          `${locale}.json CountryDetail.${key} is empty`,
        ).toBeGreaterThan(0);
      }
      // The deleted key must not silently regress back in.
      expect(countryDetail.neighborsGroupHeading).toBeUndefined();
    }
  });

  it("pins the three round-2 sovereignty gates as exact source substrings — a refactor that changes any of them must fail this suite (SOV133R2-NEW-I2)", () => {
    const pageUrl = new URL("../../app/[locale]/v2/dunya/[slug]/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");

    // (1) The special-geography predicate — gates the island-country framing (heading,
    // body, chip, spatial-status row) off for the four contested/special rows (Güney
    // Kıbrıs Rum Yönetimi, KKTC, Tayvan, Antarktika) so it is never asserted for them.
    expect(pageContent).toContain(
      'const isSpecialGeography = isSpecialStatus || country.entityType === "special";',
    );

    // (2) The neighbours-section suppression — silences the whole borders section rather
    // than rendering a false "no land border" claim, both for the four special-geography
    // rows AND for the divergent state where the contract's count and the resolved array
    // disagree (VALB133R2-NEW-I1's remedy).
    expect(pageContent).toContain(
      "  const showsNeighbourSection =\n" +
        "    !(isSpecialGeography && country.neighborCount === 0) &&\n" +
        "    !(country.neighborCount > 0 && neighbors.length === 0);",
    );

    // (3) The EN neighbour-flag suppression — hides a contested neighbour's flag on the
    // English page while leaving it visible (with the badge, SOV133R2-NEW-I1) on Turkish.
    expect(pageContent).toContain(
      "const showsNeighbourFlag = hasFlag(nb.iso) && (isTr || !nbIsSpecialStatus);",
    );
  });
});
