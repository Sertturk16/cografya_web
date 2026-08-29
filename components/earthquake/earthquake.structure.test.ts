import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * This repo's vitest environment is `node`, and the map/list/badge are plain, hook-free
 * components while the attribution block is an async server component — none of them can be
 * RENDERED here. The honest guard at this level is the source symbol, scoped to the
 * obligations `deprem-sayfalari` plan §5.6/§5.7/§5.8/§5.13 name explicitly.
 *
 * Every assertion below is about STRUCTURE — an absence, a wrapper, a reference to a shared
 * token/helper. None is about a fact or a wording choice.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Source with comments removed, matching `air-pollution.structure.test.ts`'s own reasoning:
 *  a docblock explaining WHY there is no raw hex/no `"use client"` contains those very words. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const map = read("./earthquake-map.tsx");
const list = read("./earthquake-list.tsx");
const badge = read("./magnitude-badge.tsx");
const attribution = read("./earthquake-attribution.tsx");
const filters = read("./earthquake-filters.tsx");
const mapCode = code(map);
const listCode = code(list);
const badgeCode = code(badge);
const attributionCode = code(attribution);

describe("EarthquakeMap / EarthquakeList / MagnitudeBadge are hook-free (§5.5's dual-context requirement)", () => {
  it('ships no "use client" in the map, list or badge', () => {
    for (const source of [mapCode, listCode, badgeCode]) {
      expect(source).not.toMatch(/["']use client["']/);
    }
  });

  it("calls no server-only next-intl hook — the presentational split that lets the client filter island reuse them", () => {
    for (const source of [mapCode, listCode, badgeCode]) {
      expect(source).not.toMatch(/getTranslations|next-intl\/server/);
      expect(source).not.toMatch(/useTranslations/);
    }
  });

  it("EarthquakeFilters IS the client island — positive control for the check above", () => {
    // Without this, the three absence checks report clean for free if the regex itself were
    // broken; asserting the pattern DOES fire on the one file that should carry it proves the
    // pattern can see what it is looking for.
    expect(filters).toMatch(/["']use client["']/);
  });
});

describe("EarthquakeMap draws magnitude via the shared token set, never a raw hex (§5.6)", () => {
  it("references the magnitude bucket helper rather than inventing its own thresholds", () => {
    expect(mapCode).toMatch(/magnitudeBucket\(/);
    expect(mapCode).toMatch(/MAGNITUDE_MARKER_RADIUS/);
  });

  it("carries no raw hex colour literal — every fill comes from a CSS Module class", () => {
    expect(mapCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("draws no per-marker text label — up to 200 events would recreate the word-cloud MarineMap rejects", () => {
    expect(mapCode).not.toMatch(/placePointLabels|frameForLabelledPoints|<text\b/);
  });

  it("gives each marker exactly one accessible <title>, with the single-em-dash shape (§17 density limit)", () => {
    expect(mapCode).toMatch(/<title>\{marker\.accessibleName\}<\/title>/);
    const match = /accessibleName: `([^`]*)`/.exec(map);
    expect(match).not.toBeNull();
    const emDashCount = (match?.[1]?.match(/—/g) ?? []).length;
    expect(emDashCount).toBe(1);
  });
});

describe("MagnitudeBadge never encodes magnitude by colour alone (DESIGN §6.1 rule 3)", () => {
  it("always prints the numeric magnitude label, not just a colour swatch", () => {
    expect(badgeCode).toMatch(/M \{label\}/);
  });
});

describe("EarthquakeList's bindingKind sentence is gated, never printed for every row (§5.7)", () => {
  it("gates the binding note on bindingSentenceKey, never a naive province sentence for every row", () => {
    expect(listCode).toMatch(/bindingSentenceKey\(event\.bindingKind\)/);
    // The gate must require BOTH a non-null key AND a resolved province — losing either half
    // would either misfire on "inside" rows or print a sentence with no real place name.
    expect(listCode).toMatch(/key !== null && province !== null/);
  });

  it('renders no literal "X ili yakınında"/"an earthquake in" location claim', () => {
    // The exact wrong sentence shape §5.7 exists to prevent — a naive province-location
    // claim would defeat the whole gate even while the gate itself is present. Checked
    // against COMMENT-STRIPPED source: the docblock above quotes the forbidden shape as a
    // negative example, which would otherwise self-trigger this exact assertion
    // (`air-pollution.structure.test.ts`'s own documented trap).
    expect(listCode).not.toMatch(/earthquake (occurred|happened) in/i);
    expect(listCode).not.toMatch(/'?te deprem/i);
  });
});

describe("EarthquakeAttribution renders API strings verbatim, never re-authors them (§5.8)", () => {
  it("reads requiredNoticeTr/regulationReference/disclaimerTr from props, never hardcodes them", () => {
    expect(attributionCode).toMatch(/attribution\.requiredNoticeTr/);
    expect(attributionCode).toMatch(/attribution\.regulationReference/);
    expect(attributionCode).toMatch(/\{disclaimerTr\}/);
    // No hardcoded provider sentence anywhere in this file's own source — the string must
    // come from the payload, never be minted here.
    expect(attributionCode).not.toMatch(/Kaynak: T\.C\./);
  });

  it('marks every TR-only string lang="tr" — including on the EN page (WCAG 3.1.2)', () => {
    expect(attributionCode).toMatch(/lang="tr"[\s\S]{0,80}attribution\.requiredNoticeTr/);
    expect(attributionCode).toMatch(/lang="tr"[\s\S]{0,80}\{disclaimerTr\}/);
  });

  it("carries no client directive — attribution never changes with the filter island's re-fetch", () => {
    expect(attributionCode).not.toMatch(/["']use client["']/);
  });
});
