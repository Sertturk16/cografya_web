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

  it("enforces locale-aware flag gating and synchronizes special status set in v2/dunya (SOV125-C1, SOV124-I1, RV133R4-NEW-I1)", () => {
    const pageUrl = new URL("../../app/[locale]/v2/dunya/page.tsx", import.meta.url);
    const pageContent = readFileSync(pageUrl, "utf8");

    // Must suppress flags in EN for special-status rows per DEC 2026-08-08h and DEC 2026-09-03a md.2
    expect(pageContent).toContain(
      'const flagVisible = hasFlagAsset && (!isSpecialStatus || locale === "tr");',
    );

    // (Amendment 2, RV133R4-NEW-I1) flagVisible's own locale condition above is correct and untouched.
    // This pins what it READS: a locale fold folded in HERE instead — the sibling of the same fold
    // round 2/3/4 each found one address lower on the country-detail page — would slip the pin above
    // (flagVisible's own line does not change) while breaking every EN row's flag/note symmetry.
    expect(pageContent).toContain(
      "const isSpecialStatus = SPECIAL_STATUS_ISO_CODES.has(c.isoCode.toUpperCase());",
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
      // (Bounded close-out, SOV133R4-NEW-I1) The two checks above match TEXT PRESENCE, not which
      // definition the name `SPECIAL_STATUS_ISO_CODES` actually binds to. An aliased re-import
      // (`SPECIAL_STATUS_ISO_CODES as _SPECIAL_STATUS_ISO_CODES`) plus a page-local, locale-gated
      // `const SPECIAL_STATUS_ISO_CODES = isTr ? _SPECIAL_STATUS_ISO_CODES : new Set<string>();`
      // satisfies both checks above without the identifier ever resolving through the real
      // import — this loop covers BOTH consumers (`pageContent` = the hub page's own
      // declaration at its :63, `slugContent` = the slug page's `nbIsSpecialStatus` at its
      // :1071), so pinning the exact, unaliased import line here closes the binding gap for
      // both addresses at once.
      expect(content).toContain(
        'import { SPECIAL_STATUS_ISO_CODES } from "@/lib/geo/special-status-isos";',
      );
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

  it("pins the three round-2 sovereignty gates, their call sites, AND the two upstream booleans that feed them — a refactor that changes any of them, at their declaration, at any place the page reads them, or at the input each declaration reads, must fail this suite (SOV133R2-NEW-I2, SOV133R3-NEW-I1, FEN133R3-NEW-M2, RV133R4-NEW-I1)", () => {
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

    // (SOV133R3-NEW-I1 / FEN133R3-NEW-M2) The three pins above lock only the DECLARATION line of
    // each gate. The page reads these gates at further call sites the declaration pin cannot
    // reach — including two call sites this PR's own round-2 fix round created. Pin the call
    // sites too, in the idiom lib/geo/sovereignty.test.ts:96-103/118-121 already established for
    // the v1 page: a call-site COUNT plus a gated-use pattern, comments stripped first so a
    // left-behind comment cannot satisfy a raw-text scan after the real code is deleted.
    const strippedPageContent = pageContent
      .replace(/\r\n/g, "\n")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
      .replace(/^[ \t]*\/\/.*$/gm, " ");

    // The neighbour-card special-status badge must never be gated on locale again
    // (SOV133R2-NEW-I1's regression). Checked before the count below so a re-added `isTr &&`
    // fails on THIS line, not on the count.
    expect(strippedPageContent).not.toMatch(/isTr\s*&&\s*nbIsSpecialStatus/);
    // ...and it has exactly its two known call sites (the "link" and "text" neighbour branches),
    // ungated.
    expect(strippedPageContent.match(/\{nbIsSpecialStatus && \(/g) ?? []).toHaveLength(2);

    // The EN neighbour-flag suppression gate: exactly its two known call sites.
    expect(strippedPageContent.match(/\{showsNeighbourFlag && \(/g) ?? []).toHaveLength(2);

    // The neighbours-section suppression gate: exactly its two known call sites (the quicknav
    // chip and the section itself).
    expect(strippedPageContent.match(/\{showsNeighbourSection && \(/g) ?? []).toHaveLength(2);

    // The four remaining isSpecialGeography call sites the declaration pin does not reach.
    expect(strippedPageContent).toMatch(/isSpecialGeography\s*\?\s*null\s*:\s*\(/); // hero empty-neighbour chip
    expect(strippedPageContent).toMatch(
      /isSpecialGeography\s*\?\s*"0"\s*:\s*t\("kpiIslandNeighbourValue"\)/,
    ); // hero KPI land-neighbours value
    expect(strippedPageContent).toContain(
      "{!(isSpecialGeography && country.neighborCount === 0) && (",
    ); // spatial-status row suppression (FEN133R3-NEW-M2)
    expect(strippedPageContent).toMatch(
      /isSpecialGeography\s*\?\s*"0"\s*:\s*t\("identityIslandNeighbourValue"\)/,
    ); // identity-card neighbour-count row

    // (Amendment 1, RV133R4-NEW-I1, §5.1.1-§5.1.2 — APPENDED after the 8 assertions above; none
    // of the 8 moved position, per the validator's own confirmation, §0.) The 8 pins above guard
    // the three DERIVED gates and their call sites. They do not guard what feeds those gates: the
    // two booleans the page computes fresh at every read. `nbIsSpecialStatus` (§5.1.2) IS its own
    // chain's origin already — a raw Set.has() call, no further function indirection to hide a
    // locale gate in. `isSpecialStatus` (§5.1.1) is NOT its chain's origin — see
    // lib/geo/sovereignty.test.ts's own new pin (§5.1.3) for the one link still further up.
    expect(strippedPageContent).toContain(
      "const isSpecialStatus = isSpecialStatusRow(country.sovereigntyNoteTr);",
    ); // §5.1.1 — RV133R4-NEW-I1
    expect(strippedPageContent).toContain(
      "const nbIsSpecialStatus = SPECIAL_STATUS_ISO_CODES.has(nb.iso.toUpperCase());",
    ); // §5.1.2 — RV133R4-NEW-I1

    // (Bounded close-out, SOV133R4-NEW-I1) The §5.1.1 pin above locks the CALL SITE's own text —
    // not which definition the name `isSpecialStatusRow` resolves to. Removing the name from the
    // import and adding a page-local, same-named function (closing over `isTr`, already in scope)
    // leaves the call-site line's text byte-identical while the runtime behaviour regresses on
    // EN only. Pin the import statement itself, unaliased, so that construction fails HERE.
    expect(strippedPageContent).toContain(
      'import { isSpecialStatusRow, showsCountryFlag, showsSovereigntyNote } from "@/lib/geo/sovereignty";',
    ); // binding pin — SOV133R4-NEW-I1
  });
});
